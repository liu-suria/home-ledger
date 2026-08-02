(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHtml = value => {
    const element = document.createElement('i');
    element.textContent = value == null ? '' : String(value);
    return element.innerHTML;
  };

  let templates = [];
  let types = [];

  function installStyles() {
    if ($('#templates-ui-style')) return;
    const style = document.createElement('style');
    style.id = 'templates-ui-style';
    style.textContent = '.tpl-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.tpl-head p{margin:0;color:#8d7881;font-size:12px}.tpl-item{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:14px;margin:10px 0;border:1px solid #eadfe3;border-radius:12px;background:#fff}.tpl-item .full,.tpl-item .tpl-remove{grid-column:1/-1}.tpl-item .tpl-remove{justify-self:end}.brand[data-refresh="1"]:hover{opacity:.8}@media(max-width:720px){.tpl-item{grid-template-columns:1fr}.tpl-item .full,.tpl-item .tpl-remove{grid-column:1}.tpl-head{align-items:flex-start;flex-direction:column}}[data-theme="dark"] .tpl-item{background:#242023;border-color:#3b3337}';
    document.head.appendChild(style);
  }

  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}
    if (!response.ok) throw Error(data.error || `请求失败 ${response.status}`);
    return data;
  }

  function openModal(title, body, footer = '') {
    const dialog = $('#manageDialog');
    const form = $('#manageForm');
    form.innerHTML = `<div class="modal"><header><h2>${escapeHtml(title)}</h2><button type="button" class="close" data-tpl-close>×</button></header><div class="manage-body">${body}</div>${footer ? `<footer>${footer}</footer>` : ''}</div>`;
    if (dialog.open) dialog.close();
    dialog.showModal();
  }

  function typeOptions(selected) {
    return types.map(type => `<option value="${escapeHtml(type.id)}"${type.id === selected ? ' selected' : ''}>${escapeHtml(type.name)}</option>`).join('');
  }

  function templateItemRow(item = {}) {
    return `<div class="tpl-item"><label class="field"><span>事项标题</span><input data-ti="title" value="${escapeHtml(item.title || '')}" maxlength="100"></label><label class="field"><span>类型</span><select data-ti="type">${typeOptions(item.type || types[0]?.id)}</select></label><label class="field"><span>距起始日</span><input data-ti="offsetDays" type="number" min="0" max="36500" value="${Number(item.offsetDays) || 0}"></label><label class="field"><span>金额</span><input data-ti="amount" type="number" min="0" step="0.01" value="${item.amount == null ? '' : Number(item.amount).toFixed(2)}"></label><label class="field"><span>币种</span><input data-ti="currency" value="${escapeHtml(item.currency || 'CNY')}" maxlength="8"></label><label class="field"><span>支付方式</span><input data-ti="payment" value="${escapeHtml(item.payment || '')}" maxlength="50"></label><label class="field full"><span>备注</span><input data-ti="note" value="${escapeHtml(item.note || '')}" maxlength="1000"></label><button type="button" class="danger tpl-remove">删除这一项</button></div>`;
  }

  async function loadData() {
    const [templateData, ledger] = await Promise.all([request('/api/templates'), request('/api/ledger')]);
    templates = templateData.templates || [];
    types = ledger.settings?.types || [];
  }

  async function showTemplateList() {
    await loadData();
    openModal('事项模板', `<div class="tpl-head"><p>模板用于按一个起始日期批量创建多条事项。</p><button type="button" class="primary" data-tpl-new>＋ 新建模板</button></div><div class="v25-list">${templates.map(template => `<div><b>${escapeHtml(template.name)}${template.builtIn ? ' <small>内置</small>' : ''}</b><small>${(template.items || []).length} 个事项</small><button type="button" data-tpl-use="${escapeHtml(template.id)}">使用</button>${template.builtIn ? '' : `<button type="button" data-tpl-edit="${escapeHtml(template.id)}">编辑</button><button type="button" class="danger" data-tpl-delete="${escapeHtml(template.id)}">删除</button>`}</div>`).join('') || '<p>暂无模板</p>'}</div>`);
  }

  function showTemplateEditor(id = '') {
    const template = templates.find(item => item.id === id) || { name: '', items: [{}] };
    openModal(id ? '编辑模板' : '新建模板', `<label class="field full"><span>模板名称</span><input id="tplName" value="${escapeHtml(template.name)}" maxlength="40"></label><div id="tplItems">${(template.items || [{}]).map(templateItemRow).join('')}</div><button type="button" class="ghost" data-tpl-add>＋ 添加事项</button>`, `<button type="button" class="ghost" data-tpl-close>取消</button><button type="button" class="primary" data-tpl-save="${escapeHtml(id)}">保存模板</button>`);
  }

  function collectItems() {
    return Array.from(document.querySelectorAll('.tpl-item')).map(row => {
      const read = name => row.querySelector(`[data-ti="${name}"]`)?.value ?? '';
      return {
        title: read('title').trim(),
        type: read('type'),
        offsetDays: Number(read('offsetDays')) || 0,
        amount: read('amount') === '' ? null : Number(read('amount')),
        currency: read('currency').trim().toUpperCase() || 'CNY',
        payment: read('payment').trim(),
        note: read('note').trim()
      };
    }).filter(item => item.title);
  }

  function showTemplateApply(id) {
    const template = templates.find(item => item.id === id);
    openModal(`使用“${template?.name || '模板'}”`, `<p>系统会以起始日期为基准，按照模板中每项的偏移天数创建独立事项。</p><label class="field full"><span>起始日期</span><input id="tplStart" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>`, `<button type="button" class="ghost" data-tpl-close>取消</button><button type="button" class="primary" data-tpl-apply="${escapeHtml(id)}">确认创建</button>`);
  }

  function bindRefreshTitle() {
    const brand = $('.brand');
    if (!brand || brand.dataset.refresh) return;
    brand.dataset.refresh = '1';
    brand.title = '点击刷新当前页面';
    brand.style.cursor = 'pointer';
    brand.setAttribute('role', 'button');
    brand.setAttribute('tabindex', '0');
    brand.addEventListener('click', () => location.reload());
    brand.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        location.reload();
      }
    });
  }

  document.addEventListener('click', async event => {
    const entry = event.target.closest('[data-v25="templates"]');
    if (!entry) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try { await showTemplateList(); } catch (error) { alert(error.message); }
  }, true);

  document.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    try {
      if (button.hasAttribute('data-tpl-close')) return $('#manageDialog').close();
      if (button.hasAttribute('data-tpl-new')) return showTemplateEditor();
      if (button.dataset.tplEdit) return showTemplateEditor(button.dataset.tplEdit);
      if (button.dataset.tplUse) return showTemplateApply(button.dataset.tplUse);
      if (button.hasAttribute('data-tpl-add')) return $('#tplItems').insertAdjacentHTML('beforeend', templateItemRow({}));
      if (button.classList.contains('tpl-remove')) {
        if (document.querySelectorAll('.tpl-item').length <= 1) return alert('模板至少保留一个事项');
        button.closest('.tpl-item').remove();
        return;
      }
      if (button.dataset.tplSave !== undefined) {
        const name = $('#tplName').value.trim();
        const items = collectItems();
        if (!name) return alert('请输入模板名称');
        if (!items.length) return alert('模板至少需要一个有效事项');
        await request('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', id: button.dataset.tplSave || undefined, name, items }) });
        return showTemplateList();
      }
      if (button.dataset.tplApply) {
        await request('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'apply', id: button.dataset.tplApply, startDate: $('#tplStart').value }) });
        location.reload();
        return;
      }
      if (button.dataset.tplDelete) {
        if (!confirm('确定删除这个个人模板？')) return;
        await request(`/api/templates?id=${encodeURIComponent(button.dataset.tplDelete)}`, { method: 'DELETE' });
        return showTemplateList();
      }
    } catch (error) {
      alert(error.message);
    }
  });

  document.addEventListener('input', event => {
    if (event.target.matches('[data-ti="currency"]')) {
      event.target.value = event.target.value.toUpperCase().replace(/[^A-Z]/g, '');
    }
  });

  installStyles();
  bindRefreshTitle();
  document.addEventListener('DOMContentLoaded', bindRefreshTitle, { once: true });
})();
