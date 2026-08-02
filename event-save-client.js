(() => {
  'use strict';

  const app = () => window.FamilyHub;
  const $ = (selector, root = document) => root.querySelector(selector);
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  let editingId = '';
  let saving = false;

  function cloneLedger() {
    return structuredClone(app().getLedger());
  }

  function commonFromForm(form) {
    const values = Object.fromEntries(new FormData(form));
    const amount = values.amount === '' ? null : Math.round(Number(values.amount) * 100) / 100;
    if (values.endDate && values.endDate < values.date) throw new Error('结束日期不能早于开始日期');
    const common = {
      title: String(values.title || '').trim(),
      type: values.type,
      date: values.date,
      calendar: values.calendar === 'lunar' ? 'lunar' : 'solar',
      lunarMonth: values.calendar === 'lunar' ? Number(values.lunarMonth) : null,
      lunarDay: values.calendar === 'lunar' ? Number(values.lunarDay) : null,
      amount,
      currency: String(values.currency || 'CNY').trim().toUpperCase() || 'CNY',
      payment: String(values.payment || '').trim(),
      note: String(values.note || '').trim()
    };
    if (!common.title) throw new Error('标题不能为空');
    if (!common.date) throw new Error('请选择日期');
    return { values, common };
  }

  async function commit({ method, url = '/api/events', body, optimistic }) {
    if (saving) return;
    saving = true;
    const before = cloneLedger();

    try {
      optimistic();
      app().setLedger(app().getLedger());
      const options = { method, headers: { 'Content-Type': 'application/json' } };
      if (body) options.body = JSON.stringify(body);
      const result = await app().request(url, options);
      if (result?.data) app().setLedger(result.data);
    } catch (error) {
      app().setLedger(before);
      alert(error.message || '保存失败');
    } finally {
      saving = false;
    }
  }

  async function submit(form) {
    const ledger = app().getLedger();
    const revision = Number(ledger.revision) || 0;
    const { values, common } = commonFromForm(form);
    const now = new Date().toISOString();
    const currentId = editingId;
    editingId = '';
    $('#eventDialog')?.close();

    if (currentId) {
      const current = ledger.events.find(item => item.id === currentId);
      if (!current) throw new Error('事项不存在');
      const patch = {
        ...common,
        occurrenceDate: current.occurrenceDate || common.date,
        overridden: Boolean(current.seriesId) || current.overridden,
        updatedAt: now
      };
      return commit({
        method: 'PATCH',
        body: { id: currentId, revision, event: patch },
        optimistic: () => Object.assign(ledger.events.find(item => item.id === currentId), patch)
      });
    }

    const repeat = values.repeat || 'none';
    if (repeat === 'none') {
      const id = uid('evt');
      const optimisticEvent = {
        ...common, id, seriesId: null, occurrenceDate: common.date,
        status: 'pending', completedAt: null, icon: '', attachments: [],
        archived: false, overridden: false, createdAt: now, updatedAt: now
      };
      return commit({
        method: 'POST',
        body: { ...common, id, repeat: 'none', revision },
        optimistic: () => ledger.events.push(optimisticEvent)
      });
    }

    const seriesId = uid('series');
    const temporaryEventId = uid('temp');
    const optimisticSeries = {
      id: seriesId, title: common.title, type: common.type, startDate: common.date,
      endDate: values.endDate || '', endMode: values.endDate ? 'fixed' : 'open',
      repeat: common.calendar === 'lunar' ? 'yearly' : repeat,
      intervalDays: Math.max(1, Number(values.intervalDays) || 1),
      calendar: common.calendar, lunarMonth: common.lunarMonth, lunarDay: common.lunarDay,
      active: true, amount: common.amount, currency: common.currency,
      payment: common.payment, note: common.note, icon: '', createdAt: now, updatedAt: now
    };
    const optimisticEvent = {
      ...common, id: temporaryEventId, seriesId, occurrenceDate: common.date,
      status: 'pending', completedAt: null, icon: '', attachments: [],
      archived: false, overridden: false, createdAt: now, updatedAt: now
    };
    return commit({
      method: 'POST',
      body: {
        ...common, revision, repeat, seriesId,
        endDate: values.endDate || '', intervalDays: Math.max(1, Number(values.intervalDays) || 1)
      },
      optimistic: () => {
        ledger.series.push(optimisticSeries);
        ledger.events.push(optimisticEvent);
      }
    });
  }

  function eventFromButton(button) {
    const id = button.closest('.event')?.dataset.id;
    return id ? app().getLedger().events.find(item => item.id === id) : null;
  }

  async function action(button) {
    const item = eventFromButton(button);
    if (!item) return;
    const ledger = app().getLedger();
    const revision = Number(ledger.revision) || 0;
    const actionName = button.dataset.action;

    if (actionName === 'done') {
      const nextStatus = item.status === 'done' ? 'pending' : 'done';
      return commit({
        method: 'PATCH',
        body: { id: item.id, revision, action: nextStatus === 'done' ? 'done' : 'restore' },
        optimistic: () => {
          item.status = nextStatus;
          item.completedAt = nextStatus === 'done' ? new Date().toISOString() : null;
          item.updatedAt = new Date().toISOString();
        }
      });
    }

    if (actionName === 'delay') {
      const date = new Date(`${item.date}T12:00:00+08:00`);
      date.setDate(date.getDate() + 7);
      const nextDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return commit({
        method: 'PATCH',
        body: { id: item.id, revision, event: { date: nextDate } },
        optimistic: () => {
          item.date = nextDate;
          item.overridden = Boolean(item.seriesId) || item.overridden;
          item.updatedAt = new Date().toISOString();
        }
      });
    }

    if (actionName === 'delete') {
      if (!confirm(`确定删除本次“${item.title}”？删除后不可恢复。`)) return;
      return commit({
        method: 'DELETE',
        url: `/api/events?id=${encodeURIComponent(item.id)}&revision=${revision}`,
        optimistic: () => {
          ledger.events = ledger.events.filter(value => value.id !== item.id);
        }
      });
    }
  }

  document.addEventListener('click', event => {
    const card = event.target.closest('.event');
    if (card && !event.target.closest('[data-action="menu"]')) editingId = card.dataset.id || '';

    const button = event.target.closest('button[data-action]');
    if (!button || !['done', 'delay', 'delete'].includes(button.dataset.action)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    action(button).catch(error => alert(error.message));
  }, true);

  document.addEventListener('submit', event => {
    if (event.target.id !== 'eventForm') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    submit(event.target).catch(error => alert(error.message));
  }, true);

  document.addEventListener('click', event => {
    if (event.target.closest('[data-action="new"]')) editingId = '';
    if (event.target.closest('[data-close-event]')) editingId = '';
  }, true);
})();
