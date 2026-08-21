import type { ScoutLocale } from './LanguageContext';

type TranslatedLocale = Exclude<ScoutLocale, 'en'>;
type LocalizedPhrase = Record<TranslatedLocale, string>;

const phrase = (ja: string, es: string, ko: string, zhTw: string, ptBr: string, de: string): LocalizedPhrase => ({
  ja, es, ko, 'zh-TW': zhTw, 'pt-BR': ptBr, de,
});

// MLB play descriptions are generated at runtime. They use a constrained
// baseball vocabulary, so an ordered phrase dictionary can localize the event
// while leaving official player names intact in non-Japanese locales.
const BASEBALL_PHRASES: readonly [string, LocalizedPhrase][] = [
  ['strikes out swinging', phrase('空振り三振', 'se poncha tirándole', '헛스윙 삼진', '揮棒落空遭三振', 'é eliminado por strikeout com swing', 'schlägt schwingend aus')],
  ['strikes out looking', phrase('見逃し三振', 'se poncha mirando', '루킹 삼진', '站著遭三振', 'é eliminado por strikeout olhando', 'schlägt ohne Schwung aus')],
  ['intentionally walks', phrase('敬遠で出塁', 'recibe base por bolas intencional', '고의사구로 출루', '獲故意保送', 'recebe walk intencional', 'wird absichtlich gewalkt')],
  ['reaches on a fielding error', phrase('守備失策で出塁', 'se embasa por error de fildeo', '수비 실책으로 출루', '因守備失誤上壘', 'chega à base por erro de defesa', 'erreicht durch einen Feldfehler die Base')],
  ["reaches on a fielder's choice", phrase('野手選択で出塁', 'se embasa por jugada de selección', '야수 선택으로 출루', '因野手選擇上壘', 'chega à base por escolha do defensor', 'erreicht durch Fielder’s Choice die Base')],
  ['grounds into a double play', phrase('併殺打', 'batea para doble play', '병살타', '擊成雙殺打', 'bate em jogada dupla', 'schlägt in ein Double Play')],
  ['hits a sacrifice fly', phrase('犠牲フライを放つ', 'conecta un elevado de sacrificio', '희생 플라이', '擊出高飛犧牲打', 'rebate uma bola de sacrifício', 'schlägt einen Sacrifice Fly')],
  ['hits a sacrifice bunt', phrase('犠牲バントを決める', 'realiza toque de sacrificio', '희생 번트', '擊出犧牲觸擊', 'faz um bunt de sacrifício', 'legt einen Sacrifice Bunt')],
  ['caught stealing home', phrase('本塁盗塁死', 'es puesto out robando el plato', '홈 도루 실패', '盜本壘遭刺殺', 'é eliminado tentando roubar o home', 'wird beim Stehlen der Homeplate ausgeworfen')],
  ['caught stealing third', phrase('三塁盗塁死', 'es puesto out robando tercera', '3루 도루 실패', '盜三壘遭刺殺', 'é eliminado tentando roubar a terceira', 'wird beim Stehlen der dritten Base ausgeworfen')],
  ['caught stealing second', phrase('二塁盗塁死', 'es puesto out robando segunda', '2루 도루 실패', '盜二壘遭刺殺', 'é eliminado tentando roubar a segunda', 'wird beim Stehlen der zweiten Base ausgeworfen')],
  ['steals home', phrase('本盗に成功', 'roba el plato', '홈 도루 성공', '盜本壘成功', 'rouba o home', 'stiehlt die Homeplate')],
  ['steals third', phrase('三盗に成功', 'roba tercera', '3루 도루 성공', '盜三壘成功', 'rouba a terceira', 'stiehlt die dritte Base')],
  ['steals second', phrase('二盗に成功', 'roba segunda', '2루 도루 성공', '盜二壘成功', 'rouba a segunda', 'stiehlt die zweite Base')],
  ['advances to home', phrase('本塁へ進む', 'avanza al plato', '홈으로 진루', '推進至本壘', 'avança para o home', 'rückt zur Homeplate vor')],
  ['advances to third', phrase('三塁へ進む', 'avanza a tercera', '3루로 진루', '推進至三壘', 'avança para a terceira', 'rückt zur dritten Base vor')],
  ['advances to second', phrase('二塁へ進む', 'avanza a segunda', '2루로 진루', '推進至二壘', 'avança para a segunda', 'rückt zur zweiten Base vor')],
  ['four-seam fastball', phrase('フォーシーム', 'recta de cuatro costuras', '포심 패스트볼', '四縫線速球', 'bola rápida de quatro costuras', 'Vier-Naht-Fastball')],
  ['two-seam fastball', phrase('ツーシーム', 'recta de dos costuras', '투심 패스트볼', '二縫線速球', 'bola rápida de duas costuras', 'Zwei-Naht-Fastball')],
  ['knuckle curve', phrase('ナックルカーブ', 'curva de nudillos', '너클 커브', '指關節曲球', 'curva de nós dos dedos', 'Knuckle Curve')],
  ['swinging strike', phrase('空振り', 'strike tirándole', '헛스윙 스트라이크', '揮棒落空', 'strike com swing', 'Swinging Strike')],
  ['called strike', phrase('見逃しストライク', 'strike cantado', '루킹 스트라이크', '好球', 'strike cantado', 'angesagter Strike')],
  ['ball in dirt', phrase('ワンバウンドのボール', 'bola en el suelo', '바운드된 볼', '落地壞球', 'bola no chão', 'Ball im Boden')],
  ['fielding error', phrase('守備失策', 'error de fildeo', '수비 실책', '守備失誤', 'erro de defesa', 'Feldfehler')],
  ['throwing error', phrase('送球失策', 'error de tiro', '송구 실책', '傳球失誤', 'erro de lançamento', 'Wurffehler')],
  ['defensive substitution', phrase('守備交代', 'sustitución defensiva', '수비 교체', '守備替換', 'substituição defensiva', 'Defensivwechsel')],
  ['offensive substitution', phrase('攻撃側の交代', 'sustitución ofensiva', '공격 교체', '進攻替換', 'substituição ofensiva', 'Offensivwechsel')],
  ['pitching change', phrase('投手交代', 'cambio de lanzador', '투수 교체', '投手更換', 'troca de arremessador', 'Pitcherwechsel')],
  ['mound visit', phrase('マウンド訪問', 'visita al montículo', '마운드 방문', '投手丘暫停', 'visita ao montinho', 'Mound Visit')],
  ['game advisory', phrase('試合案内', 'aviso del partido', '경기 안내', '比賽公告', 'aviso do jogo', 'Spielhinweis')],
  ['passed ball', phrase('捕逸', 'passed ball', '포일', '捕逸', 'bola passada', 'Passed Ball')],
  ['wild pitch', phrase('暴投', 'lanzamiento descontrolado', '폭투', '暴投', 'arremesso descontrolado', 'Wild Pitch')],
  ['double play', phrase('併殺', 'doble play', '병살', '雙殺', 'jogada dupla', 'Double Play')],
  ['triple play', phrase('三重殺', 'triple play', '삼중살', '三殺', 'jogada tripla', 'Triple Play')],
  ['line drive', phrase('ライナー', 'línea', '라인드라이브', '平飛球', 'linha', 'Line Drive')],
  ['ground ball', phrase('ゴロ', 'rodado', '땅볼', '滾地球', 'bola rasteira', 'Groundball')],
  ['fly ball', phrase('フライ', 'elevado', '뜬공', '高飛球', 'bola alta', 'Flyball')],
  ['left fielder', phrase('左翼手', 'jardinero izquierdo', '좌익수', '左外野手', 'jardineiro esquerdo', 'Left Fielder')],
  ['center fielder', phrase('中堅手', 'jardinero central', '중견수', '中外野手', 'jardineiro central', 'Center Fielder')],
  ['right fielder', phrase('右翼手', 'jardinero derecho', '우익수', '右外野手', 'jardineiro direito', 'Right Fielder')],
  ['first baseman', phrase('一塁手', 'primera base', '1루수', '一壘手', 'primeira base', 'First Baseman')],
  ['second baseman', phrase('二塁手', 'segunda base', '2루수', '二壘手', 'segunda base', 'Second Baseman')],
  ['third baseman', phrase('三塁手', 'tercera base', '3루수', '三壘手', 'terceira base', 'Third Baseman')],
  ['left field', phrase('左翼', 'jardín izquierdo', '좌익', '左外野', 'campo esquerdo', 'Left Field')],
  ['center field', phrase('中堅', 'jardín central', '중견', '中外野', 'campo central', 'Center Field')],
  ['right field', phrase('右翼', 'jardín derecho', '우익', '右外野', 'campo direito', 'Right Field')],
  ['strikes out', phrase('三振', 'se poncha', '삼진', '遭三振', 'é eliminado por strikeout', 'schlägt aus')],
  ['hit by pitch', phrase('死球', 'golpeado por lanzamiento', '몸에 맞는 공', '觸身球', 'atingido pelo arremesso', 'von Pitch getroffen')],
  ['home runs', phrase('本塁打を放つ', 'conecta jonrón', '홈런', '擊出全壘打', 'rebate um home run', 'schlägt einen Home Run')],
  ['homers', phrase('本塁打を放つ', 'conecta jonrón', '홈런', '擊出全壘打', 'rebate um home run', 'schlägt einen Home Run')],
  ['triples', phrase('三塁打を放つ', 'conecta triple', '3루타', '擊出三壘安打', 'rebate uma tripla', 'schlägt ein Triple')],
  ['doubles', phrase('二塁打を放つ', 'conecta doble', '2루타', '擊出二壘安打', 'rebate uma dupla', 'schlägt ein Double')],
  ['singles', phrase('単打を放つ', 'conecta sencillo', '안타', '擊出一壘安打', 'rebate uma simples', 'schlägt ein Single')],
  ['grounds out', phrase('ゴロでアウト', 'bate rodado para out', '땅볼 아웃', '滾地球出局', 'é eliminado em bola rasteira', 'scheidet per Groundout aus')],
  ['flies out', phrase('フライでアウト', 'bate elevado para out', '뜬공 아웃', '高飛球出局', 'é eliminado em bola alta', 'scheidet per Flyout aus')],
  ['lines out', phrase('ライナーでアウト', 'batea línea para out', '라인드라이브 아웃', '平飛球出局', 'é eliminado em linha', 'scheidet per Lineout aus')],
  ['pops out', phrase('ポップフライでアウト', 'batea elevado corto para out', '팝플라이 아웃', '內野高飛球出局', 'é eliminado em pop fly', 'scheidet per Popout aus')],
  ['forceout', phrase('フォースアウト', 'out forzado', '포스 아웃', '封殺', 'eliminação forçada', 'Forceout')],
  ['walks', phrase('四球で出塁', 'recibe base por bolas', '볼넷으로 출루', '獲保送', 'recebe walk', 'wird gewalkt')],
  ['scores', phrase('生還', 'anota', '득점', '得分', 'anota', 'erzielt einen Run')],
  ['picked off', phrase('牽制死', 'es sorprendido fuera de base', '견제사', '遭牽制出局', 'é eliminado por pickoff', 'wird per Pickoff ausgeworfen')],
  ['pinch-hitter', phrase('代打', 'bateador emergente', '대타', '代打', 'rebatedor substituto', 'Pinch Hitter')],
  ['pinch-runner', phrase('代走', 'corredor emergente', '대주자', '代跑', 'corredor substituto', 'Pinch Runner')],
  ['shortstop', phrase('遊撃手', 'campocorto', '유격수', '游擊手', 'interbases', 'Shortstop')],
  ['pitcher', phrase('投手', 'lanzador', '투수', '投手', 'arremessador', 'Pitcher')],
  ['catcher', phrase('捕手', 'receptor', '포수', '捕手', 'receptor', 'Catcher')],
  ['batter', phrase('打者', 'bateador', '타자', '打者', 'rebatedor', 'Batter')],
  ['sinker', phrase('シンカー', 'sinker', '싱커', '伸卡球', 'sinker', 'Sinker')],
  ['slider', phrase('スライダー', 'slider', '슬라이더', '滑球', 'slider', 'Slider')],
  ['sweeper', phrase('スイーパー', 'sweeper', '스위퍼', '橫掃球', 'sweeper', 'Sweeper')],
  ['changeup', phrase('チェンジアップ', 'cambio', '체인지업', '變速球', 'changeup', 'Changeup')],
  ['curveball', phrase('カーブ', 'curva', '커브', '曲球', 'curva', 'Curveball')],
  ['cutter', phrase('カットボール', 'cutter', '커터', '卡特球', 'cutter', 'Cutter')],
  ['splitter', phrase('スプリット', 'splitter', '스플리터', '指叉球', 'splitter', 'Splitter')],
  ['knuckleball', phrase('ナックルボール', 'bola de nudillos', '너클볼', '蝴蝶球', 'knuckleball', 'Knuckleball')],
  ['foul tip', phrase('ファウルチップ', 'foul tip', '파울 팁', '擦棒球', 'foul tip', 'Foul Tip')],
  ['foul bunt', phrase('バントファウル', 'toque de foul', '번트 파울', '觸擊界外', 'bunt em foul', 'Foul Bunt')],
  ['foul', phrase('ファウル', 'foul', '파울', '界外球', 'foul', 'Foul')],
  ['ball', phrase('ボール', 'bola', '볼', '壞球', 'bola', 'Ball')],
  ['in play', phrase('インプレー', 'en juego', '인플레이', '進入場內', 'em jogo', 'im Spiel')],
  ['reviewed', phrase('レビュー判定', 'revisado', '비디오 판독', '經重播檢視', 'revisado', 'überprüft')],
  ['confirmed', phrase('判定維持', 'confirmado', '원심 유지', '維持原判', 'confirmado', 'bestätigt')],
  ['overturned', phrase('判定変更', 'revocado', '판정 번복', '改判', 'revertido', 'aufgehoben')],
  ['no play', phrase('プレーなし', 'sin jugada', '플레이 없음', '無有效比賽', 'sem jogada', 'kein Spielzug')],
  ['out at', phrase('でアウト', 'out en', '에서 아웃', '於出局', 'eliminado em', 'aus an')],
  ['on a', phrase('、', 'en una', '', '，', 'em uma', 'mit einem')],
  ['on an', phrase('、', 'en un', '', '，', 'em um', 'mit einem')],
  ['to', phrase('へ', 'a', '로', '至', 'para', 'zu')],
  ['by', phrase('による', 'por', '에 의해', '由', 'por', 'durch')],
  ['and', phrase('と', 'y', '및', '與', 'e', 'und')],
];

const BASEBALL_SIGNAL = /\b(?:strike|ball|pitch|walk|single|double|triple|homer|home run|ground|fly|line|pop|fielder|baseman|shortstop|catcher|scores?|advances?|steals?|out|error|bunt|balk|inning|substitution|mound|reviewed|overturned)\b/i;
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const translateBaseballDynamic = (source: string, locale: ScoutLocale): string | null => {
  if (locale === 'en' || !BASEBALL_SIGNAL.test(source)) return null;
  let result = source;
  for (const [english, values] of BASEBALL_PHRASES) {
    const expression = new RegExp(`(?<![A-Za-z])${escapeRegExp(english)}(?![A-Za-z])`, 'gi');
    result = result.replace(expression, values[locale]);
  }
  return result === source ? null : result;
};
