(() => {
  'use strict';

  const today = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: window.APP_CONFIG?.timeZone || 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  const dayDifference = (date, current) => Math.round(
    (new Date(`${date}T12:00:00+08:00`) - new Date(`${current}T12:00:00+08:00`)) / 86400000
  );

  function applyStatusVisuals() {
    const ledger = window.FamilyHub?.getLedger?.();
    if (!ledger) return;

    const current = today();
    const eventMap = new Map((ledger.events || []).map(event => [event.id, event]));

    document.querySelectorAll('.event').forEach(card => {
      card.classList.remove('status-overdue', 'status-today', 'status-soon');
      const event = eventMap.get(card.dataset.id);
      if (!event || event.status === 'done') return;
      const difference = dayDifference(event.date, current);
      if (difference < 0) card.classList.add('status-overdue');
      else if (difference === 0) card.classList.add('status-today');
      else if (difference <= 3) card.classList.add('status-soon');
    });

    document.querySelectorAll('.group').forEach(group => {
      group.classList.remove('group-overdue', 'group-today', 'group-soon');
      const title = group.querySelector('.group-title b')?.textContent?.trim();
      if (title === '已逾期') group.classList.add('group-overdue');
      else if (title === '今天') group.classList.add('group-today');
      else if (title === '明天' || title === '未来 7 天') group.classList.add('group-soon');
    });
  }

  document.addEventListener('familyhub:render', applyStatusVisuals);
  document.addEventListener('DOMContentLoaded', applyStatusVisuals, { once: true });
})();
