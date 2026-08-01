/* Shared reminder scheduling helpers. All calculations use local calendar days. */
const MS_DAY = 86400000;
const lunarMonths = { "正月": 1, "二月": 2, "三月": 3, "四月": 4, "五月": 5, "六月": 6, "七月": 7, "八月": 8, "九月": 9, "十月": 10, "冬月": 11, "腊月": 12 };
export const dateToISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
export const isoToDate = iso => { const [y,m,d] = String(iso || "").split("-").map(Number); return y && m && d ? new Date(y,m-1,d) : null; };
export const todayISO = () => dateToISO(new Date());
export const dayDiff = (iso, base = todayISO()) => { const a = isoToDate(iso), b = isoToDate(base); return a && b ? Math.round((a-b)/MS_DAY) : null; };
const addDays = (d, count) => { const n = new Date(d); n.setDate(n.getDate()+count); return n; };
const monthDate = (start, months) => { const day = start.getDate(), n = new Date(start.getFullYear(), start.getMonth()+months, 1); n.setDate(Math.min(day, new Date(n.getFullYear(), n.getMonth()+1, 0).getDate())); return n; };
function lunarParts(date) { const parts = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", { month:"long", day:"numeric" }).formatToParts(date); const month = parts.find(p=>p.type === "month")?.value || ""; return { month: lunarMonths[month.replace("闰", "")] || 0, day: Number(parts.find(p=>p.type === "day")?.value), leap: month.startsWith("闰") }; }
export const isRecurring = item => item.calendar === "lunar" || (item.repeat && item.repeat !== "none");
export function nextOccurrence(item, base = todayISO()) {
  const start = isoToDate(item.targetDate), today = isoToDate(base);
  if (!today) return null;
  const stop = isoToDate(item.repeatUntil);
  const allowed = date => !stop || date <= stop;
  if (item.calendar === "lunar") {
    const targetMonth = Number(item.lunarMonth), targetDay = Number(item.lunarDay);
    if (!targetMonth || !targetDay) return null;
    for (let i=0;i<800;i++) { const candidate = addDays(today,i), p = lunarParts(candidate); if (p.month === targetMonth && p.day === targetDay && p.leap === !!item.lunarLeap) return allowed(candidate) ? dateToISO(candidate) : null; }
    return null;
  }
  if (!start) return null;
  if (item.repeat === "none") return item.targetDate;
  if (item.repeat === "weekly" || item.repeat === "interval") {
    const step = item.repeat === "weekly" ? 7 : Math.max(1, Number(item.intervalDays) || 1);
    const passed = Math.max(0, Math.ceil((today-start)/MS_DAY));
    const candidate = addDays(start, Math.ceil(passed/step)*step); return allowed(candidate) ? dateToISO(candidate) : null;
  }
  const step = item.repeat === "monthly" ? 1 : item.repeat === "quarterly" ? 3 : 12;
  let n = Math.max(0, Math.floor(((today.getFullYear()-start.getFullYear())*12 + today.getMonth()-start.getMonth())/step)-1);
  for (;n<200;n++) { const candidate = monthDate(start,n*step); if (candidate >= today) return allowed(candidate) ? dateToISO(candidate) : null; }
  return null;
}
export function nextDue(item, base = todayISO()) {
  let candidate = nextOccurrence(item, base);
  if (!candidate || !isRecurring(item)) return candidate;
  const completed = new Set(Array.isArray(item.completedDates) ? item.completedDates : []);
  for (let i=0; candidate && i<800; i++) {
    if (!completed.has(candidate)) return candidate;
    candidate = nextOccurrence(item, dateToISO(addDays(isoToDate(candidate), 1)));
  }
  return null;
}
export function occurrencesInRange(item, from, until) {
  const end = isoToDate(until), result = [];
  if (!end) return result;
  if (!isRecurring(item)) { const date = nextOccurrence(item, from); return date ? [date] : result; }
  let date = nextOccurrence(item, from);
  for (let i=0; date && i<800 && isoToDate(date) < end; i++) {
    result.push(date);
    date = nextOccurrence(item, dateToISO(addDays(isoToDate(date), 1)));
  }
  return result;
}
export function repeatLabel(item) { if (item.calendar === "lunar") return `农历每年${item.lunarLeap ? "闰" : ""}${item.lunarMonth}月${item.lunarDay}日`; return ({none:"单次",weekly:"每周",monthly:"每月",quarterly:"每季度",yearly:"每年",interval:`每隔 ${Math.max(1, Number(item.intervalDays)||1)} 天`})[item.repeat || "none"]; }
