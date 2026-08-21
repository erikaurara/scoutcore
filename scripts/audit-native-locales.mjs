import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { finalizeNativeLocaleText, unexpectedNativeEnglishTokens } from '../src/i18n/nativeLocaleFallbacks.ts';

const projectRoot = process.cwd();
const catalogFiles = [
  path.join(projectRoot, 'src', 'i18n', 'uiTranslations.ts'),
  path.join(projectRoot, 'src', 'i18n', 'uiTranslationsExtra.ts'),
  path.join(projectRoot, 'src', 'i18n', 'uiTranslationsComplete.ts'),
];

const localeIndexes = { ja: 1, es: 2, ko: 3, 'zh-TW': 4, 'pt-BR': 5, de: 6 };
const normalize = value => value.replace(/\s+/g, ' ').trim();
const literal = node => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null;
const rows = [];

for (const file of catalogFiles) {
  const sourceFile = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const visit = node => {
    if (ts.isArrayLiteralExpression(node) && node.elements.length === 7) {
      const values = node.elements.map(literal);
      if (values.every(value => value !== null)) rows.push({ file: path.relative(projectRoot, file), values });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

const findings = [];
for (const { file, values } of rows) {
  const source = normalize(values[0]);
  for (const [locale, index] of Object.entries(localeIndexes)) {
    if (locale === 'ja') continue;
    const target = normalize(finalizeNativeLocaleText(values[index], locale));
    const unexpected = unexpectedNativeEnglishTokens(target, locale);
    if (unexpected.length) findings.push({ file, locale, source, target, tokens: unexpected });
  }
}

for (const finding of findings) {
  console.log(`${finding.locale}\t${finding.file}\t${JSON.stringify(finding.tokens)}\t${JSON.stringify(finding.source)}\t${JSON.stringify(finding.target)}`);
}
console.log(`\nNative-language audit: ${rows.length} catalog rows; ${findings.length} residual-English findings after finalization.`);
if (process.argv.includes('--strict') && findings.length) process.exitCode = 1;
