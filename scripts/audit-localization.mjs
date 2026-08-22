import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, 'src');
const catalogFiles = [
  path.join(srcRoot, 'i18n', 'uiTranslations.ts'),
  path.join(srcRoot, 'i18n', 'uiTranslationsExtra.ts'),
  path.join(srcRoot, 'i18n', 'uiTranslationsComplete.ts'),
  path.join(srcRoot, 'i18n', 'uiTranslationsPremium.ts'),
];

const TRANSLATED_ATTRIBUTES = new Set([
  'aria-label',
  'placeholder',
  'title',
  'alt',
  'label',
  'subtitle',
  'description',
  'helperText',
  'emptyText',
  'nextLabel',
  'left',
  'right',
]);

const VISIBLE_PROPERTY_NAMES = /^(?:label|title|subtitle|description|summary|keyFactor|text|eyebrow|helper|helperText|emptyText|buttonText|cta|note|detail|message)$/i;
const VISIBLE_VARIABLE_NAMES = /^(?:summary|keyFactor|headline|description|detail|message|notice|feedback|statusMessage|insight|reason|copy)$/i;
const USER_MESSAGE_CALLS = /^(?:alert|showToast|toast|setError|setMessage|setNotice|setFeedback|setStatusMessage)$/;
const ALLOWED_TOKENS = new Set([
  'MLB', 'AI', 'OPS', 'ERA', 'RBI', 'WHIP', 'AVG', 'OBP', 'SLG', 'HR', 'H', 'R', 'E', 'SO', 'K',
  'K/9', 'BB', 'IP', 'AB', 'PA', 'BvP', 'PvB', 'EV', 'LA', 'xBA', 'xSLG', 'wOBA', 'WAR', 'W', 'L',
  'ET', 'UTC', 'QR', 'URL', 'ID', 'CSV', 'IXMetrics', 'ScoutBot', 'TBD', 'VS', 'G',
  'FB', 'SL', 'KC', 'CH', 'SB', 'ER', 'OPP', 'POS', 'HB', 'HP', 'mph',
  'LHP', 'RHP', 'W-L', 'L10', 'H ·', 'HR ·', 'ERA |', '· ET', 'i',
  'B', 'T', 'P', '1B', '2B', '3B', 'SC', 'HP #', 'HP ·', 'IXMETRICS',
  'check', 'circle', 'mail', 'new', 'sensors', 'visibility',
]);

const normalize = value => value.replace(/\s+/g, ' ').trim();
const folded = value => normalize(value).toLocaleLowerCase('en-US');
const literalValue = node => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
};

