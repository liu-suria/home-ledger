import { readData, saveData, DEFAULT_TYPES } from "./_storage.js";

const REPEAT_VALUES = ["none", "daily", "weekly", "monthly", "quarterly", "yearly", "interval"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{3,100}$/;

const text = (value, limit) => String(value ?? "").trim().slice(0, limit);
const validDate = value => DATE_PATTERN.test(String(value || ""));
const uid = (prefix = "evt") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

function plusOneYear(value) {
  if (!validDate(value)) return "";
  const date = new Date(`${value}T12:00:00+08:00`);
  const day = date.getDate();
  date.setDate(1);
  date.setFullYear(date.getFullYear() + 1);
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function money(value) {
  if (value === null || value === "" || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1e8) throw new Error("金额不正确");
  return Math.round(number * 100) / 100;
}

function sanitizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 5)
    .map(attachment => ({
      id: text(attachment?.id || uid("att"), 100),
      name: text(attachment?.name, 80),
      type: text(attachment?.type, 80),
      data: text(attachment?.data, 220000)
    }))
    .filter(attachment => ID_PATTERN.test(attachment.id) && attachment.name && attachment.data.startsWith("data:"));
}

export function sanitiseTypes(value) {
  const source = Array.isArray(value) ? value : DEFAULT_TYPES;
  const result = [];
  const seen = new Set();

  for (const item of source.slice(0, 30)) {
    const id = text(item?.id, 100);
    const name = text(item?.name, 20);
    if (!ID_PATTERN.test(id) || !name || seen.has(id)) continue;
    seen.add(id);
    result.push({ id, name });
  }

  return result.length ? result : DEFAULT_TYPES.map(type => ({ ...type }));
}

export function sanitiseEvent(item, typeIds) {
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("事项格式不正确");

  const id = text(item.id || uid(), 100);
  const title = text(item.title, 100);
  const date = text(item.date, 10);
  const type = typeIds.has(String(item.type)) ? String(item.type) : [...typeIds][0];
  if (!title || !validDate(date) || !ID_PATTERN.test(id)) throw new Error("事项标题、日期或标识不正确");

  const calendar = item.calendar === "lunar" ? "lunar" : "solar";
  const status = item.status === "done" ? "done" : "pending";

  return {
    id,
    title,
    type,
    date,
    calendar,
    lunarMonth: calendar === "lunar" ? Math.max(1, Math.min(12, Number(item.lunarMonth) || 1)) : null,
    lunarDay: calendar === "lunar" ? Math.max(1, Math.min(30, Number(item.lunarDay) || 1)) : null,
    seriesId: text(item.seriesId, 100) || null,
    occurrenceDate: validDate(item.occurrenceDate) ? item.occurrenceDate : date,
    status,
    completedAt: status === "done" ? text(item.completedAt, 40) || null : null,
    amount: money(item.amount),
    currency: text(item.currency || "CNY", 8).toUpperCase() || "CNY",
    payment: text(item.payment, 50),
    note: text(item.note, 1000),
    icon: text(item.icon, 500),
    attachments: sanitizeAttachments(item.attachments),
    archived: Boolean(item.archived),
    overridden: item.overridden === true,
    createdAt: text(item.createdAt, 40) || new Date().toISOString(),
    updatedAt: text(item.updatedAt, 40) || new Date().toISOString()
  };
}

export function sanitiseSeries(item, typeIds) {
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("循环规则格式不正确");

  const id = text(item.id || uid("series"), 100);
  const title = text(item.title, 100);
  const startDate = text(item.startDate || item.date, 10);
  const rawEndDate = text(item.endDate, 10);
  const legacyAutomaticEnd = !item.endMode && rawEndDate && rawEndDate === plusOneYear(startDate);
  const endMode = item.endMode === "fixed" && !legacyAutomaticEnd ? "fixed" : "open";
  const endDate = endMode === "fixed" ? rawEndDate : "";

  if (!ID_PATTERN.test(id) || !title || !validDate(startDate) || (endDate && (!validDate(endDate) || endDate < startDate))) {
    throw new Error("循环规则标题或起止日期不正确");
  }

  const calendar = item.calendar === "lunar" ? "lunar" : "solar";
  const repeat = calendar === "lunar"
    ? "yearly"
    : REPEAT_VALUES.includes(item.repeat) && item.repeat !== "none" ? item.repeat : "yearly";

  return {
    id,
    title,
    type: typeIds.has(String(item.type)) ? String(item.type) : [...typeIds][0],
    startDate,
    endDate,
    endMode,
    repeat,
    intervalDays: Math.max(1, Math.min(3650, Number(item.intervalDays) || 1)),
    calendar,
    lunarMonth: calendar === "lunar" ? Math.max(1, Math.min(12, Number(item.lunarMonth) || 1)) : null,
    lunarDay: calendar === "lunar" ? Math.max(1, Math.min(30, Number(item.lunarDay) || 1)) : null,
    active: item.active !== false,
    amount: money(item.amount),
    currency: text(item.currency || "CNY", 8).toUpperCase() || "CNY",
    payment: text(item.payment, 50),
    note: text(item.note, 1000),
    icon: text(item.icon, 500),
    createdAt: text(item.createdAt, 40) || new Date().toISOString(),
    updatedAt: text(item.updatedAt, 40) || new Date().toISOString()
  };
}

