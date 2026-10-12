// Dashboard excludes history, templates and embedded attachment bytes.
export function dashboard(data){
 return {revision:data.revision,updatedAt:data.updatedAt,settings:{types:data.settings?.types||[]},events:(data.events||[]).filter(e=>!e.archived).map(e=>({id:e.id,title:e.title,type:e.type,date:e.date,status:e.status,amount:e.amount,currency:e.currency,note:e.note,seriesId:e.seriesId,calendar:e.calendar,attachments:(e.attachments||[]).map(a=>({id:a.id,name:a.name,type:a.type}))}))};
}
