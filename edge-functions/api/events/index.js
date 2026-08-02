import { json, readJson, requireAccess } from "../../_lib.js";
import { readData, saveData } from "../../_storage.js";
import { queryEvents, sanitiseEvent, sanitiseSeries, uid } from "../../_domain.js";
import { maintainSeries } from "../../_series-maintenance.js";

function conflict(error) {
  if (error?.code !== "REVISION_CONFLICT") return null;
  return json({ error: error.message, code: error.code, currentRevision: error.currentRevision }, 409);
}

function expectedRevision(body, fallback = 0) {
  return Math.max(0, Number(body?.revision ?? fallback) || 0);
}

async function save(data, revision) {
  return saveData(data, { expectedRevision: revision });
}

export async function onRequestGet(context) {
  const access = await requireAccess(context);
  if (access.response) return access.response;
  try {
    const data = await readData();
    const events = queryEvents(data, new URL(context.request.url));
    return json({ events, count: events.length, revision: data.revision });
  } catch (error) {
    return json({ error: error.message || "查询失败" }, 400);
  }
}

export async function onRequestPost(context) {
  const access = await requireAccess(context);
  if (access.response) return access.response;

  try {
    const body = await readJson(context.request);
    const data = await readData();
    const revision = expectedRevision(body, data.revision);
    const typeIds = new Set(data.settings.types.map(type => type.id));
    const now = new Date().toISOString();
    const repeat = String(body.repeat || "none");

    if (repeat !== "none") {
      const series = sanitiseSeries({
        id: body.seriesId || uid("series"),
        title: body.title,
        type: body.type,
        startDate: body.date,
        endDate: body.endDate || "",
        endMode: body.endDate ? "fixed" : "open",
        repeat: body.calendar === "lunar" ? "yearly" : repeat,
        intervalDays: body.intervalDays,
        calendar: body.calendar,
        lunarMonth: body.lunarMonth,
        lunarDay: body.lunarDay,
        active: true,
        amount: body.amount,
        currency: body.currency,
        payment: body.payment,
        note: body.note,
        icon: body.icon || "",
        createdAt: now,
        updatedAt: now
      }, typeIds);
      data.series.push(series);
      maintainSeries(data, { force: true });
      const saved = await save(data, revision);
      return json({ series: saved.series.find(item => item.id === series.id), data: saved }, 201);
    }

    const event = sanitiseEvent({
      ...body,
      id: body.id || uid(),
      seriesId: null,
      occurrenceDate: body.date,
      status: "pending",
      icon: body.icon || "",
      attachments: [],
      archived: false,
      createdAt: now,
      updatedAt: now
    }, typeIds);
    data.events.push(event);
    const saved = await save(data, revision);
    return json({ event: saved.events.find(item => item.id === event.id), data: saved }, 201);
  } catch (error) {
    return conflict(error) || json({ error: error.message || "新增失败" }, 400);
  }
}

export async function onRequestPatch(context) {
  const access = await requireAccess(context);
  if (access.response) return access.response;

  try {
    const body = await readJson(context.request);
    const data = await readData();
    const revision = expectedRevision(body, data.revision);
    const id = String(body.id || new URL(context.request.url).searchParams.get("id") || "");
    const index = data.events.findIndex(item => item.id === id);
    if (index < 0) return json({ error: "事项不存在" }, 404);

    const current = data.events[index];
    const patch = body.event && typeof body.event === "object" ? body.event : body;
    const now = new Date().toISOString();
    const next = { ...current };
    const allowed = [
      "title", "type", "date", "calendar", "lunarMonth", "lunarDay",
      "amount", "currency", "payment", "note", "icon", "status", "archived"
    ];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) next[key] = patch[key];
    }

    if (body.action === "done") {
      next.status = "done";
      next.completedAt = now;
    } else if (body.action === "restore") {
      next.status = "pending";
      next.completedAt = null;
    }
    if (current.seriesId && allowed.some(key => Object.prototype.hasOwnProperty.call(patch, key))) {
      next.overridden = true;
    }
    next.updatedAt = now;

    const typeIds = new Set(data.settings.types.map(type => type.id));
    data.events[index] = sanitiseEvent(next, typeIds);
    if (current.seriesId) maintainSeries(data, { force: true });
    const saved = await save(data, revision);
    return json({ event: saved.events.find(item => item.id === id), data: saved });
  } catch (error) {
    return conflict(error) || json({ error: error.message || "修改失败" }, 400);
  }
}

export async function onRequestDelete(context) {
  const access = await requireAccess(context);
  if (access.response) return access.response;

  try {
    const url = new URL(context.request.url);
    const data = await readData();
    const revision = Math.max(0, Number(url.searchParams.get("revision")) || 0);
    const id = String(url.searchParams.get("id") || "");
    const index = data.events.findIndex(item => item.id === id);
    if (index < 0) return json({ error: "事项不存在" }, 404);

    const [event] = data.events.splice(index, 1);
    if (event.seriesId) maintainSeries(data, { force: true });
    return json({ ok: true, data: await save(data, revision) });
  } catch (error) {
    return conflict(error) || json({ error: error.message || "删除失败" }, 400);
  }
}