const isAllowed = value => {
  const text = normalize(value);
  if (!text || !/[A-Za-z]/.test(text)) return true;
  if (ALLOWED_TOKENS.has(text)) return true;
  if (/^(?:https?:|mailto:|tel:|\/|\.\/|\.\.\/)/i.test(text)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return true;
  if (/^[a-z]+(?:-[A-Z]{2})?$/.test(text) && ['en', 'ja', 'es', 'ko', 'de', 'pt-BR', 'zh-TW'].includes(text)) return true;
  if (/^(?:button|submit|reset|dialog|alert|status|tab|tabpanel|navigation|main|search|group|listbox|option|menu|menuitem|switch|checkbox|radio|img|video|text|email|password|file)$/i.test(text)) return true;
  if (/^[a-z][a-z0-9_]*(?:\s+[a-z][a-z0-9_]*)?$/.test(text) && text.includes('_')) return true;
  if (/^\d+(?:\|[^|]*){2,}$/.test(text)) return true;
  if (/^[A-Fa-f0-9-]{24,}$/.test(text)) return true;
  if (/^[.#\[]/.test(text) || /(?:^|\s)(?:bg|text|border|rounded|flex|grid|px|py|mt|mb|sm|md|lg|xl)-/.test(text)) return true;
  return false;
};

const readSourceFile = file => ts.createSourceFile(
  file,
  fs.readFileSync(file, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
);

const catalog = new Set();
for (const file of catalogFiles) {
  const sourceFile = readSourceFile(file);
  const visit = node => {
    if (ts.isArrayLiteralExpression(node) && node.elements.length === 7) {
      const source = literalValue(node.elements[0]);
      if (source) catalog.add(folded(source));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

const allFiles = [];
const walk = directory => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'i18n') continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (/\.(?:ts|tsx)$/.test(entry.name)) allFiles.push(fullPath);
  }
};
walk(srcRoot);

const sourceByFile = new Map(allFiles.map(file => [file, readSourceFile(file)]));
const resolveLocalImport = (fromFile, specifier) => {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
  return candidates.find(candidate => sourceByFile.has(candidate)) ?? null;
};
const reachable = new Set();
const visitImports = file => {
  if (reachable.has(file)) return;
  reachable.add(file);
  const sourceFile = sourceByFile.get(file);
  if (!sourceFile) return;
  const visitDependency = node => {
    let specifier = null;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifier = node.moduleSpecifier.text;
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      specifier = node.arguments[0].text;
    }
    if (specifier) {
      const imported = resolveLocalImport(file, specifier);
      if (imported) visitImports(imported);
    }
    ts.forEachChild(node, visitDependency);
  };
  visitDependency(sourceFile);
};
visitImports(path.join(srcRoot, 'App.tsx'));
const files = process.argv.includes('--all') ? allFiles : [...reachable];

const findings = new Map();
const templateFindings = new Map();
const add = (file, node, raw, kind) => {
  const value = normalize(raw);
  if (isAllowed(value) || catalog.has(folded(value))) return;
  const sourceFile = node.getSourceFile();
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  const key = `${path.relative(projectRoot, file)}:${line}:${value}`;
  findings.set(key, { file: path.relative(projectRoot, file), line, value, kind });
};

const collectRenderLiteral = (file, node, kind) => {
  const value = literalValue(node);
  if (value !== null) {
    add(file, node, value, kind);
    return;
  }
  if (ts.isTemplateExpression(node)) {
    if (process.argv.includes('--templates')) {
      const signature = [node.head.text, ...node.templateSpans.flatMap(span => ['{…}', span.literal.text])].join('').replace(/\s+/g, ' ').trim();
      if (/[A-Za-z]/.test(signature)) {
        const sourceFile = node.getSourceFile();
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        const key = `${path.relative(projectRoot, file)}:${line}:${signature}`;
        templateFindings.set(key, { file: path.relative(projectRoot, file), line, signature, kind });
      }
    }
  } else if (ts.isConditionalExpression(node)) {
    collectRenderLiteral(file, node.whenTrue, kind);
    collectRenderLiteral(file, node.whenFalse, kind);
  } else if (ts.isParenthesizedExpression(node)) {
    collectRenderLiteral(file, node.expression, kind);
  } else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) {
    collectRenderLiteral(file, node.left, kind);
    collectRenderLiteral(file, node.right, kind);
  }
};

for (const file of files) {
  const sourceFile = sourceByFile.get(file) ?? readSourceFile(file);
  const visit = node => {
    if (ts.isJsxText(node)) {
      const parent = node.parent;
      const tag = ts.isJsxElement(parent) ? parent.openingElement.tagName.getText(sourceFile) : '';
      const opening = ts.isJsxElement(parent) ? parent.openingElement : null;
      const className = opening?.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText(sourceFile) === 'className');
      const classText = className && ts.isJsxAttribute(className) && className.initializer && ts.isStringLiteral(className.initializer) ? className.initializer.text : '';
      if (!/material-(?:symbols|icons)/.test(classText) && !/^(?:script|style)$/i.test(tag)) add(file, node, node.text, 'jsx-text');
    } else if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      collectRenderLiteral(file, node.expression, 'jsx-expression');
    } else if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      if (TRANSLATED_ATTRIBUTES.has(name) && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) add(file, node.initializer, node.initializer.text, `attribute:${name}`);
        else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) collectRenderLiteral(file, node.initializer.expression, `attribute:${name}`);
      }
    } else if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText(sourceFile).replace(/["']/g, '');
      if (VISIBLE_PROPERTY_NAMES.test(name)) collectRenderLiteral(file, node.initializer, `property:${name}`);
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && VISIBLE_VARIABLE_NAMES.test(node.name.text) && node.initializer) {
      collectRenderLiteral(file, node.initializer, `variable:${node.name.text}`);
    } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left) && VISIBLE_VARIABLE_NAMES.test(node.left.text)) {
      collectRenderLiteral(file, node.right, `assignment:${node.left.text}`);
    } else if (ts.isCallExpression(node)) {
      const name = node.expression.getText(sourceFile).split('.').at(-1) ?? '';
      if (USER_MESSAGE_CALLS.test(name)) {
        for (const argument of node.arguments) collectRenderLiteral(file, argument, `call:${name}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

const sorted = [...findings.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.value.localeCompare(b.value));
for (const item of sorted) console.log(`${item.file}:${item.line}\t${item.kind}\t${JSON.stringify(item.value)}`);
console.log(`\nLocalization audit: ${catalog.size} catalogued phrases; ${sorted.length} visible English strings missing.`);
if (process.argv.includes('--templates')) {
  const dynamic = [...templateFindings.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.signature.localeCompare(b.signature));
  for (const item of dynamic) console.log(`${item.file}:${item.line}\t${item.kind}\t${JSON.stringify(item.signature)}`);
  console.log(`Dynamic template review: ${dynamic.length} rendered templates.`);
}
if (sorted.length) process.exitCode = 1;
