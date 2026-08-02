import test from 'node:test';
import assert from 'node:assert/strict';
import { maintainSeries, shanghaiToday } from '../edge-functions/_series-maintenance.js';

const type = 'reminder';
const base = rule => ({
  version: 8,
  revision: 0,
  settings: {},
  series: [{
    id: 'series-test',
    title: '测试事项',
    type,
    startDate: '2026-01-31',
    endDate: '',
    endMode: 'open',
    repeat: 'monthly',
    intervalDays: 1,
    calendar: 'solar',
    active: true,
    amount: null,
    currency: 'CNY',
    payment: '',
    note: '',
    ...rule
  }],
  events: [],
  templates: []
});

function futurePending(data) {
  const today = shanghaiToday();
  return data.events.filter(item => item.seriesId === 'series-test' && item.status !== 'done' && item.date >= today);
}

test('monthly rule keeps two future pending occurrences', () => {
  const data = base({ startDate: shanghaiToday() });
  const result = maintainSeries(data, { force: true });
  assert.equal(futurePending(result.data).length, 2);
});

test('far-future override does not become the generation cursor', () => {
  const data = base({ startDate: shanghaiToday() });
  data.events.push({
    id: 'override', title: '测试事项', type, date: '2030-01-01', occurrenceDate: '2030-01-01',
    seriesId: 'series-test', calendar: 'solar', status: 'pending', amount: null, currency: 'CNY',
    payment: '', note: '', icon: '', attachments: [], archived: false, overridden: true
  });
  const result = maintainSeries(data, { force: true });
  const regular = futurePending(result.data).filter(item => item.overridden !== true);
  assert.equal(regular.length, 2);
  assert.ok(regular.every(item => item.date < '2030-01-01'));
});

test('overdue pending occurrence is preserved and does not consume the future window', () => {
  const data = base({ startDate: '2025-01-01' });
  data.events.push({
    id: 'overdue', title: '测试事项', type, date: '2025-01-01', occurrenceDate: '2025-01-01',
    seriesId: 'series-test', calendar: 'solar', status: 'pending', amount: null, currency: 'CNY',
    payment: '', note: '', icon: '', attachments: [], archived: false, overridden: false
  });
  const result = maintainSeries(data, { force: true });
  assert.ok(result.data.events.some(item => item.id === 'overdue'));
  assert.equal(futurePending(result.data).length, 2);
});

test('fixed end date prevents generation beyond the rule boundary', () => {
  const today = shanghaiToday();
  const data = base({ startDate: today, endDate: today, endMode: 'fixed', repeat: 'daily' });
  const result = maintainSeries(data, { force: true });
  assert.equal(futurePending(result.data).length, 1);
  assert.equal(futurePending(result.data)[0].date, today);
});
