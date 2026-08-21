import type { ScoutLocale } from './LanguageContext';
import { toJapaneseKatakanaFallback } from './katakana';

type NativeLocale = Exclude<ScoutLocale, 'en' | 'ja'>;

const PROTECTED_TERMS = new Set([
  'SCOUTCORE', 'SCOUTCOREMLB', 'SCOUTBOT', 'MLB', 'AI', 'OPS', 'ERA', 'RBI', 'WHIP', 'AVG', 'OBP',
  'SLG', 'HR', 'SO', 'IP', 'AB', 'PA', 'BB', 'HBP', 'K', 'K9', 'WAR', 'W', 'L', 'R', 'H', 'E',
  'SB', 'CS', 'EV', 'LA', 'XBA', 'XSLG', 'WOBA', 'BVP', 'PVB', 'ET', 'UTC', 'QR', 'URL', 'ID',
  'CSV', 'MPH', 'K/9', 'LHP', 'RHP', 'TBD', 'XG', 'STUFF+', 'STATCAST', 'PITCHF/X', 'GOOGLE',
  'SUPABASE', 'YOUTUBE', 'NETLIFY', 'JPG', 'JPEG', 'PNG', 'WEBP', 'GIF', 'MP4', 'WEBM', 'MOV', 'MB',
  'GB', 'PDF',
  'ATL', 'AZ', 'BAL', 'BOS', 'CHC', 'CIN', 'CLE', 'COL', 'CWS', 'DET', 'HOU', 'KC', 'LAA', 'LAD',
  'MIA', 'MIL', 'MIN', 'NYM', 'NYY', 'ATH', 'OAK', 'PHI', 'PIT', 'SD', 'SEA', 'SF', 'STL', 'TB',
  'TEX', 'TOR', 'WSH',
]);

const TEAM_NAMES: Record<string, readonly [ko: string, zhTw: string]> = {
  'Arizona Diamondbacks': ['애리조나 다이아몬드백스', '亞利桑那響尾蛇'],
  'Atlanta Braves': ['애틀랜타 브레이브스', '亞特蘭大勇士'],
  'Baltimore Orioles': ['볼티모어 오리올스', '巴爾的摩金鶯'],
  'Boston Red Sox': ['보스턴 레드삭스', '波士頓紅襪'],
  'Chicago Cubs': ['시카고 컵스', '芝加哥小熊'],
  'Chicago White Sox': ['시카고 화이트삭스', '芝加哥白襪'],
  'Cincinnati Reds': ['신시내티 레즈', '辛辛那提紅人'],
  'Cleveland Guardians': ['클리블랜드 가디언스', '克里夫蘭守護者'],
  'Colorado Rockies': ['콜로라도 로키스', '科羅拉多洛磯'],
  'Detroit Tigers': ['디트로이트 타이거스', '底特律老虎'],
  'Houston Astros': ['휴스턴 애스트로스', '休士頓太空人'],
  'Kansas City Royals': ['캔자스시티 로열스', '堪薩斯市皇家'],
  'Los Angeles Angels': ['로스앤젤레스 에인절스', '洛杉磯天使'],
  'Los Angeles Dodgers': ['로스앤젤레스 다저스', '洛杉磯道奇'],
  'Miami Marlins': ['마이애미 말린스', '邁阿密馬林魚'],
  'Milwaukee Brewers': ['밀워키 브루어스', '密爾瓦基釀酒人'],
  'Minnesota Twins': ['미네소타 트윈스', '明尼蘇達雙城'],
  'New York Mets': ['뉴욕 메츠', '紐約大都會'],
  'New York Yankees': ['뉴욕 양키스', '紐約洋基'],
  'Oakland Athletics': ['오클랜드 애슬레틱스', '奧克蘭運動家'],
  Athletics: ['애슬레틱스', '運動家'],
  'Philadelphia Phillies': ['필라델피아 필리스', '費城費城人'],
  'Pittsburgh Pirates': ['피츠버그 파이리츠', '匹茲堡海盜'],
  'San Diego Padres': ['샌디에이고 파드리스', '聖地牙哥教士'],
  'San Francisco Giants': ['샌프란시스코 자이언츠', '舊金山巨人'],
  'Seattle Mariners': ['시애틀 매리너스', '西雅圖水手'],
  'St. Louis Cardinals': ['세인트루이스 카디널스', '聖路易紅雀'],
  'Tampa Bay Rays': ['탬파베이 레이스', '坦帕灣光芒'],
  'Texas Rangers': ['텍사스 레인저스', '德州遊騎兵'],
  'Toronto Blue Jays': ['토론토 블루제이스', '多倫多藍鳥'],
  'Washington Nationals': ['워싱턴 내셔널스', '華盛頓國民'],
};

