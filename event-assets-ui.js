(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHtml = value => window.FamilyHub?.escapeHtml
    ? window.FamilyHub.escapeHtml(value)
    : String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[character]);

  let decorationPending = false;
  let visibleLimit = 100;

  function request(url, options = {}) {
    if (window.FamilyHub?.request) return window.FamilyHub.request(url, options);
    return fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `请求失败 ${response.status}`);
      return data;
    });
  }

  function currentLedger() {
    return window.FamilyHub?.getLedger?.() || { events: [] };
  }

  function safeIconUrl(value) {
    const url = String(value || '').trim();
    return /^(https:\/\/|data:image\/)/i.test(url) ? url : '';
  }

  function paginate() {
    const timeline = $('.timeline');
    if (!timeline) return;
    const cards = $$('.event', timeline);
    cards.forEach((card, index) => { card.hidden = index >= visibleLimit; });

    let more = $('.asset-load-more', timeline);
    if (cards.length > visibleLimit) {
      if (!more) {
        more = document.createElement('button');
        more.type = 'button';
        more.className = 'ghost asset-load-more';
        more.textContent = '加载更多';
        timeline.appendChild(more);
      }
      more.hidden = false;
    } else if (more) {
      more.hidden = true;
    }
  }

  function decorateEvents() {
    decorationPending = false;
    const eventById = new Map((currentLedger().events || []).map(event => [event.id, event]));

    for (const card of $$('.event')) {
      const item = eventById.get(card.dataset.id);
      if (!item) continue;
      const titleLine = $('.event-line', card);
      const iconUrl = safeIconUrl(item.icon);

      if (iconUrl && titleLine && !$('.event-logo', card)) {
        const image = document.createElement('img');
        image.className = 'event-logo';
        image.src = iconUrl;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        titleLine.prepend(image);
      }

      const attachmentCount = Array.isArray(item.attachments) ? item.attachments.length : 0;
      if (attachmentCount && !$('.event-attachments', card)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'event-attachments';
        button.textContent = `附件 ${attachmentCount}`;
        button.dataset.assetsView = item.id;
        $('.event-main', card)?.appendChild(button);
      }

      const menu = $('.row-menu', card);
      if (menu && !menu.querySelector('[data-assets-edit]')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.assetsEdit = '1';
        button.textContent = '附件 / Logo';
        menu.appendChild(button);
      }
    }

    paginate();
  }

  function scheduleDecoration(delay = 0) {
    if (decorationPending && delay === 0) return;
    decorationPending = true;
    window.setTimeout(() => {
      (window.requestAnimationFrame || window.setTimeout)(decorateEvents);
    }, delay);
  }

  function scheduleRenderCheckpoints() {
    scheduleDecoration(0);
    scheduleDecoration(160);
    scheduleDecoration(700);
  }

  function openModal(title, body, footer = '') {
    const dialog = $('#manageDialog');
    const form = $('#manageForm');
    form.innerHTML = `<div class="modal"><header><h2>${escapeHtml(title)}</h2><button type="button" class="close" data-assets-close>×</button></header><div class="manage-body">${body}</div>${footer ? `<footer>${footer}</footer>` : ''}</div>`;
    if (dialog.open) dialog.close();
    dialog.showModal();
  }

  function findEvent(eventId) {
    return (currentLedger().events || []).find(item => item.id === eventId);
  }

  function attachmentRows(item, editable) {
    const attachments = Array.isArray(item.attachments) ? item.attachments : [];
    if (!attachments.length) return '<p>暂无附件</p>';
    return attachments.map(attachment => {
      const name = escapeHtml(attachment.name || '附件');
      const id = escapeHtml(attachment.id || '');
      const eventId = escapeHtml(item.id);
      if (editable) {
        return `<div><b>${name}</b><button type="button" data-remove-attachment="${id}" data-event-id="${eventId}">删除</button></div>`;
      }
      return `<div><b>${name}</b><a href="${escapeHtml(attachment.data || '')}" target="_blank" rel="noopener" download="${name}">打开 / 保存</a></div>`;
    }).join('');
  }

  function showAssets(eventId, edit = false) {
    const item = findEvent(eventId);
    if (!item) throw new Error('事项不存在或页面数据已更新');

    if (!edit) {
      openModal('查看附件', `<div class="v25-list">${attachmentRows(item, false)}</div>`);
      return;
    }

    openModal(
      '附件与 Logo',
      `<p>附件支持图片或 PDF，单个不超过 160KB，每条最多 5 个。</p>
       <label class="field full"><span>Logo 地址</span><input id="assetIcon" value="${escapeHtml(item.icon || '')}" placeholder="仅支持 https:// 或 data:image/"></label>
       <label class="field full"><span>新增附件</span><input id="assetFile" type="file" accept="image/*,.pdf"></label>
       <div class="v25-list">${attachmentRows(item, true)}</div>`,
      `<button type="button" class="ghost" data-assets-close>取消</button><button type="button" class="primary" data-save-assets="${escapeHtml(eventId)}">保存</button>`
    );
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('附件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  async function saveAssets(eventId) {
    const file = $('#assetFile')?.files?.[0];
    const icon = String($('#assetIcon')?.value || '').trim();
    if (icon && !safeIconUrl(icon)) throw new Error('Logo 地址仅支持 https:// 或 data:image/');

    const body = { eventId, icon };
    if (file) {
      if (file.size > 160000) throw new Error('附件不能超过 160KB');
      body.file = { name: file.name.slice(0, 80), type: file.type, data: await readFile(file) };
    }

    const result = await request('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (result?.data && window.FamilyHub?.setLedger) {
      window.FamilyHub.setLedger(result.data);
      $('#manageDialog').close();
      scheduleRenderCheckpoints();
    } else {
      location.reload();
    }
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;

    try {
      if (button.classList.contains('asset-load-more')) {
        visibleLimit += 100;
        paginate();
        return;
      }
      if (button.hasAttribute('data-assets-close')) return $('#manageDialog').close();
      if (button.dataset.assetsView) return showAssets(button.dataset.assetsView, false);
      if (button.hasAttribute('data-assets-edit')) return showAssets(button.closest('.event')?.dataset.id, true);
      if (button.dataset.saveAssets) return saveAssets(button.dataset.saveAssets);
      if (button.dataset.removeAttachment) {
        const result = await request(`/api/files?eventId=${encodeURIComponent(button.dataset.eventId)}&attachmentId=${encodeURIComponent(button.dataset.removeAttachment)}`, { method: 'DELETE' });
        if (result?.data && window.FamilyHub?.setLedger) window.FamilyHub.setLedger(result.data);
        showAssets(button.dataset.eventId, true);
        scheduleRenderCheckpoints();
        return;
      }
    } catch (error) {
      alert(error.message);
    }
  }, true);

  document.addEventListener('click', event => {
    if (event.target.closest('[data-filter],[data-action="done"],[data-action="delay"],[data-action="delete"]')) {
      scheduleRenderCheckpoints();
    }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'search') scheduleDecoration(220);
  });
  document.addEventListener('familyhub:render', scheduleRenderCheckpoints);

  let startupAttempts = 0;
  (function waitForApp() {
    if (window.FamilyHub && $('.timeline')) return scheduleRenderCheckpoints();
    if (startupAttempts++ < 40) window.setTimeout(waitForApp, 50);
  })();
})();
