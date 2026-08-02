(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const MAINTENANCE_URL = '/api/series/maintain';
  const DAILY_MAINTENANCE_URL = '/api/cron/series-maintenance';
  let pendingSeriesEndMode = null;
  let maintenanceRunning = false;
  let hideTimer = 0;

  function shanghaiToday() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }

  function requestMeta(input, init = {}) {
    return {
      url: typeof input === 'string' ? input : input?.url || '',
      method: String(init.method || 'GET').toUpperCase()
    };
  }

  function captureNewSeriesForm(event) {
    if (event.target?.id !== 'eventForm') return;
    const repeat = event.target.querySelector('[name="repeat"]')?.value;
    if (!repeat || repeat === 'none') {
      pendingSeriesEndMode = null;
      return;
    }
    pendingSeriesEndMode = {
      explicit: Boolean(event.target.querySelector('[name="endDate"]')?.value),
      capturedAt: Date.now()
    };
  }

  function normalizeLedgerWrite(init) {
    if (!pendingSeriesEndMode || Date.now() - pendingSeriesEndMode.capturedAt >= 10000) return init;
    if (typeof init.body !== 'string') return init;

    const ledger = JSON.parse(init.body);
    const series = Array.isArray(ledger.series) ? ledger.series : [];
    const newest = series
      .slice()
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];

    if (newest) {
      newest.endMode = pendingSeriesEndMode.explicit ? 'fixed' : 'open';
      if (!pendingSeriesEndMode.explicit) newest.endDate = '';
    }
    pendingSeriesEndMode = null;
    return { ...init, body: JSON.stringify(ledger) };
  }

  function normalizeSeriesWrite(init) {
    if (typeof init.body !== 'string') return init;
    const body = JSON.parse(init.body);
    if (body?.action === 'update' && body.patch) {
      body.patch.endMode = body.patch.endDate ? 'fixed' : 'open';
      if (!body.patch.endDate) body.patch.endDate = '';
      return { ...init, body: JSON.stringify(body) };
    }
    return init;
  }

  async function maintainSeries(force = false) {
    if (maintenanceRunning) return;
    maintenanceRunning = true;
    try {
      const response = await nativeFetch(force ? MAINTENANCE_URL : DAILY_MAINTENANCE_URL, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store'
      });
      const result = await response.json().catch(() => ({}));
      if (force && response.ok && (Number(result.generated) || Number(result.removed))) {
        location.reload();
      }
    } catch {
      // Maintenance has a daily server-side schedule; page execution is only a fallback.
    } finally {
      maintenanceRunning = false;
    }
  }

  async function hideCompletedPastEvents() {
    try {
      const response = await nativeFetch('/api/ledger', {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (!response.ok) return;
      const ledger = await response.json();
      const today = shanghaiToday();
      const hiddenIds = new Set(
        (ledger.events || [])
          .filter(event => event.status === 'done' && event.date < today)
          .map(event => event.id)
      );
      document.querySelectorAll('.event').forEach(card => {
        if (hiddenIds.has(card.dataset.id)) card.remove();
      });
      document.querySelectorAll('.group').forEach(group => {
        if (!group.querySelector('.event')) group.remove();
      });
    } catch {
      // Rendering the ledger remains usable if this optional cleanup fails.
    }
  }

  function scheduleCompletedCleanup() {
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hideCompletedPastEvents, 50);
  }

  document.addEventListener('submit', captureNewSeriesForm, true);

  window.fetch = async function seriesAwareFetch(input, init = {}) {
    const { url, method } = requestMeta(input, init);
    let nextInit = init;
    try {
      if (url.includes('/api/ledger') && method === 'PUT') nextInit = normalizeLedgerWrite(nextInit);
      if (url.includes('/api/series') && method === 'POST') nextInit = normalizeSeriesWrite(nextInit);
    } catch {
      nextInit = init;
    }

    const response = await nativeFetch(input, nextInit);
    if (response.ok && url.includes('/api/ledger') && method === 'PUT') {
      queueMicrotask(() => maintainSeries(true));
    }
    return response;
  };

  const app = document.querySelector('#app');
  if (app && 'MutationObserver' in window) {
    new MutationObserver(scheduleCompletedCleanup).observe(app, { childList: true, subtree: true });
  }

  maintainSeries(false);
  scheduleCompletedCleanup();
})();
