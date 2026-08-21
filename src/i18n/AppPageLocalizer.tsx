import { useEffect } from 'react';
import type { ScoutLocale } from './LanguageContext';
import { translateUiText } from './uiTranslations';

type TranslationRecord = {
  source: string;
  rendered: string;
};

const TRANSLATED_ATTRIBUTES = ['aria-label', 'placeholder', 'title', 'alt'] as const;
const SKIP_SELECTOR = [
  'script',
  'style',
  'noscript',
  'code',
  'pre',
  '.material-symbols-outlined',
  '.material-icons',
  '[data-i18n-skip]',
  '[data-i18n-user-content]',
  '[contenteditable="true"]',
].join(',');

const textRecords = new WeakMap<Text, TranslationRecord>();
const attributeRecords = new WeakMap<Element, Map<string, TranslationRecord>>();

const shouldSkip = (element: Element | null) => Boolean(element?.closest(SKIP_SELECTOR));

const translateTextNode = (node: Text, locale: ScoutLocale) => {
  const parent = node.parentElement;
  if (!parent || shouldSkip(parent)) return;

  // A text-only <option> uses its label as its form value. Preserve the original
  // source value before translating the visible label so changing language never
  // changes the selected filter or the value submitted by a form.
  if (parent instanceof HTMLOptionElement && !parent.hasAttribute('value')) {
    parent.setAttribute('value', parent.value);
  }

  const current = node.nodeValue ?? '';
  let record = textRecords.get(node);
  if (!record) {
    record = { source: current, rendered: current };
    textRecords.set(node, record);
  } else if (current !== record.rendered && current !== record.source) {
    // React replaced this text node's value with new source copy.
    record.source = current;
  }

  const translated = translateUiText(record.source, locale);
  if (current !== translated) node.nodeValue = translated;
  record.rendered = translated;
};

const translateAttributes = (element: Element, locale: ScoutLocale) => {
  if (shouldSkip(element)) return;
  let records = attributeRecords.get(element);
  if (!records) {
    records = new Map();
    attributeRecords.set(element, records);
  }

  for (const attribute of TRANSLATED_ATTRIBUTES) {
    const current = element.getAttribute(attribute);
    if (!current) continue;
    let record = records.get(attribute);
    if (!record) {
      record = { source: current, rendered: current };
      records.set(attribute, record);
    } else if (current !== record.rendered && current !== record.source) {
      record.source = current;
    }
    const translated = translateUiText(record.source, locale);
    if (current !== translated) element.setAttribute(attribute, translated);
    record.rendered = translated;
  }
};

const localizeSubtree = (root: Node, locale: ScoutLocale) => {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, locale);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root as Element, locale);

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE && shouldSkip(node as Element)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text, locale);
    else translateAttributes(node as Element, locale);
    node = walker.nextNode();
  }
};

/**
 * Compatibility bridge for the existing ScoutCore pages. Newer navigation copy
 * already uses `useLanguage`; this bridge localizes the visible legacy page copy
 * (including content rendered after API calls) from the same language selector.
 */
export const AppPageLocalizer = ({ locale }: { locale: ScoutLocale }) => {
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;

    let frame = 0;
    const apply = () => {
      frame = 0;
      localizeSubtree(root, locale);
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(apply);
    };

    apply();
    const observer = new MutationObserver(schedule);
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATED_ATTRIBUTES],
    });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [locale]);

  return null;
};
