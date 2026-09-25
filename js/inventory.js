// ========== 재고 현황 & 입고 관리 모듈 ==========
const Inventory = (function() {
  let selCat = 'all', selStatus = 'all', search = '';

  function init() {
    bindEvents();
    renderCatFilter();
    render();
    renderStockInLogs();
  }

  function bindEvents() {
    const si = document.getElementById('inv-search');
    if (si) si.oninput = e => { search = e.target.value.toLowerCase().trim(); render(); };
    const sf = document.getElementById('inv-status');
    if (sf) sf.onchange = e => { selStatus = e.target.value; render(); };

    const btnNew = document.getElementById('btn-new-item');
    if (btnNew) btnNew.onclick = openNewItemModal;
    const btnStockIn = document.getElementById('btn-stockin');
    if (btnStockIn) btnStockIn.onclick = () => openStockInModal();

    const fiExcel = document.getElementById('file-excel-import');
    if (fiExcel) fiExcel.onchange = handleExcelImport;

    const fNew = document.getElementById('form-new-item');
    if (fNew) fNew.onsubmit = handleNewItem;
    const fSI = document.getElementById('form-stockin');
    if (fSI) fSI.onsubmit = handleStockIn;

    document.querySelectorAll('.si-quick').forEach(b => b.onclick = () => {
      const inp = document.getElementById('si-qty');
      inp.value = (parseInt(inp.value)||0) + parseInt(b.dataset.add);
    });

    document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeModal(b.dataset.close));
  }

  /* 카테고리 필터 */
  function renderCatFilter() {
    const el = document.getElementById('cat-filters');
    if (!el) return;
    const cats = ['all', ...Storage.getCategories()];
    el.innerHTML = cats.map(c => {
      const label = c === 'all' ? '전체' : c;
      return `<button data-cat="${c}" class="cat-btn px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${selCat===c?'bg-slate-900 text-white shadow-sm':'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}">${label}</button>`;
    }).join('');
    el.querySelectorAll('.cat-btn').forEach(b => b.onclick = () => { selCat=b.dataset.cat; renderCatFilter(); render(); });
  }

  /* 재고 카드 그리드 */
  function render() {
    const el = document.getElementById('inv-grid'), empty = document.getElementById('inv-empty');
    if (!el) return;
    let items = Storage.getItems();
    if (selCat !== 'all') items = items.filter(i => i.category === selCat);
    if (search) items = items.filter(i => i.name.toLowerCase().includes(search)||i.category.toLowerCase().includes(search)||(i.location||'').toLowerCase().includes(search));
    if (selStatus === 'low') items = items.filter(i => i.currentStock <= i.safeStock);
    else if (selStatus === 'normal') items = items.filter(i => i.currentStock > i.safeStock);

    if (!items.length) { el.innerHTML=''; if(empty) empty.classList.remove('hidden'); return; }
    if(empty) empty.classList.add('hidden');

    el.innerHTML = items.map(i => {
      const low = i.currentStock<=i.safeStock, out = i.currentStock<=0;
      const pct = Math.min(100, (i.currentStock / (i.safeStock*2||20)) * 100);
      let badgeCls='bg-emerald-50 text-emerald-700 border-emerald-200', badgeTxt='여유', barCls='bg-emerald-500';
      if (out) { badgeCls='bg-red-50 text-red-700 border-red-200 animate-pulse'; badgeTxt='품절'; barCls='bg-red-500'; }
      else if (low) { badgeCls='bg-amber-50 text-amber-700 border-amber-200'; badgeTxt='부족'; barCls='bg-amber-500'; }

      return `<div class="card p-5 flex flex-col justify-between">
        <div>
          <div class="flex justify-between mb-3"><span class="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg">${i.category}</span><span class="text-xs font-semibold px-2 py-0.5 rounded-full border ${badgeCls}">${badgeTxt}</span></div>
          <h4 class="text-sm font-bold text-slate-800 mb-1 line-clamp-2">${i.name}</h4>
          <p class="text-xs text-slate-500 mb-3 line-clamp-1">${i.description||''}</p>
          <div class="bg-slate-50 rounded-xl p-3 mb-3 border border-slate-100">
            <div class="flex justify-between mb-1"><span class="text-xs text-slate-500">현재고</span><div><span class="text-xl font-black ${out?'text-red-600':low?'text-amber-600':'text-slate-900'}">${i.currentStock.toLocaleString()}</span><span class="text-xs text-slate-500 ml-0.5">${i.unit}</span></div></div>
            <div class="w-full bg-slate-200 rounded-full h-1.5 mb-1"><div class="${barCls} h-1.5 rounded-full transition-all" style="width:${pct}%"></div></div>
            <div class="flex justify-between text-[11px] text-slate-400"><span>안전: ${i.safeStock}${i.unit}</span><span>${i.location||''}</span></div>
          </div>
          <div class="flex justify-between text-xs text-slate-500 px-1 mb-3"><span>단가: ${(i.unitCost||0).toLocaleString()}원</span><span>총액: ${(i.currentStock*(i.unitCost||0)).toLocaleString()}원</span></div>
        </div>
        <div class="pt-3 border-t border-slate-100 flex gap-2">
          <button data-id="${i.id}" class="si-btn flex-1 flex items-center justify-center gap-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold"><i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>입고</button>
          <button data-id="${i.id}" class="co-btn py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold">반출</button>
        </div>
      </div>`;
    }).join('');

    el.querySelectorAll('.si-btn').forEach(b => b.onclick = () => openStockInModal(b.dataset.id));
    el.querySelectorAll('.co-btn').forEach(b => b.onclick = () => { App.switchTab('checkout'); const sel=document.getElementById('co-item-sel'); if(sel){sel.value=b.dataset.id;} });
    lucide.createIcons();
  }

  /* ── 모달: 추가 입고 ── */
  function openStockInModal(preId) {
    const modal = document.getElementById('modal-stockin');
    const sel = document.getElementById('si-item-sel');
    if (!modal) return;
    const items = Storage.getItems();
    if (sel) sel.innerHTML = items.map(i => `<option value="${i.id}" ${i.id===preId?'selected':''}>${i.name} (${i.currentStock}${i.unit})</option>`).join('');
    document.getElementById('si-qty').value = 10;
    const dt = document.getElementById('si-date');
    if (dt) dt.value = new Date().toISOString().slice(0,16);
    document.getElementById('si-supplier').value = '본사 마케팅총괄팀';
    document.getElementById('si-manager').value = Storage.getTeamMembers()[0]?.name || '';
    document.getElementById('si-memo').value = '';
    modal.classList.remove('hidden'); modal.classList.add('flex');
  }

  async function handleStockIn(e) {
    e.preventDefault();
    const itemId = document.getElementById('si-item-sel').value;
    const qty = parseInt(document.getElementById('si-qty').value);
    if (!qty || qty<=0) { App.toast('수량을 입력하세요.','warning'); return; }
    try {
      const r = await Storage.addStockIn({
        itemId, quantity: qty,
        date: (document.getElementById('si-date').value||'').replace('T',' '),
        supplier: document.getElementById('si-supplier').value.trim(),
        manager: document.getElementById('si-manager').value.trim(),
        memo: document.getElementById('si-memo').value.trim()
      });
      closeModal('modal-stockin');
      App.toast(`🎉 ${r.record.itemName} ${qty}개 입고 완료! (총 ${r.updatedStock}개)`,'success');
      render(); renderStockInLogs(); Checkout.renderItems(); Dashboard.refresh();
    } catch(e) { App.toast(e.message,'error'); }
  }

  /* ── 모달: 신규 품목 ── */
  function openNewItemModal() {
    const modal = document.getElementById('modal-newitem');
    if (!modal) return;
    document.getElementById('form-new-item')?.reset();
    const catSel = document.getElementById('ni-cat');
    if (catSel) catSel.innerHTML = Storage.getCategories().map(c => `<option value="${c}">${c}</option>`).join('');
    modal.classList.remove('hidden'); modal.classList.add('flex');
  }

  async function handleNewItem(e) {
    e.preventDefault();
    const name = document.getElementById('ni-name').value.trim();
    if (!name) { App.toast('품목명을 입력하세요.','warning'); return; }
    try {
      const item = await Storage.addItem({
        name, category: document.getElementById('ni-cat').value,
        unit: document.getElementById('ni-unit').value.trim()||'개',
        initialStock: parseInt(document.getElementById('ni-init').value)||0,
        safeStock: parseInt(document.getElementById('ni-safe').value)||10,
        location: document.getElementById('ni-loc').value.trim(),
        unitCost: parseInt(document.getElementById('ni-cost').value)||0,
        description: document.getElementById('ni-desc').value.trim()
      });
      closeModal('modal-newitem');
      App.toast(`[${item.name}] 품목 등록 완료!`,'success');
      renderCatFilter(); render(); renderStockInLogs(); Checkout.renderItems(); Dashboard.refresh();
    } catch(e) { App.toast(e.message,'error'); }
  }

  function closeModal(id) { const m=document.getElementById(id); if(m){m.classList.add('hidden');m.classList.remove('flex');} }

  /* 입고 이력 테이블 */
  function renderStockInLogs() {
    const tbody = document.getElementById('si-tbody'), empty = document.getElementById('si-empty');
    if (!tbody) return;
    const logs = Storage.getStockIns();
    if (!logs.length) { tbody.innerHTML=''; if(empty) empty.classList.remove('hidden'); return; }
    if(empty) empty.classList.add('hidden');
    tbody.innerHTML = logs.map(s => `
      <tr class="border-b border-slate-100 hover:bg-slate-50/80">
        <td class="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">${s.date}</td>
        <td class="px-3 py-2.5 text-xs font-semibold">${s.itemName}</td>
        <td class="px-3 py-2.5 text-xs font-bold text-emerald-600 text-center">+${s.quantity}</td>
        <td class="px-3 py-2.5 text-xs">${s.supplier}</td>
        <td class="px-3 py-2.5 text-xs">${s.manager}</td>
        <td class="px-3 py-2.5 text-xs text-slate-400 truncate max-w-[120px]">${s.memo||'-'}</td>
      </tr>`).join('');
  }

  /* 엑셀 임포트 */
  function handleExcelImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') { App.toast('엑셀 라이브러리가 로드되지 않았습니다.', 'error'); return; }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet);
        
        if (!rows || rows.length === 0) {
          App.toast('엑셀 파일에 데이터가 없습니다.', 'warning');
          return;
        }

        let count = 0;
        for (const row of rows) {
          const name = row['품목명'] || row['name'] || row['품목'];
          if (!name) continue;
          
          await Storage.addItem({
            name: name,
            category: row['카테고리'] || row['category'] || '기타',
            unit: row['단위'] || row['unit'] || '개',
            initialStock: parseInt(row['수량'] || row['초기수량'] || row['재고'] || row['현재고']) || 0,
            safeStock: parseInt(row['안전재고']) || 10,
            location: row['보관위치'] || row['위치'] || '',
            unitCost: parseInt(row['단가'] || row['가격']) || 0,
            description: row['설명'] || row['비고'] || ''
          });
          count++;
        }
        
        App.toast(`총 ${count}개의 품목이 성공적으로 등록되었습니다.`, 'success');
        renderCatFilter(); render(); renderStockInLogs(); Checkout.renderItems(); Dashboard.refresh();
      } catch(error) {
        console.error(error);
        App.toast('엑셀 파일 처리 중 오류가 발생했습니다.', 'error');
      } finally {
        document.getElementById('file-excel-import').value = ''; // Reset input
      }
    };
    reader.readAsArrayBuffer(file);
  }

  return { init, render, renderStockInLogs, openStockInModal, openNewItemModal, closeModal, handleExcelImport };
})();
