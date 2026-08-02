import { json, readJson, requireAccess } from "../../_lib.js";
import { load, persist, sanitiseData } from "../../_domain.js";

export async function onRequestGet(context) {
  const access = await requireAccess(context);
  if (access.response) return access.response;

  try {
    return json(await load());
  } catch {
    return json({ error: "无法读取数据" }, 503);
  }
}

export async function onRequestPut(context) {
  const access = await requireAccess(context);
  if (access.response) return access.response;

  try {
    const data = sanitiseData(await readJson(context.request));
    return json(await persist(data));
  } catch (error) {
    return json({ error: error.message || "保存失败" }, 400);
  }
}
