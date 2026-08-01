import { json, readJson, requireAuth } from "../../_lib.js";
import { readData, saveData } from "../../_storage.js";

const text = (value, max) => String(value ?? "").trim().slice(0, max);
const date = (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value || "") : null;
const id = (value) => /^[a-zA-Z0-9_-]{6,100}$/.test(String(value)) ? String(value) : null;
const TYPES = ["reminder", "subscription", "warranty", "maintenance", "baby", "document", "vehicle"];
const REPEATS = ["none", "daily", "weekly", "monthly", "quarterly", "yearly"];

function sanitiseEvent(item) {
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

  return {
    id: eventId,
    title,
    type: TYPES.includes(item.type) ? item.type : "reminder",
    category: text(item.category, 40),
    date: eventDate,
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
  if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.events) || data.events.length > 1000) {
    throw new Error("数据格式不正确");
  }
  return {
    version: 5,
    updatedAt: new Date().toISOString(),
    settings: {
      siteName: text(data.settings?.siteName || "Family Hub", 30) || "Family Hub"
    },
    events: data.events.map(sanitiseEvent)
  };
}

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.response) return auth.response;
  try {
    return json(await readData());
  } catch {
    return json({ error: "无法读取数据" }, 503);
  }
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
