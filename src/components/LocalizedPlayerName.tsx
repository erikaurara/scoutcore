import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage, type ScoutLocale } from '../i18n/LanguageContext';

type LocalizedNames = Partial<Record<'ja' | 'ko' | 'zh-TW', string>>;
type CacheRow = { fetchedAt: number; names: LocalizedNames };

const CACHE_PREFIX = 'scoutcore:localized-player-name:v1:';
const CACHE_TTL = 1000 * 60 * 60 * 24 * 90;
const memory = new Map<number, LocalizedNames>();
const pending = new Map<number, Promise<LocalizedNames>>();

const targetLocale = (locale: ScoutLocale) => locale === 'ja' || locale === 'ko' || locale === 'zh-TW';

const hiraganaToKatakana = (value: string) => value.replace(/[ぁ-ゖ]/g, character => String.fromCharCode(character.charCodeAt(0) + 0x60));

const readCache = (playerId: number): LocalizedNames | null => {
  const inMemory = memory.get(playerId);
  if (inMemory) return inMemory;
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${playerId}`);
    if (!raw) return null;
    const row = JSON.parse(raw) as CacheRow;
    if (!row?.names || !row.fetchedAt || Date.now() - row.fetchedAt > CACHE_TTL) return null;
    memory.set(playerId, row.names);
    return row.names;
  } catch {
    return null;
  }
};

const writeCache = (playerId: number, names: LocalizedNames) => {
  memory.set(playerId, names);
  try {
    window.localStorage.setItem(`${CACHE_PREFIX}${playerId}`, JSON.stringify({ fetchedAt: Date.now(), names } satisfies CacheRow));
  } catch {}
};

const fetchLocalizedNames = async (playerId: number): Promise<LocalizedNames> => {
  const cached = readCache(playerId);
  if (cached) return cached;
  const inFlight = pending.get(playerId);
  if (inFlight) return inFlight;

  const request = (async () => {
    const query = `
SELECT ?ja ?ko ?zhTW ?zhHant ?kana WHERE {
  ?item wdt:P3541 "${playerId}".
  OPTIONAL { ?item rdfs:label ?ja FILTER(LANG(?ja) = "ja") }
  OPTIONAL { ?item rdfs:label ?ko FILTER(LANG(?ko) = "ko") }
  OPTIONAL { ?item rdfs:label ?zhTW FILTER(LCASE(LANG(?zhTW)) = "zh-tw") }
  OPTIONAL { ?item rdfs:label ?zhHant FILTER(LCASE(LANG(?zhHant)) = "zh-hant") }
  OPTIONAL { ?item wdt:P1814 ?kana }
}
LIMIT 1`;
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
    try {
      const response = await fetch(url, { headers: { Accept: 'application/sparql-results+json' } });
      if (!response.ok) throw new Error(`Localized name request failed (${response.status})`);
      const payload = await response.json();
      const row = payload?.results?.bindings?.[0] ?? {};
      const jaLabel = row?.ja?.value ? String(row.ja.value) : '';
      const kana = row?.kana?.value ? hiraganaToKatakana(String(row.kana.value)) : '';
      const names: LocalizedNames = {
        ja: kana || (jaLabel ? hiraganaToKatakana(jaLabel) : undefined),
        ko: row?.ko?.value ? String(row.ko.value) : undefined,
        'zh-TW': row?.zhTW?.value ? String(row.zhTW.value) : row?.zhHant?.value ? String(row.zhHant.value) : undefined,
      };
      writeCache(playerId, names);
      return names;
    } catch {
      return {};
    } finally {
      pending.delete(playerId);
    }
  })();

  pending.set(playerId, request);
  return request;
};

export const useLocalizedPlayerName = (playerId: number | null | undefined, englishName: string | null | undefined) => {
  const { locale } = useLanguage();
  const [names, setNames] = useState<LocalizedNames>(() => playerId ? readCache(playerId) ?? {} : {});

  useEffect(() => {
    let cancelled = false;
    if (!playerId || !targetLocale(locale)) return;
    const cached = readCache(playerId);
    if (cached) {
      setNames(cached);
      return;
    }
    void fetchLocalizedNames(playerId).then(next => { if (!cancelled) setNames(next); });
    return () => { cancelled = true; };
  }, [playerId, locale]);

  const officialName = englishName?.trim() || 'Unknown Player';
  const displayName = targetLocale(locale) && playerId ? names[locale as 'ja' | 'ko' | 'zh-TW'] || officialName : officialName;
  return useMemo(() => ({ displayName, officialName, isLocalized: displayName !== officialName, locale }), [displayName, officialName, locale]);
};

type Props = {
  playerId?: number | null;
  englishName?: string | null;
  className?: string;
  secondaryClassName?: string;
  showEnglish?: boolean;
  as?: 'span' | 'div';
};

export const LocalizedPlayerName: React.FC<Props> = ({ playerId, englishName, className = '', secondaryClassName = '', showEnglish = true, as = 'span' }) => {
  const { displayName, officialName, isLocalized } = useLocalizedPlayerName(playerId, englishName);
  const Tag = as;
  return <Tag className={className}>
    <span className="block">{displayName}</span>
    {showEnglish && isLocalized && <span className={`block text-[0.78em] font-medium text-[#8fa0b7] ${secondaryClassName}`}>{officialName}</span>}
  </Tag>;
};
