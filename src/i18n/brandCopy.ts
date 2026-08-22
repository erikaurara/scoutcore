import type { ScoutLocale } from './LanguageContext';

const replaceCommonBrandCopy = (value: string) => value
  .replace(/ScoutCoreMLB/g, 'IXMetrics')
  .replace(/ScoutCore/g, 'IXMetrics')
  .replace(/IXMetrics Challenge/g, 'IX Challenge')
  .replace(/IXMetrics Points/g, 'IX Points')
  .replace(/IXMetrics All-Star/g, 'IX All-Star')
  .replace(/Scouting Feed/g, 'Insights Feed')
  .replace(/Scout Level/g, 'Analyst Level');

export const applyBrandCopy = (value: string, locale: ScoutLocale) => {
  const common = replaceCommonBrandCopy(value);
  if (locale === 'en') return common;

  if (locale === 'ja') return common
    .replace(/IXMetrics\s*チャレンジ/g, 'IX チャレンジ')
    .replace(/スカウティングフィード/g, 'インサイトフィード')
    .replace(/スカウトレベル/g, 'アナリストレベル')
    .replace(/IXMetrics ポイント/g, 'IX ポイント')
    .replace(/IXMetrics オールスター/g, 'IX オールスター');

  if (locale === 'es') return common
    .replace(/Desafío IXMetrics/gi, 'Desafío IX')
    .replace(/Informe de scouting/gi, 'Feed de insights')
    .replace(/Nivel Scout/gi, 'Nivel de analista')
    .replace(/nivel de ojeador/gi, 'nivel de analista')
    .replace(/puntos IXMetrics/gi, 'puntos IX')
    .replace(/estrella de IXMetrics/gi, 'estrella de IX');

  if (locale === 'ko') return common
    .replace(/IXMetrics 챌린지/g, 'IX 챌린지')
    .replace(/IXMetrics 도전/g, 'IX 도전')
    .replace(/스카우팅 피드/g, '인사이트 피드')
    .replace(/스카우트 레벨/g, '분석가 레벨')
    .replace(/IXMetrics 포인트/g, 'IX 포인트')
    .replace(/IXMetrics 올스타/g, 'IX 올스타');

  if (locale === 'zh-TW') return common
    .replace(/IXMetrics 挑戰/g, 'IX 挑戰')
    .replace(/球探動態/g, '洞察動態')
    .replace(/球探等級/g, '分析師等級')
    .replace(/IXMetrics 積分/g, 'IX 積分')
    .replace(/IXMetrics 全明星/g, 'IX 全明星');

  if (locale === 'pt-BR') return common
    .replace(/Desafio IXMetrics/gi, 'Desafio IX')
    .replace(/Feed de scouting/gi, 'Feed de insights')
    .replace(/Nível Scout/gi, 'Nível de analista')
    .replace(/nível de olheiro/gi, 'nível de analista')
    .replace(/pontos IXMetrics/gi, 'pontos IX')
    .replace(/estrela do IXMetrics/gi, 'estrela IX');

  return common
    .replace(/IXMetrics-Challenge/g, 'IX-Challenge')
    .replace(/IXMetrics-Herausforderung/g, 'IX-Herausforderung')
    .replace(/Scouting-Feed/g, 'Insights-Feed')
    .replace(/Scout-Level/g, 'Analystenstufe')
    .replace(/Beobachterstufe/g, 'Analystenstufe')
    .replace(/IXMetrics-Punkte/g, 'IX-Punkte')
    .replace(/Dein Analystenstufe/g, 'Deine Analystenstufe')
    .replace(/Über das Analystenstufe/g, 'Über die Analystenstufe')
    .replace(/höchstes erreichtes Analystenstufe/g, 'höchste erreichte Analystenstufe');
};