const PLAYER_NAMES: Record<string, readonly [ko: string, zhTw: string]> = {
  'Shohei Ohtani': ['오타니 쇼헤이', '大谷翔平'],
  'Yoshinobu Yamamoto': ['야마모토 요시노부', '山本由伸'],
  'Aaron Judge': ['애런 저지', '亞倫・賈吉'],
  'Juan Soto': ['후안 소토', '胡安・索托'],
  'Bryce Harper': ['브라이스 하퍼', '布萊斯・哈波'],
  'Mookie Betts': ['무키 베츠', '穆奇・貝茲'],
  'Freddie Freeman': ['프레디 프리먼', '弗萊迪・弗里曼'],
  'Jahmai Jones': ['자마이 존스', '賈邁・瓊斯'],
  'Logan Webb': ['로건 웹', '羅根・韋布'],
  'Luis Torrens': ['루이스 토렌스', '路易斯・托倫斯'],
  'Sean Burke': ['션 버크', '西恩・伯克'],
  'Troy Melton': ['트로이 멜튼', '特洛伊・梅爾頓'],
  'Noah Cameron': ['노아 캐머런', '諾亞・卡麥隆'],
  'Chris Sale': ['크리스 세일', '克里斯・塞爾'],
  'Jacob Misiorowski': ['제이컵 미시오로스키', '雅各布・米西奧羅斯基'],
  'Jesús Luzardo': ['헤수스 루사르도', '赫蘇斯・盧薩爾多'],
  'Cam Schlittler': ['캠 슐리틀러', '坎姆・施利特勒'],
  'Sonny Gray': ['소니 그레이', '桑尼・葛雷'],
  'Brad Lord': ['브래드 로드', '布萊德・洛德'],
  'Ryan Gusto': ['라이언 구스토', '萊恩・古斯托'],
  'Freddy Peralta': ['프레디 페랄타', '弗雷迪・佩拉爾塔'],
  'Trevor Rogers': ['트레버 로저스', '崔佛・羅傑斯'],
  'Sean Manaea': ['션 마네아', '西恩・馬奈亞'],
  'J.T. Ginn': ['J.T. 긴', 'J.T. 吉恩'],
  'Hayden Wesneski': ['헤이든 웨스네스키', '海登・威斯內斯基'],
  'Reid Detmers': ['리드 데트머스', '瑞德・戴特默斯'],
  'MacKenzie Gore': ['맥켄지 고어', '麥肯齊・高爾'],
  'Joey Cantillo': ['조이 칸티요', '喬伊・坎提約'],
  'Tanner Gordon': ['태너 고든', '坦納・戈登'],
  'Nick Lodolo': ['닉 로돌로', '尼克・洛多洛'],
  'Eduardo Rodriguez': ['에두아르도 로드리게스', '愛德華多・羅德里格斯'],
  'Connor Prielipp': ['코너 프리립', '康納・普里利普'],
  'Bubba Chandler': ['버바 챈들러', '巴巴・錢德勒'],
  'Matthew Boyd': ['매튜 보이드', '馬修・博伊德'],
  'Emerson Hancock': ['에머슨 핸콕', '艾默森・漢考克'],
};

