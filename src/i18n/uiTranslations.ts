import type { ScoutLocale } from './LanguageContext';
import { EXTRA_TRANSLATION_ROWS } from './uiTranslationsExtra';

export type LocalizedValues = readonly [ja: string, es: string, ko: string, zhTw: string, ptBr: string, de: string];
export type TranslationRow = readonly [source: string, ...values: LocalizedValues];

const LOCALE_INDEX: Record<Exclude<ScoutLocale, 'en'>, number> = {
  ja: 1,
  es: 2,
  ko: 3,
  'zh-TW': 4,
  'pt-BR': 5,
  de: 6,
};

// This catalog is intentionally based on the visible English copy already used by
// ScoutCore. It lets legacy pages participate in the same language selector without
// duplicating their complete JSX trees for every language.
const TRANSLATION_ROWS: TranslationRow[] = [
  ['All', 'すべて', 'Todo', '전체', '全部', 'Tudo', 'Alle'],
  ['ALL', 'すべて', 'TODO', '전체', '全部', 'TUDO', 'ALLE'],
  ['Back', '戻る', 'Volver', '뒤로', '返回', 'Voltar', 'Zurück'],
  ['BACK', '戻る', 'VOLVER', '뒤로', '返回', 'VOLTAR', 'ZURÜCK'],
  ['Close', '閉じる', 'Cerrar', '닫기', '關閉', 'Fechar', 'Schließen'],
  ['Refresh', '更新', 'Actualizar', '새로고침', '重新整理', 'Atualizar', 'Aktualisieren'],
  ['REFRESH', '更新', 'ACTUALIZAR', '새로고침', '重新整理', 'ATUALIZAR', 'AKTUALISIEREN'],
  ['Loading…', '読み込み中…', 'Cargando…', '불러오는 중…', '載入中…', 'Carregando…', 'Wird geladen…'],
  ['Loading...', '読み込み中...', 'Cargando...', '불러오는 중...', '載入中...', 'Carregando...', 'Wird geladen...'],
  ['TRY AGAIN', 'もう一度試す', 'INTENTAR DE NUEVO', '다시 시도', '再試一次', 'TENTAR NOVAMENTE', 'ERNEUT VERSUCHEN'],
  ['Continue', '続ける', 'Continuar', '계속', '繼續', 'Continuar', 'Weiter'],
  ['CONTINUE', '続ける', 'CONTINUAR', '계속', '繼續', 'CONTINUAR', 'WEITER'],
  ['Cancel', 'キャンセル', 'Cancelar', '취소', '取消', 'Cancelar', 'Abbrechen'],
  ['CANCEL', 'キャンセル', 'CANCELAR', '취소', '取消', 'CANCELAR', 'ABBRECHEN'],
  ['Confirm', '確認', 'Confirmar', '확인', '確認', 'Confirmar', 'Bestätigen'],
  ['Accept', '承認', 'Aceptar', '수락', '接受', 'Aceitar', 'Annehmen'],
  ['Decline', '辞退', 'Rechazar', '거절', '拒絕', 'Recusar', 'Ablehnen'],
  ['Edit', '編集', 'Editar', '수정', '編輯', 'Editar', 'Bearbeiten'],
  ['Save', '保存', 'Guardar', '저장', '儲存', 'Salvar', 'Speichern'],
  ['Search', '検索', 'Buscar', '검색', '搜尋', 'Pesquisar', 'Suchen'],
  ['SEARCH', '検索', 'BUSCAR', '검색', '搜尋', 'PESQUISAR', 'SUCHEN'],
  ['Filters', 'フィルター', 'Filtros', '필터', '篩選', 'Filtros', 'Filter'],
  ['FILTERS', 'フィルター', 'FILTROS', '필터', '篩選', 'FILTROS', 'FILTER'],
  ['CLEAR FILTERS', 'フィルターをクリア', 'BORRAR FILTROS', '필터 지우기', '清除篩選', 'LIMPAR FILTROS', 'FILTER LÖSCHEN'],
  ['Select', '選択', 'Seleccionar', '선택', '選擇', 'Selecionar', 'Auswählen'],
  ['Choose', '選ぶ', 'Elegir', '선택', '選擇', 'Escolher', 'Auswählen'],
  ['Analyze', '分析', 'Analizar', '분석', '分析', 'Analisar', 'Analysieren'],
  ['ANALYZE', '分析', 'ANALIZAR', '분석', '分析', 'ANALISAR', 'ANALYSIEREN'],
  ['RESET', 'リセット', 'RESTABLECER', '초기화', '重設', 'REDEFINIR', 'ZURÜCKSETZEN'],
  ['View', '表示', 'Ver', '보기', '查看', 'Ver', 'Ansehen'],
  ['VIEW MORE →', 'もっと見る →', 'VER MÁS →', '더 보기 →', '查看更多 →', 'VER MAIS →', 'MEHR ANZEIGEN →'],
  ['VIEW REPORT →', 'レポートを見る →', 'VER INFORME →', '보고서 보기 →', '查看報告 →', 'VER RELATÓRIO →', 'BERICHT ANSEHEN →'],
  ['VIEW FULL REPORT →', '完全なレポートを見る →', 'VER INFORME COMPLETO →', '전체 보고서 보기 →', '查看完整報告 →', 'VER RELATÓRIO COMPLETO →', 'VOLLSTÄNDIGEN BERICHT ANSEHEN →'],
  ['LIVE', 'ライブ', 'EN VIVO', '라이브', '即時', 'AO VIVO', 'LIVE'],
  ['Live', 'ライブ', 'En vivo', '라이브', '即時', 'Ao vivo', 'Live'],
  ['Upcoming', '予定', 'Próximos', '예정', '即將開始', 'Próximos', 'Bevorstehend'],
  ['UPCOMING', '予定', 'PRÓXIMOS', '예정', '即將開始', 'PRÓXIMOS', 'BEVORSTEHEND'],
  ['Finished', '終了', 'Finalizados', '종료', '已結束', 'Finalizados', 'Beendet'],
  ['FINISHED', '終了', 'FINALIZADOS', '종료', '已結束', 'FINALIZADOS', 'BEENDET'],
  ['Final', '試合終了', 'Final', '경기 종료', '比賽結束', 'Final', 'Endstand'],
  ['FINAL', '試合終了', 'FINAL', '경기 종료', '比賽結束', 'FINAL', 'ENDSTAND'],
  ['Today', '今日', 'Hoy', '오늘', '今天', 'Hoje', 'Heute'],
  ['TODAY', '今日', 'HOY', '오늘', '今天', 'HOJE', 'HEUTE'],
  ['Tomorrow', '明日', 'Mañana', '내일', '明天', 'Amanhã', 'Morgen'],
  ['Yesterday', '昨日', 'Ayer', '어제', '昨天', 'Ontem', 'Gestern'],
  ['Date', '日付', 'Fecha', '날짜', '日期', 'Data', 'Datum'],
  ['DATE', '日付', 'FECHA', '날짜', '日期', 'DATA', 'DATUM'],
  ['Team', 'チーム', 'Equipo', '팀', '球隊', 'Time', 'Team'],
  ['TEAM', 'チーム', 'EQUIPO', '팀', '球隊', 'TIME', 'TEAM'],
  ['Player', '選手', 'Jugador', '선수', '球員', 'Jogador', 'Spieler'],
  ['PLAYER', '選手', 'JUGADOR', '선수', '球員', 'JOGADOR', 'SPIELER'],
  ['Pitcher', '投手', 'Lanzador', '투수', '投手', 'Arremessador', 'Pitcher'],
  ['PITCHER', '投手', 'LANZADOR', '투수', '投手', 'ARREMESSADOR', 'PITCHER'],
  ['Batter', '打者', 'Bateador', '타자', '打者', 'Rebatedor', 'Batter'],
  ['BATTER', '打者', 'BATEADOR', '타자', '打者', 'REBATEDOR', 'BATTER'],
  ['Game', '試合', 'Partido', '경기', '比賽', 'Jogo', 'Spiel'],
  ['Games', '試合', 'Partidos', '경기', '比賽', 'Jogos', 'Spiele'],
  ['Results', '結果', 'Resultados', '결과', '結果', 'Resultados', 'Ergebnisse'],
  ['Statistics', '統計', 'Estadísticas', '통계', '統計', 'Estatísticas', 'Statistiken'],
  ['STATISTICS', '統計', 'ESTADÍSTICAS', '통계', '統計', 'ESTATÍSTICAS', 'STATISTIKEN'],
  ['Performance', 'パフォーマンス', 'Rendimiento', '성과', '表現', 'Desempenho', 'Leistung'],
  ['Accuracy', '的中率', 'Precisión', '정확도', '準確率', 'Precisão', 'Genauigkeit'],
  ['Current Streak', '現在の連続記録', 'Racha actual', '현재 연속 기록', '目前連勝', 'Sequência atual', 'Aktuelle Serie'],
  ['Best Streak', '最高連続記録', 'Mejor racha', '최고 연속 기록', '最佳連勝', 'Melhor sequência', 'Beste Serie'],
  ['Total Points', '合計ポイント', 'Puntos totales', '총 포인트', '總積分', 'Pontos totais', 'Gesamtpunkte'],
  ['Total Predictions', '予測合計', 'Predicciones totales', '총 예측', '預測總數', 'Previsões totais', 'Prognosen gesamt'],
  ['Correct Picks', '的中予測', 'Aciertos', '적중 예측', '正確預測', 'Palpites corretos', 'Richtige Tipps'],
  ['View all', 'すべて見る', 'Ver todo', '모두 보기', '查看全部', 'Ver tudo', 'Alle ansehen'],
  ['View all stats ›', 'すべての統計を見る ›', 'Ver todas las estadísticas ›', '모든 통계 보기 ›', '查看所有統計 ›', 'Ver todas as estatísticas ›', 'Alle Statistiken ansehen ›'],
  ['Back to profile', 'プロフィールに戻る', 'Volver al perfil', '프로필로 돌아가기', '返回個人檔案', 'Voltar ao perfil', 'Zurück zum Profil'],
  ['BACK TO DASHBOARD', 'ダッシュボードへ戻る', 'VOLVER AL PANEL', '대시보드로 돌아가기', '返回儀表板', 'VOLTAR AO PAINEL', 'ZURÜCK ZUR ÜBERSICHT'],

  ['LIVE NOW', 'ライブ中', 'EN VIVO AHORA', '현재 라이브', '正在直播', 'AO VIVO AGORA', 'JETZT LIVE'],
  ["TODAY'S GAMES", '今日の試合', 'PARTIDOS DE HOY', '오늘의 경기', '今日賽事', 'JOGOS DE HOJE', 'HEUTIGE SPIELE'],
  ['TODAY’S GAMES', '今日の試合', 'PARTIDOS DE HOY', '오늘의 경기', '今日賽事', 'JOGOS DE HOJE', 'HEUTIGE SPIELE'],
  ["Today's MLB Games", '今日のMLB試合', 'Partidos de MLB de hoy', '오늘의 MLB 경기', '今日 MLB 賽事', 'Jogos da MLB de hoje', 'Heutige MLB-Spiele'],
  ['LIVE GAME ENGINE', 'ライブゲームエンジン', 'MOTOR DE JUEGO EN VIVO', '라이브 게임 엔진', '即時比賽引擎', 'MOTOR DE JOGO AO VIVO', 'LIVE-SPIEL-ENGINE'],
  ['Gameday Intelligence', '試合当日インテリジェンス', 'Inteligencia del día de juego', '게임데이 인텔리전스', '比賽日情報', 'Inteligência do dia de jogo', 'Gameday-Intelligenz'],
  ['Daily ScoutCore Intelligence', 'ScoutCore デイリーインテリジェンス', 'Inteligencia diaria de ScoutCore', '일일 ScoutCore 인텔리전스', 'ScoutCore 每日情報', 'Inteligência diária ScoutCore', 'Tägliche ScoutCore-Analyse'],
  ['DAILY SCOUTCORE INTELLIGENCE', 'SCOUTCORE デイリーインテリジェンス', 'INTELIGENCIA DIARIA DE SCOUTCORE', '일일 SCOUTCORE 인텔리전스', 'SCOUTCORE 每日情報', 'INTELIGÊNCIA DIÁRIA SCOUTCORE', 'TÄGLICHE SCOUTCORE-ANALYSE'],
  ['WHAT MATTERS TODAY · VERIFIED MLB SIGNALS', '今日の重要ポイント · 検証済みMLBシグナル', 'LO IMPORTANTE HOY · SEÑALES MLB VERIFICADAS', '오늘의 핵심 · 검증된 MLB 신호', '今日重點 · 已驗證 MLB 訊號', 'O QUE IMPORTA HOJE · SINAIS MLB VERIFICADOS', 'HEUTE WICHTIG · VERIFIZIERTE MLB-SIGNALE'],
  ['● AUTO-UPDATING', '● 自動更新', '● ACTUALIZACIÓN AUTOMÁTICA', '● 자동 업데이트', '● 自動更新', '● ATUALIZAÇÃO AUTOMÁTICA', '● AUTOMATISCHE AKTUALISIERUNG'],
  ['TODAY’S SIGNAL BOARD', '今日のシグナルボード', 'TABLERO DE SEÑALES DE HOY', '오늘의 신호 보드', '今日訊號看板', 'PAINEL DE SINAIS DE HOJE', 'HEUTIGES SIGNALBOARD'],
  ['Matchup Edges', '対戦優位性', 'Ventajas del enfrentamiento', '매치업 우위', '對戰優勢', 'Vantagens do confronto', 'Matchup-Vorteile'],
  ['Hot Players', '注目選手', 'Jugadores destacados', '주목 선수', '熱門球員', 'Jogadores em destaque', 'Heiße Spieler'],
  ['Watch Alerts', '注目アラート', 'Alertas a seguir', '관찰 알림', '關注提醒', 'Alertas de observação', 'Beobachtungshinweise'],
  ['Signals are analytics clues, not guaranteed outcomes.', 'シグナルは分析上の手がかりであり、結果を保証するものではありません。', 'Las señales son pistas analíticas, no resultados garantizados.', '신호는 분석 단서이며 결과를 보장하지 않습니다.', '訊號是分析線索，不保證結果。', 'Os sinais são pistas analíticas, não resultados garantidos.', 'Signale sind Analysehinweise, keine garantierten Ergebnisse.'],
  ['VIEW DAILY REPORT', 'デイリーレポートを見る', 'VER INFORME DIARIO', '일일 보고서 보기', '查看每日報告', 'VER RELATÓRIO DIÁRIO', 'TAGESBERICHT ANSEHEN'],
  ['What is Daily ScoutCore Intelligence?', 'ScoutCore デイリーインテリジェンスとは？', '¿Qué es la Inteligencia diaria de ScoutCore?', '일일 ScoutCore 인텔리전스란?', '什麼是 ScoutCore 每日情報？', 'O que é a Inteligência diária ScoutCore?', 'Was ist die tägliche ScoutCore-Analyse?'],
  ['This is ScoutCore’s signal board — not another schedule. It highlights verified matchup edges, recent hitter form, pitcher trends and bullpen watch items that may deserve a deeper look.', 'これは単なる日程表ではなく、ScoutCore のシグナルボードです。検証済みの対戦優位性、打者の直近調子、投手傾向、ブルペンの注目点を表示します。', 'Este es el tablero de señales de ScoutCore, no otro calendario. Destaca ventajas verificadas, forma reciente de bateadores, tendencias de lanzadores y alertas del bullpen.', '이 화면은 단순 일정이 아닌 ScoutCore 신호 보드입니다. 검증된 매치업 우위, 타자 최근 흐름, 투수 추세와 불펜 주의 항목을 보여줍니다.', '這是 ScoutCore 的訊號看板，不是另一個賽程表。它顯示已驗證的對戰優勢、打者近況、投手趨勢與牛棚關注項目。', 'Este é o painel de sinais do ScoutCore, não apenas outra agenda. Ele destaca vantagens verificadas, fase recente dos rebatedores, tendências de arremessadores e alertas do bullpen.', 'Dies ist das ScoutCore-Signalboard, kein weiterer Spielplan. Es zeigt verifizierte Matchup-Vorteile, aktuelle Batter-Form, Pitcher-Trends und Bullpen-Hinweise.'],
  ['Live MLB games · tap a game to open ScoutCore Gameday', 'MLBライブ試合 · タップしてScoutCore Gamedayを開く', 'Partidos MLB en vivo · toca un partido para abrir ScoutCore Gameday', 'MLB 라이브 경기 · 탭하여 ScoutCore Gameday 열기', 'MLB 即時賽事 · 點選開啟 ScoutCore Gameday', 'Jogos MLB ao vivo · toque para abrir o ScoutCore Gameday', 'Live-MLB-Spiele · antippen, um ScoutCore Gameday zu öffnen'],
  ['OPEN GAMEDAY →', 'GAMEDAYを開く →', 'ABRIR GAMEDAY →', 'GAMEDAY 열기 →', '開啟 GAMEDAY →', 'ABRIR GAMEDAY →', 'GAMEDAY ÖFFNEN →'],
  ['No MLB games are live right now. This section will automatically fill when a game starts.', '現在ライブ中のMLB試合はありません。試合開始時に自動表示されます。', 'No hay partidos MLB en vivo ahora. Esta sección se llenará automáticamente cuando empiece uno.', '현재 라이브 MLB 경기가 없습니다. 경기가 시작되면 자동으로 표시됩니다.', '目前沒有 MLB 即時賽事。比賽開始後此區會自動顯示。', 'Não há jogos da MLB ao vivo agora. Esta seção será preenchida automaticamente quando um jogo começar.', 'Derzeit läuft kein MLB-Spiel live. Dieser Bereich füllt sich automatisch, sobald ein Spiel beginnt.'],
  ['MLB Schedule', 'MLB スケジュール', 'Calendario MLB', 'MLB 일정', 'MLB 賽程', 'Agenda MLB', 'MLB-Spielplan'],
  ['Game times shown in Eastern Time (ET).', '試合時間は米国東部時間（ET）で表示されます。', 'Los horarios se muestran en hora del Este (ET).', '경기 시간은 미국 동부 시간(ET)으로 표시됩니다.', '比賽時間以美東時間（ET）顯示。', 'Os horários são exibidos no fuso do leste dos EUA (ET).', 'Spielzeiten werden in Eastern Time (ET) angezeigt.'],
  ['Previous day', '前日', 'Día anterior', '이전 날짜', '前一天', 'Dia anterior', 'Vorheriger Tag'],
  ['Next day', '翌日', 'Día siguiente', '다음 날짜', '後一天', 'Próximo dia', 'Nächster Tag'],
  ['PROBABLE PITCHERS', '予告先発', 'LANZADORES PROBABLES', '예상 선발 투수', '預計先發投手', 'ARREMESSADORES PROVÁVEIS', 'VORAUSSICHTLICHE PITCHER'],
  ['STARTERS', '先発投手', 'ABRIDORES', '선발 투수', '先發投手', 'TITULARES', 'STARTER'],
  ['No MLB games are scheduled for this date.', 'この日のMLB試合はありません。', 'No hay partidos MLB programados para esta fecha.', '이 날짜에는 MLB 경기가 없습니다.', '此日期沒有 MLB 賽事。', 'Não há jogos da MLB marcados para esta data.', 'Für dieses Datum sind keine MLB-Spiele angesetzt.'],
  ['No MLB games are scheduled today.', '今日のMLB試合はありません。', 'No hay partidos MLB programados hoy.', '오늘 예정된 MLB 경기가 없습니다.', '今天沒有 MLB 賽事。', 'Não há jogos da MLB marcados para hoje.', 'Heute sind keine MLB-Spiele angesetzt.'],
  ['Loading MLB schedule…', 'MLBスケジュールを読み込み中…', 'Cargando calendario MLB…', 'MLB 일정 불러오는 중…', '正在載入 MLB 賽程…', 'Carregando agenda MLB…', 'MLB-Spielplan wird geladen…'],
  ['Scores refresh automatically.', 'スコアは自動更新されます。', 'Los marcadores se actualizan automáticamente.', '점수는 자동으로 업데이트됩니다.', '比分會自動更新。', 'Os placares são atualizados automaticamente.', 'Spielstände werden automatisch aktualisiert.'],
];

