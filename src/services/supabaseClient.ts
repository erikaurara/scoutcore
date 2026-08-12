import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://emjluyqkptfvinpdmalu.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_oz4VwsnHHGaGAiKbjAmaEg_TSSShVxU';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const rawSupabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

type Filter = { column: string; value: unknown };
type Sort = { column: string; ascending: boolean };

type SafeTableName =
  | 'community_posts'
  | 'community_comments'
  | 'community_likes'
  | 'community_reactions'
  | 'game_chat_messages'
  | 'game_event_reactions'
  | 'challenge_scores';

const safeTables = new Set<SafeTableName>([
  'community_posts',
  'community_comments',
  'community_likes',
  'community_reactions',
  'game_chat_messages',
  'game_event_reactions',
  'challenge_scores',
]);

const getFilter = (filters: Filter[], column: string) => filters.find((filter) => filter.column === column)?.value;

const compareValues = (left: unknown, right: unknown) => {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  const leftTime = typeof left === 'string' ? Date.parse(left) : Number.NaN;
  const rightTime = typeof right === 'string' ? Date.parse(right) : Number.NaN;
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return leftTime - rightTime;
  return String(left).localeCompare(String(right));
};

class PrivacyQuery {
  private operation: 'select' | 'delete' = 'select';
  private selectedColumns = '*';
  private filters: Filter[] = [];
  private sorts: Sort[] = [];
  private maxRows: number | null = null;
  private singleMode: 'single' | 'maybeSingle' | null = null;

  constructor(private table: SafeTableName) {}

