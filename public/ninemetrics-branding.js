(() => {
  const TEXT_REPLACEMENTS = [
    [/ScoutCoreMLB/g, 'NineMetrics'],
    [/SCOUTCOREMLB/g, 'NINEMETRICS'],
    [/ScoutCore/g, 'NineMetrics'],
    [/SCOUTCORE/g, 'NINEMETRICS'],
    [/Baseball Intelligence/g, 'AI Gameday Intelligence'],
    [/BASEBALL INTELLIGENCE/g, 'AI GAMEDAY INTELLIGENCE'],
  ];

  const replaceText = (value) => {
    if (!value) return value;
    return TEXT_REPLACEMENTS.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), value);
  };

  const brandElement = (element) => {
    if (!(element instanceof Element)) return;

    for (const attribute of ['alt', 'title', 'aria-label', 'placeholder']) {
      if (element.hasAttribute(attribute)) {
        const current = element.getAttribute(attribute) || '';
        const next = replaceText(current);
        if (next !== current) element.setAttribute(attribute, next);
      }
    }

    if (element instanceof HTMLImageElement && element.src.includes('scoutcore-logo-email.png')) {
      element.src = '/ninemetrics-icon.svg';
      element.alt = 'NineMetrics';
      element.classList.add('object-contain');
    }
  };

  const brandNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const current = node.nodeValue || '';
      const next = replaceText(current);
      if (next !== current) node.nodeValue = next;
      return;
    }

    if (!(node instanceof Element)) return;
    brandElement(node);
    node.querySelectorAll('*').forEach(brandElement);

    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let textNode;
    while ((textNode = walker.nextNode())) {
      const current = textNode.nodeValue || '';
      const next = replaceText(current);
      if (next !== current) textNode.nodeValue = next;
    }
  };

  const run = () => brandNode(document.body);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(brandNode);
      if (mutation.type === 'characterData') brandNode(mutation.target);
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
})();