const PHRASES: Record<NativeLocale, Record<string, string>> = {
  es: {
    'box score': 'resumen estadístico', 'live chat': 'conversación en vivo', 'same-game': 'mismo partido',
    'team up': 'juego en equipo', 'head-to-head': 'duelo directo', 'at bat': 'al bate',
    'game logs': 'registros de partidos', 'game log': 'registro del partido',
    'game chat': 'conversación del partido', 'push notifications': 'notificaciones automáticas',
    'scout level': 'nivel de ojeador', 'all-star': 'estrella',
    'passed ball': 'bola pasada', 'double play': 'jugada doble', 'triple play': 'jugada triple',
    'foul tip': 'roce de bate', 'foul bunt': 'toque fuera', 'home run': 'jonrón',
    'four-seam fastball': 'recta de cuatro costuras', 'two-seam fastball': 'recta de dos costuras',
    'knuckle curve': 'curva de nudillos', 'swinging strike': 'abanica sin contacto',
    'called strike': 'lanzamiento bueno cantado', 'wild pitch': 'lanzamiento descontrolado',
    gameday: 'día de juego', hot: 'en racha', bullpen: 'relevo', pitcher: 'lanzador', pitchers: 'lanzadores',
    batter: 'bateador', batters: 'bateadores', challenge: 'desafío', challenges: 'desafíos',
    matchup: 'enfrentamiento', matchups: 'enfrentamientos', feed: 'actualizaciones', scouting: 'evaluación',
    starter: 'abridor', starters: 'abridores', walks: 'bases por bolas', walk: 'base por bolas',
    strikeouts: 'strikeouts', strikeout: 'strikeout', lineup: 'alineación', lineups: 'alineaciones',
    roster: 'plantilla', rosters: 'plantillas', chat: 'conversación', chats: 'conversaciones',
    clips: 'fragmentos', hits: 'hits', hit: 'hit', outs: 'eliminados',
    slugging: 'potencia de bateo', splits: 'divisiones', level: 'nivel', scouts: 'ojeadores',
    top: 'mejores', sinker: 'bola hundida', slider: 'bola deslizante', sweeper: 'curva horizontal',
    changeup: 'cambio de velocidad', cutter: 'recta cortada', splitter: 'bola de dedos separados',
    knuckleball: 'bola de nudillos', foul: 'bola fuera', strikes: 'lanzamientos buenos',
    strike: 'lanzamiento bueno', out: 'eliminado', 'vs.': 'contra', vs: 'contra',
    scout: 'ojeador', live: 'en vivo', watch: 'seguimiento', go: 'confirmar', pts: 'puntos',
  },
  de: {
    'box score': 'Spielstatistik', boxscore: 'Spielstatistik', 'live chat': 'Direktunterhaltung',
    'same-game': 'gleiches Spiel', 'team up': 'Mannschaftsspiel', 'head-to-head': 'Direktduell',
    'at bat': 'am Schlag', 'game logs': 'Spielprotokolle', 'game log': 'Spielprotokoll',
    'play-by-play': 'Spielzugfolge', 'quality start': 'Qualitätsstart', 'scout level': 'Beobachterstufe',
    'all-star': 'Spitzenauswahl', 'stolen bases': 'gestohlene Basisstationen',
    'push notifications': 'automatische Mitteilungen', 'groundouts-flyouts': 'Boden- und Flugaus',
    "fielder's choice": 'Feldspielerentscheidung', 'double play': 'Doppelaus', 'triple play': 'Dreifachaus',
    'sacrifice fly': 'Opferflugball', 'sacrifice bunt': 'Opferkurzschlag', 'passed ball': 'Fangfehler',
    'wild pitch': 'Fehlwurf', 'home run': 'Rundlauf', homeplate: 'Schlagmal',
    'four-seam fastball': 'Vier-Naht-Schnellball', 'two-seam fastball': 'Zwei-Naht-Schnellball',
    'knuckle curve': 'Knöchelkurvenball', fastball: 'Schnellball',
    'swinging strike': 'Fehlschwung', 'called strike': 'angesagter gültiger Wurf',
    'line drive': 'Geradschlag', groundball: 'Bodenball', flyball: 'Flugball',
    'left fielder': 'linker Feldspieler', 'center fielder': 'mittlerer Feldspieler',
    'right fielder': 'rechter Feldspieler', 'first baseman': 'Feldspieler an der ersten Basis',
    'second baseman': 'Feldspieler an der zweiten Basis', 'third baseman': 'Feldspieler an der dritten Basis',
    'left field': 'linkes Feld', 'center field': 'mittleres Feld', 'right field': 'rechtes Feld',
    groundout: 'Bodenaus', flyout: 'Flugaus', lineout: 'Geradschlagaus', popout: 'Hochschlagaus',
    forceout: 'Zwangsaus', pickoff: 'Abfangen', 'pinch hitter': 'Ersatzschlagmann',
    'pinch runner': 'Ersatzläufer', shortstop: 'Kurzfeldspieler', catcher: 'Fänger',
    'mound visit': 'Besuch am Wurfhügel', pitcherwechsel: 'Werferwechsel',
    'extra innings': 'Verlängerung', 'extra-inning': 'Verlängerungs', innings: 'Spielabschnitte', inning: 'Spielabschnitt',
    'starting werfer': 'Startwerfer', 'starting pitcher': 'Startwerfer',
    'strikeout rate': 'Dreischlag-Aus-Quote', strikes: 'gültige Würfe', strike: 'gültiger Wurf',
    'run(s)': 'Punkte', runs: 'Punkte', run: 'Punkt', hits: 'Treffer', hit: 'Treffer',
    sinker: 'Sinkball', slider: 'Gleitball', sweeper: 'Quer-Kurvenball', changeup: 'Tempowechselball',
    curveball: 'Kurvenball', cutter: 'Schnittball', splitter: 'Gabelball', knuckleball: 'Knöchelball',
    'foul tip': 'abgefälschter Fehlball', 'foul bunt': 'Fehl-Kurzschlag', foul: 'Fehlball',
    'home runs': 'Rundläufe', 'home plate': 'Schlagmal', 'hot take': 'gewagte Einschätzung',
    'eastern time': 'Ostküstenzeit', 'community post': 'Gemeinschaftsbeitrag',
    pitch: 'Wurf', pitches: 'Würfe', ball: 'Fehlwurf', balls: 'Fehlwürfe', bases: 'Basisstationen',
    batting: 'Schlagen', pitching: 'Werfen', count: 'Wurfzahl', 'at-bat': 'Schlagauftritt',
    community: 'Gemeinschaft', advanced: 'Fortgeschritten', rookie: 'Nachwuchs',
    highlights: 'Höhepunkte', likes: 'Zustimmungen', like: 'Zustimmung', tickets: 'Teilnahmescheine',
    browser: 'Internetprogramm', countdown: 'Rückwärtszähler', cyan: 'Türkis', details: 'Einzelheiten',
    errors: 'Fehler', fans: 'Anhänger', index: 'Kennzahl', link: 'Verweis', panel: 'Bereich',
    scanner: 'Prüfprogramm', scouts: 'Beobachter', slugging: 'Schlagkraft',
    starting: 'beginnend', trend: 'Entwicklung', trends: 'Entwicklungen', take: 'Einschätzung',
    update: 'Aktualisierung', upload: 'Hochladen', level: 'Stufe', levels: 'Stufen',
    chat: 'Unterhaltung', clips: 'Ausschnitte', out: 'Aus', outs: 'Aus', top: 'beste',
    'vs.': 'gegen', vs: 'gegen',
    gameday: 'Spieltag', hot: 'stark', bullpen: 'Ersatzwerfer', pitcher: 'Werfer', pitchers: 'Werfer',
    batter: 'Schlagmann', batters: 'Schlagmänner', challenge: 'Herausforderung', challenges: 'Herausforderungen',
    matchup: 'Duell', matchups: 'Duelle', feed: 'Meldungen', scouting: 'Spielerbeobachtung',
    starter: 'Startwerfer', starters: 'Startwerfer', walks: 'Vier-Ball-Freiläufe', walk: 'Vier-Ball-Freilauf',
    strikeouts: 'Dreischlag-Aus', strikeout: 'Dreischlag-Aus', lineup: 'Aufstellung', lineups: 'Aufstellungen',
    scout: 'Beobachter', live: 'laufend', watch: 'Beobachtung', player: 'Spieler', players: 'Spieler',
    team: 'Mannschaft', teams: 'Mannschaften', game: 'Spiel', games: 'Spiele', go: 'festlegen', pts: 'Punkte',
  },
  'pt-BR': {
    'box score': 'súmula', boxscore: 'súmula', 'live chat': 'conversa ao vivo', 'same-game': 'mesmo jogo',
    'team up': 'jogo em equipe', 'head-to-head': 'duelo direto', 'at bat': 'no bastão',
    'game logs': 'registros de jogos', 'game log': 'registro do jogo',
    'game chat': 'conversa do jogo', 'push notifications': 'notificações automáticas',
    'quality start': 'partida de qualidade', 'scout level': 'nível de olheiro',
    'home runs': 'rebatidas completas', 'home plate': 'base principal',
    'plate appearances': 'idas ao bastão', 'all-star': 'estrela',
    'passed ball': 'bola passada', 'double play': 'jogada dupla', 'triple play': 'jogada tripla',
    'foul tip': 'desvio no bastão', 'foul bunt': 'toque para fora', 'home run': 'rebatida completa',
    'four-seam fastball': 'bola rápida de quatro costuras', 'two-seam fastball': 'bola rápida de duas costuras',
    'knuckle curve': 'curva de articulação', 'swinging strike': 'erro ao rebater',
    'called strike': 'arremesso válido marcado', 'wild pitch': 'arremesso descontrolado',
    gameday: 'dia de jogo', hot: 'em alta', bullpen: 'grupo de relevistas', pitcher: 'arremessador',
    pitchers: 'arremessadores', batter: 'rebatedor', batters: 'rebatedores', challenge: 'desafio',
    challenges: 'desafios', matchup: 'confronto', matchups: 'confrontos', feed: 'atualizações',
    scouting: 'avaliação', starter: 'titular', starters: 'titulares', walks: 'bases por bolas',
    walk: 'base por bolas', strikeouts: 'eliminações por três arremessos válidos', strikeout: 'eliminação por três arremessos válidos',
    lineup: 'escalação', lineups: 'escalações', scout: 'olheiro', live: 'ao vivo', watch: 'observação',
    chat: 'conversa', chats: 'conversas', link: 'ligação', links: 'ligações', login: 'acesso',
    insights: 'análises', level: 'nível', 'groundouts-flyouts': 'eliminações rasteiras-aéreas',
    runs: 'corridas', run: 'corrida', staff: 'equipe', scanner: 'analisador', scouts: 'olheiros',
    slugging: 'potência de rebatida', start: 'início', top: 'melhores', bullying: 'assédio',
    sinker: 'bola afundada', slider: 'bola deslizante', sweeper: 'curva horizontal',
    changeup: 'mudança de velocidade', cutter: 'bola cortada', splitter: 'bola de dedos separados',
    knuckleball: 'bola de articulação', 'pickoff': 'eliminação por tentativa de avanço',
    strikes: 'arremessos válidos', strike: 'arremesso válido', foul: 'bola fora', home: 'base principal',
    'vs.': 'contra', vs: 'contra', go: 'confirmar', pts: 'pontos',
  },
  ko: {
    'scout level': '스카우트 레벨', level: '레벨',
    gameday: '경기일', hot: '주목', challenge: '도전', challenges: '도전', matchup: '맞대결',
    matchups: '맞대결', scouting: '선수 평가', scout: '스카우트', feed: '소식', bullpen: '불펜',
    pitcher: '투수', pitchers: '투수', batter: '타자', batters: '타자', starter: '선발 투수',
    starters: '선발 투수', lineup: '타순', lineups: '타순', live: '실시간', go: '확정', pts: '포인트',
    vs: '대', youtube: '유튜브', statcast: '스탯캐스트',
  },
  'zh-TW': {
    'scout level': '球探等級', level: '等級',
    gameday: '比賽日', hot: '熱門', challenge: '挑戰', challenges: '挑戰', matchup: '對戰',
    matchups: '對戰', scouting: '球探評估', scout: '球探', feed: '動態', bullpen: '牛棚',
    pitcher: '投手', pitchers: '投手', batter: '打者', batters: '打者', starter: '先發投手',
    starters: '先發投手', lineup: '打線', lineups: '打線', live: '即時', go: '確認', pts: '積分',
    vs: '對', youtube: 'YouTube', statcast: 'Statcast',
  },
};

