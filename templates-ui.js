(() => {
  'use strict';

  const app = () => window.FamilyHub;
  const ui = () => window.FamilyHubUI;
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => ui().escapeHtml(value);
  let templates = [];
  let types = [];

  function modal(title, body, footer = '') {
    ui().openModal({ title, body, footer, closeAttribute: 'data-template-close' });
  }

  function typeOptions(selected) {
    return types.map(type => `<option value="${esc(type.id)}"${type.id === selected ? ' selected' : ''}>${esc(type.name)}</option>`).join('');
  }

  function itemRow(item = {}) {
    return `<div class="template-item"><label class="field"><span>事项标题</span><input data-template-field="title" value="${esc(item.title || '')}" maxlength="100"></label><label class="field"><span>类型</span><select data-template-field="type">${typeOptions(item.type || types[0]?.id)}</select></label><label class="field"><span>距起始日</span><input data-template-field="offsetDays" type="number" min="0" max="36500" value="${Number(item.offsetDays) || 0}"></label><label class="field"><span>金额</span><input data-template-field="amount" type="number" min="0" step="0.01" value="${item.amount == null ? '' : Number(item.amount).toFixed(2)}"></label><label class="field"><span>币种</span><input data-template-field="currency" value="${esc(item.currency || 'CNY')}" maxlength="8"></label><label class="field"><span>支付方式</span><input data-template-field="payment" value="${esc(item.payment || '')}" maxlength="50"></label><label class="field full"><span>备注</span><input data-template-field="note" value="${esc(item.note || '')}" maxlength="1000"></label><button type="button" class="danger template-remove">删除这一项</button></div>`;
  }

  async function load() {
    const [templateData, ledger] = await Promise.all([app().request('/api/templates'), app().request('/api/ledger')]);
    templates = templateData.templates || [];
    types = ledger.settings?.types || [];
  }

  async function showList() {
    await load();
    modal('事项模板', `<div class="template-head"><p>模板用于按一个起始日期批量创建多条独立事项。</p><button type="button" class="primary" data-template-new>＋ 新建模板</button></div><div class="template-list">${templates.map(template => `<div><span><b>${esc(template.name)}</b><small>${template.builtIn ? '内置模板' : '个人模板'} · ${(template.items || []).length} 个事项</small></span><span><button type="button" data-template-use="${esc(template.id)}">使用</button>${template.builtIn ? '' : `<button type="button" data-template-edit="${esc(template.id)}">编辑</button><button type="button" class="danger" data-template-delete="${esc(template.id)}">删除</button>`}</span></div>`).join('') || '<p>暂无模板</p>'}</div>`);
  }

  function showEditor(id = '') {
    const template = templates.find(item => item.id === id) || { name: '', items: [{}] };
    modal(id ? '编辑模板' : '新建模板', `<label class="field full"><span>模板名称</span><input id="templateName" value="${esc(template.name)}" maxlength="40"></label><div id="templateItems">${(template.items || [{}]).map(itemRow).join('')}</div><button type="button" class="ghost" data-template-add>＋ 添加事项</button>`, `<button type="button" class="ghost" data-template-close>取消</button><button type="button" class="primary" data-template-save="${esc(id)}">保存模板</button>`);
  }

  function collectItems() {
    return Array.from(document.querySelectorAll('.template-item')).map(row => {
      const read = name => row.querySelector(`[data-template-field="${name}"]`)?.value ?? '';
      return {
        title: read('title').trim(), type: read('type'), offsetDays: Number(read('offsetDays')) || 0,
        amount: read('amount') === '' ? null : Number(read('amount')),
        currency: read('currency').trim().toUpperCase() || 'CNY', payment: read('payment').trim(), note: read('note').trim()
      };
    }).filter(item => item.title);
  }

  function showApply(id) {
    const template = templates.find(item => item.id === id);
    modal(`使用“${template?.name || '模板'}”`, `<p>系统会以起始日期为基准，按每项偏移天数创建独立事项。</p><label class="field full"><span>起始日期</span><input id="templateStart" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>`, `<button type="button" class="ghost" data-template-close>取消</button><button type="button" class="primary" data-template-apply="${esc(id)}">确认创建</button>`);
  }

  async function saveTemplate(id) {
    const name = $('#templateName').value.trim();
    const items = collectItems();
    if (!name) throw new Error('请输入模板名称');
    if (!items.length) throw new Error('模板至少需要一个有效事项');
    await app().request('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', id: id || undefined, name, items }) });
    await showList();
  }

  async function applyTemplate(id) {
    const result = await app().request('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'apply', id, startDate: $('#templateStart').value }) });
    if (result.data) app().setLedger(result.data);
    ui().closeModal();
  }

  document.addEventListener('familyhub:open-templates', () => showList().catch(ui().report));
  document.addEventListener('input', event => {
    if (event.target.matches('[data-template-field="currency"]')) event.target.value = event.target.value.toUpperCase().replace(/[^A-Z]/g, '');
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-template-close')) return ui().closeModal();
    if (button.hasAttribute('data-template-new')) return showEditor();
    if (button.dataset.templateEdit) return showEditor(button.dataset.templateEdit);
    if (button.dataset.templateUse) return showApply(button.dataset.templateUse);
    if (button.hasAttribute('data-template-add')) return $('#templateItems').insertAdjacentHTML('beforeend', itemRow({}));
    if (button.classList.contains('template-remove')) {
      if (document.querySelectorAll('.template-item').length <= 1) return alert('模板至少保留一个事项');
      return button.closest('.template-item').remove();
    }
    if (button.dataset.templateSave !== undefined) return saveTemplate(button.dataset.templateSave).catch(ui().report);
    if (button.dataset.templateApply) return applyTemplate(button.dataset.templateApply).catch(ui().report);
    if (button.dataset.templateDelete) {
      if (!confirm('确定删除这个个人模板？')) return;
      app().request(`/api/templates?id=${encodeURIComponent(button.dataset.templateDelete)}`, { method: 'DELETE' }).then(showList).catch(ui().report);
    }
  });
})();
