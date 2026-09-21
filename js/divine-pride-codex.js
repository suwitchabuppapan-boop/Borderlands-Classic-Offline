/* Offline-only encyclopedia. No fetch, API key, remote images or gameplay overrides. */
(function(root){'use strict';
const MOB_NAMES=[['poring',1002],['fabre',1007],['lunatic',1063],['willow',1010],['hornet',1004],['poporing',1031]];
const ITEM_NAMES=[[501,'Red Potion'],[909,'Jellopy']];
const SKILL_NAMES=[[5,'Bash','bash'],[6,'Provoke','provoke'],[7,'Magnum Break','magnum_break']];
const escapeHtml=value=>String(value??'—').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const show=value=>value===null||value===undefined||value===''?'—':escapeHtml(value);
function isValidCache(cache){
 if(!cache||typeof cache!=='object'||Array.isArray(cache)||cache.schema!==1||cache.region!=='thROC')return false;
 if(typeof cache.fetchedAt!=='string'&&cache.fetchedAt!==null)return false;
 if(!cache.monsters||!cache.items||!cache.skills)return false;
 function scan(obj,depth=0){if(depth>8||!obj||typeof obj!=='object')return true;for(const [k,v] of Object.entries(obj)){if(/api.?key|secret|token|authorization/i.test(k))return false;if(typeof v==='object'&&!scan(v,depth+1))return false;}return true;}
 if(!scan(cache))return false;
 for(const [group,allowed] of [['monsters',MOB_NAMES.map(x=>x[1])],['items',ITEM_NAMES.map(x=>x[0])],['skills',SKILL_NAMES.map(x=>x[0])]]){
  const rows=cache[group];if(!rows||Array.isArray(rows)||typeof rows!=='object'||Object.keys(rows).length>allowed.length)return false;
  for(const [id,record] of Object.entries(rows))if(!allowed.includes(Number(id))||String(Number(id))!==id||!record||typeof record!=='object'||Array.isArray(record)||record.id!==Number(id))return false;
 }
 return true;
}
function render(cache,core){
 const good=isValidCache(cache),c=good?cache:null,number=(v)=>v===undefined||v===null?'—':show(v);
 const count=c?Object.keys(c.monsters).length+Object.keys(c.items).length+Object.keys(c.skills).length:0;
 let out='<div class="panel-head"><div><small>REFERENCE / THAI CLASSIC</small><h2>Divine Pride Codex</h2></div><span class="tag green">LOCAL</span></div>';
 out+='<p class="panel-note">ข้อมูล API ใช้สำหรับดูและเทียบเท่านั้น <strong>ไม่ได้แทนที่</strong> ค่า HP / EXP / Damage / Drop ในระบบต่อสู้ Pre-Renewal SOLO</p>';
 if(!count){out+='<div class="quest-card"><strong>ยังไม่ได้ Import API</strong><p>เกมยังเล่นได้เต็มระบบด้วยข้อมูล Classic v1.1 เดิม · รัน IMPORT_DIVINE_PRIDE.bat ในโฟลเดอร์เกม ใส่ Key บนเครื่อง และเปิด index.html ใหม่</p></div>';}
 else out+='<p class="panel-note"><span class="tag gold">thROC · '+count+' RECORDS</span> ดึงล่าสุด '+show(c.fetchedAt)+' · ข้อมูลเซิร์ฟเวอร์อาจไม่ตรง rAthena Pre-Renewal</p>';
 out+='<div class="equip-section"><h3>MONSTERS · เปรียบเทียบค่าจาก 2 แหล่ง</h3>';
 for(const [key,id] of MOB_NAMES){const base=core.MONSTERS[key],api=c?.monsters?.[String(id)];out+='<div class="codex-row"><strong>'+escapeHtml(base.name)+' <span class="tag">#'+id+'</span></strong><small>Pre-Renewal ในเกม: Lv '+base.level+' · HP '+base.hp+' · ATK '+base.atk+'–'+base.atkMax+' · DEF '+base.def+' · Base EXP '+base.exp+'</small>'+(api?'<small class="codex-import">thROC API: '+show(api.name)+' · Lv '+number(api.level)+' · HP '+number(api.health)+' · ATK '+show(api.attackRange)+' · DEF '+number(api.def)+' · '+show(api.element)+'</small>':'<small class="codex-missing">thROC API: ยังไม่มีข้อมูลสำหรับ ID นี้</small>')+'</div>';}
 out+='</div><div class="equip-section"><h3>ITEMS · ข้อมูลอ้างอิง (ไม่เปลี่ยนราคาในเกม)</h3>';
 for(const [id,name] of ITEM_NAMES){const api=c?.items?.[String(id)];out+='<div class="codex-row"><strong>'+escapeHtml(name)+' <span class="tag">#'+id+'</span></strong>'+(api?'<small class="codex-import">'+show(api.name)+' · ซื้อ '+number(api.buyPrice)+' · ขาย '+number(api.sellPrice)+' · น้ำหนัก '+number(api.weight)+' · '+show(api.type)+'</small>':'<small class="codex-missing">ยังไม่มีข้อมูลจาก API</small>')+'</div>';}
 out+='</div><div class="equip-section"><h3>SKILLS · ค่าสกิลเพื่อเปรียบเทียบ</h3>';
 for(const [id,name,key] of SKILL_NAMES){const api=c?.skills?.[String(id)],solo=core.SKILLS[key];out+='<div class="codex-row"><strong>'+escapeHtml(name)+' <span class="tag">#'+id+'</span></strong><small>SOLO: SP '+solo.sp+' · CD '+solo.cd+' วินาที</small>'+(api?'<small class="codex-import">thROC: '+show(api.name)+' · Max Lv '+number(api.maxLevel)+' · SP '+show(api.spCost)+' · Range '+show(api.range)+'</small>':'<small class="codex-missing">ยังไม่มีข้อมูลจาก API</small>')+'</div>';}
 out+='</div><p class="panel-note" style="margin-top:17px">แหล่งข้อมูล: divine-pride.net API · server thROC · ไม่รวมภาพ/ไอคอนจาก API · Key ไม่บันทึกในเกม</p>';
 return out;
}
const api={MOB_NAMES,ITEM_NAMES,SKILL_NAMES,isValidCache,render};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.BorderCodex=api;
})(typeof window!=='undefined'?window:globalThis);
