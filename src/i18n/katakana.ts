const PROTECTED_TERMS = new Set([
  'SCOUTCORE', 'SCOUTCOREMLB', 'SCOUTBOT', 'MLB', 'AI', 'OPS', 'ERA', 'RBI', 'WHIP', 'AVG', 'OBP', 'SLG',
  'HR', 'SO', 'IP', 'AB', 'PA', 'BB', 'HBP', 'K', 'K9', 'WAR', 'W', 'L', 'R', 'H', 'E', 'SB', 'CS', 'EV',
  'LA', 'XBA', 'XSLG', 'WOBA', 'BVP', 'PVB', 'ET', 'UTC', 'QR', 'URL', 'ID', 'CSV', '2B', '3B',
  'MPH', 'K/9', 'LHP', 'RHP', 'TBD', 'XG', 'STUFF+',
]);

const PHRASE_KATAKANA: Record<string, string> = {
  'Arizona Diamondbacks': 'アリゾナ・ダイヤモンドバックス',
  'Atlanta Braves': 'アトランタ・ブレーブス',
  'Baltimore Orioles': 'ボルチモア・オリオールズ',
  'Boston Red Sox': 'ボストン・レッドソックス',
  'Chicago Cubs': 'シカゴ・カブス',
  'Chicago White Sox': 'シカゴ・ホワイトソックス',
  'Cincinnati Reds': 'シンシナティ・レッズ',
  'Cleveland Guardians': 'クリーブランド・ガーディアンズ',
  'Colorado Rockies': 'コロラド・ロッキーズ',
  'Detroit Tigers': 'デトロイト・タイガース',
  'Houston Astros': 'ヒューストン・アストロズ',
  'Kansas City Royals': 'カンザスシティ・ロイヤルズ',
  'Los Angeles Angels': 'ロサンゼルス・エンゼルス',
  'Los Angeles Dodgers': 'ロサンゼルス・ドジャース',
  'Miami Marlins': 'マイアミ・マーリンズ',
  'Milwaukee Brewers': 'ミルウォーキー・ブルワーズ',
  'Minnesota Twins': 'ミネソタ・ツインズ',
  'New York Mets': 'ニューヨーク・メッツ',
  'New York Yankees': 'ニューヨーク・ヤンキース',
  'Oakland Athletics': 'オークランド・アスレチックス',
  'Philadelphia Phillies': 'フィラデルフィア・フィリーズ',
  'Pittsburgh Pirates': 'ピッツバーグ・パイレーツ',
  'San Diego Padres': 'サンディエゴ・パドレス',
  'San Francisco Giants': 'サンフランシスコ・ジャイアンツ',
  'Seattle Mariners': 'シアトル・マリナーズ',
  'St. Louis Cardinals': 'セントルイス・カージナルス',
  'Tampa Bay Rays': 'タンパベイ・レイズ',
  'Texas Rangers': 'テキサス・レンジャーズ',
  'Toronto Blue Jays': 'トロント・ブルージェイズ',
  'Washington Nationals': 'ワシントン・ナショナルズ',
  'Athletics': 'アスレチックス',
  'Aaron Judge': 'アーロン・ジャッジ',
  'Juan Soto': 'フアン・ソト',
  'Bryce Harper': 'ブライス・ハーパー',
  'Fernando Tatis Jr.': 'フェルナンド・タティス・ジュニア',
  'Vladimir Guerrero Jr.': 'ブラディミール・ゲレーロ・ジュニア',
  'Ronald Acuña Jr.': 'ロナルド・アクーニャ・ジュニア',
  'Bobby Witt Jr.': 'ボビー・ウィット・ジュニア',
  'Gunnar Henderson': 'ガナー・ヘンダーソン',
  'Kyle Tucker': 'カイル・タッカー',
  'Corbin Carroll': 'コービン・キャロル',
  'Julio Rodríguez': 'フリオ・ロドリゲス',
  'Paul Skenes': 'ポール・スキーンズ',
  'Tarik Skubal': 'タリック・スクーバル',
  'Zack Wheeler': 'ザック・ウィーラー',
  'Gerrit Cole': 'ゲリット・コール',
  'Max Fried': 'マックス・フリード',
  'Chris Sale': 'クリス・セール',
  'Jacob deGrom': 'ジェイコブ・デグロム',
  'Cal Raleigh': 'カル・ローリー',
  'Francisco Lindor': 'フランシスコ・リンドーア',
  'Manny Machado': 'マニー・マチャド',
  'José Ramírez': 'ホセ・ラミレス',
  'Elly De La Cruz': 'エリー・デラクルーズ',
};