const copyBySource = new Map<string, TranslationRow>();
const copyBySourceFolded = new Map<string, TranslationRow>();
for (const row of [...TRANSLATION_ROWS, ...EXTRA_TRANSLATION_ROWS]) {
  const source = row[0].replace(/\s+/g, ' ').trim();
  copyBySource.set(source, row);
  copyBySourceFolded.set(source.toLocaleLowerCase('en-US'), row);
}

export const localeForIntl = (locale: ScoutLocale) => ({
  en: 'en-US', ja: 'ja-JP', es: 'es-ES', ko: 'ko-KR', 'zh-TW': 'zh-TW', 'pt-BR': 'pt-BR', de: 'de-DE',
}[locale]);

const exactTranslation = (source: string, locale: ScoutLocale) => {
  if (locale === 'en') return source;
  const row = copyBySource.get(source) ?? copyBySourceFolded.get(source.toLocaleLowerCase('en-US'));
  const translated = row?.[LOCALE_INDEX[locale]] ?? null;
  if (!translated) return null;
  const hasLetters = /[A-Za-zÀ-ÿ]/.test(source);
  const isUppercase = hasLetters && source === source.toLocaleUpperCase('en-US');
  return isUppercase ? translated.toLocaleUpperCase(localeForIntl(locale)) : translated;
};

