import type { ScoutLocale } from './LanguageContext';
import { EXTRA_TRANSLATION_ROWS } from './uiTranslationsExtra';
import { COMPLETE_TRANSLATION_ROWS } from './uiTranslationsComplete';
import { toJapaneseKatakanaFallback } from './katakana';
import { translateBaseballDynamic } from './baseballDynamic';
import { finalizeNativeLocaleText } from './nativeLocaleFallbacks';

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
  ['Live MLB games · tap a game to open ScoutCore Gameday', 'MLBライブ試合 · タップしてScoutCore Gamedayを開く', 'Partidos MLB en vivo · toca un partido para abrir el día de juego de ScoutCore', 'MLB 실시간 경기 · 탭하여 ScoutCore 경기 화면 열기', 'MLB 即時賽事 · 點選開啟 ScoutCore 比賽日', 'Jogos MLB ao vivo · toque para abrir o dia de jogo do ScoutCore', 'Laufende MLB-Spiele · antippen, um den ScoutCore-Spieltag zu öffnen'],
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
for (const row of [...TRANSLATION_ROWS, ...EXTRA_TRANSLATION_ROWS, ...COMPLETE_TRANSLATION_ROWS]) {
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
  const inline = (value: string) => exactTranslation(value, locale) ?? value;
  const localizeEmbeddedDate = (value: string) => {
    const text = value.trim();
    const timeOnly = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (timeOnly) {
      const hour = (Number(timeOnly[1]) % 12) + (timeOnly[3].toUpperCase() === 'PM' ? 12 : 0);
      const date = new Date(2000, 0, 1, hour, Number(timeOnly[2]));
      return new Intl.DateTimeFormat(intl, { hour: 'numeric', minute: '2-digit' }).format(date);
    }
    const shortMonthDay = text.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})$/i);
    if (shortMonthDay) {
      const date = new Date(`${shortMonthDay[1]} ${shortMonthDay[2]}, ${new Date().getFullYear()} 12:00:00`);
      if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(intl, { month: 'short', day: 'numeric' }).format(date);
    }
    const longMonthDay = text.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})$/i);
    if (longMonthDay) {
      const date = new Date(`${longMonthDay[1]} ${longMonthDay[2]}, ${new Date().getFullYear()} 12:00:00`);
      if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(intl, { month: 'long', day: 'numeric' }).format(date);
    }
    const shortDateTime = text.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,\s+(\d{1,2}):(\d{2})\s*(AM|PM))?$/i);
    if (shortDateTime) {
      const suffix = shortDateTime[4] ? ` ${shortDateTime[4]}:${shortDateTime[5]} ${shortDateTime[6]}` : ' 12:00 PM';
      const date = new Date(`${shortDateTime[2]} ${shortDateTime[3]}, ${new Date().getFullYear()}${suffix}`);
      if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(intl, {
        weekday: 'short', month: 'short', day: 'numeric',
        ...(shortDateTime[4] ? { hour: 'numeric', minute: '2-digit' } : {}),
      }).format(date);
    }
    const longWeekdayDate = text.match(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})$/i);
    if (longWeekdayDate) {
      const date = new Date(`${longWeekdayDate[2]} ${longWeekdayDate[3]}, ${new Date().getFullYear()} 12:00:00`);
      if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(intl, { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
    }
    return value;
  };
  const relativeTime = source.match(/^(\d+)([mhd])(?:\s+ago)?$/i);
  if (relativeTime) {
    const amount = relativeTime[1];
    const unit = relativeTime[2].toLocaleLowerCase('en-US');
    return localized({
      ja: `${amount}${unit === 'm' ? '分' : unit === 'h' ? '時間' : '日'}前`,
      es: `hace ${amount} ${unit === 'm' ? 'min' : unit === 'h' ? 'h' : 'd'}`,
      ko: `${amount}${unit === 'm' ? '분' : unit === 'h' ? '시간' : '일'} 전`,
      'zh-TW': `${amount}${unit === 'm' ? '分鐘' : unit === 'h' ? '小時' : '天'}前`,
      'pt-BR': `há ${amount} ${unit === 'm' ? 'min' : unit === 'h' ? 'h' : 'd'}`,
      de: `vor ${amount} ${unit === 'm' ? 'Min.' : unit === 'h' ? 'Std.' : 'Tg.'}`,
    });
  }
  if (/^just now$/i.test(source)) return localized({ ja: 'たった今', es: 'Ahora mismo', ko: '방금', 'zh-TW': '剛剛', 'pt-BR': 'Agora mesmo', de: 'Gerade eben' });
  const lockCountdown = source.match(/^Locks in\s+(?:(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m)?$/i);
  if (lockCountdown) {
    const days = lockCountdown[1];
    const hours = lockCountdown[2];
    const minutes = lockCountdown[3];
    const ja = [days && `${days}日`, hours && `${hours}時間`, minutes && `${minutes}分`].filter(Boolean).join('');
    const es = [days && `${days} d`, hours && `${hours} h`, minutes && `${minutes} min`].filter(Boolean).join(' ');
    const ko = [days && `${days}일`, hours && `${hours}시간`, minutes && `${minutes}분`].filter(Boolean).join(' ');
    const zh = [days && `${days}天`, hours && `${hours}小時`, minutes && `${minutes}分鐘`].filter(Boolean).join('');
    const pt = [days && `${days} d`, hours && `${hours} h`, minutes && `${minutes} min`].filter(Boolean).join(' ');
    const de = [days && `${days} Tg.`, hours && `${hours} Std.`, minutes && `${minutes} Min.`].filter(Boolean).join(' ');
    return localized({ ja: `${ja}後に締切`, es: `Se bloquea en ${es}`, ko: `${ko} 후 마감`, 'zh-TW': `${zh}後鎖定`, 'pt-BR': `Bloqueia em ${pt}`, de: `Sperrt in ${de}` });
  }
  const seasonOption = source.match(/^(\d{4})\s+Season$/i);
  if (seasonOption) return localized({ ja: `${seasonOption[1]}年シーズン`, es: `Temporada ${seasonOption[1]}`, ko: `${seasonOption[1]} 시즌`, 'zh-TW': `${seasonOption[1]} 賽季`, 'pt-BR': `Temporada ${seasonOption[1]}`, de: `Saison ${seasonOption[1]}` });
  const noFilteredOpponentGames = source.match(/^No (.+?) games vs (.+?) match these filters in (.+)\.$/i);
  if (noFilteredOpponentGames) return localized({
    ja: `${noFilteredOpponentGames[1]}の対${noFilteredOpponentGames[2]}戦では、${noFilteredOpponentGames[3]}の条件に一致する試合がありません。`,
    es: `Ningún partido de ${noFilteredOpponentGames[1]} contra ${noFilteredOpponentGames[2]} coincide con estos filtros en ${noFilteredOpponentGames[3]}.`,
    ko: `${noFilteredOpponentGames[3]}에서 ${noFilteredOpponentGames[1]}의 ${noFilteredOpponentGames[2]} 상대 경기 중 이 필터와 일치하는 경기가 없습니다.`,
    'zh-TW': `${noFilteredOpponentGames[3]} 中，${noFilteredOpponentGames[1]} 對 ${noFilteredOpponentGames[2]} 的比賽沒有符合這些篩選條件的項目。`,
    'pt-BR': `Nenhum jogo de ${noFilteredOpponentGames[1]} contra ${noFilteredOpponentGames[2]} corresponde a estes filtros em ${noFilteredOpponentGames[3]}.`,
    de: `Keine Spiele von ${noFilteredOpponentGames[1]} gegen ${noFilteredOpponentGames[2]} entsprechen diesen Filtern in ${noFilteredOpponentGames[3]}.`,
  });
  const noFilteredGames = source.match(/^No games match the selected filters in (.+)\.$/i);
  if (noFilteredGames) return localized({ ja: `${noFilteredGames[1]}では選択した条件に一致する試合がありません。`, es: `Ningún partido coincide con los filtros seleccionados en ${noFilteredGames[1]}.`, ko: `${noFilteredGames[1]}에서 선택한 필터와 일치하는 경기가 없습니다.`, 'zh-TW': `${noFilteredGames[1]} 中沒有符合所選篩選條件的比賽。`, 'pt-BR': `Nenhum jogo corresponde aos filtros selecionados em ${noFilteredGames[1]}.`, de: `Keine Spiele entsprechen den ausgewählten Filtern in ${noFilteredGames[1]}.` });
  const predictionOutcome = (value: string): string | null => {
    const exact = exactTranslation(value, locale);
    if (exact) return exact;
    if (/^Win$/i.test(value)) return localized({ ja: '勝利', es: 'Victoria', ko: '승리', 'zh-TW': '獲勝', 'pt-BR': 'Vitória', de: 'Sieg' });
    const atLeast = value.match(/^(\d+)\+\s+(.+)$/i);
    if (atLeast) {
      const singularToCatalog: Record<string, string> = {
        hit: 'Hits', hits: 'Hits', 'total base': 'Total Bases', 'total bases': 'Total Bases', run: 'Runs', runs: 'Runs',
        walk: 'Walks', walks: 'Walks', 'stolen base': 'Stolen Bases', 'stolen bases': 'Stolen Bases',
        'batter strikeout': 'BATTER STRIKEOUTS', 'batter strikeouts': 'BATTER STRIKEOUTS', strikeout: 'Strikeouts', strikeouts: 'Strikeouts',
        inning: 'PITCHER INNINGS', innings: 'PITCHER INNINGS', 'team runs': 'TEAM RUNS', 'team hits': 'TEAM HITS',
        'home run': 'Home Run', 'extra-base hit': 'EXTRA-BASE HIT', 'hits + runs + rbi': 'HITS + RUNS + RBI', rbi: 'RBI',
      };
      const key = atLeast[2].toLocaleLowerCase('en-US');
      const label = inline(singularToCatalog[key] ?? atLeast[2]);
      return `${atLeast[1]}+ ${label}`;
    }
    const reaches = value.match(/^Reach Base\s+(\d+)\+\s+Times?$/i);
    if (reaches) return localized({ ja: `${reaches[1]}回以上出塁`, es: `Llega a base ${reaches[1]}+ veces`, ko: `${reaches[1]}회 이상 출루`, 'zh-TW': `上壘 ${reaches[1]} 次以上`, 'pt-BR': `Chega à base ${reaches[1]}+ vezes`, de: `Erreicht ${reaches[1]}+ Mal eine Base` });
    const fewerWithStat = value.match(/^(\d+)\s+or Fewer\s+(.+)$/i);
    if (fewerWithStat) {
      const label = inline(fewerWithStat[2]);
      return localized({ ja: `${label} ${fewerWithStat[1]}以下`, es: `${fewerWithStat[1]} ${label} o menos`, ko: `${label} ${fewerWithStat[1]} 이하`, 'zh-TW': `${label} ${fewerWithStat[1]} 或更少`, 'pt-BR': `${fewerWithStat[1]} ${label} ou menos`, de: `${fewerWithStat[1]} ${label} oder weniger` });
    }
    const choice = value.match(/^(.+?):\s*(Yes|No)$/i);
    if (choice) return `${inline(choice[1])}: ${inline(choice[2])}`;
    return null;
  };
  const titledPrediction = source.match(/^(.+?)\s+([—·])\s+(.+)$/);
  if (titledPrediction) {
    const outcome = predictionOutcome(titledPrediction[3]);
    if (outcome) return `${inline(titledPrediction[1])} ${titledPrediction[2]} ${outcome}`;
  }
  const firstInningPick = source.match(/^First Inning\s+[—·]\s+(Run Scored|No Run Scored)$/i);
  if (firstInningPick) return `${inline('FIRST INNING')} — ${inline(firstInningPick[1])}`;
  const extraInningsPick = source.match(/^Extra Innings\s+[—·]\s+(Yes|No)$/i);
  if (extraInningsPick) return `${inline('EXTRA INNINGS')} — ${inline(extraInningsPick[1])}`;
  const selectedTeamScores = source.match(/^Selected team scores at least (\d+) runs\.$/i);
  if (selectedTeamScores) return localized({ ja: `選択チームが${selectedTeamScores[1]}点以上得点。`, es: `El equipo seleccionado anota al menos ${selectedTeamScores[1]} carreras.`, ko: `선택한 팀이 최소 ${selectedTeamScores[1]}득점합니다.`, 'zh-TW': `已選球隊至少得到 ${selectedTeamScores[1]} 分。`, 'pt-BR': `O time selecionado marca pelo menos ${selectedTeamScores[1]} corridas.`, de: `Das ausgewählte Team erzielt mindestens ${selectedTeamScores[1]} Runs.` });
  const selectedTeamHits = source.match(/^Selected team records at least (\d+) hits\.$/i);
  if (selectedTeamHits) return localized({ ja: `選択チームが${selectedTeamHits[1]}安打以上を記録。`, es: `El equipo seleccionado registra al menos ${selectedTeamHits[1]} hits.`, ko: `선택한 팀이 최소 ${selectedTeamHits[1]}안타를 기록합니다.`, 'zh-TW': `已選球隊至少敲出 ${selectedTeamHits[1]} 支安打。`, 'pt-BR': `O time selecionado registra pelo menos ${selectedTeamHits[1]} rebatidas.`, de: `Das ausgewählte Team erzielt mindestens ${selectedTeamHits[1]} Hits.` });
  const allowsFewer = source.match(/^Allows (\d+) (hits|earned runs|walks) or fewer\.$/i);
  if (allowsFewer) {
    const stat = allowsFewer[2].toLocaleLowerCase('en-US');
    return localized({
      ja: `${allowsFewer[1]}${stat === 'hits' ? '被安打' : stat === 'earned runs' ? '自責点' : '四球'}以下。`,
      es: `Permite ${allowsFewer[1]} ${stat === 'hits' ? 'hits' : stat === 'earned runs' ? 'carreras limpias' : 'bases por bolas'} o menos.`,
      ko: `${stat === 'hits' ? '피안타' : stat === 'earned runs' ? '자책점' : '볼넷'} ${allowsFewer[1]} 이하를 허용합니다.`,
      'zh-TW': `最多允許 ${allowsFewer[1]} 次${stat === 'hits' ? '安打' : stat === 'earned runs' ? '責失' : '保送'}。`,
      'pt-BR': `Cede ${allowsFewer[1]} ${stat === 'hits' ? 'rebatidas' : stat === 'earned runs' ? 'corridas merecidas' : 'bases por bolas'} ou menos.`,
      de: `Lässt höchstens ${allowsFewer[1]} ${stat === 'hits' ? 'Hits' : stat === 'earned runs' ? 'Earned Runs' : 'Walks'} zu.`,
    });
  }
  const inningsPitched = source.match(/^Records at least (\d+(?:\.\d+)?) innings pitched\.$/i);
  if (inningsPitched) return localized({ ja: `${inningsPitched[1]}回以上を投球。`, es: `Lanza al menos ${inningsPitched[1]} entradas.`, ko: `최소 ${inningsPitched[1]}이닝을 투구합니다.`, 'zh-TW': `至少投滿 ${inningsPitched[1]} 局。`, 'pt-BR': `Arremessa pelo menos ${inningsPitched[1]} entradas.`, de: `Wirft mindestens ${inningsPitched[1]} Innings.` });
  const hitterPerformance = source.match(/^(.+?) produced (.+?) against (.+?)\. Season line: (.+?) AVG \/ (.+?) OBP \/ (.+?) SLG, (.+?) HR, (.+?) RBI\.$/i);
  if (hitterPerformance) return localized({
    ja: `${hitterPerformance[1]}は対${hitterPerformance[3]}戦で${hitterPerformance[2]}を記録。シーズン成績：AVG ${hitterPerformance[4]}／OBP ${hitterPerformance[5]}／SLG ${hitterPerformance[6]}、HR ${hitterPerformance[7]}、RBI ${hitterPerformance[8]}。`,
    es: `${hitterPerformance[1]} produjo ${hitterPerformance[2]} contra ${hitterPerformance[3]}. Línea de temporada: ${hitterPerformance[4]} AVG / ${hitterPerformance[5]} OBP / ${hitterPerformance[6]} SLG, ${hitterPerformance[7]} HR, ${hitterPerformance[8]} RBI.`,
    ko: `${hitterPerformance[1]}은 ${hitterPerformance[3]}전에서 ${hitterPerformance[2]}을 기록했습니다. 시즌 기록: AVG ${hitterPerformance[4]} / OBP ${hitterPerformance[5]} / SLG ${hitterPerformance[6]}, HR ${hitterPerformance[7]}, RBI ${hitterPerformance[8]}.`,
    'zh-TW': `${hitterPerformance[1]} 對 ${hitterPerformance[3]} 繳出 ${hitterPerformance[2]}。賽季成績：AVG ${hitterPerformance[4]}／OBP ${hitterPerformance[5]}／SLG ${hitterPerformance[6]}、HR ${hitterPerformance[7]}、RBI ${hitterPerformance[8]}。`,
    'pt-BR': `${hitterPerformance[1]} produziu ${hitterPerformance[2]} contra ${hitterPerformance[3]}. Linha da temporada: ${hitterPerformance[4]} AVG / ${hitterPerformance[5]} OBP / ${hitterPerformance[6]} SLG, ${hitterPerformance[7]} HR, ${hitterPerformance[8]} RBI.`,
    de: `${hitterPerformance[1]} erzielte ${hitterPerformance[2]} gegen ${hitterPerformance[3]}. Saisonwerte: ${hitterPerformance[4]} AVG / ${hitterPerformance[5]} OBP / ${hitterPerformance[6]} SLG, ${hitterPerformance[7]} HR, ${hitterPerformance[8]} RBI.`,
  });
  const pitcherPerformance = source.match(/^(.+?) finished with (.+?) against (.+?)\. Season profile: (.+?) ERA, (.+?) WHIP, (.+?) K\/9 across (.+?) IP\.$/i);
  if (pitcherPerformance) return localized({
    ja: `${pitcherPerformance[1]}は対${pitcherPerformance[3]}戦で${pitcherPerformance[2]}を記録。シーズン成績：ERA ${pitcherPerformance[4]}、WHIP ${pitcherPerformance[5]}、K/9 ${pitcherPerformance[6]}、IP ${pitcherPerformance[7]}。`,
    es: `${pitcherPerformance[1]} terminó con ${pitcherPerformance[2]} contra ${pitcherPerformance[3]}. Perfil de temporada: ${pitcherPerformance[4]} ERA, ${pitcherPerformance[5]} WHIP, ${pitcherPerformance[6]} K/9 en ${pitcherPerformance[7]} IP.`,
    ko: `${pitcherPerformance[1]}은 ${pitcherPerformance[3]}전에서 ${pitcherPerformance[2]}을 기록했습니다. 시즌 기록: ERA ${pitcherPerformance[4]}, WHIP ${pitcherPerformance[5]}, K/9 ${pitcherPerformance[6]}, IP ${pitcherPerformance[7]}.`,
    'zh-TW': `${pitcherPerformance[1]} 對 ${pitcherPerformance[3]} 繳出 ${pitcherPerformance[2]}。賽季資料：ERA ${pitcherPerformance[4]}、WHIP ${pitcherPerformance[5]}、K/9 ${pitcherPerformance[6]}、IP ${pitcherPerformance[7]}。`,
    'pt-BR': `${pitcherPerformance[1]} terminou com ${pitcherPerformance[2]} contra ${pitcherPerformance[3]}. Perfil da temporada: ${pitcherPerformance[4]} ERA, ${pitcherPerformance[5]} WHIP, ${pitcherPerformance[6]} K/9 em ${pitcherPerformance[7]} IP.`,
    de: `${pitcherPerformance[1]} beendete das Spiel gegen ${pitcherPerformance[3]} mit ${pitcherPerformance[2]}. Saisonprofil: ${pitcherPerformance[4]} ERA, ${pitcherPerformance[5]} WHIP, ${pitcherPerformance[6]} K/9 in ${pitcherPerformance[7]} IP.`,
  });
  const pitcherProfile = source.match(/^(.+?) works primarily off the (.+?), averaging (.+?) mph in recent tracked outings with (.+?)% usage\. His (.+?): (.+?) ERA, (.+?) WHIP, (.+?) SO in (.+?) IP\.$/i);
  if (pitcherProfile) return localized({
    ja: `${pitcherProfile[1]}は主に${pitcherProfile[2]}を使用し、直近の追跡登板では平均${pitcherProfile[3]} mph、使用率${pitcherProfile[4]}%です。${inline(pitcherProfile[5])}：ERA ${pitcherProfile[6]}、WHIP ${pitcherProfile[7]}、SO ${pitcherProfile[8]}、IP ${pitcherProfile[9]}。`,
    es: `${pitcherProfile[1]} trabaja principalmente con ${pitcherProfile[2]}, con una media de ${pitcherProfile[3]} mph y ${pitcherProfile[4]}% de uso en sus salidas recientes. ${inline(pitcherProfile[5])}: ${pitcherProfile[6]} ERA, ${pitcherProfile[7]} WHIP, ${pitcherProfile[8]} SO en ${pitcherProfile[9]} IP.`,
    ko: `${pitcherProfile[1]}은 주로 ${pitcherProfile[2]}을 사용하며 최근 추적 등판에서 평균 ${pitcherProfile[3]} mph, 사용률 ${pitcherProfile[4]}%입니다. ${inline(pitcherProfile[5])}: ERA ${pitcherProfile[6]}, WHIP ${pitcherProfile[7]}, SO ${pitcherProfile[8]}, IP ${pitcherProfile[9]}.`,
    'zh-TW': `${pitcherProfile[1]} 主要使用${pitcherProfile[2]}，近期追蹤登板平均 ${pitcherProfile[3]} mph，使用率 ${pitcherProfile[4]}%。${inline(pitcherProfile[5])}：ERA ${pitcherProfile[6]}、WHIP ${pitcherProfile[7]}、SO ${pitcherProfile[8]}、IP ${pitcherProfile[9]}。`,
    'pt-BR': `${pitcherProfile[1]} trabalha principalmente com ${pitcherProfile[2]}, com média de ${pitcherProfile[3]} mph e ${pitcherProfile[4]}% de uso nas saídas recentes. ${inline(pitcherProfile[5])}: ${pitcherProfile[6]} ERA, ${pitcherProfile[7]} WHIP, ${pitcherProfile[8]} SO em ${pitcherProfile[9]} IP.`,
    de: `${pitcherProfile[1]} setzt vor allem auf ${pitcherProfile[2]} und erreicht in den zuletzt erfassten Einsätzen durchschnittlich ${pitcherProfile[3]} mph bei ${pitcherProfile[4]} % Nutzung. ${inline(pitcherProfile[5])}: ${pitcherProfile[6]} ERA, ${pitcherProfile[7]} WHIP, ${pitcherProfile[8]} SO in ${pitcherProfile[9]} IP.`,
  });
  const missingPitchProfile = source.match(/^(.+?)[’']s recent tracked pitch profile is not available yet\.$/i);
  if (missingPitchProfile) return localized({ ja: `${missingPitchProfile[1]}の直近の投球追跡データはまだ利用できません。`, es: `El perfil reciente de lanzamientos de ${missingPitchProfile[1]} aún no está disponible.`, ko: `${missingPitchProfile[1]}의 최근 투구 추적 프로필은 아직 제공되지 않습니다.`, 'zh-TW': `${missingPitchProfile[1]} 的近期投球追蹤資料尚未提供。`, 'pt-BR': `O perfil recente de arremessos de ${missingPitchProfile[1]} ainda não está disponível.`, de: `Das aktuelle Pitch-Profil von ${missingPitchProfile[1]} ist noch nicht verfügbar.` });
  const batterProfile = source.match(/^(.+?) is a (left-handed|right-handed|switch) hitter\.(.*)$/i);
  if (batterProfile) {
    const hand = batterProfile[2].toLocaleLowerCase('en-US');
    const split = batterProfile[3].match(/\s*His OPS is (.+?) vs LHP and (.+?) vs RHP\./i);
    const strongest = batterProfile[3].match(/\s*Recent tracked results are strongest against (.+?) \((.+?) AVG\)\./i);
    const handValues = { ja: hand === 'left-handed' ? '左打ち' : hand === 'right-handed' ? '右打ち' : '両打ち', es: hand === 'left-handed' ? 'zurdo' : hand === 'right-handed' ? 'diestro' : 'ambidiestro', ko: hand === 'left-handed' ? '좌타' : hand === 'right-handed' ? '우타' : '스위치', 'zh-TW': hand === 'left-handed' ? '左打' : hand === 'right-handed' ? '右打' : '左右開弓', 'pt-BR': hand === 'left-handed' ? 'canhoto' : hand === 'right-handed' ? 'destro' : 'ambidestro', de: hand === 'left-handed' ? 'linkshändiger' : hand === 'right-handed' ? 'rechtshändiger' : 'Switch-' } as const;
    const splitText = split ? localized({ ja: ` OPSは対LHP ${split[1]}、対RHP ${split[2]}です。`, es: ` Su OPS es ${split[1]} contra LHP y ${split[2]} contra RHP.`, ko: ` OPS는 LHP 상대 ${split[1]}, RHP 상대 ${split[2]}입니다.`, 'zh-TW': ` 對 LHP 的 OPS 為 ${split[1]}，對 RHP 為 ${split[2]}。`, 'pt-BR': ` Seu OPS é ${split[1]} contra LHP e ${split[2]} contra RHP.`, de: ` Sein OPS beträgt ${split[1]} gegen LHP und ${split[2]} gegen RHP.` }) : '';
    const strongestText = strongest ? localized({ ja: ` 直近の追跡結果では${strongest[1]}に対して最も好成績です（AVG ${strongest[2]}）。`, es: ` Sus mejores resultados recientes son contra ${strongest[1]} (${strongest[2]} AVG).`, ko: ` 최근 추적 결과는 ${strongest[1]} 상대에서 가장 좋습니다(AVG ${strongest[2]}).`, 'zh-TW': ` 近期追蹤結果對 ${strongest[1]} 最佳（AVG ${strongest[2]}）。`, 'pt-BR': ` Os melhores resultados recentes são contra ${strongest[1]} (${strongest[2]} AVG).`, de: ` Die besten aktuellen Ergebnisse erzielt er gegen ${strongest[1]} (${strongest[2]} AVG).` }) : '';
    return localized({ ja: `${batterProfile[1]}は${handValues.ja}の打者です。${splitText}${strongestText}`, es: `${batterProfile[1]} es un bateador ${handValues.es}.${splitText}${strongestText}`, ko: `${batterProfile[1]}은 ${handValues.ko} 타자입니다.${splitText}${strongestText}`, 'zh-TW': `${batterProfile[1]} 是${handValues['zh-TW']}打者。${splitText}${strongestText}`, 'pt-BR': `${batterProfile[1]} é um rebatedor ${handValues['pt-BR']}.${splitText}${strongestText}`, de: `${batterProfile[1]} ist ein ${handValues.de} Batter.${splitText}${strongestText}` });
  }
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
    return `${label} ${localizeEmbeddedDate(updated[1])}`;
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
  const performances = source.match(/^(.+?)\s+performances$/i);
  if (performances) {
    const subject = exactTranslation(performances[1], locale) ?? performances[1];
    return localized({ ja: `${subject}のパフォーマンス`, es: `Actuaciones de ${subject}`, ko: `${subject} 성과`, 'zh-TW': `${subject}表現`, 'pt-BR': `Desempenhos de ${subject}`, de: `${subject}-Leistungen` });
  }
  const fewer = source.match(/^(.+?)\s+or fewer$/i);
  if (fewer) return localized({ ja: `${fewer[1]}以下`, es: `${fewer[1]} o menos`, ko: `${fewer[1]} 이하`, 'zh-TW': `${fewer[1]} 或更少`, 'pt-BR': `${fewer[1]} ou menos`, de: `${fewer[1]} oder weniger` });
  const versusHand = source.match(/^vs\s+(.+?)HP$/i);
  if (versusHand) return localized({ ja: `対 ${versusHand[1]}HP`, es: `vs. ${versusHand[1]}HP`, ko: `${versusHand[1]}HP 상대`, 'zh-TW': `對 ${versusHand[1]}HP`, 'pt-BR': `contra ${versusHand[1]}HP`, de: `gegen ${versusHand[1]}HP` });
  const sample = source.match(/^(.+?)\s+sample$/i);
  if (sample) return localized({ ja: `${sample[1]}の対象数`, es: `Muestra de ${sample[1]}`, ko: `${sample[1]} 표본`, 'zh-TW': `${sample[1]}樣本`, 'pt-BR': `Amostra de ${sample[1]}`, de: `${sample[1]}-Stichprobe` });
  const challengeLimit = source.match(/^Choose up to (\d+) Challenge selections on one card\.$/i);
  if (challengeLimit) return localized({ ja: `1枚のカードでチャレンジ予測を最大${challengeLimit[1]}件選択してください。`, es: `Elige hasta ${challengeLimit[1]} selecciones de desafío en una tarjeta.`, ko: `한 카드에서 챌린지 선택을 최대 ${challengeLimit[1]}개 고르세요.`, 'zh-TW': `一張卡最多選擇 ${challengeLimit[1]} 個挑戰項目。`, 'pt-BR': `Escolha até ${challengeLimit[1]} seleções de desafio em um cartão.`, de: `Wähle bis zu ${challengeLimit[1]} Challenge-Tipps auf einer Karte.` });
  const limitedData = source.match(/^·\s*(\d+)\s+limited-data$/i);
  if (limitedData) return localized({ ja: `· データ不足 ${limitedData[1]}件`, es: `· ${limitedData[1]} con datos limitados`, ko: `· 데이터 부족 ${limitedData[1]}개`, 'zh-TW': `· ${limitedData[1]} 個資料有限`, 'pt-BR': `· ${limitedData[1]} com dados limitados`, de: `· ${limitedData[1]} mit begrenzten Daten` });
  const extraCards = source.match(/^·\s*extra personal cards:\s*(\d+)$/i);
  if (extraCards) return localized({ ja: `· 追加個人カード：${extraCards[1]}`, es: `· tarjetas personales extra: ${extraCards[1]}`, ko: `· 추가 개인 카드: ${extraCards[1]}`, 'zh-TW': `· 額外個人卡：${extraCards[1]}`, 'pt-BR': `· cartões pessoais extras: ${extraCards[1]}`, de: `· zusätzliche persönliche Karten: ${extraCards[1]}` });
  const correctFraction = source.match(/^(\d+)\/(\d+)\s+correct$/i);
  if (correctFraction) return localized({ ja: `${correctFraction[1]}/${correctFraction[2]} 的中`, es: `${correctFraction[1]}/${correctFraction[2]} correctas`, ko: `${correctFraction[1]}/${correctFraction[2]} 적중`, 'zh-TW': `${correctFraction[1]}/${correctFraction[2]} 正確`, 'pt-BR': `${correctFraction[1]}/${correctFraction[2]} corretos`, de: `${correctFraction[1]}/${correctFraction[2]} richtig` });
  const replyBy = source.match(/^Reply by (.+)$/i);
  if (replyBy) return localized({ ja: `${replyBy[1]}さんの返信`, es: `Respuesta de ${replyBy[1]}`, ko: `${replyBy[1]}님의 답글`, 'zh-TW': `${replyBy[1]} 的回覆`, 'pt-BR': `Resposta de ${replyBy[1]}`, de: `Antwort von ${replyBy[1]}` });
  const replyTo = source.match(/^Reply to (.+)…$/i);
  if (replyTo) return localized({ ja: `${replyTo[1]}さんに返信…`, es: `Responder a ${replyTo[1]}…`, ko: `${replyTo[1]}님에게 답글…`, 'zh-TW': `回覆 ${replyTo[1]}…`, 'pt-BR': `Responder a ${replyTo[1]}…`, de: `${replyTo[1]} antworten…` });
  const headshot = source.match(/^(.+?)\s+headshot$/i);
  if (headshot) return localized({ ja: `${headshot[1]}の選手写真`, es: `Foto de ${headshot[1]}`, ko: `${headshot[1]} 선수 사진`, 'zh-TW': `${headshot[1]} 球員照片`, 'pt-BR': `Foto de ${headshot[1]}`, de: `Spielerfoto von ${headshot[1]}` });
  const versusName = source.match(/^·?\s*vs\s+(.+)$/i);
  if (versusName) return localized({ ja: `${source.trim().startsWith('·') ? '· ' : ''}対 ${versusName[1]}`, es: `${source.trim().startsWith('·') ? '· ' : ''}vs. ${versusName[1]}`, ko: `${source.trim().startsWith('·') ? '· ' : ''}${versusName[1]} 상대`, 'zh-TW': `${source.trim().startsWith('·') ? '· ' : ''}對 ${versusName[1]}`, 'pt-BR': `${source.trim().startsWith('·') ? '· ' : ''}contra ${versusName[1]}`, de: `${source.trim().startsWith('·') ? '· ' : ''}gegen ${versusName[1]}` });
  const logo = source.match(/^(.+?)\s+logo$/i);
  if (logo) return localized({ ja: `${logo[1]}のロゴ`, es: `Logo de ${logo[1]}`, ko: `${logo[1]} 로고`, 'zh-TW': `${logo[1]} 標誌`, 'pt-BR': `Logo do ${logo[1]}`, de: `Logo von ${logo[1]}` });
  const scoreFour = source.match(/^(.+?)\s+Score 4\+$/i);
  if (scoreFour) return localized({ ja: `${scoreFour[1]} 4点以上`, es: `${scoreFour[1]} anota 4+`, ko: `${scoreFour[1]} 4득점 이상`, 'zh-TW': `${scoreFour[1]} 得 4 分以上`, 'pt-BR': `${scoreFour[1]} marca 4+`, de: `${scoreFour[1]} erzielt 4+` });
  const submitPrivate = source.match(/^Submit (\d+) private picks$/i);
  if (submitPrivate) return localized({ ja: `非公開予測${submitPrivate[1]}件を送信`, es: `Enviar ${submitPrivate[1]} selecciones privadas`, ko: `비공개 선택 ${submitPrivate[1]}개 제출`, 'zh-TW': `提交 ${submitPrivate[1]} 個私人選擇`, 'pt-BR': `Enviar ${submitPrivate[1]} palpites privados`, de: `${submitPrivate[1]} private Tipps absenden` });
  const leading = source.match(/^(.+?)\s+IS LEADING$/i);
  if (leading) return localized({ ja: `${leading[1]}がリード`, es: `${leading[1]} VA GANANDO`, ko: `${leading[1]} 리드 중`, 'zh-TW': `${leading[1]} 領先`, 'pt-BR': `${leading[1]} ESTÁ NA FRENTE`, de: `${leading[1]} FÜHRT` });
  const possessiveResults = source.match(/^(.+?)[’']s results$/i);
  if (possessiveResults) return localized({ ja: `${possessiveResults[1]}の結果`, es: `Resultados de ${possessiveResults[1]}`, ko: `${possessiveResults[1]}의 결과`, 'zh-TW': `${possessiveResults[1]} 的結果`, 'pt-BR': `Resultados de ${possessiveResults[1]}`, de: `Ergebnisse von ${possessiveResults[1]}` });
  const weekOf = source.match(/^Week of (.+)$/i);
  if (weekOf) {
    const date = localizeEmbeddedDate(weekOf[1]);
    return localized({ ja: `${date}の週`, es: `Semana del ${date}`, ko: `${date} 주간`, 'zh-TW': `${date} 當週`, 'pt-BR': `Semana de ${date}`, de: `Woche vom ${date}` });
  }
  const bench = source.match(/^Bench\s+·\s+(.+)$/i);
  if (bench) return localized({ ja: `ベンチ · ${bench[1]}`, es: `Banca · ${bench[1]}`, ko: `벤치 · ${bench[1]}`, 'zh-TW': `板凳 · ${bench[1]}`, 'pt-BR': `Banco · ${bench[1]}`, de: `Bank · ${bench[1]}` });
  const batting = source.match(/^Batting:\s*(.+)$/i);
  if (batting) return localized({ ja: `打者：${batting[1]}`, es: `Al bate: ${batting[1]}`, ko: `타자: ${batting[1]}`, 'zh-TW': `打者：${batting[1]}`, 'pt-BR': `Rebatendo: ${batting[1]}`, de: `Am Schlag: ${batting[1]}` });
  const resultLabel = source.match(/^Result:\s*(.+)$/i);
  if (resultLabel) {
    const result = exactTranslation(resultLabel[1], locale) ?? translateBaseballDynamic(resultLabel[1], locale) ?? resultLabel[1];
    return localized({ ja: `結果：${result}`, es: `Resultado: ${result}`, ko: `결과: ${result}`, 'zh-TW': `結果：${result}`, 'pt-BR': `Resultado: ${result}`, de: `Ergebnis: ${result}` });
  }
  const remove = source.match(/^Remove\s+(.+)$/i);
  if (remove) return localized({ ja: `${remove[1]}を削除`, es: `Eliminar ${remove[1]}`, ko: `${remove[1]} 삭제`, 'zh-TW': `移除 ${remove[1]}`, 'pt-BR': `Remover ${remove[1]}`, de: `${remove[1]} entfernen` });
  const editableUntil = source.match(/^Editable until (.+)\.$/i);
  if (editableUntil) {
    const date = localizeEmbeddedDate(editableUntil[1]);
    return localized({ ja: `${date}まで編集可能。`, es: `Editable hasta ${date}.`, ko: `${date}까지 수정 가능.`, 'zh-TW': `可編輯至 ${date}。`, 'pt-BR': `Editável até ${date}.`, de: `Bearbeitbar bis ${date}.` });
  }
  const record = source.match(/^(\d+)W\s+[–-]\s+(\d+)L$/i);
  if (record) return localized({ ja: `${record[1]}勝 – ${record[2]}敗`, es: `${record[1]}G – ${record[2]}P`, ko: `${record[1]}승 – ${record[2]}패`, 'zh-TW': `${record[1]}勝 – ${record[2]}敗`, 'pt-BR': `${record[1]}V – ${record[2]}D`, de: `${record[1]}S – ${record[2]}N` });
  const predictorRank = source.match(/^You’re in the (.+?) of predictors\. Make smart picks and climb higher!$/i);
  if (predictorRank) return localized({ ja: `予測者の${predictorRank[1]}に入っています。的確な予測でさらに順位を上げましょう！`, es: `Estás en el ${predictorRank[1]} de predictores. ¡Haz buenas selecciones y sigue subiendo!`, ko: `예측자 ${predictorRank[1]}에 있습니다. 현명하게 선택해 더 높이 올라가세요!`, 'zh-TW': `你位於預測者的 ${predictorRank[1]}。做出明智選擇並繼續提升！`, 'pt-BR': `Você está entre os ${predictorRank[1]} dos participantes. Faça bons palpites e continue subindo!`, de: `Du liegst bei den Prognose-Teilnehmern in ${predictorRank[1]}. Tippe klug und steige weiter auf!` });
  const accuracyFraction = source.match(/^(\d+)%\s+accuracy\s+·\s+(\d+)\/(\d+)\s+correct$/i);
  if (accuracyFraction) return localized({ ja: `的中率${accuracyFraction[1]}% · ${accuracyFraction[2]}/${accuracyFraction[3]} 的中`, es: `${accuracyFraction[1]}% de precisión · ${accuracyFraction[2]}/${accuracyFraction[3]} correctas`, ko: `정확도 ${accuracyFraction[1]}% · ${accuracyFraction[2]}/${accuracyFraction[3]} 적중`, 'zh-TW': `準確率 ${accuracyFraction[1]}% · ${accuracyFraction[2]}/${accuracyFraction[3]} 正確`, 'pt-BR': `${accuracyFraction[1]}% de precisão · ${accuracyFraction[2]}/${accuracyFraction[3]} corretos`, de: `${accuracyFraction[1]} % Genauigkeit · ${accuracyFraction[2]}/${accuracyFraction[3]} richtig` });
  const unread = source.match(/^(\d+)\s+unread$/i);
  if (unread) return localized({ ja: `未読${unread[1]}件`, es: `${unread[1]} sin leer`, ko: `읽지 않음 ${unread[1]}개`, 'zh-TW': `${unread[1]} 則未讀`, 'pt-BR': `${unread[1]} não lidas`, de: `${unread[1]} ungelesen` });
  const projectedChance = source.match(/^Projected chance\s+(\d+)%$/i);
  if (projectedChance) return localized({ ja: `予測確率 ${projectedChance[1]}%`, es: `Probabilidad proyectada ${projectedChance[1]}%`, ko: `예측 확률 ${projectedChance[1]}%`, 'zh-TW': `預測機率 ${projectedChance[1]}%`, 'pt-BR': `Probabilidade projetada ${projectedChance[1]}%`, de: `Prognostizierte Chance ${projectedChance[1]} %` });
  const searchPlayers = source.match(/^Search\s+(.+?)\s+players$/i);
  if (searchPlayers) return localized({ ja: `${searchPlayers[1]}の選手を検索`, es: `Buscar jugadores de ${searchPlayers[1]}`, ko: `${searchPlayers[1]} 선수 검색`, 'zh-TW': `搜尋 ${searchPlayers[1]} 球員`, 'pt-BR': `Buscar jogadores de ${searchPlayers[1]}`, de: `Spieler von ${searchPlayers[1]} suchen` });
  const noLogs = source.match(/^No game logs are available for (.+?) in the selected season view\.$/i);
  if (noLogs) return localized({ ja: `選択したシーズン表示では${noLogs[1]}の試合ログを利用できません。`, es: `No hay registros de partidos de ${noLogs[1]} en la vista de temporada seleccionada.`, ko: `선택한 시즌 보기에서 ${noLogs[1]}의 경기 기록을 사용할 수 없습니다.`, 'zh-TW': `所選賽季檢視中沒有 ${noLogs[1]} 的比賽紀錄。`, 'pt-BR': `Não há registros de jogos de ${noLogs[1]} na temporada selecionada.`, de: `Für ${noLogs[1]} sind in der gewählten Saisonansicht keine Spielprotokolle verfügbar.` });
  const addHandle = source.match(/^Add\s+(@[^\s]+)\s+on ScoutCoreMLB$/i);
  if (addHandle) return localized({ ja: `ScoutCoreMLBで${addHandle[1]}を追加`, es: `Añade a ${addHandle[1]} en ScoutCoreMLB`, ko: `ScoutCoreMLB에서 ${addHandle[1]} 추가`, 'zh-TW': `在 ScoutCoreMLB 新增 ${addHandle[1]}`, 'pt-BR': `Adicione ${addHandle[1]} no ScoutCoreMLB`, de: `${addHandle[1]} bei ScoutCoreMLB hinzufügen` });
  const profileTitle = source.match(/^(.+?)\s+on ScoutCoreMLB$/i);
  if (profileTitle) return localized({ ja: `ScoutCoreMLBの${profileTitle[1]}`, es: `${profileTitle[1]} en ScoutCoreMLB`, ko: `ScoutCoreMLB의 ${profileTitle[1]}`, 'zh-TW': `${profileTitle[1]} 的 ScoutCoreMLB`, 'pt-BR': `${profileTitle[1]} no ScoutCoreMLB`, de: `${profileTitle[1]} bei ScoutCoreMLB` });
  const scoutLevel = source.match(/^Scout Level:\s*(.+)$/i);
  if (scoutLevel) return localized({ ja: `スカウトレベル：${scoutLevel[1]}`, es: `Nivel Scout: ${scoutLevel[1]}`, ko: `스카우트 레벨: ${scoutLevel[1]}`, 'zh-TW': `球探等級：${scoutLevel[1]}`, 'pt-BR': `Nível Scout: ${scoutLevel[1]}`, de: `Scout-Level: ${scoutLevel[1]}` });
  const localTimes = source.match(/^Game times shown in your local timezone \((.+)\)\.$/i);
  if (localTimes) return localized({ ja: `試合時刻は現地時間（${localTimes[1]}）で表示されます。`, es: `Los horarios se muestran en tu zona local (${localTimes[1]}).`, ko: `경기 시간은 현지 시간대(${localTimes[1]})로 표시됩니다.`, 'zh-TW': `比賽時間以你的本地時區（${localTimes[1]}）顯示。`, 'pt-BR': `Os horários são exibidos no seu fuso local (${localTimes[1]}).`, de: `Spielzeiten werden in deiner lokalen Zeitzone (${localTimes[1]}) angezeigt.` });
  const openTeam = source.match(/^Open\s+(.+?)\s+team profile$/i);
  if (openTeam) return localized({ ja: `${openTeam[1]}のチームプロフィールを開く`, es: `Abrir el perfil de ${openTeam[1]}`, ko: `${openTeam[1]} 팀 프로필 열기`, 'zh-TW': `開啟 ${openTeam[1]} 球隊資料`, 'pt-BR': `Abrir o perfil de ${openTeam[1]}`, de: `Teamprofil von ${openTeam[1]} öffnen` });
  const probableStarters = source.match(/^Probable starters:\s*(.+?)\s+vs\s+(.+?)\. ScoutCore will use confirmed lineups, pitcher handedness and current player data as they become available\.$/i);
  if (probableStarters) return localized({ ja: `予告先発：${probableStarters[1]} 対 ${probableStarters[2]}。ScoutCoreは確定したラインアップ、投手の利き腕、現在の選手データを取得次第使用します。`, es: `Abridores probables: ${probableStarters[1]} vs. ${probableStarters[2]}. ScoutCore usará alineaciones confirmadas, mano del lanzador y datos actuales cuando estén disponibles.`, ko: `예상 선발: ${probableStarters[1]} 대 ${probableStarters[2]}. ScoutCore는 확정 라인업, 투수 손, 현재 선수 데이터를 제공되는 대로 사용합니다.`, 'zh-TW': `預計先發：${probableStarters[1]} 對 ${probableStarters[2]}。ScoutCore 會在確認後使用先發名單、投手慣用手與目前球員資料。`, 'pt-BR': `Titulares prováveis: ${probableStarters[1]} contra ${probableStarters[2]}. O ScoutCore usará escalações confirmadas, mão do arremessador e dados atuais quando disponíveis.`, de: `Voraussichtliche Starter: ${probableStarters[1]} gegen ${probableStarters[2]}. ScoutCore nutzt bestätigte Aufstellungen, Wurfhand und aktuelle Spielerdaten, sobald sie verfügbar sind.` });
  const batterFinalLine = source.match(/^Final line:\s*(.+?)\s+in\s+(.+?)\s+AB\. Plate appearances:\s*(.+?), walks:\s*(.+?), strikeouts:\s*(.+?), total bases:\s*(.+?)\. This report summarizes verified MLB box-score production from the completed game\.$/i);
  if (batterFinalLine) return localized({ ja: `最終成績：${batterFinalLine[2]} ABで${batterFinalLine[1]}。打席：${batterFinalLine[3]}、四球：${batterFinalLine[4]}、三振：${batterFinalLine[5]}、塁打：${batterFinalLine[6]}。このレポートは終了済み試合の検証済みMLBボックススコア成績をまとめたものです。`, es: `Línea final: ${batterFinalLine[1]} en ${batterFinalLine[2]} AB. Apariciones: ${batterFinalLine[3]}, bases por bolas: ${batterFinalLine[4]}, strikeouts: ${batterFinalLine[5]}, bases totales: ${batterFinalLine[6]}. Este informe resume el resumen estadístico verificado de MLB.`, ko: `최종 기록: ${batterFinalLine[2]} AB에서 ${batterFinalLine[1]}. 타석: ${batterFinalLine[3]}, 볼넷: ${batterFinalLine[4]}, 삼진: ${batterFinalLine[5]}, 총 루타: ${batterFinalLine[6]}. 이 보고서는 종료된 경기의 검증된 MLB 박스스코어 성적을 요약합니다.`, 'zh-TW': `最終成績：${batterFinalLine[2]} AB 中 ${batterFinalLine[1]}。打席：${batterFinalLine[3]}、保送：${batterFinalLine[4]}、三振：${batterFinalLine[5]}、壘打數：${batterFinalLine[6]}。本報告彙整已結束比賽的已驗證 MLB 技術統計。`, 'pt-BR': `Linha final: ${batterFinalLine[1]} em ${batterFinalLine[2]} AB. Idas ao bastão: ${batterFinalLine[3]}, bases por bolas: ${batterFinalLine[4]}, eliminações por três arremessos válidos: ${batterFinalLine[5]}, bases totais: ${batterFinalLine[6]}. Este relatório resume a súmula verificada da MLB.`, de: `Endergebnis: ${batterFinalLine[1]} bei ${batterFinalLine[2]} AB. Schlagauftritte: ${batterFinalLine[3]}, Vier-Ball-Freiläufe: ${batterFinalLine[4]}, Dreischlag-Aus: ${batterFinalLine[5]}, erreichte Basisstationen: ${batterFinalLine[6]}. Dieser Bericht fasst die verifizierte MLB-Spielstatistik zusammen.` });
  const pitcherFinalLine = source.match(/^Final line:\s*(.+?)\s+IP,\s*(.+?)\s+H,\s*(.+?)\s+ER,\s*(.+?)\s+BB,\s*(.+?)\s+K\. Pitches:\s*(.+?), strikes:\s*(.+?)\. This is verified completed-game pitching data\.$/i);
  if (pitcherFinalLine) return localized({ ja: `最終成績：${pitcherFinalLine[1]} IP、${pitcherFinalLine[2]} H、${pitcherFinalLine[3]} ER、${pitcherFinalLine[4]} BB、${pitcherFinalLine[5]} K。投球数：${pitcherFinalLine[6]}、ストライク：${pitcherFinalLine[7]}。終了済み試合の検証済み投球データです。`, es: `Línea final: ${pitcherFinalLine[1]} IP, ${pitcherFinalLine[2]} H, ${pitcherFinalLine[3]} ER, ${pitcherFinalLine[4]} BB, ${pitcherFinalLine[5]} K. Lanzamientos: ${pitcherFinalLine[6]}, lanzamientos buenos: ${pitcherFinalLine[7]}. Son datos verificados del partido finalizado.`, ko: `최종 기록: ${pitcherFinalLine[1]} IP, ${pitcherFinalLine[2]} H, ${pitcherFinalLine[3]} ER, ${pitcherFinalLine[4]} BB, ${pitcherFinalLine[5]} K. 투구: ${pitcherFinalLine[6]}, 스트라이크: ${pitcherFinalLine[7]}. 종료된 경기의 검증된 투구 데이터입니다.`, 'zh-TW': `最終成績：${pitcherFinalLine[1]} IP、${pitcherFinalLine[2]} H、${pitcherFinalLine[3]} ER、${pitcherFinalLine[4]} BB、${pitcherFinalLine[5]} K。投球：${pitcherFinalLine[6]}、好球：${pitcherFinalLine[7]}。這是已結束比賽的已驗證投球資料。`, 'pt-BR': `Linha final: ${pitcherFinalLine[1]} IP, ${pitcherFinalLine[2]} H, ${pitcherFinalLine[3]} ER, ${pitcherFinalLine[4]} BB, ${pitcherFinalLine[5]} K. Arremessos: ${pitcherFinalLine[6]}, arremessos válidos: ${pitcherFinalLine[7]}. Estes são dados verificados do jogo concluído.`, de: `Endergebnis: ${pitcherFinalLine[1]} IP, ${pitcherFinalLine[2]} H, ${pitcherFinalLine[3]} ER, ${pitcherFinalLine[4]} BB, ${pitcherFinalLine[5]} K. Würfe: ${pitcherFinalLine[6]}, gültige Würfe: ${pitcherFinalLine[7]}. Dies sind verifizierte Wurfdaten des beendeten Spiels.` });
  const pointsTo = source.match(/^points to\s+(.+)$/i);
  if (pointsTo) return localized({ ja: `${pointsTo[1]}ポイントまで`, es: `puntos para ${pointsTo[1]}`, ko: `${pointsTo[1]}까지 포인트`, 'zh-TW': `距 ${pointsTo[1]} 的積分`, 'pt-BR': `pontos para ${pointsTo[1]}`, de: `Punkte bis ${pointsTo[1]}` });
  const clearedLine = source.match(/^(.+?) cleared this line in (\d+) of its last (.+?) completed games\. ScoutCore also checks recent scoring plus verified starter and team context where available\.$/i);
  if (clearedLine) {
    const team = inline(clearedLine[1]);
    const sampleSize = inline(clearedLine[3]);
    return localized({ ja: `${team}は終了済み直近${sampleSize}試合のうち${clearedLine[2]}試合でこのラインを達成しました。ScoutCoreは最近の得点状況と検証済みの先発・チーム情報も確認します。`, es: `${team} superó esta línea en ${clearedLine[2]} de sus últimos ${sampleSize} partidos finalizados. ScoutCore también revisa anotación reciente y contexto verificado de abridor y equipo.`, ko: `${team}은 최근 종료 ${sampleSize}경기 중 ${clearedLine[2]}경기에서 이 기준을 넘었습니다. ScoutCore는 최근 득점과 검증된 선발 및 팀 상황도 확인합니다.`, 'zh-TW': `${team} 在最近 ${sampleSize} 場已結束比賽中有 ${clearedLine[2]} 場達成此標準。ScoutCore 也會檢查近期得分及已驗證的先發與球隊情境。`, 'pt-BR': `${team} superou esta linha em ${clearedLine[2]} dos últimos ${sampleSize} jogos concluídos. O ScoutCore também verifica a pontuação recente e o contexto confirmado do titular e do time.`, de: `${team} erreichte diese Linie in ${clearedLine[2]} der letzten ${sampleSize} beendeten Spiele. ScoutCore prüft außerdem aktuelle Runs sowie verifizierten Starter- und Teamkontext.` });
  }
  const opposingStarter = source.match(/^Opposing starter (.+?) has a (.+?) ERA and (.+?)\.$/i);
  if (opposingStarter) {
    const seasonLine = inline(opposingStarter[3]);
    return localized({ ja: `相手先発${opposingStarter[1]}はERA ${opposingStarter[2]}、${seasonLine}です。`, es: `El abridor rival ${opposingStarter[1]} tiene ERA de ${opposingStarter[2]} y ${seasonLine}.`, ko: `상대 선발 ${opposingStarter[1]}의 ERA는 ${opposingStarter[2]}이며 ${seasonLine}입니다.`, 'zh-TW': `對方先發 ${opposingStarter[1]} 的 ERA 為 ${opposingStarter[2]}，${seasonLine}。`, 'pt-BR': `O titular adversário ${opposingStarter[1]} tem ERA ${opposingStarter[2]} e ${seasonLine}.`, de: `Der gegnerische Starter ${opposingStarter[1]} hat eine ERA von ${opposingStarter[2]} und ${seasonLine}.` });
  }
  const firstInningSample = source.match(/^Across the recent completed-game samples for both clubs, this first-inning outcome occurred in (\d+) of (.+?) tracked games\.$/i);
  if (firstInningSample) {
    const sampleSize = inline(firstInningSample[2]);
    return localized({ ja: `両チームの終了済み直近試合では、この1回の結果が対象${sampleSize}試合中${firstInningSample[1]}試合で発生しました。`, es: `En las muestras recientes de ambos clubes, este resultado de primera entrada ocurrió en ${firstInningSample[1]} de ${sampleSize} partidos.`, ko: `양 팀의 최근 종료 경기 표본에서 이 1회 결과는 ${sampleSize}경기 중 ${firstInningSample[1]}경기에서 나왔습니다.`, 'zh-TW': `在兩隊近期已結束比賽樣本中，此第一局結果出現在 ${sampleSize} 場中的 ${firstInningSample[1]} 場。`, 'pt-BR': `Nas amostras recentes dos dois times, este resultado da primeira entrada ocorreu em ${firstInningSample[1]} de ${sampleSize} jogos.`, de: `In den jüngsten beendeten Spielen beider Teams trat dieses Ergebnis im ersten Inning in ${firstInningSample[1]} von ${sampleSize} Spielen auf.` });
  }
  const extraInningSample = source.match(/^This extra-innings outcome occurred in (\d+) of (.+?) recent completed-game samples across the two teams\.$/i);
  if (extraInningSample) {
    const sampleSize = inline(extraInningSample[2]);
    return localized({ ja: `この延長戦の結果は、両チームの終了済み直近${sampleSize}試合のうち${extraInningSample[1]}試合で発生しました。`, es: `Este resultado de entradas extra ocurrió en ${extraInningSample[1]} de ${sampleSize} partidos recientes de ambos equipos.`, ko: `이 연장전 결과는 양 팀의 최근 종료 ${sampleSize}경기 중 ${extraInningSample[1]}경기에서 나왔습니다.`, 'zh-TW': `此延長賽結果出現在兩隊最近 ${sampleSize} 場已結束比賽中的 ${extraInningSample[1]} 場。`, 'pt-BR': `Este resultado de entradas extras ocorreu em ${extraInningSample[1]} de ${sampleSize} jogos recentes dos dois times.`, de: `Dieses Extra-Innings-Ergebnis trat in ${extraInningSample[1]} von ${sampleSize} jüngsten beendeten Spielen beider Teams auf.` });
  }
  const exactLine = source.match(/^(.+?) met this exact line in (\d+) of the last (.+?) completed games\. ScoutCore combines that recent result with season context; this is a support rating, not a guaranteed probability\.$/i);
  if (exactLine) {
    const sampleSize = inline(exactLine[3]);
    return localized({ ja: `${exactLine[1]}は終了済み直近${sampleSize}試合のうち${exactLine[2]}試合でこの条件を達成しました。ScoutCoreは最近の結果とシーズン状況を組み合わせます。これは支持度であり、保証された確率ではありません。`, es: `${exactLine[1]} cumplió esta línea en ${exactLine[2]} de los últimos ${sampleSize} partidos. ScoutCore combina ese resultado con el contexto de temporada; es una valoración de respaldo, no una probabilidad garantizada.`, ko: `${exactLine[1]}은 최근 종료 ${sampleSize}경기 중 ${exactLine[2]}경기에서 이 기준을 달성했습니다. ScoutCore는 최근 결과와 시즌 상황을 결합합니다. 이는 지지도이며 보장 확률이 아닙니다.`, 'zh-TW': `${exactLine[1]} 在最近 ${sampleSize} 場已結束比賽中有 ${exactLine[2]} 場達成此條件。ScoutCore 會結合近期結果與賽季情境；這是支持度評分，不是保證機率。`, 'pt-BR': `${exactLine[1]} atingiu esta linha em ${exactLine[2]} dos últimos ${sampleSize} jogos. O ScoutCore combina esse resultado com o contexto da temporada; é uma avaliação de apoio, não uma probabilidade garantida.`, de: `${exactLine[1]} erfüllte diese Linie in ${exactLine[2]} der letzten ${sampleSize} Spiele. ScoutCore kombiniert das Ergebnis mit dem Saisonkontext; dies ist eine Unterstützungsbewertung, keine garantierte Wahrscheinlichkeit.` });
  }
  const recentTeamRecord = source.match(/^(.+?) is (\d+)-(\d+) across its last (.+?) completed games, averaging (.+?) runs and (.+?) hits\.$/i);
  if (recentTeamRecord) {
    const sampleSize = inline(recentTeamRecord[4]);
    return localized({ ja: `${recentTeamRecord[1]}は終了済み直近${sampleSize}試合で${recentTeamRecord[2]}勝${recentTeamRecord[3]}敗、平均${recentTeamRecord[5]}得点・${recentTeamRecord[6]}安打です。`, es: `${recentTeamRecord[1]} tiene marca de ${recentTeamRecord[2]}-${recentTeamRecord[3]} en sus últimos ${sampleSize} partidos, con promedios de ${recentTeamRecord[5]} carreras y ${recentTeamRecord[6]} hits.`, ko: `${recentTeamRecord[1]}은 최근 종료 ${sampleSize}경기에서 ${recentTeamRecord[2]}승 ${recentTeamRecord[3]}패, 평균 ${recentTeamRecord[5]}득점과 ${recentTeamRecord[6]}안타입니다.`, 'zh-TW': `${recentTeamRecord[1]} 最近 ${sampleSize} 場已結束比賽為 ${recentTeamRecord[2]} 勝 ${recentTeamRecord[3]} 敗，平均 ${recentTeamRecord[5]} 得分、${recentTeamRecord[6]} 安打。`, 'pt-BR': `${recentTeamRecord[1]} tem campanha de ${recentTeamRecord[2]}-${recentTeamRecord[3]} nos últimos ${sampleSize} jogos, com médias de ${recentTeamRecord[5]} corridas e ${recentTeamRecord[6]} rebatidas.`, de: `${recentTeamRecord[1]} steht in den letzten ${sampleSize} Spielen bei ${recentTeamRecord[2]}-${recentTeamRecord[3]} und erzielt im Schnitt ${recentTeamRecord[5]} Runs sowie ${recentTeamRecord[6]} Hits.` });
  }
  const hitterLine = source.match(/^(.+?) cleared this (.+?) line in (\d+) of the last (.+?) tracked games\. ScoutCore combines recent results with season production and verified opposing-starter context when available\.$/i);
  if (hitterLine) {
    const category = inline(hitterLine[2]);
    const sampleSize = inline(hitterLine[4]);
    return localized({ ja: `${hitterLine[1]}は追跡対象の直近${sampleSize}試合中${hitterLine[3]}試合で${category}の条件を達成しました。ScoutCoreは最近の結果、シーズン成績、検証済みの相手先発情報を組み合わせます。`, es: `${hitterLine[1]} superó la línea de ${category} en ${hitterLine[3]} de los últimos ${sampleSize} partidos. ScoutCore combina resultados recientes, producción de temporada y contexto verificado del abridor rival.`, ko: `${hitterLine[1]}은 최근 추적 ${sampleSize}경기 중 ${hitterLine[3]}경기에서 ${category} 기준을 넘었습니다. ScoutCore는 최근 결과, 시즌 성적, 검증된 상대 선발 상황을 결합합니다.`, 'zh-TW': `${hitterLine[1]} 在最近 ${sampleSize} 場追蹤比賽中有 ${hitterLine[3]} 場達成 ${category} 標準。ScoutCore 結合近期結果、賽季表現與已驗證的對方先發情境。`, 'pt-BR': `${hitterLine[1]} superou a linha de ${category} em ${hitterLine[3]} dos últimos ${sampleSize} jogos. O ScoutCore combina resultados recentes, produção da temporada e contexto confirmado do titular adversário.`, de: `${hitterLine[1]} erreichte die ${category}-Linie in ${hitterLine[3]} der letzten ${sampleSize} Spiele. ScoutCore kombiniert aktuelle Ergebnisse, Saisonleistung und verifizierten Kontext des gegnerischen Starters.` });
  }
  const starterWhip = source.match(/^Opposing starter (.+?) carries a (.+?) WHIP\.$/i);
  if (starterWhip) return localized({ ja: `相手先発${starterWhip[1]}のWHIPは${starterWhip[2]}です。`, es: `El abridor rival ${starterWhip[1]} tiene WHIP de ${starterWhip[2]}.`, ko: `상대 선발 ${starterWhip[1]}의 WHIP는 ${starterWhip[2]}입니다.`, 'zh-TW': `對方先發 ${starterWhip[1]} 的 WHIP 為 ${starterWhip[2]}。`, 'pt-BR': `O titular adversário ${starterWhip[1]} tem WHIP de ${starterWhip[2]}.`, de: `Der gegnerische Starter ${starterWhip[1]} hat einen WHIP von ${starterWhip[2]}.` });
  const pitcherLine = source.match(/^(.+?) cleared this (.+?) line in (\d+) of the last (.+?) tracked pitching appearances\. ScoutCore adjusts the recent trend with workload and opponent context where verified\.$/i);
  if (pitcherLine) {
    const category = inline(pitcherLine[2]);
    const sampleSize = inline(pitcherLine[4]);
    return localized({ ja: `${pitcherLine[1]}は追跡対象の直近${sampleSize}登板中${pitcherLine[3]}登板で${category}の条件を達成しました。ScoutCoreは最近の傾向を登板負荷と対戦状況で調整します。`, es: `${pitcherLine[1]} superó la línea de ${category} en ${pitcherLine[3]} de sus últimas ${sampleSize} apariciones. ScoutCore ajusta la tendencia con carga de trabajo y contexto del rival.`, ko: `${pitcherLine[1]}은 최근 추적 ${sampleSize}등판 중 ${pitcherLine[3]}등판에서 ${category} 기준을 넘었습니다. ScoutCore는 투구 부담과 상대 상황으로 최근 추세를 조정합니다.`, 'zh-TW': `${pitcherLine[1]} 在最近 ${sampleSize} 場追蹤登板中有 ${pitcherLine[3]} 場達成 ${category} 標準。ScoutCore 會依工作量與對手情境調整近期趨勢。`, 'pt-BR': `${pitcherLine[1]} superou a linha de ${category} em ${pitcherLine[3]} das últimas ${sampleSize} aparições. O ScoutCore ajusta a tendência com carga e contexto do adversário.`, de: `${pitcherLine[1]} erreichte die ${category}-Linie in ${pitcherLine[3]} der letzten ${sampleSize} Einsätze. ScoutCore passt den Trend anhand von Belastung und Gegnerkontext an.` });
  }
  const teamStrikeoutRate = source.match(/^(.+?) hitters have a (.+?) strikeout rate in the verified season team line\.$/i);
  if (teamStrikeoutRate) return localized({ ja: `${teamStrikeoutRate[1]}の打者は、検証済みシーズンチーム成績で三振率${teamStrikeoutRate[2]}です。`, es: `Los bateadores de ${teamStrikeoutRate[1]} tienen una tasa de strikeouts de ${teamStrikeoutRate[2]} en la línea de temporada verificada.`, ko: `${teamStrikeoutRate[1]} 타자들의 검증된 시즌 팀 삼진율은 ${teamStrikeoutRate[2]}입니다.`, 'zh-TW': `${teamStrikeoutRate[1]} 打者在已驗證賽季球隊資料中的三振率為 ${teamStrikeoutRate[2]}。`, 'pt-BR': `Os rebatedores de ${teamStrikeoutRate[1]} têm taxa de strikeout de ${teamStrikeoutRate[2]} na linha verificada da temporada.`, de: `Die Batter von ${teamStrikeoutRate[1]} haben in der verifizierten Saison-Teamlinie eine Strikeout-Rate von ${teamStrikeoutRate[2]}.` });
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
  const embeddedDate = localizeEmbeddedDate(source);
  if (embeddedDate !== source) return embeddedDate;
  return null;
};

export const translateUiText = (value: string, locale: ScoutLocale) => {
  if (!value || locale === 'en') return value;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return value;
  let translated = exactTranslation(normalized, locale) ?? translateDynamic(normalized, locale) ?? translateBaseballDynamic(normalized, locale);
  if (locale === 'ja') translated = toJapaneseKatakanaFallback(translated ?? normalized);
  else translated = finalizeNativeLocaleText(translated ?? normalized, locale);
  return translated ? preserveOuterWhitespace(value, translated) : value;
};
