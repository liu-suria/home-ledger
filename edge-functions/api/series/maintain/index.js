import { json, requireAccess } from "../../../_lib.js";
import { readData, saveData } from "../../../_storage.js";
import { maintainSeries } from "../../../_series-maintenance.js";

export async function onRequestPost(context) {
  const access = await requireAccess(context);
  if (access.response) return access.response;

  try {
    const data = await readData();
    const result = maintainSeries(data, { force: true });
    const saved = result.changed ? await saveData(result.data) : data;

    return json({
      ok: true,
      generated: result.generated,
      removed: result.removed,
      data: saved
    });
  } catch (error) {
    return json({ error: error.message || "维护失败" }, 500);
  }
}
