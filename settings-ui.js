(() => {
  'use strict';

  const CONFIG = window.APP_CONFIG;
  const app = () => window.FamilyHub;
  const ui = () => window.FamilyHubUI;
  const esc = value => ui().escapeHtml(value);

  const row = (attrs, title, description) => `<button type="button" ${attrs} class="rc-setting-row"><span class="rc-setting-copy"><b>${esc(title)}</b><small>${esc(description)}</small></span><i>›</i></button>`;
  const info = (title, description) => `<div class="rc-setting-row rc-setting-info"><span class="rc-setting-copy"><b>${esc(title)}</b><small>${esc(description)}</small></span></div>`;
  const group = (title, description, items) => `<section><div class="rc-group-head"><h3>${esc(title)}</h3><p>${esc(description)}</p></div><div class="rc-list">${items}</div></section>`;

  function modal(title, body, footer = '') {
    ui().openModal({ title, body, footer, closeAttribute: 'data-settings-close', className: 'rc-modal' });
  }

  function showSettings() {
    modal('设置', `<div class="rc-groups">
      ${group('数据', '管理数据导入、导出与日历同步',
        row('data-setting="export"', '导出 JSON', '导出当前全部事项和设置，便于长期备份') +
        row('data-setting="import"', '导入 JSON', '导入之前导出的完整数据文件') +
        row('data-setting="calendar"', '导出日历', '导出 ICS 文件，可导入系统日历'))}
      ${group('内容', '管理家庭事项的分类和复用配置',
        row('data-setting="types"', '类型管理', '新增、修改和调整首页事项类型') +
        row('data-setting="templates"', '事项模板', '维护常用事项模板并快速批量创建') +
        row('data-setting="recurring"', '循环事项管理', '编辑循环基础规则并重新生成未来待办'))}
      ${group('连接', '查看系统提供的外部连接能力', row('data-setting="api"', 'API 接口文档', '查看接口字段、鉴权方式和调用示例'))}
      ${group('外观', '调整页面显示方式和主题', row('data-setting="theme"', '主题', '切换浅色、深色或跟随系统'))}
      ${group('关于', '查看当前系统与数据版本信息',
        info('当前版本', CONFIG.version) + info('数据模型', `Version ${CONFIG.dataVersion}`) + info('数据安全', '每次保存前自动创建静默快照'))}
    </div>`);
  }

  async function showStats() {
    const hub = app();
    const [stats, rates] = await Promise.all([
      hub.request('/api/stats'),
      hub.request('/api/exchange-rates').catch(() => ({ rates: { CNY: 1 } }))
    ]);
    const ledger = hub.getLedger();
    const current = new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const future = days => {
      const date = new Date(`${current}T12:00:00+08:00`);
      date.setDate(date.getDate() + days);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    const pending = ledger.events.filter(item => !item.archived && item.status !== 'done');
    const subscriptions = pending.filter(item => item.type === 'subscription' && item.amount != null);
    const sum = end => subscriptions.filter(item => item.date >= current && item.date <= end).reduce((total, item) => {
      const currency = item.currency || 'CNY';
      const rate = currency === 'CNY' ? 1 : Number(rates.rates?.[currency] || 0);
      return total + Number(item.amount || 0) * rate;
    }, 0);
    const total = Number(stats.total || 0);
    const done = Number(stats.done || 0);
    const items = [
      ['今天', stats.today], ['未来 7 天', stats.next7], ['未来 30 天', stats.next30], ['逾期', stats.overdue],
      ['全部事项', total], ['已完成', done], ['未完成', pending.length], ['完成率', total ? `${Math.round(done / total * 100)}%` : '0%'],
      ['30 天订阅', `¥${sum(future(30)).toFixed(2)}`], ['季度订阅', `¥${sum(future(90)).toFixed(2)}`],
      ['年度订阅', `¥${sum(future(365)).toFixed(2)}`], ['循环规则', ledger.series.length]
    ];
    modal('统计', `<div class="rc-stats">${items.map(([label, value]) => `<div><b>${esc(value ?? 0)}</b><span>${esc(label)}</span></div>`).join('')}</div>`);
  }

  function showTypes() {
    const ledger = app().getLedger();
    modal('类型管理', `<div id="settingsTypes">${ledger.settings.types.map(item => `<div class="rc-type" data-id="${esc(item.id)}"><input maxlength="20" value="${esc(item.name)}"><button type="button" data-type-remove>删除</button></div>`).join('')}</div><button type="button" class="ghost" data-type-add>＋ 新增类型</button>`,
      '<button type="button" class="ghost" data-settings-close>取消</button><button type="button" class="primary" data-type-save>保存</button>');
  }

  async function saveTypes() {
    const hub = app();
    const ledger = structuredClone(hub.getLedger());
    const types = [];
    ui().$$('#settingsTypes .rc-type').forEach((element, index) => {
      const name = ui().$('input', element).value.trim();
      if (name) types.push({ id: element.dataset.id || `type-${Date.now().toString(36)}-${index}`, name: name.slice(0, 20) });
    });
    if (!types.length) throw new Error('至少保留一个类型');
    const ids = new Set(types.map(item => item.id));
    const fallback = types[0].id;
    ledger.events.forEach(item => { if (!ids.has(item.type)) item.type = fallback; });
    ledger.series.forEach(item => { if (!ids.has(item.type)) item.type = fallback; });
    ledger.settings.types = types;
    ledger.settings.typeOrder = types.map(item => item.id);
    hub.setLedger(ledger);
    await hub.persist();
    ui().closeModal();
  }

  async function handleSetting(action) {
    const hub = app();
    if (action === 'export') {
      const date = new Date().toISOString().slice(0, 10);
      return ui().download(`family-hub-${date}.json`, JSON.stringify(hub.getLedger(), null, 2));
    }
    if (action === 'import') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const value = JSON.parse(await file.text());
        hub.setLedger(value);
        await hub.persist({ maintain: true });
        ui().closeModal();
      };
      return input.click();
    }
    if (action === 'calendar') return location.assign('/api/calendar?days=365');
    if (action === 'types') return showTypes();
    if (action === 'templates') return document.dispatchEvent(new CustomEvent('familyhub:open-templates'));
    if (action === 'recurring') return document.dispatchEvent(new CustomEvent('familyhub:open-recurring'));
    if (action === 'api') return location.assign('/api.html');
    if (action === 'theme') {
      const current = localStorage.getItem('family-hub-theme') || 'system';
      const next = current === 'system' ? 'dark' : current === 'dark' ? 'light' : 'system';
      localStorage.setItem('family-hub-theme', next);
      if (next === 'system') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.dataset.theme = next;
      location.reload();
    }
  }

  document.addEventListener('familyhub:open-settings', showSettings);
  document.addEventListener('familyhub:open-stats', () => showStats().catch(ui().report));
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-settings-close')) return ui().closeModal();
    if (button.dataset.setting) handleSetting(button.dataset.setting).catch(ui().report);
    if (button.hasAttribute('data-type-add')) ui().$('#settingsTypes').insertAdjacentHTML('beforeend', '<div class="rc-type"><input maxlength="20" value="新类型"><button type="button" data-type-remove>删除</button></div>');
    if (button.hasAttribute('data-type-remove')) button.closest('.rc-type').remove();
    if (button.hasAttribute('data-type-save')) saveTypes().catch(ui().report);
  });
})();
