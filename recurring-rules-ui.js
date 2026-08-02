(() => {
  'use strict';

  const app = () => window.FamilyHub;
  const ui = () => window.FamilyHubUI;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = value => ui().escapeHtml(value);
  const REPEAT_NAMES = { daily: '每天', weekly: '每周', monthly: '每月', quarterly: '每季度', yearly: '每年', interval: '每隔 X 天' };

  function modal(title, body, footer = '') {
    ui().openModal({ title, body, footer, closeAttribute: 'data-recurring-close' });
  }

  function typeOptions(types, selected) {
    return types.map(item => `<option value="${esc(item.id)}"${item.id === selected ? ' selected' : ''}>${esc(item.name)}</option>`).join('');
  }

  function repeatOptions(selected) {
    return Object.entries(REPEAT_NAMES).map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`).join('');
  }

  function showList() {
    const ledger = app().getLedger();
    const typeMap = new Map(ledger.settings.types.map(item => [item.id, item.name]));
    const rules = ledger.series.map(rule => `<button type="button" class="rc-setting-row" data-recurring-edit="${esc(rule.id)}"><span class="rc-setting-copy"><b>${esc(rule.title)}</b><small>${esc(typeMap.get(rule.type) || rule.type)} · ${esc(REPEAT_NAMES[rule.repeat] || rule.repeat)} · ${esc(rule.startDate)}${rule.endDate ? ` 至 ${esc(rule.endDate)}` : ' · 长期有效'}</small></span><i>›</i></button>`).join('');
    modal('循环事项管理', `<p class="helper-text">这里编辑基础规则。总览中的编辑只影响单次事项。</p><div class="rc-list">${rules || '<div class="rc-setting-row rc-setting-info"><span class="rc-setting-copy"><b>暂无循环事项</b><small>新增事项时选择循环周期后，会在这里显示基础规则。</small></span></div>'}</div>`);
  }

  function toggleFields() {
    const calendar = $('#ruleCalendar')?.value || 'solar';
    const repeat = $('#ruleRepeat')?.value || 'yearly';
    $$('.rule-lunar').forEach(node => { node.hidden = calendar !== 'lunar'; });
    $$('.rule-interval').forEach(node => { node.hidden = repeat !== 'interval'; });
    if (calendar === 'lunar') $('#ruleRepeat').value = 'yearly';
  }

  function showEditor(id) {
    const ledger = app().getLedger();
    const rule = ledger.series.find(item => item.id === id);
    if (!rule) throw new Error('循环规则不存在');
    modal('编辑循环基础规则', `<div class="grid">
      <label class="field full"><span>事项标题</span><input id="ruleTitle" maxlength="100" value="${esc(rule.title)}" required></label>
      <label class="field"><span>类型</span><select id="ruleType">${typeOptions(ledger.settings.types, rule.type)}</select></label>
      <label class="field"><span>日期类型</span><select id="ruleCalendar"><option value="solar"${rule.calendar !== 'lunar' ? ' selected' : ''}>公历</option><option value="lunar"${rule.calendar === 'lunar' ? ' selected' : ''}>农历</option></select></label>
      <label class="field"><span>开始生效日期</span><input id="ruleStart" type="date" value="${esc(rule.startDate)}" required></label>
      <label class="field rule-lunar"><span>农历月份</span><input id="ruleLunarMonth" type="number" min="1" max="12" value="${Number(rule.lunarMonth) || 1}"></label>
      <label class="field rule-lunar"><span>农历日期</span><input id="ruleLunarDay" type="number" min="1" max="30" value="${Number(rule.lunarDay) || 1}"></label>
      <label class="field"><span>循环周期</span><select id="ruleRepeat">${repeatOptions(rule.repeat)}</select></label>
      <label class="field"><span>结束日期（可选）</span><input id="ruleEnd" type="date" value="${esc(rule.endDate || '')}"></label>
      <label class="field rule-interval"><span>每隔多少天</span><input id="ruleInterval" type="number" min="1" max="3650" value="${Number(rule.intervalDays) || 1}"></label>
      <label class="field"><span>金额（可选）</span><input id="ruleAmount" type="number" min="0" step="0.01" value="${rule.amount == null ? '' : Number(rule.amount).toFixed(2)}"></label>
      <label class="field"><span>币种</span><input id="ruleCurrency" maxlength="8" value="${esc(rule.currency || 'CNY')}"></label>
      <label class="field"><span>支付方式</span><input id="rulePayment" maxlength="50" value="${esc(rule.payment || '')}"></label>
      <label class="field full"><span>备注</span><textarea id="ruleNote" maxlength="1000">${esc(rule.note || '')}</textarea></label>
      <p class="full helper-text">结束日期留空表示长期有效。保存后保留已完成历史，只重建未来两条待办。</p>
    </div>`, `<button type="button" class="ghost" data-recurring-back>返回</button><button type="button" class="danger" data-recurring-delete="${esc(id)}">删除规则</button><button type="button" class="primary" data-recurring-save="${esc(id)}">保存规则</button>`);
    toggleFields();
  }

  async function saveRule(id) {
    const startDate = $('#ruleStart').value;
    const endDate = $('#ruleEnd').value;
    const title = $('#ruleTitle').value.trim();
    const calendar = $('#ruleCalendar').value;
    if (!title) throw new Error('标题不能为空');
    if (!startDate) throw new Error('请填写开始生效日期');
    if (endDate && endDate < startDate) throw new Error('结束日期不能早于开始日期');
    const patch = {
      title, type: $('#ruleType').value, calendar, startDate, endDate: endDate || '', endMode: endDate ? 'fixed' : 'open',
      repeat: calendar === 'lunar' ? 'yearly' : $('#ruleRepeat').value,
      intervalDays: Math.max(1, Number($('#ruleInterval').value) || 1),
      lunarMonth: calendar === 'lunar' ? Number($('#ruleLunarMonth').value) || 1 : null,
      lunarDay: calendar === 'lunar' ? Number($('#ruleLunarDay').value) || 1 : null,
      amount: $('#ruleAmount').value === '' ? null : Math.round(Number($('#ruleAmount').value) * 100) / 100,
      currency: $('#ruleCurrency').value.trim().toUpperCase() || 'CNY', payment: $('#rulePayment').value.trim(), note: $('#ruleNote').value.trim()
    };
    if (!confirm('保存后会保留已完成历史，并按新规则重建未来两条待办。确定继续？')) return;
    const data = await app().request('/api/series', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'update', rebuildAll: true, patch }) });
    app().setLedger(data);
    ui().closeModal();
  }

  async function deleteRule(id) {
    if (!confirm('确定删除这条循环规则及其未完成事项？已完成历史会保留。')) return;
    const data = await app().request('/api/series', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'delete', scope: 'all' }) });
    app().setLedger(data);
    ui().closeModal();
  }

  document.addEventListener('familyhub:open-recurring', showList);
  document.addEventListener('change', event => { if (['ruleCalendar', 'ruleRepeat'].includes(event.target.id)) toggleFields(); });
  document.addEventListener('input', event => { if (event.target.id === 'ruleCurrency') event.target.value = event.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-recurring-close')) return ui().closeModal();
    if (button.hasAttribute('data-recurring-back')) return showList();
    if (button.dataset.recurringEdit) return showEditor(button.dataset.recurringEdit);
    if (button.dataset.recurringSave) return saveRule(button.dataset.recurringSave).catch(ui().report);
    if (button.dataset.recurringDelete) return deleteRule(button.dataset.recurringDelete).catch(ui().report);
  });
})();
