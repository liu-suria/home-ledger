(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  let cachedLedger = null;
  let cachedAt = 0;
  let decorationPending = false;

  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}
    if (!response.ok) throw Error(data.error || `请求失败 ${response.status}`);
    return data;
  }

  async function loadLedger(force = false) {
    if (!force && cachedLedger && Date.now() - cachedAt < 30000) return cachedLedger;
    cachedLedger = await request('/api/ledger');
    cachedAt = Date.now();
    return cachedLedger;
  }

  function paginate() {
    const timeline = $('.timeline');
    if (!timeline) return;
    const cards = $$('.event', timeline);
    const limit = Number(timeline.dataset.limit || 100);
    cards.forEach((card, index) => { card.hidden = index >= limit; });

    let more = $('.rc-more', timeline);
    if (cards.length > limit) {
      if (!more) {
        more = document.createElement('button');
        more.type = 'button';
        more.className = 'ghost rc-more';
        more.textContent = '加载更多';
        timeline.appendChild(more);
      }
      more.hidden = false;
    } else if (more) {
      more.hidden = true;
    }
  }

  async function decorateEvents() {
    decorationPending = false;
    const ledger = await loadLedger().catch(() => null);
    if (!ledger) return;
    const eventById = new Map((ledger.events || []).map(event => [event.id, event]));

    for (const card of $$('.event')) {
      const event = eventById.get(card.dataset.id);
      if (!event) continue;
      const titleLine = $('.event-line', card);

      if (event.icon && titleLine && !$('.rc-logo', card)) {
        const image = document.createElement('img');
        image.className = 'rc-logo';
        image.src = event.icon;
        image.alt = '';
        image.loading = 'lazy';
        titleLine.prepend(image);
      }

      if ((event.attachments || []).length && !$('.rc-att', card)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'rc-att';
        button.textContent = `附件 ${event.attachments.length}`;
        button.dataset.rcAssets = event.id;
        $('.event-main', card)?.appendChild(button);
      }

      const menu = $('.row-menu', card);
      if (menu && !menu.querySelector('[data-rc-edit-assets]')) {
        menu.insertAdjacentHTML('beforeend', '<button type="button" data-rc-edit-assets>附件 / Logo</button>');
      }
    }
    paginate();
  }

  function scheduleDecoration() {
    if (decorationPending) return;
    decorationPending = true;
    (window.requestAnimationFrame || setTimeout)(() => decorateEvents().catch(() => {}));
  }

  function openModal(title, body, footer = '') {
    const dialog = $('#manageDialog');
    const form = $('#manageForm');
    form.innerHTML = `<div class="modal"><header><h2>${title}</h2><button type="button" class="close" data-assets-close>×</button></header><div class="manage-body">${body}</div>${footer ? `<footer>${footer}</footer>` : ''}</div>`;
    if (dialog.open) dialog.close();
    dialog.showModal();
  }

  async function showAssets(eventId, edit = false) {
    const ledger = await loadLedger(true);
    const event = (ledger.events || []).find(item => item.id === eventId);
    if (!event) return;

    if (!edit) {
      openModal('查看附件', `<div class="v25-list">${(event.attachments || []).map(attachment => `<div><b>${attachment.name}</b><a href="${attachment.data}" target="_blank" rel="noopener" download="${attachment.name}">打开 / 保存</a></div>`).join('') || '<p>暂无附件</p>'}</div>`);
      return;
    }

    openModal('附件与 Logo', `<p>附件支持图片或 PDF，单个不超过 160KB，每条最多 5 个。</p><label class="field full"><span>Logo 地址</span><input id="assetIcon" value="${event.icon || ''}"></label><label class="field full"><span>新增附件</span><input id="assetFile" type="file" accept="image/*,.pdf"></label><div class="v25-list">${(event.attachments || []).map(attachment => `<div><b>${attachment.name}</b><button type="button" data-remove-attachment="${attachment.id}" data-event-id="${eventId}">删除</button></div>`).join('') || '<p>暂无附件</p>'}</div>`, `<button type="button" class="ghost" data-assets-close>取消</button><button type="button" class="primary" data-save-assets="${eventId}">保存</button>`);
  }

  async function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function saveAssets(eventId) {
    const file = $('#assetFile')?.files?.[0];
    const body = { eventId, icon: $('#assetIcon')?.value || '' };
    if (file) {
      if (file.size > 160000) throw Error('附件不能超过 160KB');
      body.file = { name: file.name, type: file.type, data: await readFile(file) };
    }
    await request('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    location.reload();
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) {
      scheduleDecoration();
      return;
    }

    try {
      if (button.classList.contains('rc-more')) {
        const timeline = $('.timeline');
        timeline.dataset.limit = String(Number(timeline.dataset.limit || 100) + 100);
        paginate();
        return;
      }
      if (button.hasAttribute('data-assets-close')) return $('#manageDialog').close();
      if (button.dataset.rcAssets) return showAssets(button.dataset.rcAssets, false);
      if (button.hasAttribute('data-rc-edit-assets')) return showAssets(button.closest('.event')?.dataset.id, true);
      if (button.dataset.saveAssets) return saveAssets(button.dataset.saveAssets);
      if (button.dataset.removeAttachment) {
        await request(`/api/files?eventId=${encodeURIComponent(button.dataset.eventId)}&attachmentId=${encodeURIComponent(button.dataset.removeAttachment)}`, { method: 'DELETE' });
        cachedLedger = null;
        return showAssets(button.dataset.eventId, true);
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setTimeout(scheduleDecoration, 0);
    }
  }, true);

  const app = $('#app');
  if (app && 'MutationObserver' in window) {
    let timer = 0;
    new MutationObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(scheduleDecoration, 30);
    }).observe(app, { childList: true, subtree: true });
  }

  const style = document.createElement('style');
  style.textContent = '.rc-logo{width:24px;height:24px;border-radius:7px;object-fit:cover;flex:0 0 auto}.rc-att{margin-top:4px;border:0;background:transparent;color:#806874;padding:0;font-size:10px;text-decoration:underline}.rc-more{display:block;margin:14px auto;padding:10px 22px}';
  document.head.appendChild(style);
  scheduleDecoration();
})();
