const MS_DAY = 864e5;
const lunarMonths = {
  \u6B63\u6708: 1,
  \u4E8C\u6708: 2,
  \u4E09\u6708: 3,
  \u56DB\u6708: 4,
  \u4E94\u6708: 5,
  \u516D\u6708: 6,
  \u4E03\u6708: 7,
  \u516B\u6708: 8,
  \u4E5D\u6708: 9,
  \u5341\u6708: 10,
  \u51AC\u6708: 11,
  \u814A\u6708: 12
};
const dateToISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const isoToDate = (iso) => {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
const todayISO = () => dateToISO(/* @__PURE__ */ new Date());
const dayDiff = (iso, base = todayISO()) => {
  const a = isoToDate(iso), b = isoToDate(base);
  return a && b ? Math.round((a - b) / MS_DAY) : null;
};
const addDays = (d, count) => {
  const n = new Date(d);
  n.setDate(n.getDate() + count);
  return n;
};
const monthDate = (start, months) => {
  const day = start.getDate(), n = new Date(start.getFullYear(), start.getMonth() + months, 1);
  n.setDate(
    Math.min(day, new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate())
  );
  return n;
};
function lunarParts(date) {
  var _a, _b;
  const parts = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
    month: "long",
    day: "numeric"
  }).formatToParts(date);
  const month = ((_a = parts.find((p) => p.type === "month")) == null ? void 0 : _a.value) || "";
  return {
    month: lunarMonths[month.replace("\u95F0", "")] || 0,
    day: Number((_b = parts.find((p) => p.type === "day")) == null ? void 0 : _b.value),
    leap: month.startsWith("\u95F0")
  };
}
const isRecurring = (item) => item.calendar === "lunar" || item.repeat && item.repeat !== "none";
function nextOccurrence(item, base = todayISO()) {
  const start = isoToDate(item.targetDate), today = isoToDate(base);
  if (!today) return null;
  const stop = isoToDate(item.repeatUntil);
  const allowed = (date) => !stop || date <= stop;
  if (item.calendar === "lunar") {
    const targetMonth = Number(item.lunarMonth), targetDay = Number(item.lunarDay);
    if (!targetMonth || !targetDay) return null;
    for (let i = 0; i < 800; i++) {
      const candidate = addDays(today, i), p = lunarParts(candidate);
      if (p.month === targetMonth && p.day === targetDay && p.leap === !!item.lunarLeap)
        return allowed(candidate) ? dateToISO(candidate) : null;
    }
    return null;
  }
  if (!start) return null;
  if (item.repeat === "none") return item.targetDate;
  if (item.repeat === "weekly" || item.repeat === "interval") {
    const step2 = item.repeat === "weekly" ? 7 : Math.max(1, Number(item.intervalDays) || 1);
    const passed = Math.max(0, Math.ceil((today - start) / MS_DAY));
    const candidate = addDays(start, Math.ceil(passed / step2) * step2);
    return allowed(candidate) ? dateToISO(candidate) : null;
  }
  const step = item.repeat === "monthly" ? 1 : item.repeat === "quarterly" ? 3 : 12;
  let n = Math.max(
    0,
    Math.floor(
      ((today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth()) / step
    ) - 1
  );
  for (; n < 200; n++) {
    const candidate = monthDate(start, n * step);
    if (candidate >= today)
      return allowed(candidate) ? dateToISO(candidate) : null;
  }
  return null;
}
function nextDue(item, base = todayISO()) {
  let candidate = nextOccurrence(item, base);
  if (!candidate || !isRecurring(item)) return candidate;
  const completed = new Set(
    Array.isArray(item.completedDates) ? item.completedDates : []
  );
  for (let i = 0; candidate && i < 800; i++) {
    if (!completed.has(candidate)) return candidate;
    candidate = nextOccurrence(
      item,
      dateToISO(addDays(isoToDate(candidate), 1))
    );
  }
  return null;
}
function occurrencesInRange(item, from, until) {
  const end = isoToDate(until), result = [];
  if (!end) return result;
  if (!isRecurring(item)) {
    const date2 = nextOccurrence(item, from);
    return date2 ? [date2] : result;
  }
  let date = nextOccurrence(item, from);
  for (let i = 0; date && i < 800 && isoToDate(date) < end; i++) {
    result.push(date);
    date = nextOccurrence(item, dateToISO(addDays(isoToDate(date), 1)));
  }
  return result;
}
function repeatLabel(item) {
  if (item.calendar === "lunar")
    return `\u519C\u5386\u6BCF\u5E74${item.lunarLeap ? "\u95F0" : ""}${item.lunarMonth}\u6708${item.lunarDay}\u65E5`;
  return {
    none: "\u5355\u6B21",
    weekly: "\u6BCF\u5468",
    monthly: "\u6BCF\u6708",
    quarterly: "\u6BCF\u5B63\u5EA6",
    yearly: "\u6BCF\u5E74",
    interval: `\u6BCF\u9694 ${Math.max(1, Number(item.intervalDays) || 1)} \u5929`
  }[item.repeat || "none"];
}
export {
  dateToISO,
  dayDiff,
  isRecurring,
  isoToDate,
  nextDue,
  nextOccurrence,
  occurrencesInRange,
  repeatLabel,
  todayISO
};
