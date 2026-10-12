import {json,requireAccess} from '../../_lib.js';
import {readData} from '../../_storage.js';
import {dashboard} from '../../_dashboard.js';
export async function onRequestGet(context){
 const auth=await requireAccess(context);if(auth.response)return auth.response;
 try{const data=await readData(),id=new URL(context.request.url).searchParams.get('id');
  if(id){const event=data.events.find(e=>e.id===id);return event?json({event,revision:data.revision}):json({error:'事项不存在'},404)}
  return json(dashboard(data));
 }catch{return json({error:'无法读取家庭事务'},503)}
}