const KANA_TO_HANGUL: readonly [string, string][] = [
  ['キャ', '캬'], ['キュ', '큐'], ['キョ', '쿄'], ['ギャ', '갸'], ['ギュ', '규'], ['ギョ', '교'],
  ['シャ', '샤'], ['シュ', '슈'], ['ショ', '쇼'], ['シェ', '셰'], ['ジャ', '자'], ['ジュ', '주'], ['ジョ', '조'], ['ジェ', '제'],
  ['チャ', '차'], ['チュ', '추'], ['チョ', '초'], ['チェ', '체'], ['ニャ', '냐'], ['ニュ', '뉴'], ['ニョ', '뇨'],
  ['ヒャ', '햐'], ['ヒュ', '휴'], ['ヒョ', '효'], ['ビャ', '뱌'], ['ビュ', '뷰'], ['ビョ', '뵤'],
  ['ピャ', '퍄'], ['ピュ', '퓨'], ['ピョ', '표'], ['ミャ', '먀'], ['ミュ', '뮤'], ['ミョ', '묘'],
  ['リャ', '랴'], ['リュ', '류'], ['リョ', '료'], ['ツァ', '차'], ['ツィ', '치'], ['ツェ', '체'], ['ツォ', '초'],
  ['ファ', '파'], ['フィ', '피'], ['フェ', '페'], ['フォ', '포'], ['ヴァ', '바'], ['ヴィ', '비'], ['ヴ', '브'], ['ヴェ', '베'], ['ヴォ', '보'],
  ['ウィ', '위'], ['ウェ', '웨'], ['ウォ', '워'], ['ティ', '티'], ['トゥ', '투'], ['ディ', '디'], ['ドゥ', '두'],
  ['クァ', '콰'], ['クィ', '퀴'], ['クェ', '퀘'], ['クォ', '쿼'],
  ['ア', '아'], ['イ', '이'], ['ウ', '우'], ['エ', '에'], ['オ', '오'], ['カ', '카'], ['キ', '키'], ['ク', '쿠'], ['ケ', '케'], ['コ', '코'],
  ['ガ', '가'], ['ギ', '기'], ['グ', '구'], ['ゲ', '게'], ['ゴ', '고'], ['サ', '사'], ['シ', '시'], ['ス', '스'], ['セ', '세'], ['ソ', '소'],
  ['ザ', '자'], ['ジ', '지'], ['ズ', '즈'], ['ゼ', '제'], ['ゾ', '조'], ['タ', '타'], ['チ', '치'], ['ツ', '츠'], ['テ', '테'], ['ト', '토'],
  ['ダ', '다'], ['デ', '데'], ['ド', '도'], ['ナ', '나'], ['ニ', '니'], ['ヌ', '누'], ['ネ', '네'], ['ノ', '노'],
  ['ハ', '하'], ['ヒ', '히'], ['フ', '후'], ['ヘ', '헤'], ['ホ', '호'], ['バ', '바'], ['ビ', '비'], ['ブ', '부'], ['ベ', '베'], ['ボ', '보'],
  ['パ', '파'], ['ピ', '피'], ['プ', '푸'], ['ペ', '페'], ['ポ', '포'], ['マ', '마'], ['ミ', '미'], ['ム', '무'], ['メ', '메'], ['モ', '모'],
  ['ヤ', '야'], ['ユ', '유'], ['ヨ', '요'], ['ラ', '라'], ['リ', '리'], ['ル', '루'], ['レ', '레'], ['ロ', '로'], ['ワ', '와'],
  ['ン', 'ㄴ'], ['ッ', ''], ['ー', ''], ['・', '·'],
];