export function sanitiseData(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.events) || data.events.length > 5000) {
    throw new Error("数据格式不正确");
  }

  const types = sanitiseTypes(data.settings?.types);
  const typeIds = new Set(types.map(type => type.id));
  const requestedOrder = Array.isArray(data.settings?.typeOrder)
    ? data.settings.typeOrder.filter(id => typeIds.has(id))
    : [];
  const typeOrder = [...requestedOrder, ...types.map(type => type.id).filter(id => !requestedOrder.includes(id))];

  return {
    version: 8,
    updatedAt: new Date().toISOString(),
    settings: {
      siteName: text(data.settings?.siteName || "Family Hub", 30) || "Family Hub",
      types,
      theme: ["system", "light", "dark"].includes(data.settings?.theme) ? data.settings.theme : "system",
      typeOrder,
      lastSeriesMaintenanceDate: text(data.settings?.lastSeriesMaintenanceDate, 10),
      seriesWindowSize: 2
    },
    series: (Array.isArray(data.series) ? data.series : []).slice(0, 500).map(item => sanitiseSeries(item, typeIds)),
    events: data.events.map(item => sanitiseEvent(item, typeIds)),
    templates: (Array.isArray(data.templates) ? data.templates : []).slice(0, 50)
  };
}

// Kept as a compatibility export for older thin API handlers. Logs are intentionally not persisted.
export function addLog() {}

export async function load() {
  return sanitiseData(await readData());
}

export async function persist(data) {
  const clean = sanitiseData(data);
  await saveData(clean);
  return clean;
}

export function queryEvents(data, url) {
  const params = url.searchParams;
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  let start = params.get("start");
  let end = params.get("end");
  const days = Math.max(0, Math.min(3650, Number(params.get("days")) || 0));

  if (days && !start) {
    start = now.toISOString().slice(0, 10);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + days);
    end = endDate.toISOString().slice(0, 10);
  }

  const keyword = (params.get("keyword") || "").toLowerCase();
  const type = params.get("type");
  const status = params.get("status");
  const calendar = params.get("calendar");

  return data.events
    .filter(item => !item.archived)
    .filter(item => !type || item.type === type)
    .filter(item => !status || item.status === status)
    .filter(item => !calendar || item.calendar === calendar)
    .filter(item => !start || item.date >= start)
    .filter(item => !end || item.date <= end)
    .filter(item => !keyword || [item.title, item.note, item.payment, item.currency].join(" ").toLowerCase().includes(keyword))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "zh-CN"));
}

export function stats(data) {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const iso = date => date.toISOString().slice(0, 10);
  const today = iso(now);
  const day7 = new Date(now);
  const day30 = new Date(now);
  const day365 = new Date(now);
  day7.setDate(day7.getDate() + 7);
  day30.setDate(day30.getDate() + 30);
  day365.setDate(day365.getDate() + 365);

  const active = data.events.filter(item => !item.archived);
  const pending = active.filter(item => item.status !== "done");
  const between = end => pending.filter(item => item.date >= today && item.date <= iso(end)).length;

  let annualCny = 0;
  for (const item of pending) {
    if (item.date >= today && item.date <= iso(day365) && item.amount != null && item.currency === "CNY") {
      annualCny += Number(item.amount);
    }
  }

  return {
    today: pending.filter(item => item.date === today).length,
    next7: between(day7),
    next30: between(day30),
    overdue: pending.filter(item => item.date < today).length,
    done: active.filter(item => item.status === "done").length,
    total: active.length,
    subscriptions: pending.filter(item => item.type === "subscription").length,
    annualCny: Math.round(annualCny * 100) / 100
  };
}

export const builtInTemplates = [
  {
    id: "baby-basic",
    name: "宝宝成长",
    items: [
      { title: "宝宝体检", type: "baby", offsetDays: 30 },
      { title: "疫苗接种", type: "baby", offsetDays: 60 },
      { title: "保险续费", type: "baby", offsetDays: 365 }
    ]
  },
  {
    id: "home-care",
    name: "房屋保养",
    items: [
      { title: "空调清洗", type: "maintenance", offsetDays: 180 },
      { title: "净水器滤芯", type: "maintenance", offsetDays: 90 },
      { title: "燃气检查", type: "maintenance", offsetDays: 365 }
    ]
  },
  {
    id: "documents",
    name: "证件管理",
    items: [
      { title: "身份证到期检查", type: "document", offsetDays: 365 },
      { title: "护照到期检查", type: "document", offsetDays: 365 }
    ]
  }
];

export { uid };