const WORD_KATAKANA: Record<string, string> = {
  allstar: 'オールスター', analytics: 'アナリティクス', baseball: 'ベースボール', challenge: 'チャレンジ',
  chat: 'チャット', community: 'コミュニティ', dashboard: 'ダッシュボード', data: 'データ',
  dodgers: 'ドジャース', feed: 'フィード', filter: 'フィルター', friends: 'フレンズ', game: 'ゲーム',
  gameday: 'ゲームデイ', games: 'ゲームズ', intelligence: 'インテリジェンス', live: 'ライブ',
  login: 'ログイン', logout: 'ログアウト', matchup: 'マッチアップ', matchups: 'マッチアップス',
  player: 'プレイヤー', players: 'プレイヤーズ', premium: 'プレミアム', profile: 'プロフィール',
  report: 'レポート', schedule: 'スケジュール', scout: 'スカウト', settings: 'セッティング',
  statcast: 'スタットキャスト', team: 'チーム', teams: 'チームズ', video: 'ビデオ', youtube: 'ユーチューブ',
  shohei: 'ショウヘイ', ohtani: 'オオタニ', freddie: 'フレディ', freeman: 'フリーマン',
  mookie: 'ムーキー', betts: 'ベッツ', clayton: 'クレイトン', kershaw: 'カーショー',
  yoshinobu: 'ヨシノブ', yamamoto: 'ヤマモト', rōki: 'ロウキ', roki: 'ロウキ', sasaki: 'ササキ',
};

const SYLLABLES: Record<string, string> = {
  kya: 'キャ', kyu: 'キュ', kyo: 'キョ', gya: 'ギャ', gyu: 'ギュ', gyo: 'ギョ',
  sha: 'シャ', shu: 'シュ', sho: 'ショ', she: 'シェ', ja: 'ジャ', ju: 'ジュ', jo: 'ジョ', je: 'ジェ',
  cha: 'チャ', chu: 'チュ', cho: 'チョ', che: 'チェ', nya: 'ニャ', nyu: 'ニュ', nyo: 'ニョ',
  hya: 'ヒャ', hyu: 'ヒュ', hyo: 'ヒョ', bya: 'ビャ', byu: 'ビュ', byo: 'ビョ',
  pya: 'ピャ', pyu: 'ピュ', pyo: 'ピョ', mya: 'ミャ', myu: 'ミュ', myo: 'ミョ',
  rya: 'リャ', ryu: 'リュ', ryo: 'リョ', tsa: 'ツァ', tsi: 'ツィ', tse: 'ツェ', tso: 'ツォ',
  fa: 'ファ', fi: 'フィ', fe: 'フェ', fo: 'フォ', va: 'ヴァ', vi: 'ヴィ', vu: 'ヴ', ve: 'ヴェ', vo: 'ヴォ',
  wi: 'ウィ', we: 'ウェ', wo: 'ウォ', ti: 'ティ', tu: 'トゥ', di: 'ディ', du: 'ドゥ',
  kwa: 'クァ', kwi: 'クィ', kwe: 'クェ', kwo: 'クォ',
  ka: 'カ', ki: 'キ', ku: 'ク', ke: 'ケ', ko: 'コ', ga: 'ガ', gi: 'ギ', gu: 'グ', ge: 'ゲ', go: 'ゴ',
  sa: 'サ', shi: 'シ', si: 'シ', su: 'ス', se: 'セ', so: 'ソ', za: 'ザ', ji: 'ジ', zi: 'ジ', zu: 'ズ', ze: 'ゼ', zo: 'ゾ',
  ta: 'タ', chi: 'チ', tsu: 'ツ', te: 'テ', to: 'ト', da: 'ダ', de: 'デ', do: 'ド',
  na: 'ナ', ni: 'ニ', nu: 'ヌ', ne: 'ネ', no: 'ノ', ha: 'ハ', hi: 'ヒ', fu: 'フ', hu: 'フ', he: 'ヘ', ho: 'ホ',
  ba: 'バ', bi: 'ビ', bu: 'ブ', be: 'ベ', bo: 'ボ', pa: 'パ', pi: 'ピ', pu: 'プ', pe: 'ペ', po: 'ポ',
  ma: 'マ', mi: 'ミ', mu: 'ム', me: 'メ', mo: 'モ', ya: 'ヤ', yu: 'ユ', yo: 'ヨ',
  ra: 'ラ', ri: 'リ', ru: 'ル', re: 'レ', ro: 'ロ', wa: 'ワ',
  a: 'ア', i: 'イ', u: 'ウ', e: 'エ', o: 'オ', n: 'ン',
};