  select(columns = '*') {
    this.operation = 'select';
    this.selectedColumns = columns;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.sorts.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(value: number) {
    this.maxRows = Math.max(0, Math.floor(value));
    return this;
  }

  range(from: number, to: number) {
    const start = Math.max(0, Math.floor(from));
    const size = Math.max(0, Math.floor(to) - start + 1);
    this.filters.push({ column: '__range_start__', value: start });
    this.maxRows = size;
    return this;
  }

  single() {
    this.singleMode = 'single';
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybeSingle';
    return this;
  }

  private async runSelect() {
    if (!rawSupabase) return { data: null, error: new Error('Supabase is not configured.') };

    const requestedLimit = this.maxRows ?? (this.table === 'community_comments' ? 700 : this.table === 'community_reactions' ? 5000 : this.table === 'community_likes' ? 3000 : this.table === 'challenge_scores' ? 1000 : 100);
    let response: any;

    if (this.table === 'community_posts') {
      response = await rawSupabase.rpc('get_community_posts_safe', { p_limit: requestedLimit });
    } else if (this.table === 'community_comments') {
      response = await rawSupabase.rpc('get_community_comments_safe', { p_limit: requestedLimit });
    } else if (this.table === 'community_likes') {
      response = await rawSupabase.rpc('get_community_likes_safe', { p_limit: requestedLimit });
    } else if (this.table === 'community_reactions') {
      response = await rawSupabase.rpc('get_community_reactions_safe', { p_limit: requestedLimit });
    } else if (this.table === 'game_chat_messages') {
      const gamePk = Number(getFilter(this.filters, 'game_pk'));
      if (!Number.isFinite(gamePk)) return { data: [], error: null };
      response = await rawSupabase.rpc('get_game_chat_messages_safe', { p_game_pk: gamePk, p_limit: requestedLimit });
    } else if (this.table === 'game_event_reactions') {
      const gamePk = Number(getFilter(this.filters, 'game_pk'));
      const eventKey = getFilter(this.filters, 'event_key');
      if (!Number.isFinite(gamePk) || typeof eventKey !== 'string') return { data: [], error: null };
      response = await rawSupabase.rpc('get_game_event_reactions_safe', { p_game_pk: gamePk, p_event_key: eventKey, p_limit: requestedLimit });
    } else {
      response = await rawSupabase.rpc('get_challenge_scores_safe', { p_limit: requestedLimit });
    }

    if (response.error) return response;
    let rows = Array.isArray(response.data) ? [...response.data] : [];

    const effectiveFilters = this.filters.filter((filter) => filter.column !== '__range_start__');
    rows = rows.filter((row) => effectiveFilters.every((filter) => row?.[filter.column] === filter.value));

    if (this.sorts.length) {
      rows.sort((left, right) => {
        for (const sort of this.sorts) {
          const comparison = compareValues(left?.[sort.column], right?.[sort.column]);
          if (comparison !== 0) return sort.ascending ? comparison : -comparison;
        }
        return 0;
      });
    }

    const rangeStart = Number(getFilter(this.filters, '__range_start__') ?? 0);
    if (rangeStart > 0) rows = rows.slice(rangeStart);
    if (this.maxRows != null) rows = rows.slice(0, this.maxRows);

    if (this.selectedColumns !== '*') {
      const columns = this.selectedColumns
        .split(',')
        .map((column) => column.trim())
        .filter((column) => /^[a-zA-Z0-9_]+$/.test(column));
      if (columns.length) {
        rows = rows.map((row) => Object.fromEntries(columns.map((column) => [column, row?.[column]])));
      }
    }

    if (this.singleMode === 'single') {
      if (rows.length !== 1) return { data: null, error: new Error(`Expected one row, found ${rows.length}.`) };
      return { data: rows[0], error: null };
    }
    if (this.singleMode === 'maybeSingle') {
      if (rows.length > 1) return { data: null, error: new Error(`Expected at most one row, found ${rows.length}.`) };
      return { data: rows[0] ?? null, error: null };
    }

    return { data: rows, error: null };
  }

  private async runDelete() {
    if (!rawSupabase) return { data: null, error: new Error('Supabase is not configured.') };

    if (this.table === 'community_likes') {
      const postId = getFilter(this.filters, 'post_id');
      if (typeof postId !== 'string') return { data: null, error: new Error('Post ID is required.') };
      const { error } = await rawSupabase.rpc('remove_community_like', { p_post_id: postId });
      return { data: null, error };
    }

    if (this.table === 'community_reactions') {
      const postId = getFilter(this.filters, 'post_id');
      const emoji = getFilter(this.filters, 'emoji');
      if (typeof postId !== 'string' || typeof emoji !== 'string') return { data: null, error: new Error('Post and emoji are required.') };
      const { error } = await rawSupabase.rpc('remove_community_reaction', { p_post_id: postId, p_emoji: emoji });
      return { data: null, error };
    }

    if (this.table === 'game_event_reactions') {
      const gamePk = Number(getFilter(this.filters, 'game_pk'));
      const eventKey = getFilter(this.filters, 'event_key');
      const emoji = getFilter(this.filters, 'emoji');
      if (!Number.isFinite(gamePk) || typeof eventKey !== 'string' || typeof emoji !== 'string') return { data: null, error: new Error('Game event and emoji are required.') };
      const { error } = await rawSupabase.rpc('remove_game_event_reaction', { p_game_pk: gamePk, p_event_key: eventKey, p_emoji: emoji });
      return { data: null, error };
    }

    let query: any = rawSupabase.from(this.table).delete();
    for (const filter of this.filters) {
      if (filter.column !== 'user_id' && filter.column !== '__range_start__') query = query.eq(filter.column, filter.value);
    }
    return query;
  }

  private execute() {
    return this.operation === 'delete' ? this.runDelete() : this.runSelect();
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null) {
    return this.execute().catch(onrejected ?? undefined);
  }

  finally(onfinally?: (() => void) | null) {
    return this.execute().finally(onfinally ?? undefined);
  }
}

class PrivacyTable {
  constructor(private table: SafeTableName) {}

  select(columns = '*') {
    return new PrivacyQuery(this.table).select(columns);
  }

  delete() {
    return new PrivacyQuery(this.table).delete();
  }

  insert(values: any, options?: any) {
    return rawSupabase!.from(this.table).insert(values, options);
  }

  upsert(values: any, options?: any) {
    return rawSupabase!.from(this.table).upsert(values, options);
  }

  update(values: any, options?: any) {
    return rawSupabase!.from(this.table).update(values, options);
  }
}

export const supabase = rawSupabase
  ? new Proxy(rawSupabase, {
      get(target, property, receiver) {
        if (property === 'from') {
          return (table: string) => safeTables.has(table as SafeTableName)
            ? new PrivacyTable(table as SafeTableName)
            : target.from(table);
        }
        const value = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as typeof rawSupabase
  : null;
