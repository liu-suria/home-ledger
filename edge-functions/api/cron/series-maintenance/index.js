import { json } from "../../../_lib.js";
import { readData, saveData } from "../../../_storage.js";
import { maintainSeries } from "../../../_series-maintenance.js";
export async function onRequestPost(){try{const data=await readData(),result=maintainSeries(data);if(result.changed)await saveData(result.data);return json({ok:true,generated:result.generated,removed:result.removed,date:result.data.settings?.lastSeriesMaintenanceDate})}catch(e){return json({error:e.message||"维护失败"},500)}}
