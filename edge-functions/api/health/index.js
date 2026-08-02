import { json, requireAccess } from "../../_lib.js";
import { readData } from "../../_storage.js";
import { shanghaiToday } from "../../_series-maintenance.js";

const WINDOW_SIZE = 1;

export async function onRequestGet(context) {
  const access = await requireAccess(context);
  if (access.response) return access.response;

  try {
    const data = await readData();
    const today = shanghaiToday();
    const seriesIds = new Set((data.series || []).map(item => item.id));
    const orphanEvents = (data.events || []).filter(event => event.seriesId && !seriesIds.has(event.seriesId)).length;
    let futureWindowErrors = 0;

    for (const series of data.series || []) {
      if (series.active === false) continue;
      const regularFuture = (data.events || []).filter(event => event.seriesId === series.id
        && !event.archived
        && event.status !== "done"
        && event.overridden !== true
        && event.date >= today);
      if (regularFuture.length !== WINDOW_SIZE && !(series.endDate && regularFuture.length < WINDOW_SIZE)) {
        futureWindowErrors++;
      }
    }

    return json({
      ok: orphanEvents === 0 && futureWindowErrors === 0,
      dataVersion: data.version,
      revision: data.revision,
      events: data.events.length,
      series: data.series.length,
      templates: data.templates.length,
      seriesWindowSize: WINDOW_SIZE,
      orphanEvents,
      futureWindowErrors,
      lastSeriesMaintenanceDate: data.settings?.lastSeriesMaintenanceDate || null
    });
  } catch (error) {
    return json({ ok: false, error: error.message || "健康检查失败" }, 503);
  }
}
