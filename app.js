(() => {
  'use strict';

  const CONFIG = window.APP_CONFIG;
  const DEFAULT_TYPES = [
    { id: 'baby', name: '👶 宝宝' },
    { id: 'subscription', name: '💳 订阅' },
    { id: 'document', name: '📄 证件' },
    { id: 'maintenance', name: '🏠 家庭维护' },
    { id: 'warranty', name: '🛡️ 保修' },
    { id: 'vehicle', name: '🚗 车辆' },
    { id: 'finance', name: '💰 财务' },
    { id: 'reminder', name: '📌 其他' }
  ];
  const REPEAT_NAMES = {
    none: '单次', daily: '每天', weekly: '每周', monthly: '每月',
    quarterly: '每季度', yearly: '每年', interval: '每隔 X 天'
  };
  const CACHE_KEY = `family-hub-data-v${CONFIG.dataVersion}`;
  const RATE_KEY = 'family-hub-rates-v1';

  const state = {
    ledger: emptyLedger(),
    rates: { CNY: 1 },
    ratesCached: false,
    filter: 'all',
    query: '',
    editingId: '',
    saving: false
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHtml = value => {
    const node = document.createElement('i');
    node.textContent = value == null ? '' : String(value);
    return node.innerHTML;
  };
  const pad = value => String(value).padStart(2, '0');
  const toISO = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const parseDate = value => new Date(`${value}T12:00:00+08:00`);
  const today = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: CONFIG.timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

  function emptyLedger() {
    return {
      version: CONFIG.dataVersion,
      updatedAt: null,
      settings: {
        siteName: CONFIG.name,
        types: DEFAULT_TYPES.map(item => ({ ...item })),
        typeOrder: DEFAULT_TYPES.map(item => item.id),
        theme: 'system'
      },
      series: [],
      events: [],
      templates: []
    };
  }

  function normalizeLedger(value) {
    if (!value || typeof value !== 'object' || !Array.isArray(value.events)) return emptyLedger();
    const ledger = { ...emptyLedger(), ...value };
    ledger.version = CONFIG.dataVersion;
    ledger.settings = { ...emptyLedger().settings, ...(value.settings || {}) };
    ledger.settings.types = Array.isArray(value.settings?.types) && value.settings.types.length
      ? value.settings.types
      : DEFAULT_TYPES.map(item => ({ ...item }));
    ledger.settings.typeOrder = Array.isArray(value.settings?.typeOrder)
      ? value.settings.typeOrder
      : ledger.settings.types.map(item => item.id);
    ledger.series = Array.isArray(value.series) ? value.series : [];
    ledger.events = value.events;
    ledger.templates = Array.isArray(value.templates) ? value.templates : [];
    delete ledger.trash;
    delete ledger.logs;
    return ledger;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
    const text = await response.text();
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
    if (!response.ok) throw new Error(body.error || `请求失败 ${response.status}`);
    return body;
  }

  function readCache() {
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      return saved?.data ? normalizeLedger(saved.data) : null;
    } catch { return null; }
  }

  function writeCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: state.ledger, at: Date.now() })); } catch {}
  }

  function toast(message) {
    const node = $('#toast');
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { node.hidden = true; }, 1800);
  }

  function typeName(id) {
    return state.ledger.settings.types.find(item => item.id === id)?.name || '📌 其他';
  }

  function seriesFor(event) {
    return event.seriesId ? state.ledger.series.find(item => item.id === event.seriesId) : null;
  }

  function dayDifference(value) {
    return Math.round((parseDate(value) - parseDate(today())) / 86400000);
  }

  function relativeDate(value) {
    const difference = dayDifference(value);
    if (difference < 0) return `逾期 ${Math.abs(difference)} 天`;
    if (difference === 0) return '今天';
    if (difference === 1) return '明天';
    return `${difference} 天后`;
  }

  function fullDate(value) {
    const [year, month, day] = String(value).split('-').map(Number);
    const weekday = new Intl.DateTimeFormat('zh-CN', {
      weekday: 'short', timeZone: CONFIG.timeZone
    }).format(parseDate(value));
    return `${year}/${month}/${day} ${weekday}`;
  }

  function groupName(value) {
    const difference = dayDifference(value);
    if (difference < 0) return '已逾期';
    if (difference === 0) return '今天';
    if (difference === 1) return '明天';
    if (difference <= 7) return '未来 7 天';
    if (difference <= 30) return '30 天内';
    if (difference <= 365) return '一年内';
    return '更远以后';
  }

  function money(value, currency) {
    try {
      return new Intl.NumberFormat('zh-CN', {
        style: 'currency', currency: currency || 'CNY',
        minimumFractionDigits: 2, maximumFractionDigits: 2
      }).format(Number(value || 0));
    } catch { return `${currency || 'CNY'} ${Number(value || 0).toFixed(2)}`; }
  }

  function amountMarkup(event) {
    if (event.amount == null || !Number.isFinite(Number(event.amount))) return '';
    const currency = String(event.currency || 'CNY').toUpperCase();
    const original = money(event.amount, currency);
    if (currency === 'CNY' || !Number.isFinite(Number(state.rates[currency]))) {
      return `<div class="amount">${escapeHtml(original)}</div>`;
    }
    const converted = money(Number(event.amount) * Number(state.rates[currency]), 'CNY');
    return `<div class="amount"><span>${escapeHtml(original)}</span><small>≈ ${escapeHtml(converted)}${state.ratesCached ? '（非实时）' : ''}</small></div>`;
  }

  function visibleEvents() {
    const current = today();
    return state.ledger.events
      .filter(event => !event.archived)
      .filter(event => !(event.status === 'done' && event.date < current && state.filter !== 'done'))
      .filter(event => {
        if (state.filter === 'done') return event.status === 'done';
        if (state.filter !== 'all') return event.type === state.filter;
        return true;
      })
      .filter(event => {
        if (!state.query) return true;
        return [event.title, event.note, event.payment, typeName(event.type)]
          .join(' ').toLowerCase().includes(state.query);
      })
      .sort((a, b) => (a.status === 'done') - (b.status === 'done') || String(a.date).localeCompare(String(b.date)));
  }

  function eventCard(event) {
    const difference = dayDifference(event.date);
    const className = event.status === 'done' ? ' done' : difference <= 0 ? ' urgent' : difference <= 3 ? ' soon' : '';
    const series = seriesFor(event);
    const metadata = [typeName(event.type), series ? REPEAT_NAMES[series.repeat] : '单次', event.payment, event.note]
      .filter(Boolean).map(escapeHtml).join(' · ');
    const lunar = event.calendar === 'lunar'
      ? `<em>农历 ${Number(event.lunarMonth)}/${Number(event.lunarDay)}</em>` : '';
    return `<article class="event${className}" data-id="${escapeHtml(event.id)}">
      <div class="event-main">
        <div class="event-line"><b>${escapeHtml(event.title)}</b><span class="badge">${escapeHtml(typeName(event.type))}</span></div>
        <div class="meta">${metadata}</div>${amountMarkup(event)}
      </div>
      <div class="date"><strong>${relativeDate(event.date)}</strong><small>${fullDate(event.date)}</small>${lunar}</div>
      <button class="more" type="button" data-action="menu" aria-label="更多操作">•••</button>
      <div class="row-menu" hidden>
        <button type="button" data-action="edit">编辑本次</button>
        <button type="button" data-action="done">${event.status === 'done' ? '恢复未完成' : '标记完成'}</button>
        <button type="button" data-action="delay">延期 7 天</button>
        <button type="button" data-action="delete" class="danger">删除本次</button>
      </div>
    </article>`;
  }

  function timelineMarkup() {
    const groups = new Map();
    for (const event of visibleEvents()) {
      const name = groupName(event.date);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(event);
    }
    const order = ['已逾期', '今天', '明天', '未来 7 天', '30 天内', '一年内', '更远以后'];
    return order.map(name => {
      const events = groups.get(name);
      if (!events?.length) return '';
      return `<section class="group"><div class="group-title"><b>${name}</b><span>${events.length}</span></div><div class="events">${events.map(eventCard).join('')}</div></section>`;
    }).join('') || '<div class="empty"><b>暂无事项</b><span>点击右上角“新增”开始记录。</span></div>';
  }

  function typeButtons() {
    const items = [{ id: 'all', name: '全部' }, ...state.ledger.settings.types, { id: 'done', name: '已完成' }];
    return items.map(item => `<button type="button" class="type-btn${state.filter === item.id ? ' active' : ''}" data-filter="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button>`).join('');
  }

  function render() {
    document.title = `${CONFIG.name} · 家庭事务中心 · ${CONFIG.version}`;
    $('#app').innerHTML = `<div class="shell">
      <header class="top">
        <div class="brand" role="button" tabindex="0" title="点击刷新">${CONFIG.name}<small>家庭事务中心 · ${CONFIG.version}</small></div>
        <button type="button" class="ghost compact" data-action="stats">统计</button>
        <button type="button" class="ghost compact" data-action="settings">设置</button>
        <button type="button" class="primary compact" data-action="new">＋ 新增</button>
      </header>
      <div class="controls"><div class="type-bar">${typeButtons()}</div><div class="search"><input id="search" value="${escapeHtml(state.query)}" placeholder="搜索事项"><span>⌕</span></div></div>
      <main class="timeline">${timelineMarkup()}</main>
    </div>`;
    $('#app').hidden = false;
  }

  function typeOptions(selected) {
    return state.ledger.settings.types.map(item => `<option value="${escapeHtml(item.id)}"${item.id === selected ? ' selected' : ''}>${escapeHtml(item.name)}</option>`).join('');
  }

  function repeatOptions(selected) {
    return Object.entries(REPEAT_NAMES).map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`).join('');
  }

  function toggleFormFields() {
    const form = $('#eventForm');
    const calendar = form.elements.calendar?.value || 'solar';
    const repeat = form.elements.repeat?.value || 'none';
    $$('.lunar-field', form).forEach(node => { node.hidden = calendar !== 'lunar'; });
    $$('.interval-field', form).forEach(node => { node.hidden = repeat !== 'interval'; });
    $$('.repeat-field', form).forEach(node => { node.hidden = repeat === 'none'; });
    if (calendar === 'lunar' && form.elements.repeat) form.elements.repeat.value = 'yearly';
  }

  function openEventForm(event = null) {
    state.editingId = event?.id || '';
    const editing = Boolean(event);
    const form = $('#eventForm');
    form.innerHTML = `<div class="modal"><header><h2>${editing ? '编辑本次事项' : '新增事项'}</h2><button type="button" class="close" data-close-event>×</button></header>
      <div class="grid">
        <label class="field full"><span>事项标题</span><input name="title" maxlength="100" value="${escapeHtml(event?.title || '')}" required></label>
        <label class="field"><span>类型</span><select name="type">${typeOptions(event?.type || state.ledger.settings.types[0]?.id)}</select></label>
        <label class="field"><span>日期类型</span><select name="calendar"><option value="solar"${event?.calendar !== 'lunar' ? ' selected' : ''}>公历</option><option value="lunar"${event?.calendar === 'lunar' ? ' selected' : ''}>农历</option></select></label>
        <label class="field"><span>${editing ? '事项日期' : '开始生效日期'}</span><input name="date" type="date" value="${escapeHtml(event?.date || today())}" required></label>
        <label class="field lunar-field"><span>农历月份</span><input name="lunarMonth" type="number" min="1" max="12" value="${Number(event?.lunarMonth) || 1}"></label>
        <label class="field lunar-field"><span>农历日期</span><input name="lunarDay" type="number" min="1" max="30" value="${Number(event?.lunarDay) || 1}"></label>
        ${editing ? '' : `<label class="field"><span>循环周期</span><select name="repeat">${repeatOptions('none')}</select></label>
        <label class="field repeat-field"><span>结束日期（可选）</span><input name="endDate" type="date"></label>
        <label class="field interval-field"><span>每隔多少天</span><input name="intervalDays" type="number" min="1" max="3650" value="7"></label>`}
        <label class="field"><span>金额（可选）</span><input name="amount" type="number" min="0" step="0.01" inputmode="decimal" value="${event?.amount == null ? '' : Number(event.amount).toFixed(2)}"></label>
        <label class="field"><span>币种</span><input name="currency" maxlength="8" value="${escapeHtml(event?.currency || 'CNY')}"></label>
        <label class="field"><span>支付方式</span><input name="payment" maxlength="50" value="${escapeHtml(event?.payment || '')}"></label>
        <label class="field full"><span>备注</span><textarea name="note" maxlength="1000">${escapeHtml(event?.note || '')}</textarea></label>
      </div><footer><button type="button" class="ghost" data-close-event>取消</button><button type="submit" class="primary">保存</button></footer></div>`;
    toggleFormFields();
    $('#eventDialog').showModal();
  }

  async function persist({ maintain = false } = {}) {
    if (state.saving) return;
    state.saving = true;
    const previous = structuredClone(state.ledger);
    toast('正在保存…');
    try {
      state.ledger = normalizeLedger(await request('/api/ledger', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.ledger)
      }));
      if (maintain) {
        const result = await request('/api/series/maintain', { method: 'POST' }).catch(() => null);
        if (result?.data) state.ledger = normalizeLedger(result.data);
        else state.ledger = normalizeLedger(await request('/api/ledger'));
      }
      writeCache();
      render();
      toast('已保存');
    } catch (error) {
      state.ledger = previous;
      render();
      toast('保存失败');
      throw error;
    } finally { state.saving = false; }
  }

  async function submitEventForm(event) {
    event.preventDefault();
    if (state.saving) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const amount = values.amount === '' ? null : Math.round(Number(values.amount) * 100) / 100;
    if (values.endDate && values.endDate < values.date) throw new Error('结束日期不能早于开始日期');
    const common = {
      title: values.title.trim(), type: values.type, date: values.date,
      calendar: values.calendar === 'lunar' ? 'lunar' : 'solar',
      lunarMonth: values.calendar === 'lunar' ? Number(values.lunarMonth) : null,
      lunarDay: values.calendar === 'lunar' ? Number(values.lunarDay) : null,
      amount, currency: String(values.currency || 'CNY').trim().toUpperCase() || 'CNY',
      payment: values.payment.trim(), note: values.note.trim(), updatedAt: new Date().toISOString()
    };
    if (!common.title) throw new Error('标题不能为空');

    if (state.editingId) {
      const target = state.ledger.events.find(item => item.id === state.editingId);
      if (!target) throw new Error('事项不存在');
      Object.assign(target, common, { occurrenceDate: target.occurrenceDate || common.date, overridden: Boolean(target.seriesId) || target.overridden });
      $('#eventDialog').close();
      await persist({ maintain: Boolean(target.seriesId) });
      return;
    }

    const repeat = values.repeat || 'none';
    if (repeat === 'none') {
      state.ledger.events.push({
        ...common, id: uid('evt'), seriesId: null, occurrenceDate: common.date,
        status: 'pending', icon: '', attachments: [], archived: false,
        createdAt: new Date().toISOString()
      });
      $('#eventDialog').close();
      await persist();
      return;
    }

    state.ledger.series.push({
      id: uid('series'), title: common.title, type: common.type, startDate: common.date,
      endDate: values.endDate || '', endMode: values.endDate ? 'fixed' : 'open',
      repeat: common.calendar === 'lunar' ? 'yearly' : repeat,
      intervalDays: Math.max(1, Number(values.intervalDays) || 1),
      calendar: common.calendar, lunarMonth: common.lunarMonth, lunarDay: common.lunarDay,
      active: true, amount: common.amount, currency: common.currency,
      payment: common.payment, note: common.note, icon: '',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    $('#eventDialog').close();
    await persist({ maintain: true });
  }

  function eventFromElement(element) {
    const card = element.closest('.event');
    return card ? state.ledger.events.find(item => item.id === card.dataset.id) : null;
  }

  async function handleClick(event) {
    const button = event.target.closest('button');
    if (!button) {
      const card = event.target.closest('.event');
      if (card) openEventForm(eventFromElement(card));
      return;
    }
    if (button.dataset.filter) {
      state.filter = button.dataset.filter;
      render();
      return;
    }
    const action = button.dataset.action;
    if (action === 'new') return openEventForm();
    if (action === 'stats') return document.dispatchEvent(new CustomEvent('familyhub:open-stats'));
    if (action === 'settings') return document.dispatchEvent(new CustomEvent('familyhub:open-settings'));
    if (action === 'menu') {
      event.stopPropagation();
      const menu = button.closest('.event')?.querySelector('.row-menu');
      $$('.row-menu').forEach(item => { if (item !== menu) item.hidden = true; });
      if (menu) menu.hidden = !menu.hidden;
      return;
    }
    const item = eventFromElement(button);
    if (!item) return;
    event.stopPropagation();
    if (action === 'edit') return openEventForm(item);
    if (action === 'done') {
      item.status = item.status === 'done' ? 'pending' : 'done';
      item.completedAt = item.status === 'done' ? new Date().toISOString() : null;
      item.updatedAt = new Date().toISOString();
      return persist({ maintain: Boolean(item.seriesId) });
    }
    if (action === 'delay') {
      const date = parseDate(item.date); date.setDate(date.getDate() + 7);
      item.date = toISO(date); item.overridden = Boolean(item.seriesId) || item.overridden;
      item.updatedAt = new Date().toISOString();
      return persist({ maintain: Boolean(item.seriesId) });
    }
    if (action === 'delete' && confirm(`确定删除本次“${item.title}”？删除后不可恢复。`)) {
      state.ledger.events = state.ledger.events.filter(value => value.id !== item.id);
      return persist({ maintain: Boolean(item.seriesId) });
    }
  }

  function showLogin(message = '') {
    $('#app').hidden = true;
    $('#login').hidden = false;
    $('#loginMessage').textContent = message;
  }

  async function loadRates() {
    try {
      const result = await request('/api/exchange-rates');
      state.rates = { CNY: 1, ...(result.rates || {}) };
      state.ratesCached = false;
      localStorage.setItem(RATE_KEY, JSON.stringify({ rates: state.rates, at: Date.now() }));
    } catch {
      try {
        const cached = JSON.parse(localStorage.getItem(RATE_KEY) || 'null');
        if (cached?.rates) { state.rates = cached.rates; state.ratesCached = true; }
      } catch {}
    }
  }

  async function boot() {
    try {
      const session = await request('/api/auth/session');
      if (!session.authenticated) return showLogin();
    } catch { return showLogin('会话服务暂不可用'); }

    $('#login').hidden = true;
    const cached = readCache();
    if (cached) { state.ledger = cached; render(); }
    try {
      state.ledger = normalizeLedger(await request('/api/ledger'));
      writeCache();
      render();
      loadRates().then(render).catch(() => {});
      request('/api/cron/series-maintenance', { method: 'POST' }).then(async result => {
        if (Number(result.generated) || Number(result.removed)) {
          state.ledger = normalizeLedger(await request('/api/ledger'));
          writeCache(); render();
        }
      }).catch(() => {});
    } catch (error) {
      if (!cached) {
        $('#app').hidden = false;
        $('#app').innerHTML = `<div class="load-error"><b>数据加载失败</b><span>${escapeHtml(error.message)}</span><button class="primary" onclick="location.reload()">重新加载</button></div>`;
      }
    }
  }

  document.addEventListener('click', event => { handleClick(event).catch(error => alert(error.message)); });
  document.addEventListener('input', event => {
    if (event.target.id === 'search') { state.query = event.target.value.trim().toLowerCase(); render(); }
    if (event.target.name === 'currency') event.target.value = event.target.value.toUpperCase().replace(/[^A-Z]/g, '');
  });
  document.addEventListener('change', event => {
    if (event.target.closest('#eventForm') && ['calendar', 'repeat'].includes(event.target.name)) toggleFormFields();
  });
  document.addEventListener('keydown', event => {
    if (event.target.closest('.brand') && (event.key === 'Enter' || event.key === ' ')) location.reload();
  });
  document.addEventListener('click', event => { if (event.target.closest('.brand')) location.reload(); });
  document.addEventListener('click', event => { if (event.target.closest('[data-close-event]')) $('#eventDialog').close(); });
  $('#eventForm').addEventListener('submit', event => { submitEventForm(event).catch(error => alert(error.message)); });
  $('#loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    button.disabled = true; $('#loginMessage').textContent = '';
    try {
      await request('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: $('#password').value })
      });
      const session = await request('/api/auth/session');
      if (!session.authenticated) throw new Error('登录成功但 Cookie 未保存');
      await boot();
    } catch (error) { $('#loginMessage').textContent = error.message; }
    finally { button.disabled = false; }
  });

  window.FamilyHub = {
    getLedger: () => state.ledger,
    setLedger: value => { state.ledger = normalizeLedger(value); writeCache(); render(); },
    request,
    persist,
    escapeHtml,
    render
  };

  boot();
})();
