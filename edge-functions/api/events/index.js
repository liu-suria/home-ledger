import { json, readJson, requireAccess } from "../../_lib.js";
import { load, persist, queryEvents, sanitiseEvent, uid } from "../../_domain.js";
import { maintainSeries } from "../../_series-maintenance.js";

export async function onRequestGet(context) {
  const access = await requireAccess(context);
  if (access.response) return access.response;

  try {
    const data = await load();
    const events = queryEvents(data, new URL(context.request.url));
    return json({ events, count: events.length });
  } catch (error) {
    return json({ error: error.message || "查询失败" }, 400);
  }
}

export async function onRequestPost(context) {
  const access = await requireAccess(context);
  if (access.response) return access.response;

  try {
    const data = await load();
    const body = await readJson(context.request);
    const typeIds = new Set(data.settings.types.map(type => type.id));
    const event = sanitiseEvent({
      ...body,
      id: body.id || uid(),
      status: body.status || "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, typeIds);

    data.events.push(event);
    const saved = await persist(data);
    return json({ event: saved.events.find(item => item.id === event.id), data: saved }, 201);
  } catch (error) {
    return json({ error: error.message || "新增失败" }, 400);
  }
}

export async function onRequestPatch(context) {
  const access = await requireAccess(context);
  if (access.response) return access.response;

  try {
    const data = await load();
    const body = await readJson(context.request);
    const id = String(body.id || new URL(context.request.url).searchParams.get("id") || "");
    const event = data.events.find(item => item.id === id);
    if (!event) return json({ error: "事项不存在" }, 404);

    const allowed = [
      "title", "type", "date", "calendar", "lunarMonth", "lunarDay",
      "amount", "currency", "payment", "note", "icon", "status", "archived"
    ];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) event[key] = body[key];
    }

    if (body.action === "done") {
      event.status = "done";
      event.completedAt = new Date().toISOString();
    }
    if (body.action === "restore") {
      event.status = "pending";
      event.completedAt = null;
    }
    if (event.seriesId && allowed.some(key => Object.prototype.hasOwnProperty.call(body, key))) {
      event.overridden = true;
    }
    event.updatedAt = new Date().toISOString();

    if (event.seriesId) maintainSeries(data, { force: true });
    const saved = await persist(data);
    return json({ event: saved.events.find(item => item.id === event.id), data: saved });
  } catch (error) {
    return json({ error: error.message || "修改失败" }, 400);
  }
}

export async function onRequestDelete(context) {
  const access = await requireAccess(context);
  if (access.response) return access.response;

  try {
    const data = await load();
    const id = String(new URL(context.request.url).searchParams.get("id") || "");
    const index = data.events.findIndex(item => item.id === id);
    if (index < 0) return json({ error: "事项不存在" }, 404);

    const [event] = data.events.splice(index, 1);
    if (event.seriesId) maintainSeries(data, { force: true });
    return json({ ok: true, data: await persist(data) });
  } catch (error) {
    return json({ error: error.message || "删除失败" }, 400);
  }
}
