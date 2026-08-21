import assert from 'node:assert/strict';
import { translateUiText } from '../src/i18n/uiTranslations';
import { hasUnexpectedJapaneseLatinText } from '../src/i18n/katakana';
import { unexpectedNativeEnglishTokens } from '../src/i18n/nativeLocaleFallbacks';
import type { ScoutLocale } from '../src/i18n/LanguageContext';

const translatedSamples = [
  'Friend request sent.',
  'Loading MLB game logs…',
  'Unable to analyze matchup.',
  'Generate Scout Report',
  'No notifications yet.',
  'Weekly Leaderboard',
  'Game Final',
  'HOT',
  'Gameday Intelligence',
  'VIEW FINAL BOX SCORE',
  'PITCHER VS BATTER',
  'No bullpen players listed.',
  'GAME CHAT',
  'Push notifications',
  'Loading the active roster…',
  'HITTER REPORT',
  'PITCHER REPORT',
  'STANDOUT',
  'CONTINUE TO TODAY’S GAMES',
  'NEXT: PITCHERS',
  'NEXT: GAME PICKS',
  'CONTINUE TO ANALYZE',
  'NEXT: ALMOST DONE',
  'Pick from today’s or tomorrow’s MLB slate.',
  'Choose batter, confirmed pitcher, and game selections.',
  'Game context only',
] as const;

const locales: Exclude<ScoutLocale, 'en'>[] = ['ja', 'es', 'ko', 'zh-TW', 'pt-BR', 'de'];
for (const locale of locales) {
  for (const source of translatedSamples) {
    assert.notEqual(translateUiText(source, locale), source, `${locale} did not translate: ${source}`);
  }
}

assert.equal(translateUiText('Hits', 'es'), 'Hits');
assert.equal(translateUiText('Strikeouts', 'es'), 'Strikeouts');
assert.equal(translateUiText('BATTER STRIKEOUTS', 'es'), 'STRIKEOUTS DEL BATEADOR');
assert.doesNotMatch(translateUiText('Final line: 2 H, 1 HR in 4 AB. Plate appearances: 5, walks: 1, strikeouts: 1, total bases: 5. This report summarizes verified MLB box-score production from the completed game.', 'es'), /imparables?|ponches?/i);

const dynamicSamples = [
  'Hitter performances',
  '7 or fewer',
  'vs RHP',
  'NYY sample',
  'Choose up to 8 Challenge selections on one card.',
  '· 2 limited-data',
  '4/7 correct',
  'Reply by Erika',
  'Reply to Erika…',
  'Shohei Ohtani headshot',
  '· vs New York Yankees',
  'Los Angeles Dodgers logo',
  'Dodgers Score 4+',
  'Submit 5 private picks',
  'Erika IS LEADING',
  "Erika's results",
  'Week of August 17',
  'Batting: Shohei Ohtani',
  'Result: Correct',
  'Editable until 7:10 PM.',
  '7W – 3L',
  'You’re in the top 10% of predictors. Make smart picks and climb higher!',
  '75% accuracy · 15/20 correct',
  '3 unread',
  'Projected chance 72%',
  'Search Dodgers players',
  'No game logs are available for Shohei Ohtani in the selected season view.',
  'Add @erika on ScoutCoreMLB',
  'Scout Level: Pro Scout',
  'Game times shown in your local timezone (Asia/Tokyo).',
  'Open Dodgers team profile',
  'Probable starters: Yoshinobu Yamamoto vs Gerrit Cole. ScoutCore will use confirmed lineups, pitcher handedness and current player data as they become available.',
  'Final line: 2 H, 1 HR in 4 AB. Plate appearances: 5, walks: 1, strikeouts: 1, total bases: 5. This report summarizes verified MLB box-score production from the completed game.',
  'Shohei Ohtani cleared this hits line in 7 of the last 10 tracked games. ScoutCore combines recent results with season production and verified opposing-starter context when available.',
  'Shohei Ohtani cleared this strikeouts line in 4 of the last available tracked pitching appearances. ScoutCore adjusts the recent trend with workload and opponent context where verified.',
  'Shohei Ohtani met this exact line in 7 of the last 10 completed games. ScoutCore combines that recent result with season context; this is a support rating, not a guaranteed probability.',
  'Los Angeles Dodgers is 7-3 across its last 10 completed games, averaging 5.2 runs and 8.4 hits.',
  'The selected team cleared this line in 0 of its last available completed games. ScoutCore also checks recent scoring plus verified starter and team context where available.',
  'Opposing starter Gerrit Cole has a 3.21 ERA and verified season line.',
  'Across the recent completed-game samples for both clubs, this first-inning outcome occurred in 0 of available tracked games.',
  'This extra-innings outcome occurred in 0 of available recent completed-game samples across the two teams.',
  'Opposing starter Gerrit Cole carries a 1.12 WHIP.',
  'New York Yankees hitters have a 22.4% strikeout rate in the verified season team line.',
  'Locks in 2h 15m',
  '3m ago',
  '2026 Season',
  'No Shohei Ohtani games vs New York Yankees match these filters in 2026 Season.',
  'Shohei Ohtani — Reach Base 2+ Times',
  'Shohei Ohtani — 2+ Total Bases',
  'Gerrit Cole — 5 or Fewer Hits Allowed',
  'Shohei Ohtani — Quality Start: Yes',
  'First Inning — Run Scored',
  'Los Angeles Dodgers — Win',
  'Selected team scores at least 4 runs.',
  'Allows 3 earned runs or fewer.',
  'Records at least 6.0 innings pitched.',
  'Shohei Ohtani produced 2 H, 1 HR against New York Yankees. Season line: .301 AVG / .410 OBP / .625 SLG, 42 HR, 101 RBI.',
  'Gerrit Cole finished with 6.0 IP, 8 K against Los Angeles Dodgers. Season profile: 3.21 ERA, 1.12 WHIP, 10.2 K/9 across 145.0 IP.',
  'Gerrit Cole works primarily off the Four-Seam Fastball, averaging 96.4 mph in recent tracked outings with 48% usage. His 2026 regular season: 3.21 ERA, 1.12 WHIP, 180 SO in 145.0 IP.',
  'Shohei Ohtani is a left-handed hitter. His OPS is 1.025 vs LHP and 1.112 vs RHP. Recent tracked results are strongest against Four-Seam Fastball (.412 AVG).',
  'Fri, Aug 21, 7:10 PM',
  'Aug 20, 2026',
  'Shohei Ohtani singles on a line drive to right fielder Aaron Judge. Mookie Betts scores.',
] as const;

