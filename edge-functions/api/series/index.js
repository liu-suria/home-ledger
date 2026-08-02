import { json, readJson, requireAccess } from "../../_lib.js";
import { readData, saveData } from "../../_storage.js";
import { maintainSeries } from "../../_series-maintenance.js";

export async function onRequestGet(context) {
  const access = await requireAccess(context);
  if (access.response) return access.response;
  const data = await readData();
  return json({ series: data.series || [] });
}

export async function onRequestPost(context) {
  const access = await requireAccess(context);
  if (access.response) return access.response;

  try {
    const body = await readJson(context.request);
    const data = await readData();
    const action = String(body.action || "topup");
    const id = String(body.id || "");
    const rule = (data.series || []).find(item => item.id === id);

    if (!rule) return json({ error: "循环规则不存在" }, 404);

    if (action === "topup") {
      maintainSeries(data, { force: true });
    } else if (action === "toggle") {
      rule.active = rule.active === false;
      rule.updatedAt = new Date().toISOString();
      if (rule.active) maintainSeries(data, { force: true });
    } else if (action === "update") {
      const patch = body.patch || {};
      const endDate = patch.endDate || "";
      Object.assign(rule, patch, {
        endDate,
        endMode: endDate ? "fixed" : "open",
        updatedAt: new Date().toISOString()
      });

      if (body.rebuildAll === true) {
        data.events = (data.events || []).filter(event => event.seriesId !== id || event.status === "done");
      }
      maintainSeries(data, { force: true });
    } else if (action === "delete") {
      const scope = body.scope || "all";
      const from = body.from || "0000-00-00";

      if (scope === "all") {
        data.events = (data.events || []).filter(event => event.seriesId !== id || event.status === "done");
        data.series = data.series.filter(item => item.id !== id);
      } else {
        data.events = (data.events || []).filter(event => event.seriesId !== id || event.date < from || event.status === "done");
        rule.active = false;
        rule.endDate = from;
        rule.endMode = "fixed";
        rule.updatedAt = new Date().toISOString();
      }
    } else {
      return json({ error: "不支持的操作" }, 400);
    }

    data.updatedAt = new Date().toISOString();
    await saveData(data);
    return json(data);
  } catch (error) {
    return json({ error: error.message || "操作失败" }, 400);
  }
}
