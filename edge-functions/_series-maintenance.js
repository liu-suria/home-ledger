const pad = value => String(value).padStart(2, "0");
const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parse = value => new Date(`${value}T12:00:00+08:00`);
const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const shanghaiToday = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

function addSolar(date, repeat, intervalDays, anchorDay) {
  const next = new Date(date);
  if (repeat === "daily") next.setDate(next.getDate() + 1);
  else if (repeat === "weekly") next.setDate(next.getDate() + 7);
  else if (repeat === "interval") next.setDate(next.getDate() + Math.max(1, intervalDays || 1));
  else {
    const months = repeat === "quarterly" ? 3 : repeat === "yearly" ? 12 : 1;
    next.setDate(1);
    next.setMonth(next.getMonth() + months);
    next.setDate(Math.min(anchorDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
  }
  return next;
}

function plusYear(value) {
  const date = parse(value);
  const day = date.getDate();
  date.setDate(1);
  date.setFullYear(date.getFullYear() + 1);
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  return iso(date);
}

function matchesRule(event, series) {
  return event.title === series.title
    && event.type === series.type
    && event.calendar === (series.calendar || "solar")
    && Number(event.amount ?? 0) === Number(series.amount ?? 0)
    && String(event.currency || "CNY") === String(series.currency || "CNY")
    && String(event.payment || "") === String(series.payment || "")
    && String(event.note || "") === String(series.note || "");
}

function makeEvent(series, date) {
  const now = new Date().toISOString();
  return {
    id: uid("evt"),
    title: series.title,
    type: series.type,
    date,
    occurrenceDate: date,
    seriesId: series.id,
    calendar: series.calendar || "solar",
    lunarMonth: series.lunarMonth || null,
    lunarDay: series.lunarDay || null,
    status: "pending",
    amount: series.amount ?? null,
    currency: series.currency || "CNY",
    payment: series.payment || "",
    note: series.note || "",
    icon: series.icon || "",
    attachments: [],
    archived: false,
    overridden: false,
    createdAt: now,
    updatedAt: now
  };
}

const lunarFormatter = new Intl.DateTimeFormat("en-u-ca-chinese", {
  timeZone: "Asia/Shanghai",
  month: "numeric",
  day: "numeric"
});

function lunarParts(date) {
  const parts = lunarFormatter.formatToParts(date);
  const monthValue = String(parts.find(part => part.type === "month")?.value || "");
  const dayValue = String(parts.find(part => part.type === "day")?.value || "");
  return {
    month: parseInt(monthValue, 10),
    day: parseInt(dayValue, 10),
    leap: /bis|leap/i.test(monthValue)
  };
}

function missingLunarDates(series, today, count, seen) {
  const dates = [];
  const month = Number(series.lunarMonth);
  const day = Number(series.lunarDay);
  const end = series.endDate || "9999-12-31";
  if (!month || !day) return dates;

  const start = series.startDate > today ? series.startDate : today;
  const cursor = parse(start);
  let guard = 0;
  while (dates.length < count && iso(cursor) <= end && guard++ < 1600) {
    const parts = lunarParts(cursor);
    const date = iso(cursor);
    if (!parts.leap && parts.month === month && parts.day === day && !seen.has(date)) {
      dates.push(date);
      seen.add(date);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function missingSolarDates(series, today, count, seen) {
  const dates = [];
  const end = series.endDate || "9999-12-31";
  const anchorDay = parse(series.startDate).getDate();
  let cursor = parse(series.startDate);
  let guard = 0;

  while (iso(cursor) < today && guard++ < 5000) {
    cursor = addSolar(cursor, series.repeat, series.intervalDays, anchorDay);
  }
  while (dates.length < count && iso(cursor) <= end && guard++ < 5000) {
    const date = iso(cursor);
    if (!seen.has(date)) {
      dates.push(date);
      seen.add(date);
    }
    cursor = addSolar(cursor, series.repeat, series.intervalDays, anchorDay);
  }
  return dates;
}

function missingDates(series, today, count, seen) {
  return series.calendar === "lunar"
    ? missingLunarDates(series, today, count, seen)
    : missingSolarDates(series, today, count, seen);
}

export function maintainSeries(data, { force = false } = {}) {
  const today = shanghaiToday();
  data.settings = data.settings || {};
  if (!force
    && data.settings.lastSeriesMaintenanceDate === today
    && data.settings.lunarSeriesAlgorithmVersion === 3) {
    return { changed: false, data, generated: 0, removed: 0 };
  }

  let generated = 0;
  let removed = 0;
  let changed = false;
  const migrateLunar = data.settings.lunarSeriesAlgorithmVersion !== 3;

  for (const series of data.series || []) {
    if (!series || series.active === false) continue;
    if (series.calendar === "lunar") series.repeat = "yearly";
    if (series.endDate && series.endMode !== "fixed" && series.endDate === plusYear(series.startDate)) {
      series.endDate = "";
      series.endMode = "open";
      changed = true;
    }

    const related = (data.events || []).filter(event => event.seriesId === series.id && !event.archived);
    for (const event of related) {
      if (event.overridden !== true && !matchesRule(event, series)) event.overridden = true;
    }

    if (migrateLunar && series.calendar === "lunar") {
      data.events = (data.events || []).filter(event => {
        const remove = event.seriesId === series.id
          && !event.archived
          && event.date >= today
          && event.status !== "done"
          && event.overridden !== true;
        if (remove) { removed++; changed = true; }
        return !remove;
      });
    }

    const futureRegular = (data.events || [])
      .filter(event => event.seriesId === series.id
        && !event.archived
        && event.date >= today
        && event.status !== "done"
        && event.overridden !== true)
      .sort((a, b) => a.date.localeCompare(b.date));
    const keepIds = new Set(futureRegular.slice(0, 2).map(event => event.id));

    data.events = (data.events || []).filter(event => {
      const removable = event.seriesId === series.id
        && !event.archived
        && event.date >= today
        && event.status !== "done"
        && event.overridden !== true
        && !keepIds.has(event.id);
      if (removable) { removed++; changed = true; }
      return !removable;
    });

    const remainingRegular = (data.events || []).filter(event => event.seriesId === series.id
      && !event.archived
      && event.date >= today
      && event.status !== "done"
      && event.overridden !== true);
    const missing = Math.max(0, 2 - remainingRegular.length);

    if (missing) {
      const seen = new Set((data.events || [])
        .filter(event => event.seriesId === series.id)
        .map(event => event.occurrenceDate || event.date));
      for (const date of missingDates(series, today, missing, seen)) {
        data.events.push(makeEvent(series, date));
        generated++;
        changed = true;
      }
    }
  }

  data.settings.lastSeriesMaintenanceDate = today;
  data.settings.seriesWindowSize = 2;
  data.settings.lunarSeriesAlgorithmVersion = 3;
  data.updatedAt = new Date().toISOString();
  return { changed: changed || generated > 0 || removed > 0, data, generated, removed };
}