const KANA_TO_CHINESE: Record<string, string> = {
  ア: '阿', イ: '伊', ウ: '烏', エ: '埃', オ: '奧', カ: '卡', キ: '基', ク: '庫', ケ: '凱', コ: '科',
  ガ: '加', ギ: '吉', グ: '古', ゲ: '格', ゴ: '戈', サ: '薩', シ: '西', ス: '斯', セ: '塞', ソ: '索',
  ザ: '扎', ジ: '吉', ズ: '茲', ゼ: '澤', ゾ: '佐', タ: '塔', チ: '奇', ツ: '茲', テ: '特', ト: '托',
  ダ: '達', デ: '德', ド: '多', ナ: '納', ニ: '尼', ヌ: '努', ネ: '內', ノ: '諾', ハ: '哈', ヒ: '希',
  フ: '夫', ヘ: '赫', ホ: '霍', バ: '巴', ビ: '比', ブ: '布', ベ: '貝', ボ: '博', パ: '帕', ピ: '皮',
  プ: '普', ペ: '佩', ポ: '波', マ: '馬', ミ: '米', ム: '穆', メ: '梅', モ: '莫', ヤ: '亞', ユ: '尤',
  ヨ: '約', ラ: '拉', リ: '里', ル: '魯', レ: '雷', ロ: '羅', ワ: '瓦', ン: '恩', ヴ: '維',
  ァ: '', ィ: '', ゥ: '', ェ: '', ォ: '', ャ: '亞', ュ: '尤', ョ: '約', ッ: '', ー: '', '・': '・',
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeProtected = (value: string) => value
  .replace(/[’']s$/i, '')
  .replace(/[^A-Za-z0-9/+.-]/g, '')
  .toLocaleUpperCase('en-US');

const isProtected = (value: string) => PROTECTED_TERMS.has(normalizeProtected(value));

const preserveCase = (source: string, translated: string, locale: NativeLocale) => {
  const letters = source.match(/\p{L}/gu)?.join('') ?? '';
  if (letters && letters === letters.toLocaleUpperCase('en-US')) {
    return translated.toLocaleUpperCase(locale === 'pt-BR' ? 'pt-BR' : locale);
  }
  const firstLetter = source.match(/\p{L}/u)?.[0] ?? '';
  if (firstLetter && firstLetter === firstLetter.toLocaleUpperCase('en-US') && firstLetter !== firstLetter.toLocaleLowerCase('en-US')) {
    return translated.replace(/\p{L}/u, letter => letter.toLocaleUpperCase(locale === 'pt-BR' ? 'pt-BR' : locale));
  }
  return translated;
};

const replacePhraseMap = (value: string, locale: NativeLocale, phrases: Record<string, string>) => {
  let result = value;
  for (const [source, translated] of Object.entries(phrases).sort((a, b) => b[0].length - a[0].length)) {
    const expression = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(source)}(?![\\p{L}\\p{N}])`, 'giu');
    result = result.replace(expression, match => preserveCase(match, translated, locale));
  }
  return result;
};

const katakanaToHangul = (value: string) => {
  let result = value;
  for (const [kana, hangul] of KANA_TO_HANGUL) result = result.replaceAll(kana, hangul);
  return result.replace(/[\u30A0-\u30FF]/g, '');
};

const katakanaToChinese = (value: string) => [...value].map(character => KANA_TO_CHINESE[character] ?? character).join('');

const romanFallback = (word: string, locale: 'ko' | 'zh-TW') => {
  const katakana = toJapaneseKatakanaFallback(word);
  return locale === 'ko' ? katakanaToHangul(katakana) : katakanaToChinese(katakana);
};

const nonLatinNamePhrases = (locale: 'ko' | 'zh-TW') => {
  const index = locale === 'ko' ? 0 : 1;
  return Object.fromEntries([
    ...Object.entries(TEAM_NAMES).map(([source, values]) => [source, values[index]]),
    ...Object.entries(PLAYER_NAMES).map(([source, values]) => [source, values[index]]),
  ]);
};

export const finalizeNativeLocaleText = (value: string, locale: NativeLocale) => {
  const protectedValues: string[] = [];
  let result = value.replace(/(?:https?:\/\/|mailto:)?[^\s@]+@[^\s@]+\.[^\s@]+|https?:\/\/[^\s]+|@[A-Za-z0-9_.-]+/gi, match => {
    const marker = `\uE000${protectedValues.length}\uE001`;
    protectedValues.push(match);
    return marker;
  });

  if (locale === 'ko' || locale === 'zh-TW') result = replacePhraseMap(result, locale, nonLatinNamePhrases(locale));
  result = replacePhraseMap(result, locale, PHRASES[locale]);

  if (locale === 'ko' || locale === 'zh-TW') {
    result = result.replace(/\p{Script=Latin}[\p{Script=Latin}\p{Mark}’'.+-]*/gu, word => {
      if (isProtected(word) || /\.(?:com|net|org)$/i.test(word)) return word;
      return romanFallback(word, locale);
    });
  }

  return result.replace(/\uE000(\d+)\uE001/g, (_marker, index) => protectedValues[Number(index)] ?? _marker);
};

const BANNED_NATIVE_TOKENS: Record<'es' | 'de' | 'pt-BR', readonly string[]> = {
  es: [
    'hot', 'gameday', 'bullpen', 'pitcher', 'batter', 'challenge', 'matchup', 'feed', 'scouting',
    'starter', 'walks', 'box score', 'lineup', 'roster', 'chat', 'clips',
    'outs', 'slugging', 'splits', 'level', 'scouts', 'push',
  ],
  de: [
    'hot', 'gameday', 'bullpen', 'pitcher', 'batter', 'challenge', 'matchup', 'feed', 'scouting',
    'starter', 'walks', 'strikeouts', 'boxscore', 'lineup', 'live', 'watch', 'player', 'game',
    'community', 'advanced', 'count', 'pitching', 'play-by-play', 'rookie', 'starting', 'trend',
    'at-bat', 'highlights', 'home', 'likes', 'pitches', 'tickets', 'balls', 'batting', 'browser',
    'countdown', 'cyan', 'details', 'eastern', 'errors', 'fans', 'index', 'link', 'outs', 'panel',
    'plate', 'scanner', 'scouts', 'slugging', 'stolen', 'take', 'update', 'upload', 'level', 'chat',
  ],
  'pt-BR': [
    'hot', 'gameday', 'bullpen', 'pitcher', 'batter', 'challenge', 'matchup', 'feed', 'scouting',
    'starter', 'walks', 'strikeouts', 'box score', 'lineup', 'chat', 'link', 'login', 'insights',
    'level', 'groundouts-flyouts', 'runs', 'staff', 'scanner', 'scouts', 'slugging', 'start', 'push',
  ],
};

export const unexpectedNativeEnglishTokens = (value: string, locale: NativeLocale) => {
  const safe = value
    .replace(/(?:https?:\/\/|mailto:)?[^\s@]+@[^\s@]+\.[^\s@]+|https?:\/\/[^\s]+|@[A-Za-z0-9_.-]+/gi, '')
    .replace(/\p{Script=Latin}[\p{Script=Latin}\p{Mark}0-9/+.-]*/gu, token => isProtected(token) ? '' : token);
  if (locale === 'ko' || locale === 'zh-TW') {
    return [...new Set(safe.match(/\p{Script=Latin}[\p{Script=Latin}\p{Mark}0-9/+.-]*/gu) ?? [])];
  }
  const folded = safe.toLocaleLowerCase(locale === 'pt-BR' ? 'pt-BR' : locale);
  return BANNED_NATIVE_TOKENS[locale]
    .filter(token => new RegExp(`(?<![\\p{L}])${escapeRegExp(token)}(?![\\p{L}])`, 'iu').test(folded));
};
