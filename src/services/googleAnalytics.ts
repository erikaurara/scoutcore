type AnalyticsValue = string | number | boolean;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const hasAnalyticsConsent = () => {
  try {
    return window.localStorage.getItem('ixmetrics:analytics-consent') === 'accepted';
  } catch {
    return false;
  }
};

export function trackAnalyticsEvent(name: string, parameters: Record<string, AnalyticsValue> = {}) {
  if (typeof window === 'undefined' || !hasAnalyticsConsent() || typeof window.gtag !== 'function') return;
  window.gtag('event', name, parameters);
}

export function trackAppPage(view: string) {
  if (typeof window === 'undefined' || !hasAnalyticsConsent() || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_title: `IXMetrics · ${view.replace(/-/g, ' ')}`,
    page_location: `${window.location.origin}/?view=${encodeURIComponent(view)}`,
    app_view: view,
  });
}

