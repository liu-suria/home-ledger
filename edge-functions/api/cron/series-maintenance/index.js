import { json } from "../../../_lib.js";
import { readData, saveData } from "../../../_storage.js";
import { maintainSeries } from "../../../_series-maintenance.js";

export async function onRequestPost() {
  try {
    const data = await readData();
    const result = maintainSeries(data);
    const hasInstanceChanges = Number(result.generated) > 0 || Number(result.removed) > 0;
    const saved = hasInstanceChanges ? await saveData(result.data) : data;

    return json({
      ok: true,
      generated: result.generated,
      removed: result.removed,
      date: saved.settings?.lastSeriesMaintenanceDate,
      data: saved
    });
  } catch (error) {
    return json({ error: error.message || "维护失败" }, 500);
  }
}
