(() => {
  'use strict';

  const app = () => window.FamilyHub;
  const ui = () => window.FamilyHubUI;
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => ui().escapeHtml(value);
  const CONFIG = window.APP_CONFIG;
  const SWIPE_THRESHOLD = 82;
  let touchState = null;
  let suppressClickUntil = 0;

  function eventById(id) {
    return app()?.getLedger()?.events?.find(item => item.id === id) || null;
  }

  function typeName(event) {
    const types = app()?.getLedger()?.settings?.types || [];
    return types.find(item => item.id === event.type)?.name || event.type || '其他';
  }

  function seriesName(event) {
    if (!event.seriesId) return '单次事项';
    const rule = app()?.getLedger()?.series?.find(item => item.id === event.seriesId);
    const names = { daily: '每天', weekly: '每周', monthly: '每月', quarterly: '每季度', yearly: '每年', interval: '自定义间隔' };
    return rule ? `循环 · ${names[rule.repeat] || rule.repeat}` : '循环事项';
  }

  function dateText(value) {
    const date = new Date(`${value}T12:00:00+08:00`);
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: CONFIG.timeZone,
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    }).format(date);
  }

  function amountText(event) {
    if (event.amount == null || !Number.isFinite(Number(event.amount))) return '未填写';
    try {
      return new Intl.NumberFormat('zh-CN', {
        style: 'currency', currency: event.currency || 'CNY', minimumFractionDigits: 2
      }).format(Number(event.amount));
    } catch {
      return `${event.currency || 'CNY'} ${Number(event.amount).toFixed(2)}`;
    }
  }

  function detailRow(label, value, full = false) {
    if (!value) return '';
    return `<div class="event-detail-row${full ? ' full' : ''}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
  }

  function openDetail(id) {
    const event = eventById(id);
    if (!event) return;
    const lunar = event.calendar === 'lunar' ? `农历 ${Number(event.lunarMonth)}/${Number(event.lunarDay)}` : '';
    const status = event.status === 'done' ? '已完成' : (event.date < new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) ? '已逾期' : '待完成');
    const attachmentCount = Array.isArray(event.attachments) ? event.attachments.length : 0;

    ui().openModal({
      title: '事项详情',
      closeAttribute: 'data-detail-close',
      body: `<section class="event-detail-hero ${event.status === 'done' ? 'is-done' : ''}">
        <div class="event-detail-status">${esc(status)}</div>
        <h3>${esc(event.title)}</h3>
        <p>${esc(typeName(event))} · ${esc(seriesName(event))}</p>
      </section>
      <div class="event-detail-grid">
        ${detailRow('日期', dateText(event.date))}
        ${detailRow('农历', lunar)}
        ${detailRow('金额', amountText(event))}
        ${detailRow('支付方式', event.payment || '未填写')}
        ${detailRow('备注', event.note || '无备注', true)}
        ${detailRow('附件', attachmentCount ? `${attachmentCount} 个` : '无附件')}
      </div>`,
      footer: `<div class="event-detail-actions">
        <button type="button" class="primary" data-detail-action="done" data-event-id="${esc(event.id)}">${event.status === 'done' ? '恢复未完成' : '标记完成'}</button>
        <button type="button" class="ghost" data-detail-action="edit" data-event-id="${esc(event.id)}">编辑</button>
        <button type="button" class="ghost" data-detail-action="delay" data-event-id="${esc(event.id)}">延期 7 天</button>
        <button type="button" class="ghost" data-detail-action="assets" data-event-id="${esc(event.id)}">附件 / Logo</button>
        <button type="button" class="danger" data-detail-action="delete" data-event-id="${esc(event.id)}">删除</button>
      </div>`
    });
  }

  function cardFor(id) {
    return document.querySelector(`.event[data-id="${CSS.escape(id)}"]`);
  }

  function triggerCardAction(id, action) {
    const card = cardFor(id);
    const button = card?.querySelector(`[data-action="${action}"]`);
    if (!button) return false;
    button.click();
    return true;
  }

  function performDetailAction(button) {
    const id = button.dataset.eventId;
    const action = button.dataset.detailAction;
    ui().closeModal();
    if (action === 'assets') {
      const card = cardFor(id);
      card?.querySelector('[data-assets-edit]')?.click();
      return;
    }
    triggerCardAction(id, action);
  }

  function resetSwipe(card) {
    if (!card) return;
    card.style.transform = '';
    card.classList.remove('swiping', 'swipe-ready');
  }

  document.addEventListener('touchstart', event => {
    const card = event.target.closest('.event');
    if (!card || event.target.closest('button, a, input, textarea, select')) return;
    const touch = event.touches[0];
    touchState = { card, id: card.dataset.id, startX: touch.clientX, startY: touch.clientY, dx: 0, active: true };
    card.classList.add('swiping');
  }, { passive: true });

  document.addEventListener('touchmove', event => {
    if (!touchState?.active) return;
    const touch = event.touches[0];
    const dx = touch.clientX - touchState.startX;
    const dy = touch.clientY - touchState.startY;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
      resetSwipe(touchState.card);
      touchState.active = false;
      return;
    }
    if (dx >= 0) return;
    touchState.dx = Math.max(-120, dx);
    touchState.card.style.transform = `translateX(${touchState.dx}px)`;
    touchState.card.classList.toggle('swipe-ready', Math.abs(touchState.dx) >= SWIPE_THRESHOLD);
    if (Math.abs(dx) > 8) event.preventDefault();
  }, { passive: false });

  document.addEventListener('touchend', () => {
    if (!touchState) return;
    const { card, id, dx, active } = touchState;
    touchState = null;
    if (active && Math.abs(dx) >= SWIPE_THRESHOLD) {
      suppressClickUntil = Date.now() + 500;
      resetSwipe(card);
      triggerCardAction(id, 'done');
      return;
    }
    resetSwipe(card);
  }, { passive: true });

  document.addEventListener('touchcancel', () => {
    resetSwipe(touchState?.card);
    touchState = null;
  }, { passive: true });

  document.addEventListener('click', event => {
    if (Date.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const detailButton = event.target.closest('[data-detail-action]');
    if (detailButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      performDetailAction(detailButton);
      return;
    }
    if (event.target.closest('[data-detail-close]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      ui().closeModal();
      return;
    }

    const card = event.target.closest('.event');
    if (!card || event.target.closest('button, a, input, textarea, select, .row-menu')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openDetail(card.dataset.id);
  }, true);
})();
