import { json, readJson, requireAuth } from "../../_lib.js";
import { readData, saveData } from "../../_storage.js";

const text = (value, max) => String(value ?? "").trim().slice(0, max);
const date = (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value || "") : null;
const id = (value) => /^[a-zA-Z0-9_-]{3,100}$/.test(String(value)) ? String(value) : null;
const REPEATS = ["none", "daily", "weekly", "monthly", "quarterly", "yearly"];
const DEFAULT_TYPES = [
  { id: "reminder", name: "其他事项" },
  { id: "baby", name: "宝宝事项" },
  { id: "subscription", name: "订阅续费" },
  { id: "maintenance", name: "家庭维护" },
  { id: "document", name: "证件到期" },
  { id: "warranty", name: "保修到期" },
  { id: "vehicle", name: "车辆事项" }
];

function sanitiseTypes(value) {
  const source = Array.isArray(value) ? value : DEFAULT_TYPES;
  const result = [];
  const seen = new Set();
  for (const item of source.slice(0, 30)) {
    const typeId = id(item?.id);
    const name = text(item?.name, 20);
    if (!typeId || !name || seen.has(typeId)) continue;
    seen.add(typeId);
    result.push({ id: typeId, name });
  }
  return result.length ? result : DEFAULT_TYPES;
}

function sanitiseEvent(item, typeIds) {
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("事项格式不正确");
  const eventId = id(item.id);
  const title = text(item.title, 100);
  const eventDate = date(item.date);
  if (!eventId || !title || eventDate === null) throw new Error("事项标题、日期或标识不正确");
  let amount = null;
  if (item.amount !== null && item.amount !== "" && item.amount !== undefined) {
    amount = Number(item.amount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 1e8) throw new Error("金额不正确");
    amount = Math.round(amount * 100) / 100;
  }
  const calendar = item.calendar === "lunar" ? "lunar" : "solar";
  return {
    id: eventId,
    title,
    type: typeIds.has(String(item.type)) ? String(item.type) : [...typeIds][0],
    date: eventDate,
    calendar,
    lunarMonth: calendar === "lunar" ? Math.max(1, Math.min(12, Number(item.lunarMonth) || 1)) : null,
    lunarDay: calendar === "lunar" ? Math.max(1, Math.min(30, Number(item.lunarDay) || 1)) : null,
    repeat: REPEATS.includes(item.repeat) ? item.repeat : "none",
    status: item.status === "done" ? "done" : "pending",
    amount,
    currency: text(item.currency || "CNY", 8).toUpperCase() || "CNY",
    payment: text(item.payment, 50),
    note: text(item.note, 1000),
    archived: !!item.archived,
    createdAt: text(item.createdAt, 40),
    updatedAt: text(item.updatedAt, 40)
  };
}

function sanitise(data) {
  if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.events) || data.events.length > 1000) throw new Error("数据格式不正确");
  const types = sanitiseTypes(data.settings?.types);
  const typeIds = new Set(types.map((item) => item.id));
  return {
    version: 6,
    updatedAt: new Date().toISOString(),
    settings: {
      siteName: text(data.settings?.siteName || "Family Hub", 30) || "Family Hub",
      types
    },
    events: data.events.map((item) => sanitiseEvent(item, typeIds))
  };
}

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.response) return auth.response;
  try { return json(await readData()); }
  catch { return json({ error: "无法读取数据" }, 503); }
}

export async function onRequestPut(context) {
  const auth = await requireAuth(context);
  if (auth.response) return auth.response;
  try {
    const data = sanitise(await readJson(context.request));
    await saveData(data);
    return json(data);
  } catch (error) {
    return json({ error: error.message || "保存失败" }, 400);
  }
}