for (const locale of locales) {
  for (const source of dynamicSamples) {
    const translated = translateUiText(source, locale);
    assert.notEqual(translated, source, `${locale} did not translate dynamic text: ${source}`);
    if (locale === 'ja') {
      assert.equal(hasUnexpectedJapaneseLatinText(translated), false, `Japanese dynamic Latin text leaked: ${source} -> ${translated}`);
    } else {
      assert.deepEqual(unexpectedNativeEnglishTokens(translated, locale), [], `${locale} English text leaked: ${source} -> ${translated}`);
    }
  }
}

for (const source of [
  'Live MLB games · tap a game to open ScoutCore Gameday',
  'Boston Red Sox · vs Logan Webb',
  'Chris Sale vs Jacob Misiorowski',
  "Scout Level is ScoutCore's long-term progression system. It rewards prediction performance in ScoutCore Challenge and gives users a clear path from Rookie Scout to ScoutCore All-Star.",
]) {
  for (const locale of ['es', 'ko', 'zh-TW', 'pt-BR', 'de'] as const) {
    const translated = translateUiText(source, locale);
    assert.deepEqual(unexpectedNativeEnglishTokens(translated, locale), [], `${locale} full-site English text leaked: ${source} -> ${translated}`);
  }
}

for (const source of [
  'Shohei Ohtani',
  'Aaron Judge',
  'New York Yankees',
  'Los Angeles Dodgers',
  'Jesús Luzardo vs Édgar Ramírez',
  'A Future MLB Player',
  'A new dynamic interface message',
]) {
  const translated = translateUiText(source, 'ja');
  assert.equal(hasUnexpectedJapaneseLatinText(translated), false, `Japanese Latin text leaked: ${source} -> ${translated}`);
}

for (const protectedValue of [
  'player@example.com',
  'https://scoutcoremlb.com/profile/example',
  '@erika',
]) {
  assert.equal(translateUiText(protectedValue, 'ja'), protectedValue, `Protected value changed: ${protectedValue}`);
}

const statLine = translateUiText('ScoutCore AI · OPS 1.025 · 98 mph · 9 K/9', 'ja');
assert.match(statLine, /ScoutCore/);
assert.match(statLine, /AI/);
assert.match(statLine, /OPS/);
assert.match(statLine, /mph/);
assert.match(statLine, /K\/9/);
assert.equal(hasUnexpectedJapaneseLatinText(statLine), false, `Protected baseball notation changed: ${statLine}`);

console.log(`Localization verification passed for ${locales.length} translated locales and Japanese Katakana fallbacks.`);