const SINGLE_LETTERS: Record<string, string> = {
  a: 'ア', b: 'ブ', c: 'ク', d: 'ド', e: 'エ', f: 'フ', g: 'グ', h: 'ハ', i: 'イ', j: 'ジ',
  k: 'ク', l: 'ル', m: 'ム', n: 'ン', o: 'オ', p: 'プ', q: 'ク', r: 'ル', s: 'ス', t: 'ト',
  u: 'ウ', v: 'ヴ', w: 'ウ', x: 'クス', y: 'イ', z: 'ズ',
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeLatinWord = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[øØ]/g, 'o')
  .replace(/[łŁ]/g, 'l')
  .replace(/[ðÐ]/g, 'd')
  .replace(/[þÞ]/g, 'th')
  .replace(/ß/g, 'ss')
  .replace(/[æÆ]/g, 'ae')
  .replace(/[œŒ]/g, 'oe');

const romanWordToKatakana = (original: string) => {
  const normalizedOriginal = normalizeLatinWord(original);
  const direct = WORD_KATAKANA[original.toLocaleLowerCase('en-US')]
    ?? WORD_KATAKANA[normalizedOriginal.toLocaleLowerCase('en-US')];
  if (direct) return direct;
  let word = normalizedOriginal.toLocaleLowerCase('en-US')
    .replace(/[’']/g, '')
    .replace(/tion/g, 'shon')
    .replace(/sion/g, 'zhon')
    .replace(/ture/g, 'cha')
    .replace(/dge/g, 'j')
    .replace(/ph/g, 'f')
    .replace(/th/g, 's')
    .replace(/ck/g, 'k')
    .replace(/qu/g, 'kw')
    .replace(/x/g, 'ks')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c/g, 'k')
    .replace(/g(?=[eiy])/g, 'j')
    .replace(/([bcdfghjklmpqrstvwxyz])\1/g, 'Q$1')
    .replace(/e$/, '');

  let output = '';
  while (word) {
    if (word.startsWith('Q')) {
      output += 'ッ';
      word = word.slice(1);
      continue;
    }
    let matched = false;
    for (const size of [3, 2, 1]) {
      const part = word.slice(0, size);
      const kana = SYLLABLES[part];
      if (!kana) continue;
      output += kana;
      word = word.slice(size);
      matched = true;
      break;
    }
    if (matched) continue;
    const letter = word[0];
    output += SINGLE_LETTERS[letter] ?? letter;
    word = word.slice(1);
  }
  return output || original;
};

const isProtected = (word: string) => {
  const normalized = word.replace(/[’']s$/i, '').replace(/[^A-Za-z0-9/+.-]/g, '').toLocaleUpperCase('en-US');
  return PROTECTED_TERMS.has(normalized);
};

/**
 * Japanese safety net for new MLB names and legacy UI copy. Known UI copy still
 * uses natural translations; this guarantees that an uncatalogued English word
 * cannot silently leak back into Japanese mode.
 */
export const toJapaneseKatakanaFallback = (value: string) => {
  const protectedValues: string[] = [];
  let result = value.replace(/(?:https?:\/\/|mailto:)?[^\s@]+@[^\s@]+\.[^\s@]+|https?:\/\/[^\s]+|@[A-Za-z0-9_.-]+/gi, match => {
    const marker = `\uE000${protectedValues.length}\uE001`;
    protectedValues.push(match);
    return marker;
  });
  for (const [source, kana] of Object.entries(PHRASE_KATAKANA).sort((a, b) => b[0].length - a[0].length)) {
    result = result.replace(new RegExp(`\\b${escapeRegExp(source)}\\b`, 'gi'), kana);
  }
  result = result.replace(/\p{Script=Latin}[\p{Script=Latin}\p{Mark}’'.-]*/gu, word => {
    if (isProtected(word) || /@|\.(?:com|net|org)$/i.test(word)) return word;
    return romanWordToKatakana(word);
  });
  return result.replace(/\uE000(\d+)\uE001/g, (_marker, index) => protectedValues[Number(index)] ?? _marker);
};

export const hasUnexpectedJapaneseLatinText = (value: string) => value
  .replace(/(?:https?:\/\/|mailto:)?[^\s@]+@[^\s@]+\.[^\s@]+|https?:\/\/[^\s]+|@[A-Za-z0-9_.-]+/gi, '')
  .match(/\p{Script=Latin}[\p{Script=Latin}\p{Mark}0-9/+.-]*/gu)
  ?.some(word => !isProtected(word)) ?? false;
