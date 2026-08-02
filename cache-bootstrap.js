(() => {
  'use strict';
  try {
    const config = window.APP_CONFIG;
    const markerKey = 'family-hub-cache-revision';
    const current = localStorage.getItem(markerKey);
    if (current === config.cacheRevision) return;
    Object.keys(localStorage)
      .filter(key => key.startsWith(`family-hub-data-v${config.dataVersion}`))
      .forEach(key => localStorage.removeItem(key));
    localStorage.setItem(markerKey, config.cacheRevision);
  } catch {}
})();
