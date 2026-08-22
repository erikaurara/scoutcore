import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const allowedCategories = new Set(['Game Thread', 'Analysis', 'Hot Take']);
const allowedReportReasons = new Set(['explicit', 'harassment', 'violence', 'hate', 'spam', 'other']);

class ModerationServiceError extends Error {
  providerStatus: number;
  providerCode: string | null;
  retryAfterSeconds: number | null;

  constructor(
    message: string,
    providerStatus: number,
    providerCode: string | null,
    retryAfterSeconds: number | null,
  ) {
    super(message);
    this.name = 'ModerationServiceError';
    this.providerStatus = providerStatus;
    this.providerCode = providerCode;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const safeProviderCode = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[a-z0-9_.-]{1,80}$/.test(normalized) ? normalized : null;
};

const classifyProviderFailure = (
  payload: any,
  status: number,
  retrySeconds: number | null,
) => {
  const providerCode = safeProviderCode(payload?.error?.code);
  const providerType = safeProviderCode(payload?.error?.type);
  const providerMessage = String(payload?.error?.message || '').trim().toLowerCase().slice(0, 600);
  const searchable = [providerCode, providerType, providerMessage].filter(Boolean).join(' ');

  const accountInactive = /account.{0,40}(?:not active|inactive|deactivat)|billing details/.test(providerMessage);
  const projectAccessFailure = /(?:organization|project).{0,80}(?:access|member|not found|not active)|(?:not authorized|not permitted|does not have access)/.test(providerMessage);
  const quotaFailure = /(?:insufficient|exceeded|reached).{0,40}(?:credit|quota|spend|usage|limit)|(?:credit|quota|spend|usage)[_-]?limit|billing_hard_limit/.test(searchable);
  const rateFailure = /rate[_ -]?limit|too_many_requests|requests_per_minute|tokens_per_minute/.test(searchable);
  const malformedRequest = status === 400 || status === 422 || /invalid.{0,30}(?:input|parameter|request)|unsupported.{0,30}(?:input|parameter|model)|missing.{0,30}(?:input|parameter)/.test(providerMessage);

  const supportCode = accountInactive
    ? 'moderation_account_inactive'
    : projectAccessFailure
      ? 'moderation_project_access'
      : quotaFailure
        ? 'moderation_project_limit'
        : rateFailure || (status === 429 && retrySeconds !== null)
          ? 'moderation_rate_limit'
          : malformedRequest
            ? 'moderation_request_invalid'
            : providerCode && providerCode !== 'invalid_request_error'
              ? providerCode
              : providerType && providerType !== 'invalid_request_error'
                ? providerType
                : status === 429
                  ? 'moderation_provider_inactive'
                  : `moderation_http_${status}`;

  return {
    supportCode,
    providerCode,
    providerType,
    accountInactive,
    projectAccessFailure,
    quotaFailure,
    rateFailure,
    malformedRequest,
  };
};

const retryAfterSeconds = (value: string | null) => {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) return Math.ceil(numeric);
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return null;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
};

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

const safeFileName = (value = '') => value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-90) || 'upload';

const flagReason = (result: any) => {
  const categories = result?.categories ?? {};
  const labels = Object.entries(categories)
    .filter(([, flagged]) => flagged === true)
    .map(([name]) => name.replaceAll('/', ' / '));
  return labels.length ? labels.join(', ') : 'content safety policy';
};

