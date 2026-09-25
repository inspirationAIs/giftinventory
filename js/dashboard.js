// ========== 대시보드 모듈 ==========
const Dashboard = (function() {
  let charts = {};

  function init() {
    renderKPIs();
    renderCharts();
    renderFeed();
    renderQR();
  }
  function refresh() {
    renderKPIs();
    renderCharts();
    renderFeed();
  }

  /* KPI 카드 */
  function renderKPIs() {
    const items = Storage.getItems(), co = Storage.getCheckouts();
    const totalKinds = items.length;
    const totalQty = items.reduce((s,i) => s + (i.currentStock||0), 0);
    const low = items.filter(i => i.currentStock <= i.safeStock);
    const cm = new Date().toISOString().slice(0,7);
    const monthOut = co.filter(c => c.date.startsWith(cm)).reduce((s,c) => s+(c.quantity||0), 0);
    const asset = items.reduce((s,i) => s + (i.currentStock||0)*(i.unitCost||0), 0);

    setText('kpi-kinds', totalKinds + '종');
    setText('kpi-stock', totalQty.toLocaleString() + '개');
    setText('kpi-month', monthOut.toLocaleString() + '개');
    setText('kpi-low', low.length + '종');
    setText('kpi-asset', Math.round(asset/10000).toLocaleString() + '만원');

    const badge = document.getElementById('kpi-low-badge');
    if (badge) {
      if (low.length > 0) {
        badge.textContent = low.length + '종 발주 필요';
        badge.className = 'text-xs px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700 animate-pulse';
      } else {
        badge.textContent = '모두 안전';
        badge.className = 'text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700';
      }
    }
  }

  function setText(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

  /* Chart.js 차트 */
  function renderCharts() {
    if (typeof Chart === 'undefined') return;
    stockBar();
    trendLine();
    catDonut();
    repsBar();
  }

  function stockBar() {
    const ctx = document.getElementById('ch-stock')?.getContext('2d');
    if (!ctx) return;
    const items = Storage.getItems();
    const labels = items.map(i => i.name.length > 10 ? i.name.slice(0,9)+'..' : i.name);
    const bg = items.map(i => i.currentStock<=0?'#ef4444':i.currentStock<=i.safeStock?'#f59e0b':'#3b82f6');
    if (charts.stock) charts.stock.destroy();
    charts.stock = new Chart(ctx, {
      type:'bar',
      data:{ labels, datasets:[
        { label:'현재고', data:items.map(i=>i.currentStock), backgroundColor:bg, borderRadius:6 },
        { label:'안전재고', data:items.map(i=>i.safeStock), backgroundColor:'#cbd5e1', borderRadius:6 }
      ]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top',labels:{boxWidth:12,font:{size:11}}}}, scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:'#f1f5f9'}}} }
    });
  }

  function trendLine() {
    const ctx = document.getElementById('ch-trend')?.getContext('2d');
    if (!ctx) return;
    const co = Storage.getCheckouts();
    const days = {};
    for (let i=6;i>=0;i--) { const d=new Date(); d.setDate(d.getDate()-i); days[d.toISOString().slice(0,10)]=0; }
    co.forEach(c => { const k=c.date.slice(0,10); if(days[k]!==undefined) days[k]+=c.quantity||0; });
    const labels = Object.keys(days).map(k=>k.slice(5));
    if (charts.trend) charts.trend.destroy();
    const g = ctx.createLinearGradient(0,0,0,200);
    g.addColorStop(0,'rgba(37,99,235,0.3)'); g.addColorStop(1,'rgba(37,99,235,0)');
    charts.trend = new Chart(ctx, {
      type:'line',
      data:{ labels, datasets:[{ label:'반출', data:Object.values(days), borderColor:'#2563eb', backgroundColor:g, fill:true, tension:0.35, borderWidth:2.5, pointBackgroundColor:'#1d4ed8', pointRadius:4 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'#f1f5f9'}}} }
    });
  }

  function catDonut() {
    const ctx = document.getElementById('ch-cat')?.getContext('2d');
    if (!ctx) return;
    const map = {};
    Storage.getItems().forEach(i => { map[i.category] = (map[i.category]||0) + (i.currentStock||0); });
    const colors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#64748b'];
    if (charts.cat) charts.cat.destroy();
    charts.cat = new Chart(ctx, {
      type:'doughnut',
      data:{ labels:Object.keys(map), datasets:[{ data:Object.values(map), backgroundColor:colors.slice(0,Object.keys(map).length), borderWidth:2, borderColor:'#fff' }] },
      options:{ responsive:true, maintainAspectRatio:false, cutout:'68%', plugins:{legend:{position:'right',labels:{boxWidth:10,font:{size:11}}}} }
    });
  }

  function repsBar() {
    const ctx = document.getElementById('ch-reps')?.getContext('2d');
    if (!ctx) return;
    const map = {};
    Storage.getCheckouts().forEach(c => { const r=c.requester||'미지정'; map[r]=(map[r]||0)+(c.quantity||0); });
    const sorted = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5);
    if (charts.reps) charts.reps.destroy();
    charts.reps = new Chart(ctx, {
      type:'bar',
      data:{ labels:sorted.map(s=>s[0]), datasets:[{ label:'반출(개)', data:sorted.map(s=>s[1]), backgroundColor:'#6366f1', borderRadius:6 }] },
      options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{stepSize:1}},y:{grid:{display:false}}} }
    });
  }

  /* 최근 활동 피드 */
  function renderFeed() {
    const el = document.getElementById('feed-list');
    if (!el) return;
    const co = Storage.getCheckouts().slice(0,4).map(c=>({type:'out',date:c.date,d:c}));
    const si = Storage.getStockIns().slice(0,3).map(s=>({type:'in',date:s.date,d:s}));
    const all = [...co,...si].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
    if (!all.length) { el.innerHTML='<p class="text-xs text-slate-400 py-3 text-center">활동 내역 없음</p>'; return; }
    el.innerHTML = all.map(a => {
      if (a.type==='out') {
        const c=a.d;
        return `<div class="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50">
          <div class="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><i data-lucide="arrow-up-right" class="w-3.5 h-3.5"></i></div>
          <div class="flex-1 min-w-0"><div class="flex justify-between text-[11px]"><span class="font-bold text-slate-800">${c.requester}</span><span class="text-slate-400">${c.date.slice(5)}</span></div>
          <div class="text-xs text-slate-600"><span class="text-blue-700 font-semibold">[${c.recipient}]</span> ${c.itemName} ${c.quantity}개 반출</div></div></div>`;
      } else {
        const s=a.d;
        return `<div class="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50">
          <div class="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><i data-lucide="download" class="w-3.5 h-3.5"></i></div>
          <div class="flex-1 min-w-0"><div class="flex justify-between text-[11px]"><span class="font-bold text-emerald-800">${s.supplier}</span><span class="text-slate-400">${s.date.slice(5)}</span></div>
          <div class="text-xs text-slate-600">${s.itemName} ${s.quantity}개 입고</div></div></div>`;
      }
    }).join('');
    lucide.createIcons();
  }

  /* QR 코드 */
  function renderQR() {
    const st = Storage.getServerStatus();
    let url = st.serverInfo.mobileUrl;
    if (!url || url.includes('localhost') || url.startsWith('file://'))
      url = 'http://' + st.serverInfo.localIp + ':' + (st.serverInfo.port || 8080);
    setText('mobile-url', url);
    const qr = document.getElementById('qr-box');
    if (qr && typeof QRCode !== 'undefined') {
      qr.innerHTML = '';
      new QRCode(qr, { text:url, width:130, height:130, colorDark:'#0f172a', colorLight:'#fff', correctLevel:QRCode.CorrectLevel.M });
    }
  }

  return { init, refresh, renderQR };
})();
