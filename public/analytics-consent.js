(function () {
  'use strict';

  var MEASUREMENT_ID = 'G-XB300WSWFC';
  var STORAGE_KEY = 'ixmetrics:analytics-consent';
  var loaded = false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });

  function loadAnalytics() {
    if (loaded) return;
    loaded = true;
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', MEASUREMENT_ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });

    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);
    document.head.appendChild(script);
  }

  function setChoice(choice) {
    try { localStorage.setItem(STORAGE_KEY, choice); } catch (_) {}
    if (choice === 'accepted') loadAnalytics();
    else window.gtag('consent', 'update', { analytics_storage: 'denied' });
    render(false);
  }

  function getChoice() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; }
  }

  function ensureUI() {
    if (document.getElementById('ix-consent-banner')) return;

    var banner = document.createElement('section');
    banner.id = 'ix-consent-banner';
    banner.className = 'ix-consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'false');
    banner.setAttribute('aria-labelledby', 'ix-consent-title');
    banner.innerHTML =
      '<h2 class="ix-consent-title" id="ix-consent-title">Help improve IXMetrics</h2>' +
      '<p class="ix-consent-copy">With your permission, IXMetrics uses Google Analytics to understand visits and improve the site. Analytics stays off unless you accept. Read our <a href="/privacy/">Privacy Policy</a>.</p>' +
      '<div class="ix-consent-actions">' +
        '<button class="ix-consent-button" type="button" data-consent="rejected">Reject analytics</button>' +
        '<button class="ix-consent-button accept" type="button" data-consent="accepted">Accept analytics</button>' +
      '</div>';

    var settings = document.createElement('button');
    settings.id = 'ix-consent-settings';
    settings.className = 'ix-consent-settings';
    settings.type = 'button';
    settings.textContent = 'Privacy choices';
    settings.setAttribute('aria-label', 'Review analytics privacy choices');

    banner.addEventListener('click', function (event) {
      var button = event.target.closest('[data-consent]');
      if (button) setChoice(button.getAttribute('data-consent'));
    });
    settings.addEventListener('click', function () { render(true); });
    document.body.appendChild(banner);
    document.body.appendChild(settings);
  }

  function render(forceOpen) {
    ensureUI();
    var choice = getChoice();
    var banner = document.getElementById('ix-consent-banner');
    var settings = document.getElementById('ix-consent-settings');
    banner.hidden = !forceOpen && (choice === 'accepted' || choice === 'rejected');
    settings.hidden = !banner.hidden;
  }

  window.IXMetricsPrivacy = {
    openConsentSettings: function () { render(true); },
    getAnalyticsConsent: getChoice
  };

  function init() {
    if (getChoice() === 'accepted') loadAnalytics();
    render(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

