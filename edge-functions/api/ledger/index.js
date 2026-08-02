import { json, readJson, requireAccess } from "../../_lib.js";
import { load, sanitiseData } from "../../_domain.js";
import { saveData } from "../../_storage.js";

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
    const incoming = sanitiseData(await readJson(context.request));
    const expectedRevision = Number(incoming.revision) || 0;
    return json(await saveData(incoming, { expectedRevision }));
  } catch (error) {
    if (error?.code === "REVISION_CONFLICT") {
      return json({ error: error.message, code: error.code, currentRevision: error.currentRevision }, 409);
    }
    return json({ error: error.message || "保存失败" }, 400);
  }
}
