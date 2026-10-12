import test from 'node:test';import assert from 'node:assert/strict';import {dashboard} from '../edge-functions/_dashboard.js';
test('dashboard retains actionable fields but excludes embedded files and private logs',()=>{
 const event={id:'a',title:'续费',date:'2026-10-12',note:'keep',status:'pending',attachments:[{id:'f',name:'invoice.pdf',type:'application/pdf',data:'data:application/pdf;base64,LARGE'}]};
 const data={revision:7,settings:{types:[{id:'a',name:'财务'}]},events:[event,{id:'old',archived:true}],logs:[{secret:'history'}],templates:[{secret:'template'}]};
 const result=dashboard(data);assert.equal(result.revision,7);assert.equal(result.events.length,1);assert.equal(result.events[0].note,'keep');assert.equal(result.events[0].attachments[0].name,'invoice.pdf');assert.ok(!JSON.stringify(result).includes('LARGE'));assert.ok(!JSON.stringify(result).includes('secret'));assert.ok(event.attachments[0].data);
});