const customBlocklistHit = (text: string) => {
  const entries = (Deno.env.get('COMMUNITY_BLOCKLIST') || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  if (!entries.length) return null;
  const normalized = text.toLowerCase();
  return entries.find(term => normalized.includes(term)) ?? null;
};

async function runModeration(text: string, imageUrl?: string | null) {
  const blockedTerm = customBlocklistHit(text);
  if (blockedTerm) return { flagged: true, reason: 'blocked abusive language' };

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('Community moderation is not configured yet.');

  // OpenAI accepts a plain string for text-only moderation. Use the multimodal
  // object form only when an image is actually present.
  const input: string | any[] = imageUrl
    ? [
      { type: 'text', text },
      { type: 'image_url', image_url: { url: imageUrl } },
    ]
    : text;

  const requestBody = JSON.stringify({ model: 'omni-moderation-latest', input });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });

    const payload = await response.json().catch(() => null);
    if (response.ok) {
      const result = payload?.results?.[0];
      return { flagged: Boolean(result?.flagged), reason: flagReason(result), raw: result };
    }

    const retrySeconds = retryAfterSeconds(response.headers.get('Retry-After'));
    const failure = classifyProviderFailure(payload, response.status, retrySeconds);
    const { supportCode, quotaFailure, rateFailure } = failure;
    const retryableRateFailure = response.status === 429 && !quotaFailure && (rateFailure || retrySeconds !== null);

    // A short, bounded retry handles a genuine temporary throttle without retrying
    // quota or project-access failures that require account-owner action.
    if (attempt === 0 && retryableRateFailure && (retrySeconds === null || retrySeconds <= 3)) {
      const delay = retrySeconds === null
        ? 900 + Math.floor(Math.random() * 350)
        : Math.max(500, retrySeconds * 1000 + Math.floor(Math.random() * 250));
      await wait(delay);
      continue;
    }

    const message = response.status === 401 || response.status === 403
      ? 'The Community safety service rejected its server key. Please contact IXMetrics support.'
      : response.status === 429 && (failure.accountInactive || failure.projectAccessFailure || quotaFailure || (!rateFailure && retrySeconds === null))
        ? 'The Community safety service is inactive because its API access or project limit needs attention.'
        : response.status === 429
          ? 'The Community safety service is busy right now. Please try again shortly.'
          : response.status >= 500
            ? 'The Community safety service is temporarily unavailable. Please try again shortly.'
            : 'The Community safety service could not review this post.';
    console.error('community moderation provider failure', {
      providerStatus: response.status,
      supportCode,
      providerCode: failure.providerCode,
      providerType: failure.providerType,
      retryAfterSeconds: retrySeconds,
    });
    throw new ModerationServiceError(message, response.status, supportCode, retrySeconds);
  }

  throw new ModerationServiceError(
    'The Community safety service is temporarily unavailable. Please try again shortly.',
    503,
    'moderation_retry_exhausted',
    null,
  );
}

