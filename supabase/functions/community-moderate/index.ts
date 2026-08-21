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

  const input: any[] = [{ type: 'text', text }];
  if (imageUrl) input.push({ type: 'image_url', image_url: { url: imageUrl } });

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

    const providerCode = safeProviderCode(payload?.error?.code || payload?.error?.type);
    const retrySeconds = retryAfterSeconds(response.headers.get('Retry-After'));
    const quotaFailure = Boolean(providerCode && /credit|quota|spend|usage[_-]?limit|billing|insufficient/.test(providerCode));
    const rateFailure = Boolean(providerCode && /rate[_-]?limit|too_many_requests|requests_per_minute|tokens_per_minute/.test(providerCode));
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
      ? 'The Community safety service rejected its server key. Please contact ScoutCore support.'
      : response.status === 429 && (quotaFailure || (!rateFailure && retrySeconds === null))
        ? 'The Community safety service is inactive because its API access or project limit needs attention.'
        : response.status === 429
          ? 'The Community safety service is busy right now. Please try again shortly.'
          : response.status >= 500
            ? 'The Community safety service is temporarily unavailable. Please try again shortly.'
            : 'The Community safety service could not review this post.';
    console.error('community moderation provider failure', {
      providerStatus: response.status,
      providerCode: providerCode || `moderation_http_${response.status}`,
      retryAfterSeconds: retrySeconds,
    });
    throw new ModerationServiceError(message, response.status, providerCode, retrySeconds);
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
  const author = String(user.user_metadata?.display_name || user.email?.split('@')[0] || 'ScoutCore fan').slice(0, 28);

  const warn = async (reason: string, contentType: 'post' | 'reply' | 'media', contentId?: string | null, userId = user.id) => {
    await service.from('community_warnings').insert({ user_id: userId, reason: reason.slice(0, 240), content_type: contentType, content_id: contentId || null });
  };

  try {
    if (action === 'publish_post') {
      const title = String(body?.title || '').trim().slice(0, 90);
      const textBody = String(body?.body || '').trim().slice(0, 700);
      const category = String(body?.category || 'Game Thread');
      const mediaPath = body?.mediaPath ? String(body.mediaPath) : null;
      const mediaType = body?.mediaType === 'image' || body?.mediaType === 'video' ? body.mediaType : null;

      if (!title || (!textBody && !mediaPath)) return json({ ok: false, error: 'Add a title and either text, a photo, or a video.' }, 400);
      if (!allowedCategories.has(category)) return json({ ok: false, error: 'Invalid category.' }, 400);
      if (mediaPath && !mediaPath.startsWith(`${user.id}/`)) return json({ ok: false, error: 'Invalid media path.' }, 403);

      let signedUrl: string | null = null;
      if (mediaPath) {
        const { data, error } = await service.storage.from('community-quarantine').createSignedUrl(mediaPath, 300);
        if (error || !data?.signedUrl) return json({ ok: false, error: 'Unable to review the uploaded media.' }, 400);
        signedUrl = data.signedUrl;
      }

      const textToCheck = `${title}\n${textBody}`.trim();

      if (mediaType === 'video' && signedUrl) {
        const textCheck = await runModeration(textToCheck);
        if (textCheck.flagged) {
          await service.storage.from('community-quarantine').remove([mediaPath!]);
          await warn(textCheck.reason, 'media');
          return json({ ok: false, warning: 'This post was not published because it did not pass the community safety check. A warning was added to the account.' });
        }

        const videoCheck = await scanVideo(signedUrl, textToCheck);
        if (!videoCheck.available) {
          await service.from('community_media_queue').insert({
            user_id: user.id,
            author_name: author,
            title,
            body: textBody,
            category,
            quarantine_path: mediaPath,
            media_type: 'video',
            status: 'pending_review',
            reason: videoCheck.reason,
          });
          return json({ ok: true, pending: true, message: 'Video uploaded privately. It will not appear publicly until the dedicated video safety review approves it.' });
        }
        if (!videoCheck.safe) {
          await service.storage.from('community-quarantine').remove([mediaPath!]);
          await warn(videoCheck.reason, 'media');
          return json({ ok: false, warning: 'This video was removed by the safety system and a warning was added to the account.' });
        }
      } else {
        const moderation = await runModeration(textToCheck, mediaType === 'image' ? signedUrl : null);
        if (moderation.flagged) {
          if (mediaPath) await service.storage.from('community-quarantine').remove([mediaPath]);
          await warn(moderation.reason, mediaType ? 'media' : 'post');
          return json({ ok: false, warning: 'This post was not published because it did not pass the community safety check. A warning was added to the account.' });
        }
      }

      let finalPath: string | null = null;
      if (mediaPath) {
        const { data: file, error: downloadError } = await service.storage.from('community-quarantine').download(mediaPath);
        if (downloadError || !file) throw new Error('Unable to finalize approved media.');
        finalPath = `${user.id}/${crypto.randomUUID()}-${safeFileName(mediaPath.split('/').pop())}`;
        const { error: uploadError } = await service.storage.from('community-media').upload(finalPath, file, { contentType: file.type || undefined, upsert: false });
        if (uploadError) throw uploadError;
        await service.storage.from('community-quarantine').remove([mediaPath]);
      }

      const { error: insertError } = await service.from('community_posts').insert({
        user_id: user.id,
        author_name: author,
        title,
        body: textBody,
        category,
        tag: 'MLB',
        media_path: finalPath,
        media_type: mediaType,
        moderation_status: 'approved',
        moderation_checked_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;
      return json({ ok: true, approved: true });
    }

    if (action === 'reply') {
      const postId = String(body?.postId || '');
      const parentCommentId = body?.parentCommentId ? String(body.parentCommentId) : null;
      const reply = String(body?.body || '').trim().slice(0, 240);
      if (!postId || !reply) return json({ ok: false, error: 'Reply cannot be empty.' }, 400);
      const moderation = await runModeration(reply);
      if (moderation.flagged) {
        await warn(moderation.reason, 'reply');
        return json({ ok: false, warning: 'This reply was blocked by the safety system and a warning was added to the account.' });
      }
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
      return json({ ok: true, approved: true });
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
      const { data: reportData, error: reportError } = await service.from('community_reports').insert(reportRow).select('id').single();
      if (reportError) throw reportError;

      if (targetType === 'comment') {
        const { data: comment, error } = await service.from('community_comments').select('*').eq('id', targetId).single();
        if (error || !comment) return json({ ok: false, error: 'Reply not found.' }, 404);
        const moderation = await runModeration(String(comment.body || ''));
        if (moderation.flagged) {
          await service.from('community_comments').update({ moderation_status: 'removed', moderation_reason: moderation.reason, moderation_checked_at: new Date().toISOString() }).eq('id', targetId);
          await warn(moderation.reason, 'reply', targetId, comment.user_id);
          await service.from('community_reports').update({ status: 'auto_removed', resolved_at: new Date().toISOString() }).eq('id', reportData.id);
          return json({ ok: true, removed: true, message: 'Report received. The reply failed the safety re-check and was removed.' });
        }
        return json({ ok: true, removed: false, message: 'Report received. It passed the automatic re-check and is queued for human review.' });
      }

      const { data: post, error } = await service.from('community_posts').select('*').eq('id', targetId).single();
      if (error || !post) return json({ ok: false, error: 'Post not found.' }, 404);
      let mediaUrl: string | null = null;
      if (post.media_path && post.media_type === 'image') {
        const signed = await service.storage.from('community-media').createSignedUrl(post.media_path, 300);
        mediaUrl = signed.data?.signedUrl ?? null;
      }
      const moderation = await runModeration(`${post.title || ''}\n${post.body || ''}`, mediaUrl);
      if (moderation.flagged) {
        await service.from('community_posts').update({ moderation_status: 'removed', moderation_reason: moderation.reason, moderation_checked_at: new Date().toISOString() }).eq('id', targetId);
        if (post.media_path) await service.storage.from('community-media').remove([post.media_path]);
        await warn(moderation.reason, post.media_path ? 'media' : 'post', targetId, post.user_id);
        await service.from('community_reports').update({ status: 'auto_removed', resolved_at: new Date().toISOString() }).eq('id', reportData.id);
        return json({ ok: true, removed: true, message: 'Report received. The post failed the safety re-check and was removed.' });
      }
      return json({ ok: true, removed: false, message: 'Report received. It passed the automatic re-check and is queued for human review.' });
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