const preserveOuterWhitespace = (original: string, translated: string) => {
  const start = original.match(/^\s*/)?.[0] ?? '';
  const end = original.match(/\s*$/)?.[0] ?? '';
  return `${start}${translated}${end}`;
};

const translateDynamic = (source: string, locale: ScoutLocale): string | null => {
  const intl = localeForIntl(locale);
  const localized = <T extends Record<Exclude<ScoutLocale, 'en'>, string>>(values: T) => values[locale as Exclude<ScoutLocale, 'en'>];
  const connectedGames = source.match(/^ScoutCore is connected directly to MLB data\.\s*(\d+) games are scheduled today(?:,\s*with\s*(\d+)\s*live)?\.?$/i);
  if (connectedGames) {
    const count = connectedGames[1];
    const live = connectedGames[2];
    return localized({
      ja: live ? `ScoutCore はMLBデータに直接接続されています。本日は${count}試合が予定され、現在${live}試合がライブ中です。` : `ScoutCore はMLBデータに直接接続されています。本日は${count}試合が予定されています。`,
      es: live ? `ScoutCore está conectado directamente a los datos de MLB. Hoy hay ${count} partidos programados, con ${live} en vivo.` : `ScoutCore está conectado directamente a los datos de MLB. Hoy hay ${count} partidos programados.`,
      ko: live ? `ScoutCore는 MLB 데이터에 직접 연결되어 있습니다. 오늘 ${count}경기가 예정되어 있으며 ${live}경기가 진행 중입니다.` : `ScoutCore는 MLB 데이터에 직접 연결되어 있습니다. 오늘 ${count}경기가 예정되어 있습니다.`,
      'zh-TW': live ? `ScoutCore 直接連接 MLB 資料。今天有 ${count} 場比賽，其中 ${live} 場正在進行。` : `ScoutCore 直接連接 MLB 資料。今天有 ${count} 場比賽。`,
      'pt-BR': live ? `O ScoutCore está conectado diretamente aos dados da MLB. Há ${count} jogos programados hoje, com ${live} ao vivo.` : `O ScoutCore está conectado diretamente aos dados da MLB. Há ${count} jogos programados hoje.`,
      de: live ? `ScoutCore ist direkt mit MLB-Daten verbunden. Heute sind ${count} Spiele angesetzt, davon ${live} live.` : `ScoutCore ist direkt mit MLB-Daten verbunden. Heute sind ${count} Spiele angesetzt.`,
    });
  }
  const gamesToday = source.match(/^(\d+) games are scheduled today\.?$/i);
  if (gamesToday) {
    const count = gamesToday[1];
    return ({ ja: `本日は${count}試合が予定されています。`, es: `Hoy hay ${count} partidos programados.`, ko: `오늘 ${count}경기가 예정되어 있습니다.`, 'zh-TW': `今天有 ${count} 場比賽。`, 'pt-BR': `Há ${count} jogos programados hoje.`, de: `Heute sind ${count} Spiele angesetzt.` } as const)[locale as Exclude<ScoutLocale, 'en'>];
  }
  const watchGames = source.match(/^ScoutCore is watching (\d+) MLB games today$/i);
  if (watchGames) {
    const count = watchGames[1];
    return ({ ja: `ScoutCore は今日のMLB ${count}試合をチェック中`, es: `ScoutCore sigue ${count} partidos de MLB hoy`, ko: `ScoutCore가 오늘 MLB ${count}경기를 확인 중입니다`, 'zh-TW': `ScoutCore 正在關注今天的 ${count} 場 MLB 賽事`, 'pt-BR': `O ScoutCore acompanha ${count} jogos da MLB hoje`, de: `ScoutCore beobachtet heute ${count} MLB-Spiele` } as const)[locale as Exclude<ScoutLocale, 'en'>];
  }
  const updated = source.match(/^UPDATED\s+(.+)$/i);
  if (updated) {
    const label = ({ ja: '更新', es: 'ACTUALIZADO', ko: '업데이트', 'zh-TW': '更新', 'pt-BR': 'ATUALIZADO', de: 'AKTUALISIERT' } as const)[locale as Exclude<ScoutLocale, 'en'>];
    return `${label} ${updated[1]}`;
  }
  const inning = source.match(/^(TOP|BOT|MID|END)\s+(\d+)(?:ST|ND|RD|TH)?$/i);
  if (inning) {
    const state = inning[1].toUpperCase();
    const number = inning[2];
    const labels = {
      ja: { TOP: '表', BOT: '裏', MID: '中', END: '終了' },
      es: { TOP: 'Alta', BOT: 'Baja', MID: 'Media', END: 'Fin' },
      ko: { TOP: '초', BOT: '말', MID: '중간', END: '종료' },
      'zh-TW': { TOP: '上', BOT: '下', MID: '中', END: '結束' },
      'pt-BR': { TOP: 'Alta', BOT: 'Baixa', MID: 'Meio', END: 'Fim' },
      de: { TOP: 'Oben', BOT: 'Unten', MID: 'Mitte', END: 'Ende' },
    } as const;
    const label = labels[locale as Exclude<ScoutLocale, 'en'>][state as keyof typeof labels.ja];
    if (locale === 'ja') return `${number}回${label}`;
    if (locale === 'ko') return `${number}회 ${label}`;
    if (locale === 'zh-TW') return `${number}局${label}`;
    if (locale === 'pt-BR') return `${label} da ${number}ª`;
    if (locale === 'de') return `${label} ${number}`;
    return `${label} ${number}`;
  }
  const countedTab = source.match(/^(Upcoming|Finished)\s*\((\d+)\)$/i);
  if (countedTab) {
    const label = exactTranslation(countedTab[1], locale) ?? countedTab[1];
    return `${label} (${countedTab[2]})`;
  }
  const countLabel = source.match(/^(\d+)\s+(picks|predictions)$/i);
  if (countLabel) {
    const count = countLabel[1];
    const predictions = countLabel[2].toLocaleLowerCase('en-US') === 'predictions';
    return localized({
      ja: `${count}${predictions ? '件の予測' : '予測'}`,
      es: `${count} ${predictions ? 'predicciones' : 'pronósticos'}`,
      ko: `${count}개 ${predictions ? '예측' : '선택'}`,
      'zh-TW': `${count} 個${predictions ? '預測' : '選擇'}`,
      'pt-BR': `${count} ${predictions ? 'previsões' : 'palpites'}`,
      de: `${count} ${predictions ? 'Prognosen' : 'Tipps'}`,
    });
  }
  const predictionSummary = source.match(/^(\d+)\s+upcoming\s+·\s+(\d+)\s+finished$/i);
  if (predictionSummary) return localized({
    ja: `予定 ${predictionSummary[1]}件 · 終了 ${predictionSummary[2]}件`,
    es: `${predictionSummary[1]} próximas · ${predictionSummary[2]} finalizadas`,
    ko: `예정 ${predictionSummary[1]}개 · 종료 ${predictionSummary[2]}개`,
    'zh-TW': `${predictionSummary[1]} 個即將開始 · ${predictionSummary[2]} 個已結束`,
    'pt-BR': `${predictionSummary[1]} próximas · ${predictionSummary[2]} finalizadas`,
    de: `${predictionSummary[1]} bevorstehend · ${predictionSummary[2]} beendet`,
  });
  const correct = source.match(/^(\d+)\s+correct$/i);
  if (correct) return localized({ ja: `${correct[1]}正解`, es: `${correct[1]} correctos`, ko: `${correct[1]}개 정답`, 'zh-TW': `${correct[1]} 個正確`, 'pt-BR': `${correct[1]} corretos`, de: `${correct[1]} richtig` });
  const rank = source.match(/^Rank\s+#(\d+)$/i);
  if (rank) return localized({ ja: `第${rank[1]}位`, es: `Puesto #${rank[1]}`, ko: `${rank[1]}위`, 'zh-TW': `第 ${rank[1]} 名`, 'pt-BR': `Posição #${rank[1]}`, de: `Rang #${rank[1]}` });
  const signals = source.match(/^ScoutCore found (\d+) signals worth watching today$/i);
  if (signals) return localized({
    ja: `ScoutCore が今日注目すべき${signals[1]}件のシグナルを検出`,
    es: `ScoutCore encontró ${signals[1]} señales para seguir hoy`,
    ko: `ScoutCore가 오늘 주목할 신호 ${signals[1]}개를 찾았습니다`,
    'zh-TW': `ScoutCore 找到今天值得關注的 ${signals[1]} 個訊號`,
    'pt-BR': `O ScoutCore encontrou ${signals[1]} sinais para acompanhar hoje`,
    de: `ScoutCore hat heute ${signals[1]} beachtenswerte Signale gefunden`,
  });
  const signalSummary = source.match(/^(\d+) matchup edges?, (\d+) hot (?:hitters|players) and (\d+) pitcher\/bullpen watch alerts are currently verified\. (\d+) signals have confidence of at least (\d+)%\.$/i);
  if (signalSummary) return localized({
    ja: `現在、対戦優位性${signalSummary[1]}件、注目打者${signalSummary[2]}人、投手／ブルペン注目${signalSummary[3]}件を検証済みです。信頼度${signalSummary[5]}%以上のシグナルは${signalSummary[4]}件です。`,
    es: `Hay ${signalSummary[1]} ventajas, ${signalSummary[2]} bateadores destacados y ${signalSummary[3]} alertas de lanzador/bullpen verificadas. ${signalSummary[4]} señales tienen al menos ${signalSummary[5]}% de confianza.`,
    ko: `현재 매치업 우위 ${signalSummary[1]}개, 주목 타자 ${signalSummary[2]}명, 투수/불펜 알림 ${signalSummary[3]}개가 검증되었습니다. 신뢰도 ${signalSummary[5]}% 이상 신호는 ${signalSummary[4]}개입니다.`,
    'zh-TW': `目前已驗證 ${signalSummary[1]} 個對戰優勢、${signalSummary[2]} 名熱門打者與 ${signalSummary[3]} 個投手／牛棚提醒。${signalSummary[4]} 個訊號的信心度至少為 ${signalSummary[5]}%。`,
    'pt-BR': `Há ${signalSummary[1]} vantagens, ${signalSummary[2]} rebatedores em destaque e ${signalSummary[3]} alertas de arremessador/bullpen verificados. ${signalSummary[4]} sinais têm pelo menos ${signalSummary[5]}% de confiança.`,
      de: `${signalSummary[1]} Matchup-Vorteile, ${signalSummary[2]} heiße Batter und ${signalSummary[3]} Pitcher-/Bullpen-Hinweise sind verifiziert. ${signalSummary[4]} Signale haben mindestens ${signalSummary[5]}% Konfidenz.`,
    });
  const shortSignalSummary = source.match(/^(\d+) matchup edges?, (\d+) hot (?:hitters|players) and (\d+) pitcher\/bullpen watch alerts are currently verified\.$/i);
  if (shortSignalSummary) return localized({
    ja: `現在、対戦優位性${shortSignalSummary[1]}件、注目打者${shortSignalSummary[2]}人、投手／ブルペン注目${shortSignalSummary[3]}件を検証済みです。`,
    es: `Hay ${shortSignalSummary[1]} ventajas, ${shortSignalSummary[2]} bateadores destacados y ${shortSignalSummary[3]} alertas de lanzador/bullpen verificadas.`,
    ko: `현재 매치업 우위 ${shortSignalSummary[1]}개, 주목 타자 ${shortSignalSummary[2]}명, 투수/불펜 알림 ${shortSignalSummary[3]}개가 검증되었습니다.`,
    'zh-TW': `目前已驗證 ${shortSignalSummary[1]} 個對戰優勢、${shortSignalSummary[2]} 名熱門打者與 ${shortSignalSummary[3]} 個投手／牛棚提醒。`,
    'pt-BR': `Há ${shortSignalSummary[1]} vantagens, ${shortSignalSummary[2]} rebatedores em destaque e ${shortSignalSummary[3]} alertas de arremessador/bullpen verificados.`,
    de: `${shortSignalSummary[1]} Matchup-Vorteile, ${shortSignalSummary[2]} heiße Batter und ${shortSignalSummary[3]} Pitcher-/Bullpen-Hinweise sind verifiziert.`,
  });
  const hitterForm = source.match(/^Last 10 tracked games:\s*(.+?) AVG,\s*(.+?) OPS\. Today's probable opponent is (.+?)\.$/i);
  if (hitterForm) return localized({
    ja: `直近10試合：${hitterForm[1]} AVG、${hitterForm[2]} OPS。本日の予想対戦投手は${hitterForm[3]}です。`,
    es: `Últimos 10 partidos registrados: ${hitterForm[1]} AVG, ${hitterForm[2]} OPS. El rival probable de hoy es ${hitterForm[3]}.`,
    ko: `최근 10경기: ${hitterForm[1]} AVG, ${hitterForm[2]} OPS. 오늘의 예상 상대 투수는 ${hitterForm[3]}입니다.`,
    'zh-TW': `近 10 場比賽：${hitterForm[1]} AVG、${hitterForm[2]} OPS。今天預計對戰投手為 ${hitterForm[3]}。`,
    'pt-BR': `Últimos 10 jogos registrados: ${hitterForm[1]} AVG, ${hitterForm[2]} OPS. O adversário provável de hoje é ${hitterForm[3]}.`,
    de: `Letzte 10 erfasste Spiele: ${hitterForm[1]} AVG, ${hitterForm[2]} OPS. Der voraussichtliche Gegner heute ist ${hitterForm[3]}.`,
  });
  const pitcherForm = source.match(/^Recent 5-game form:\s*(.+?) ERA,\s*(.+?) WHIP and\s*(.+?) K\/9\.$/i);
  if (pitcherForm) return localized({
    ja: `直近5試合：${pitcherForm[1]} ERA、${pitcherForm[2]} WHIP、${pitcherForm[3]} K/9。`,
    es: `Forma de los últimos 5 partidos: ${pitcherForm[1]} ERA, ${pitcherForm[2]} WHIP y ${pitcherForm[3]} K/9.`,
    ko: `최근 5경기 기록: ${pitcherForm[1]} ERA, ${pitcherForm[2]} WHIP, ${pitcherForm[3]} K/9.`,
    'zh-TW': `近 5 場表現：${pitcherForm[1]} ERA、${pitcherForm[2]} WHIP、${pitcherForm[3]} K/9。`,
    'pt-BR': `Forma nos últimos 5 jogos: ${pitcherForm[1]} ERA, ${pitcherForm[2]} WHIP e ${pitcherForm[3]} K/9.`,
    de: `Form der letzten 5 Spiele: ${pitcherForm[1]} ERA, ${pitcherForm[2]} WHIP und ${pitcherForm[3]} K/9.`,
  });
  const pitchersTeam = source.match(/^PITCHERS\s+[–-]\s+(.+)$/i);
  if (pitchersTeam) return `${exactTranslation('Pitchers', locale) ?? 'Pitchers'} – ${pitchersTeam[1]}`;
  const rosterTeam = source.match(/^(Batters|Pitchers)\s+·\s+(.+)$/i);
  if (rosterTeam) return `${exactTranslation(rosterTeam[1], locale) ?? rosterTeam[1]} · ${rosterTeam[2]}`;
  const finalWinner = source.match(/^(.+) win by (\d+)\.$/i);
  if (finalWinner) return localized({
    ja: `${finalWinner[1]}が${finalWinner[2]}点差で勝利。`,
    es: `${finalWinner[1]} gana por ${finalWinner[2]}.`,
    ko: `${finalWinner[1]}이(가) ${finalWinner[2]}점 차로 승리했습니다.`,
    'zh-TW': `${finalWinner[1]} 以 ${finalWinner[2]} 分差獲勝。`,
    'pt-BR': `${finalWinner[1]} vence por ${finalWinner[2]}.`,
    de: `${finalWinner[1]} gewinnt mit ${finalWinner[2]} Run(s) Vorsprung.`,
  });
  const inningBases = source.match(/^(.+?)\.\s+(Runners on base|Bases empty)$/i);
  if (inningBases) {
    const translatedInning = translateDynamic(inningBases[1], locale) ?? inningBases[1];
    const translatedBases = exactTranslation(inningBases[2], locale) ?? inningBases[2];
    return `${translatedInning}. ${translatedBases}`;
  }
  const dateLike = /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+[A-Z][a-z]+\s+\d{1,2},\s+\d{4}$/.test(source);
  if (dateLike) {
    const date = new Date(`${source} 12:00:00`);
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(intl, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date);
  }
  const monthYear = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/.test(source);
  if (monthYear) {
    const date = new Date(`${source.replace(' ', ' 1, ')} 12:00:00`);
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(intl, { month: 'long', year: 'numeric' }).format(date);
  }
  return null;
};

export const translateUiText = (value: string, locale: ScoutLocale) => {
  if (!value || locale === 'en') return value;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return value;
  const translated = exactTranslation(normalized, locale) ?? translateDynamic(normalized, locale);
  return translated ? preserveOuterWhitespace(value, translated) : value;
};