async function scanVideo(url: string, text: string) {
  const endpoint = Deno.env.get('VIDEO_MODERATION_URL');
  if (!endpoint) return { available: false, safe: false, reason: 'Dedicated video safety review is not configured.' };
  const token = Deno.env.get('VIDEO_MODERATION_TOKEN');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ url, text }),
  });
  if (!response.ok) throw new Error(`Video moderation service failed (${response.status}).`);
  const payload = await response.json();
  return { available: true, safe: payload?.safe === true, reason: payload?.reason || 'video safety review' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRole) return json({ ok: false, error: 'Server configuration is incomplete.' }, 500);

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ ok: false, error: 'Sign in required.' }, 401);

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const service = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  const user = userData.user;
  if (userError || !user) return json({ ok: false, error: 'Invalid session.' }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'Invalid request.' }, 400); }
  const action = String(body?.action || '');
  const author = String(user.user_metadata?.display_name || user.email?.split('@')[0] || 'IXMetrics fan').slice(0, 28);

  const warn = async (reason: string, contentType: 'post' | 'reply' | 'media', contentId?: string | null, userId = user.id) => {
    await service.from('community_warnings').insert({ user_id: userId, reason: reason.slice(0, 240), content_type: contentType, content_id: contentId || null });
  };

  const sendCommunityWarning = async (targetUserId: string, reason: string, contentType: 'post' | 'reply' | 'media', contentId: string) => {
    const safeReason = reason.trim().slice(0, 180) || 'Please review the IXMetrics Community rules before posting again.';
    await warn(safeReason, contentType, contentId, targetUserId);
    const [{ data: recipient }, { data: actor }] = await Promise.all([
      service.from('social_profiles').select('public_id').eq('user_id', targetUserId).maybeSingle(),
      service.from('social_profiles').select('public_id').eq('user_id', user.id).maybeSingle(),
    ]);
    if (recipient?.public_id) {
      const { error } = await service.from('scoutcore_notifications').insert({
        recipient_profile_id: recipient.public_id,
        actor_profile_id: actor?.public_id ?? recipient.public_id,
        actor_display_name: 'IXMetrics Community',
        actor_avatar_url: null,
        kind: 'community_warning',
        title: 'IXMetrics Community warning',
        body: safeReason,
        action_target: 'community',
        entity_id: contentId,
      });
      if (error) throw error;
    }
  };

  const moderateContent = async (targetType: 'post' | 'comment', targetId: string, decision: 'remove' | 'warn' | 'remove_and_warn', reason: string) => {
    const table = targetType === 'comment' ? 'community_comments' : 'community_posts';
    const { data: target, error } = await service.from(table).select('*').eq('id', targetId).maybeSingle();
    if (error) throw error;
    if (!target) return { found: false };
    const shouldRemove = decision === 'remove' || decision === 'remove_and_warn';
    const shouldWarn = decision === 'warn' || decision === 'remove_and_warn';
    if (shouldRemove) {
      if (targetType === 'post') {
        if (target.media_path) await service.storage.from('community-media').remove([target.media_path]);
        if (target.quarantine_path) await service.storage.from('community-quarantine').remove([target.quarantine_path]);
      }
      const { error: updateError } = await service.from(table).update({
        moderation_status: 'removed',
        moderation_reason: reason,
        moderation_checked_at: new Date().toISOString(),
        reviewed_by: user.id,
        ...(targetType === 'post' ? { media_path: null, quarantine_path: null } : {}),
      }).eq('id', targetId);
      if (updateError) throw updateError;
    }
    if (shouldWarn) {
      await sendCommunityWarning(target.user_id, reason, targetType === 'comment' ? 'reply' : target.media_path ? 'media' : 'post', targetId);
    }
    return { found: true };
  };

  const isCommunityAdmin = async () => {
    const { data, error } = await service
      .from('community_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  };

  const requireCommunityAdmin = async () => {
    if (!await isCommunityAdmin()) {
      return json({ ok: false, error: 'Community administrator access is required.' }, 403);
    }
    return null;
  };

  const finalizeApprovedMedia = async (ownerId: string, quarantinePath: string) => {
    const { data: file, error: downloadError } = await service
      .storage
      .from('community-quarantine')
      .download(quarantinePath);
    if (downloadError || !file) throw new Error('Unable to retrieve the pending media.');
    const finalPath = `${ownerId}/${crypto.randomUUID()}-${safeFileName(quarantinePath.split('/').pop())}`;
    const { error: uploadError } = await service
      .storage
      .from('community-media')
      .upload(finalPath, file, { contentType: file.type || undefined, upsert: false });
    if (uploadError) throw uploadError;
    await service.storage.from('community-quarantine').remove([quarantinePath]);
    return finalPath;
  };

  try {
    if (action === 'admin_status') {
      const isAdmin = await isCommunityAdmin();
      return json({
        ok: true,
        isAdmin,
        accessLevel: isAdmin ? 'admin' : 'standard',
        unlimited: isAdmin,
      });
    }

    if (action === 'get_review_queue') {
      const denied = await requireCommunityAdmin();
      if (denied) return denied;

      const [postResult, commentResult, reportResult] = await Promise.all([
        service.from('community_posts').select('*').in('moderation_status', ['pending', 'pending_review']).order('created_at', { ascending: true }).limit(100),
        service.from('community_comments').select('*').eq('moderation_status', 'pending').order('created_at', { ascending: true }).limit(200),
        service.from('community_reports').select('*').eq('status', 'open').order('created_at', { ascending: true }).limit(100),
      ]);
      if (postResult.error) throw postResult.error;
      if (commentResult.error) throw commentResult.error;
      if (reportResult.error) throw reportResult.error;

      const posts = await Promise.all((postResult.data || []).map(async (post: any) => {
        let mediaUrl: string | null = null;
        if (post.quarantine_path) {
          const signed = await service.storage.from('community-quarantine').createSignedUrl(post.quarantine_path, 600);
          mediaUrl = signed.data?.signedUrl ?? null;
        }
        return {
          id: post.id,
          author: post.author_name,
          title: post.title,
          body: post.body,
          category: post.category,
          mediaType: post.media_type,
          mediaUrl,
          createdAt: post.created_at,
        };
      }));

      const reportTargets = await Promise.all((reportResult.data || []).map(async (report: any) => {
        const table = report.comment_id ? 'community_comments' : 'community_posts';
        const targetId = report.comment_id || report.post_id;
        const { data: target } = await service.from(table).select('*').eq('id', targetId).maybeSingle();
        let mediaUrl: string | null = null;
        if (target?.media_path) {
          const signed = await service.storage.from('community-media').createSignedUrl(target.media_path, 600);
          mediaUrl = signed.data?.signedUrl ?? null;
        }
        return {
          id: report.id,
          targetType: report.comment_id ? 'comment' : 'post',
          targetId,
          postId: report.comment_id ? target?.post_id ?? null : report.post_id,
          reason: report.reason,
          details: report.details,
          createdAt: report.created_at,
          target: target ? {
            author: target.author_name,
            title: target.title || null,
            body: target.body,
            mediaType: target.media_type || null,
            mediaUrl,
            moderationStatus: target.moderation_status || null,
          } : null,
        };
      }));

      return json({
        ok: true,
        posts,
        comments: (commentResult.data || []).map((comment: any) => ({
          id: comment.id,
          postId: comment.post_id,
          author: comment.author_name,
          body: comment.body,
          createdAt: comment.created_at,
        })),
        reports: reportTargets,
      });
    }

    if (action === 'review_submission') {
      const denied = await requireCommunityAdmin();
      if (denied) return denied;
      const targetType = body?.targetType === 'comment' ? 'comment' : 'post';
      const targetId = String(body?.targetId || '');
      const decision = body?.decision === 'approve' ? 'approve' : body?.decision === 'reject' ? 'reject' : '';
      if (!targetId || !decision) return json({ ok: false, error: 'Invalid review decision.' }, 400);

      if (targetType === 'comment') {
        const { data: comment, error } = await service.from('community_comments').select('*').eq('id', targetId).maybeSingle();
        if (error) throw error;
        if (!comment || comment.moderation_status !== 'pending') return json({ ok: false, error: 'This reply is no longer waiting for review.' }, 409);
        const { error: updateError } = await service.from('community_comments').update({
          moderation_status: decision === 'approve' ? 'approved' : 'rejected',
          moderation_reason: decision === 'reject' ? 'Rejected by a Community administrator.' : null,
          moderation_checked_at: new Date().toISOString(),
          reviewed_by: user.id,
        }).eq('id', targetId).eq('moderation_status', 'pending');
        if (updateError) throw updateError;
        return json({ ok: true, message: decision === 'approve' ? 'Reply approved.' : 'Reply rejected.' });
      }

      const { data: post, error } = await service.from('community_posts').select('*').eq('id', targetId).maybeSingle();
      if (error) throw error;
      if (!post || !['pending', 'pending_review'].includes(post.moderation_status)) {
        return json({ ok: false, error: 'This post is no longer waiting for review.' }, 409);
      }

      let finalPath: string | null = null;
      if (decision === 'approve' && post.quarantine_path) {
        finalPath = await finalizeApprovedMedia(post.user_id, post.quarantine_path);
      } else if (decision === 'reject' && post.quarantine_path) {
        await service.storage.from('community-quarantine').remove([post.quarantine_path]);
      }
      const { error: updateError } = await service.from('community_posts').update({
        moderation_status: decision === 'approve' ? 'approved' : 'rejected',
        moderation_reason: decision === 'reject' ? 'Rejected by a Community administrator.' : null,
        moderation_checked_at: new Date().toISOString(),
        reviewed_by: user.id,
        media_path: finalPath,
        quarantine_path: null,
      }).eq('id', targetId).in('moderation_status', ['pending', 'pending_review']);
      if (updateError) throw updateError;
      return json({ ok: true, message: decision === 'approve' ? 'Post approved and published.' : 'Post rejected.' });
    }

    if (action === 'review_report') {
      const denied = await requireCommunityAdmin();
      if (denied) return denied;
      const reportId = String(body?.reportId || '');
      const allowedDecisions = new Set(['remove', 'warn', 'remove_and_warn', 'dismiss']);
      const decision = allowedDecisions.has(body?.decision) ? body.decision as 'remove' | 'warn' | 'remove_and_warn' | 'dismiss' : '';
      if (!reportId || !decision) return json({ ok: false, error: 'Invalid report decision.' }, 400);
      const { data: report, error } = await service.from('community_reports').select('*').eq('id', reportId).maybeSingle();
      if (error) throw error;
      if (!report || report.status !== 'open') return json({ ok: false, error: 'This report is no longer open.' }, 409);

      if (decision !== 'dismiss') {
        const targetId = report.comment_id || report.post_id;
        if (targetId) await moderateContent(report.comment_id ? 'comment' : 'post', targetId, decision, String(report.reason || 'Community rules violation.'));
      }
      const { error: reportUpdateError } = await service.from('community_reports').update({
        status: decision === 'dismiss' ? 'reviewed_safe' : 'closed',
        resolved_at: new Date().toISOString(),
      }).eq('id', reportId).eq('status', 'open');
      if (reportUpdateError) throw reportUpdateError;
      return json({ ok: true, message: decision === 'dismiss' ? 'Report dismissed.' : decision === 'warn' ? 'User warned.' : decision === 'remove_and_warn' ? 'Content deleted and user warned.' : 'Content deleted.' });
    }

    if (action === 'admin_moderate_content') {
      const denied = await requireCommunityAdmin();
      if (denied) return denied;
      const targetType = body?.targetType === 'comment' ? 'comment' : body?.targetType === 'post' ? 'post' : '';
      const targetId = String(body?.targetId || '');
      const decision = ['remove', 'warn', 'remove_and_warn'].includes(body?.decision) ? body.decision as 'remove' | 'warn' | 'remove_and_warn' : '';
      const reason = String(body?.reason || 'Please review the IXMetrics Community rules before posting again.').trim().slice(0, 180);
      if (!targetType || !targetId || !decision) return json({ ok: false, error: 'Invalid moderation action.' }, 400);
      const result = await moderateContent(targetType, targetId, decision, reason);
      if (!result.found) return json({ ok: false, error: 'This content no longer exists.' }, 404);
      return json({ ok: true, message: decision === 'warn' ? 'User warned.' : decision === 'remove_and_warn' ? 'Content deleted and user warned.' : 'Content deleted.' });
    }

    if (action === 'publish_post') {
      const title = String(body?.title || '').trim().slice(0, 90);
      const textBody = String(body?.body || '').trim().slice(0, 700);
      const category = String(body?.category || 'Game Thread');
      const mediaPath = body?.mediaPath ? String(body.mediaPath) : null;
      const mediaType = body?.mediaType === 'image' || body?.mediaType === 'video' ? body.mediaType : null;

      if (!title || (!textBody && !mediaPath)) return json({ ok: false, error: 'Add a title and either text, a photo, or a video.' }, 400);
      if (!allowedCategories.has(category)) return json({ ok: false, error: 'Invalid category.' }, 400);
      if (mediaPath && !mediaPath.startsWith(`${user.id}/`)) return json({ ok: false, error: 'Invalid media path.' }, 403);

      if (mediaPath) {
        const { data, error } = await service.storage.from('community-quarantine').createSignedUrl(mediaPath, 300);
        if (error || !data?.signedUrl) return json({ ok: false, error: 'Unable to review the uploaded media.' }, 400);
      }

      const blockedTerm = customBlocklistHit(`${title}\n${textBody}`);
      if (blockedTerm) {
        if (mediaPath) await service.storage.from('community-quarantine').remove([mediaPath]);
        return json({ ok: false, warning: 'This post was blocked by the Community safety rules.' });
      }

      if (mediaType === 'video') {
        const { error: insertError } = await service.from('community_posts').insert({
          user_id: user.id,
          author_name: author,
          title,
          body: textBody,
          category,
          tag: 'MLB',
          media_path: null,
          quarantine_path: mediaPath,
          media_type: mediaType,
          moderation_status: 'pending_review',
        });
        if (insertError) throw insertError;
        return json({
          ok: true,
          pending: true,
          message: 'Video submitted privately. A Community administrator must approve it before it appears publicly.',
        });
      }

      const finalPath = mediaPath ? await finalizeApprovedMedia(user.id, mediaPath) : null;

      const { error: insertError } = await service.from('community_posts').insert({
        user_id: user.id,
        author_name: author,
        title,
        body: textBody,
        category,
        tag: 'MLB',
        media_path: finalPath,
        quarantine_path: null,
        media_type: mediaType,
        moderation_status: 'approved',
        moderation_checked_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;
      return json({
        ok: true,
        approved: true,
        message: 'Posted to the Community.',
      });
    }

    if (action === 'reply') {
      const postId = String(body?.postId || '');
      const parentCommentId = body?.parentCommentId ? String(body.parentCommentId) : null;
      const reply = String(body?.body || '').trim().slice(0, 240);
      if (!postId || !reply) return json({ ok: false, error: 'Reply cannot be empty.' }, 400);
      if (customBlocklistHit(reply)) return json({ ok: false, warning: 'This reply was blocked by the Community safety rules.' });
      const { data: parentPost } = await service.from('community_posts').select('id').eq('id', postId).eq('moderation_status', 'approved').maybeSingle();
      if (!parentPost) return json({ ok: false, error: 'This post is not available for replies.' }, 404);
      const { error: insertError } = await service.from('community_comments').insert({
        post_id: postId,
        parent_comment_id: parentCommentId,
        user_id: user.id,
        author_name: author,
        body: reply,
        moderation_status: 'approved',
        moderation_checked_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;
      return json({
        ok: true,
        approved: true,
        message: 'Reply posted.',
      });
    }

    if (action === 'report') {
      const targetType = body?.targetType === 'comment' ? 'comment' : 'post';
      const targetId = String(body?.targetId || '');
      const reason = String(body?.reason || 'other');
      const details = String(body?.details || '').trim().slice(0, 300);
      if (!targetId || !allowedReportReasons.has(reason)) return json({ ok: false, error: 'Invalid report.' }, 400);

      const reportRow: any = { reporter_id: user.id, reason, details: details || null };
      if (targetType === 'comment') reportRow.comment_id = targetId;
      else reportRow.post_id = targetId;
      const { error: reportError } = await service.from('community_reports').insert(reportRow);
      if (reportError) throw reportError;
      return json({ ok: true, removed: false, message: 'Report received and queued for administrator review.' });
    }

    return json({ ok: false, error: 'Unknown action.' }, 400);
  } catch (error) {
    console.error('community-moderate error', error);
    if (error instanceof ModerationServiceError) {
      const status = error.providerStatus === 429 ? 429 : error.providerStatus >= 500 ? 503 : 502;
      return json({
        ok: false,
        error: error.message,
        errorCode: error.providerCode || `moderation_http_${error.providerStatus}`,
        retryAfterSeconds: error.retryAfterSeconds,
      }, status);
    }
    const serverCode = safeProviderCode((error as any)?.code);
    return json({
      ok: false,
      error: 'Community publishing failed on the server. Please try again.',
      errorCode: serverCode || 'community_server_error',
    }, 500);
  }
});
