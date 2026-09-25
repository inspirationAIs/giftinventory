// 데이터 저장소 – 구글 스프레드시트(Cloud) + 로컬 서버 + localStorage 삼중 동기화
const Storage = (function() {
  const LS_KEY = 'promo_db_v1';
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbywolVpg32ZQIyzxEVuh-_PoNUM6vSe7O6Cg48kkRSwXwatZ7H3_D4Hx-ps0h8K02aKtA/exec';
  let online = false;
  let useGas = true;
  let serverInfo = { localIp: location.hostname || 'cloud', port: 443, mobileUrl: location.href };
  let db = {
    categories:[], teamMembers:[], items:[], stockIns:[], checkouts:[]
  };

  async function init() {
    // 1. 구글 스프레드시트 클라우드 우선 동기화
    if (GAS_URL) {
      try {
        const r = await fetch(GAS_URL, { cache: 'no-store', redirect: 'follow' });
        if (r.ok) {
          const d = await r.json();
          if (d && d.items && d.items.length) {
            db = d;
            localStorage.setItem(LS_KEY, JSON.stringify(db));
            online = true;
            useGas = true;
            serverInfo = { localIp: 'Google Cloud (Sheets)', port: 'HTTPS', mobileUrl: location.href };
            return { ok: true, mode: 'cloud', serverInfo };
          }
        }
      } catch(e) {
        console.warn('Google Sheet fetch error:', e);
      }
    }

    // 2. 로컬 서버(server.ps1) 확인
    try {
      const r = await fetch('/api/info', { cache: 'no-store' });
      if (r.ok) {
        const info = await r.json();
        const d = await fetch('/api/data', { cache: 'no-store' });
        if (d.ok) {
          db = await d.json();
          localStorage.setItem(LS_KEY, JSON.stringify(db));
          online = true;
          useGas = false;
          serverInfo = info;
          return { ok: true, mode: 'server', serverInfo };
        }
      }
    } catch(e) {}

    // 3. 오프라인 LocalStorage 폴백
    online = false;
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      try { db = JSON.parse(saved); } catch(e){}
    } else {
      try {
        const r = await fetch('data/database.json');
        if (r.ok) {
          db = await r.json();
          localStorage.setItem(LS_KEY, JSON.stringify(db));
        }
      } catch(e){}
    }
    return { ok: true, mode: 'local', serverInfo: { localIp: location.hostname || 'localhost', port: location.port || 8080, mobileUrl: location.href } };
  }

  async function save() {
    localStorage.setItem(LS_KEY, JSON.stringify(db));
    if (useGas && GAS_URL) {
      try {
        await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(db)
        });
      } catch(e) {
        console.warn('Google Sheet save error:', e);
      }
    } else if (online) {
      try {
        await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(db)
        });
      } catch(e) {}
    }
  }

  async function poll() {
    if (useGas && GAS_URL) {
      try {
        const r = await fetch(GAS_URL, { cache: 'no-store', redirect: 'follow' });
        if (r.ok) {
          const d = await r.json();
          if (d && d.items && JSON.stringify(d) !== JSON.stringify(db)) {
            db = d;
            localStorage.setItem(LS_KEY, JSON.stringify(db));
            return true;
          }
        }
      } catch(e) {}
      return false;
    }
    if (!online) return false;
    try {
      const r = await fetch('/api/data', { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (JSON.stringify(d) !== JSON.stringify(db)) {
          db = d;
          localStorage.setItem(LS_KEY, JSON.stringify(db));
          return true;
        }
      }
    } catch(e) {}
    return false;
  }

  function getDB(){return db;}
  function getItems(){return db.items||[];}
  function getItem(id){return (db.items||[]).find(i=>i.id===id);}
  function getCheckouts(){return db.checkouts||[];}
  function getStockIns(){return db.stockIns||[];}
  function getCategories(){
    const itemCats = (db.items || []).map(i => i.category).filter(Boolean);
    const allCats = [...(db.categories || []), ...itemCats];
    return [...new Set(allCats)];
  }
  function getTeamMembers(){return db.teamMembers||[];}
  function getServerStatus(){return {online,serverInfo};}

  function _now(){
    const d=new Date(), p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function _rid(prefix){
    const d=new Date();
    return `${prefix}-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${Math.random().toString(36).substr(2,4).toUpperCase()}`;
  }

  async function addCheckout(r){
    const item=getItem(r.itemId);
    if(!item) throw new Error('품목을 찾을 수 없습니다.');
    if(item.currentStock<r.quantity) throw new Error(`재고 부족 (현재: ${item.currentStock}${item.unit})`);
    const rec={id:_rid('OUT'),itemId:item.id,itemName:item.name,quantity:Number(r.quantity),date:r.date||_now(),team:r.team||'',requester:r.requester||'',recipient:r.recipient||'',purpose:r.purpose||'',memo:r.memo||''};
    item.currentStock-=rec.quantity;
    db.checkouts.unshift(rec);
    await save();
    return {record:rec,remaining:item.currentStock,item};
  }

  async function cancelCheckout(id){
    const idx=db.checkouts.findIndex(c=>c.id===id);
    if(idx===-1) throw new Error('반출 기록을 찾을 수 없습니다.');
    const t=db.checkouts[idx], item=getItem(t.itemId);
    if(item) item.currentStock+=t.quantity;
    db.checkouts.splice(idx,1);
    await save();
  }

  async function addStockIn(r){
    const item=getItem(r.itemId);
    if(!item) throw new Error('품목을 찾을 수 없습니다.');
    const rec={id:_rid('IN'),itemId:item.id,itemName:item.name,quantity:Number(r.quantity),date:r.date||_now(),supplier:r.supplier||'',manager:r.manager||'',memo:r.memo||''};
    item.currentStock+=rec.quantity;
    db.stockIns.unshift(rec);
    await save();
    return {record:rec,updatedStock:item.currentStock};
  }

  async function addItem(d){
    const id='ITEM-'+String(db.items.length+1).padStart(3,'0');
    const qty=Number(d.initialStock)||0;
    const item={id,name:d.name.trim(),category:d.category||'기타',unit:d.unit||'개',currentStock:qty,safeStock:Number(d.safeStock)||10,location:d.location||'',unitCost:Number(d.unitCost)||0,description:d.description||''};
    db.items.push(item);
    if(qty>0) db.stockIns.unshift({id:'IN-INIT-'+id,itemId:id,itemName:item.name,quantity:qty,date:_now(),supplier:d.supplier||'초기 등록',manager:d.manager||'',memo:'신규 품목 기초 재고'});
    await save(); return item;
  }

  async function addTeamMember(name,team){
    if(!name) return;
    if(!db.teamMembers.some(m=>m.name===name)){db.teamMembers.push({name,team:team||'영업팀'});await save();}
  }

  function exportExcel(){
    if(typeof XLSX==='undefined'){alert('엑셀 라이브러리 로딩 중입니다.');return;}
    const wb=XLSX.utils.book_new();
    const ws1=XLSX.utils.json_to_sheet(db.items.map((i,n)=>({
      '번호':n+1,'품목코드':i.id,'품목명':i.name,'카테고리':i.category,'단위':i.unit,
      '현재고':i.currentStock,'안전재고':i.safeStock,'상태':i.currentStock<=i.safeStock?'부족':'여유',
      '보관위치':i.location,'단가':i.unitCost,'총액':i.currentStock*i.unitCost,'설명':i.description
    })));
    XLSX.utils.book_append_sheet(wb,ws1,'재고현황');
    const ws2=XLSX.utils.json_to_sheet(db.checkouts.map((c,n)=>({
      '번호':n+1,'반출번호':c.id,'일시':c.date,'품목':c.itemName,'수량':c.quantity,
      '반출자':c.requester,'팀':c.team,'대상':c.recipient,'목적':c.purpose,'메모':c.memo
    })));
    XLSX.utils.book_append_sheet(wb,ws2,'반출일지');
    const ws3=XLSX.utils.json_to_sheet(db.stockIns.map((s,n)=>({
      '번호':n+1,'입고번호':s.id,'일시':s.date,'품목':s.itemName,'수량':s.quantity,
      '공급처':s.supplier,'담당자':s.manager,'메모':s.memo
    })));
    XLSX.utils.book_append_sheet(wb,ws3,'입고이력');
    XLSX.writeFile(wb,`판촉물_관리대장_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  function exportJson(){
    const a=document.createElement('a');
    a.href='data:text/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(db,null,2));
    a.download=`판촉물_백업_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  }

  async function importJson(text){
    const parsed=JSON.parse(text);
    if(!parsed.items) throw new Error('유효하지 않은 파일');
    db=parsed; await save();
  }

  return {init,poll,getDB,getItems,getItem,getCheckouts,getStockIns,getCategories,getTeamMembers,getServerStatus,addCheckout,cancelCheckout,addStockIn,addItem,addTeamMember,exportExcel,exportJson,importJson};
})();
