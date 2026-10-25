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

    setText('kpi-kinds', totalKinds + '종');
    setText('kpi-stock', totalQty.toLocaleString() + '개');
    setText('kpi-month', monthOut.toLocaleString() + '개');
    setText('kpi-low', low.length + '종');

    const badge = document.getElementById('kpi-low-badge');
    if (badge) {
      if (low.length > 0) {
        badge.textContent = low.length + '종 발주 필요 (클릭)';
        badge.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-red-100 text-red-700 animate-pulse cursor-pointer hover:bg-red-200 transition-colors';
        badge.onclick = openLowStockModal;
      } else {
        badge.textContent = '모두 안전';
        badge.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700';
        badge.onclick = null;
      }
    }
  }

  /* ── 재고 부족 품목 모달 ── */
  function openLowStockModal() {
    const modal = document.getElementById('modal-low-stock');
    const tbody = document.getElementById('low-stock-tbody');
    const countBadge = document.getElementById('low-stock-count-badge');
    if (!modal || !tbody) return;

    const items = Storage.getItems();
    const low = items.filter(i => (i.currentStock || 0) <= (i.safeStock || 0));

    // 품절(0개 이하)을 상단에, 그다음 현재고 오름차순 정렬
    low.sort((a, b) => (a.currentStock || 0) - (b.currentStock || 0));

    if (countBadge) countBadge.textContent = low.length + '종';

    if (!low.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-slate-400 text-xs">현재 부족한 재고가 없습니다. 모든 품목이 안전재고 이상입니다! 🎉</td></tr>`;
    } else {
      tbody.innerHTML = low.map(i => {
        const isOut = (i.currentStock || 0) <= 0;
        const statusBadge = isOut
          ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">품절</span>`
          : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">부족</span>`;
        const stockText = isOut
          ? `<span class="text-rose-600 font-black">0 ${i.unit||'개'}</span>`
          : `<span class="text-amber-600 font-extrabold">${i.currentStock} ${i.unit||'개'}</span>`;

        return `
          <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
            <td class="px-3 py-2.5">
              <div class="font-bold text-slate-800 text-xs">${i.name}</div>
              <div class="text-[11px] text-slate-400 truncate max-w-[200px]">${i.description || i.category || ''}</div>
            </td>
            <td class="px-3 py-2.5 text-center text-xs whitespace-nowrap">${stockText}</td>
            <td class="px-3 py-2.5 text-center text-xs text-slate-500 whitespace-nowrap">${i.safeStock || 0} ${i.unit||'개'}</td>
            <td class="px-3 py-2.5 text-center whitespace-nowrap">${statusBadge}</td>
            <td class="px-3 py-2.5 text-right whitespace-nowrap">
              <button data-id="${i.id}" class="low-stock-in-btn px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold border border-blue-200 transition-colors">입고</button>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.low-stock-in-btn').forEach(btn => {
        btn.onclick = () => {
          closeModal('modal-low-stock');
          Inventory.openStockInModal(btn.dataset.id);
        };
      });
    }

    const btnGo = document.getElementById('btn-goto-inventory-low');
    if (btnGo) {
      btnGo.onclick = () => {
        closeModal('modal-low-stock');
        App.switchTab('inventory');
        const sel = document.getElementById('inv-status');
        if (sel) { sel.value = 'low'; Inventory.render(); }
      };
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    lucide.createIcons();
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
  }

  /* ── 1. 등록 품목 전체 목록 모달 ── */
  function openAllItemsModal() {
    const modal = document.getElementById('modal-all-items');
    const tbody = document.getElementById('all-items-tbody');
    const countBadge = document.getElementById('all-items-count-badge');
    const searchInp = document.getElementById('all-items-search');
    if (!modal || !tbody) return;

    const items = Storage.getItems();
    if (countBadge) countBadge.textContent = items.length + '종';

    function renderList(list) {
      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="py-10 text-center text-slate-400 text-xs">일치하는 품목이 없습니다.</td></tr>`;
        return;
      }
      tbody.innerHTML = list.map((i, idx) => {
        const isOut = (i.currentStock || 0) <= 0;
        const isLow = !isOut && (i.currentStock || 0) <= (i.safeStock || 0);
        let badge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">여유</span>`;
        if (isOut) badge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">품절</span>`;
        else if (isLow) badge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">부족</span>`;

        return `
          <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
            <td class="px-3 py-2 text-center text-slate-400 text-[11px]">${idx + 1}</td>
            <td class="px-3 py-2">
              <div class="font-bold text-slate-800 text-xs">${i.name}</div>
              <div class="text-[11px] text-slate-400 truncate max-w-[220px]">${i.description || i.category || ''}</div>
            </td>
            <td class="px-3 py-2 text-center text-xs font-bold ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-800'}">
              ${(i.currentStock || 0).toLocaleString()} <span class="text-[10px] font-normal text-slate-400">${i.unit || '개'}</span>
            </td>
            <td class="px-3 py-2 text-center whitespace-nowrap">${badge}</td>
          </tr>
        `;
      }).join('');
    }

    renderList(items);

    if (searchInp) {
      searchInp.value = '';
      searchInp.oninput = (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = items.filter(i => (i.name||'').toLowerCase().includes(q) || (i.description||'').toLowerCase().includes(q));
        renderList(filtered);
      };
    }

    const btnGo = document.getElementById('btn-goto-inventory-all');
    if (btnGo) {
      btnGo.onclick = () => {
        closeModal('modal-all-items');
        App.switchTab('inventory');
      };
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    lucide.createIcons();
  }

  /* ── 2. 총 재고 요약 현황판 모달 ── */
  function openTotalStockModal() {
    const modal = document.getElementById('modal-total-stock');
    if (!modal) return;

    const items = Storage.getItems();
    const totalQty = items.reduce((s, i) => s + (i.currentStock || 0), 0);
    const totalKinds = items.length;
    const outItems = items.filter(i => (i.currentStock || 0) <= 0);
    const lowItems = items.filter(i => (i.currentStock || 0) > 0 && (i.currentStock || 0) <= (i.safeStock || 0));
    const normalItems = items.filter(i => (i.currentStock || 0) > (i.safeStock || 0));

    setText('sum-total-qty', totalQty.toLocaleString() + '개');
    setText('sum-total-kinds', totalKinds + '종');
    setText('sum-normal-kinds', normalItems.length + '종');
    setText('sum-low-kinds', (lowItems.length + outItems.length) + '종');

    const normalPct = totalKinds ? Math.round((normalItems.length / totalKinds) * 100) : 0;
    const lowPct = totalKinds ? Math.round((lowItems.length / totalKinds) * 100) : 0;
    const outPct = totalKinds ? Math.max(0, 100 - normalPct - lowPct) : 0;

    const barEl = document.getElementById('sum-status-bar');
    if (barEl) {
      barEl.innerHTML = `
        <div class="h-2.5 rounded-l-full bg-emerald-500" style="width: ${normalPct}%" title="여유 ${normalItems.length}종 (${normalPct}%)"></div>
        <div class="h-2.5 bg-amber-500" style="width: ${lowPct}%" title="부족 ${lowItems.length}종 (${lowPct}%)"></div>
        <div class="h-2.5 rounded-r-full bg-rose-500" style="width: ${outPct}%" title="품절 ${outItems.length}종 (${outPct}%)"></div>
      `;
    }
    setText('sum-bar-legend', `여유 ${normalItems.length}종 (${normalPct}%) · 부족 ${lowItems.length}종 (${lowPct}%) · 품절 ${outItems.length}종 (${outPct}%)`);

    const top5 = [...items].sort((a, b) => (b.currentStock || 0) - (a.currentStock || 0)).slice(0, 5);
    const topEl = document.getElementById('sum-top5-list');
    if (topEl) {
      const maxStock = top5[0]?.currentStock || 1;
      topEl.innerHTML = top5.map((i, idx) => {
        const pct = Math.round(((i.currentStock || 0) / maxStock) * 100);
        return `
          <div class="space-y-1">
            <div class="flex justify-between text-xs">
              <span class="font-bold text-slate-800"><span class="text-emerald-600 font-extrabold mr-1.5">#${idx+1}</span>${i.name}</span>
              <span class="font-extrabold text-slate-900">${(i.currentStock||0).toLocaleString()} ${i.unit||'개'}</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div class="bg-emerald-500 h-1.5 rounded-full" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    const btnGo = document.getElementById('btn-goto-inventory-summary');
    if (btnGo) {
      btnGo.onclick = () => {
        closeModal('modal-total-stock');
        App.switchTab('inventory');
      };
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    lucide.createIcons();
  }

  /* ── 3. 이달 반출 내역 모달 ── */
  function openMonthOutModal() {
    const modal = document.getElementById('modal-month-out');
    const tbody = document.getElementById('month-out-tbody');
    const badge = document.getElementById('month-out-count-badge');
    if (!modal || !tbody) return;

    const cm = new Date().toISOString().slice(0, 7);
    const curMonthFormatted = `${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월`;
    setText('month-out-title-date', curMonthFormatted);

    const co = Storage.getCheckouts();
    const monthCo = co.filter(c => (c.date || '').startsWith(cm));
    const totalOutQty = monthCo.reduce((s, c) => s + (c.quantity || 0), 0);

    if (badge) badge.textContent = `총 ${totalOutQty}개 (${monthCo.length}건)`;

    if (!monthCo.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-slate-400 text-xs">이번 달(${curMonthFormatted}) 반출 내역이 아직 없습니다.</td></tr>`;
    } else {
      tbody.innerHTML = monthCo.map(c => `
        <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
          <td class="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">${(c.date || '').slice(5)}</td>
          <td class="px-3 py-2.5">
            <div class="font-bold text-slate-800 text-xs">${c.itemName}</div>
            <div class="text-[11px] text-slate-400">${c.memo || ''}</div>
          </td>
          <td class="px-3 py-2.5 text-center text-xs font-black text-indigo-600 whitespace-nowrap">${c.quantity}개</td>
          <td class="px-3 py-2.5 text-xs font-bold text-slate-700 whitespace-nowrap">${c.requester || '-'}</td>
          <td class="px-3 py-2.5 text-xs text-slate-600">
            <span class="text-blue-700 font-semibold">[${c.recipient || '-'}]</span> ${c.purpose || ''}
          </td>
        </tr>
      `).join('');
    }

    const btnGo = document.getElementById('btn-goto-checkout');
    if (btnGo) {
      btnGo.onclick = () => {
        closeModal('modal-month-out');
        App.switchTab('checkout');
      };
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    lucide.createIcons();
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
    const stockIns = Storage.getStockIns();
    const totalInMap = {};
    items.forEach(i => totalInMap[i.id] = 0);
    stockIns.forEach(s => {
      if (totalInMap[s.itemId] !== undefined) totalInMap[s.itemId] += (s.quantity || 0);
    });

    const labels = items.map(i => i.name.length > 10 ? i.name.slice(0,9)+'..' : i.name);
    const bg = items.map(i => i.currentStock<=0?'#ef4444':i.currentStock<=i.safeStock?'#f59e0b':'#e6007e');
    if (charts.stock) charts.stock.destroy();
    charts.stock = new Chart(ctx, {
      type:'bar',
      data:{ labels, datasets:[
        { label:'현재고', data:items.map(i=>i.currentStock), backgroundColor:bg, borderRadius:6 },
        { label:'총 입고 수량', data:items.map(i=>totalInMap[i.id]), backgroundColor:'#cbd5e1', borderRadius:6 }
      ]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:'#f1f5f9'}}} }
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
    g.addColorStop(0,'rgba(230,0,126,0.3)'); g.addColorStop(1,'rgba(230,0,126,0)');
    charts.trend = new Chart(ctx, {
      type:'line',
      data:{ labels, datasets:[{ label:'반출', data:Object.values(days), borderColor:'#e6007e', backgroundColor:g, fill:true, tension:0.35, borderWidth:2.5, pointBackgroundColor:'#e6007e', pointRadius:4 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'#f1f5f9'}}} }
    });
  }

  function catDonut() {
    const ctx = document.getElementById('ch-cat')?.getContext('2d');
    if (!ctx) return;
    const map = {};
    Storage.getItems().forEach(i => { map[i.category] = (map[i.category]||0) + (i.currentStock||0); });
    const colors = ['#e6007e','#222222','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#64748b'];
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
      data:{ labels:sorted.map(s=>s[0]), datasets:[{ label:'반출(개)', data:sorted.map(s=>s[1]), backgroundColor:'#111111', borderRadius:6 }] },
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

  return { init, refresh, renderQR, openLowStockModal, openAllItemsModal, openTotalStockModal, openMonthOutModal };
})();
