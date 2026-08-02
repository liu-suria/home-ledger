import { json, readJson, requireAccess } from "../../_lib.js";
import { builtInTemplates, load, persist, sanitiseEvent, uid } from "../../_domain.js";

const text = (value, limit) => String(value ?? "").trim().slice(0, limit);

function cleanItem(item, typeIds) {
  const type = typeIds.has(String(item?.type)) ? String(item.type) : [...typeIds][0];
  const amount = item?.amount === "" || item?.amount == null
    ? null
    : Math.round(Number(item.amount) * 100) / 100;

  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    throw new Error("模板金额不正确");
  }

  return {
    title: text(item?.title, 100),
    type,
    offsetDays: Math.max(0, Math.min(36500, Number(item?.offsetDays) || 0)),
    amount,
    currency: text(item?.currency || "CNY", 8).toUpperCase() || "CNY",
    payment: text(item?.payment, 50),
    note: text(item?.note, 1000)
  };
}

function cleanTemplate(body, typeIds, id) {
  const name = text(body?.name, 40);
  const items = Array.isArray(body?.items)
    ? body.items.slice(0, 100).map(item => cleanItem(item, typeIds)).filter(item => item.title)
    : [];

  if (!name) throw new Error("模板名称不能为空");
  if (!items.length) throw new Error("模板至少需要一个事项");

  return {
    id: id || uid("tpl"),
    name,
    items,
    updatedAt: new Date().toISOString()
  };
}

export async function onRequestGet(context) {
  const access = await requireAccess(context);
  if (access.response) return access.response;

  const data = await load();
  return json({
    templates: [
      ...builtInTemplates.map(template => ({ ...template, builtIn: true })),
      ...(data.templates || []).map(template => ({ ...template, builtIn: false }))
    ]
  });
}

export async function onRequestPost(context) {
  const access = await requireAccess(context);
  if (access.response) return access.response;

  try {
    const data = await load();
    const body = await readJson(context.request);
    const action = String(body.action || "apply");
    const typeIds = new Set(data.settings.types.map(type => type.id));

    if (action === "save") {
      const requestedId = text(body.id, 100);
      const index = (data.templates || []).findIndex(template => template.id === requestedId);
      const template = cleanTemplate(body, typeIds, index >= 0 ? requestedId : uid("tpl"));

      if (index >= 0) data.templates[index] = template;
      else data.templates.push(template);

      const saved = await persist(data);
      return json({ template, data: saved }, index >= 0 ? 200 : 201);
    }

    if (action !== "apply") return json({ error: "不支持的模板操作" }, 400);

    const template = [...builtInTemplates, ...(data.templates || [])].find(item => item.id === body.id);
    if (!template) return json({ error: "模板不存在" }, 404);

    const startDate = body.startDate || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("起始日期不正确");

    const base = new Date(`${startDate}T12:00:00+08:00`);
    const created = [];

    for (const item of template.items || []) {
      const date = new Date(base);
      date.setDate(date.getDate() + Number(item.offsetDays || 0));
      const event = sanitiseEvent({
        ...item,
        id: uid(),
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
        type: typeIds.has(item.type) ? item.type : [...typeIds][0],
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, typeIds);
      data.events.push(event);
      created.push(event);
    }

    return json({ created, data: await persist(data) }, 201);
  } catch (error) {
    return json({ error: error.message || "模板操作失败" }, 400);
  }
}

export async function onRequestDelete(context) {
  const access = await requireAccess(context);
  if (access.response) return access.response;

  try {
    const data = await load();
    const id = new URL(context.request.url).searchParams.get("id");
    const index = (data.templates || []).findIndex(template => template.id === id);
    if (index < 0) return json({ error: "个人模板不存在或内置模板不可删除" }, 404);

    data.templates.splice(index, 1);
    return json({ ok: true, data: await persist(data) });
  } catch (error) {
    return json({ error: error.message || "删除失败" }, 400);
  }
}
