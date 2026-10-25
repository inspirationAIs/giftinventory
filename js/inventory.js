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

    document.querySelectorAll('.file-excel-sync').forEach(fi => fi.onchange = handleExcelImport);

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

  /* ── 엑셀 업로드 → 재고현황 동기화 ── */
  let pendingRows = null;
  const COL_ALIASES = {
    id:['품목코드','코드','id','ID'],
    name:['품목명','품목','품명','name'],
    category:['카테고리','분류','category'],
    unit:['단위','unit'],
    currentStock:['현재고','잔여수량','잔여','잔량','재고수량','현재수량','재고','수량'],
    safeStock:['안전재고','안전수량'],
    location:['보관위치','위치','location'],
    unitCost:['단가','가격','unitCost'],
    description:['설명','비고','description'],
    purchaseQty:['구매수량','입고수량'],
    purchaseDate:['구매일','입고일','구매월']
  };
  const NUM_FIELDS = ['currentStock','safeStock','unitCost','purchaseQty'];
  const norm = s => String(s ?? '').replace(/\s/g, '');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  function toNum(v) {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(String(v).replace(/[^\d.-]/g, ''));
    return isNaN(n) ? 0 : Math.round(n);
  }

  function parseWorkbook(workbook) {
    // '재고현황' 시트 우선, 없으면 첫 번째 시트
    const sheetName = workbook.SheetNames.find(n => norm(n).includes('재고현황')) || workbook.SheetNames[0];
    const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', blankrows: false });
    if (!grid.length) throw new Error(`[${sheetName}] 시트에 데이터가 없습니다.`);

    // 머리글 행 자동 탐색 (상단 제목/안내 문구가 있어도 OK) — '품목/품목명/품목코드' 칸이 있는 첫 행
    const nameKeys = [...COL_ALIASES.name, ...COL_ALIASES.id];
    const hIdx = grid.slice(0, 20).findIndex(r => r.some(c => nameKeys.includes(norm(c))));
    if (hIdx === -1) throw new Error('엑셀에서 "품목" 또는 "품목명" 머리글을 찾을 수 없습니다.');
    const headers = grid[hIdx].map(norm);

    // 열 매핑: 별칭 우선순위대로 첫 번째로 일치하는 열 사용
    const map = {};
    Object.entries(COL_ALIASES).forEach(([field, aliases]) => {
      for (const a of aliases) {
        const idx = headers.indexOf(norm(a));
        if (idx !== -1 && !Object.values(map).includes(idx)) { map[field] = idx; break; }
      }
    });

    const rows = [];
    let lastDate = '';
    grid.slice(hIdx + 1).forEach(r => {
      const row = {};
      Object.entries(map).forEach(([field, idx]) => {
        const v = r[idx];
        row[field] = NUM_FIELDS.includes(field) ? toNum(v) : String(v ?? '').trim();
      });
      // 병합된 '구매일' 칸은 아래 행으로 채우기
      if (map.purchaseDate !== undefined) { if (row.purchaseDate) lastDate = row.purchaseDate; else row.purchaseDate = lastDate; }
      if (!row.name && !row.id) return; // 빈 줄 건너뛰기
      if (/^(합계|소계|총계|total)$/i.test(norm(row.name))) return;

      // 구매일/구매수량 → 설명에 기록 (설명 열이 없을 때)
      if (map.description === undefined && (row.purchaseDate || row.purchaseQty)) {
        row.description = [row.purchaseDate && `구매 ${row.purchaseDate}`, row.purchaseQty && `구매수량 ${row.purchaseQty}`].filter(Boolean).join(' · ');
      }
      // 안전재고 열이 없으면: 구매수량의 20% (최소 1)
      if (map.safeStock === undefined) row.safeStockDefault = row.purchaseQty ? Math.max(1, Math.round(row.purchaseQty * 0.2)) : 1;
      delete row.purchaseQty; delete row.purchaseDate;
      rows.push(row);
    });
    if (!rows.length) throw new Error('반영할 품목 행이 없습니다.');
    return { sheetName, rows, mapped: Object.keys(map) };
  }

  function handleExcelImport(e) {
    const input = e.target;
    const file = input.files[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') { App.toast('엑셀 라이브러리가 로드되지 않았습니다.', 'error'); return; }

    const reader = new FileReader();
    reader.onload = function(ev) {
      try {
        const workbook = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
        const parsed = parseWorkbook(workbook);
        pendingRows = parsed.rows;
        openSyncPreview(file.name, parsed);
      } catch (error) {
        console.error(error);
        App.toast(error.message || '엑셀 파일 처리 중 오류가 발생했습니다.', 'error');
        alert('엑셀 업로드 실패\n\n' + (error.message || '엑셀 파일 처리 중 오류가 발생했습니다.'));
      } finally {
        input.value = ''; // 같은 파일 재선택 허용
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function openSyncPreview(fileName, parsed) {
    const modal = document.getElementById('modal-excel-sync');
    if (!modal) return;
    const p = Storage.previewInventorySync(parsed.rows);
    const fmt = (f, v) => NUM_FIELDS.includes(f) ? Number(v||0).toLocaleString() : esc(v || '-');

    document.getElementById('xs-file').textContent = `${fileName} · [${parsed.sheetName}] 시트 · ${parsed.rows.length}행`;
    document.getElementById('xs-summary').innerHTML = [
      ['변경', p.updates.length, 'bg-blue-50 text-blue-700 border-blue-200'],
      ['신규', p.adds.length, 'bg-emerald-50 text-emerald-700 border-emerald-200'],
      ['동일', p.same.length, 'bg-slate-50 text-slate-600 border-slate-200'],
      ['엑셀에 없음', p.missing.length, 'bg-amber-50 text-amber-700 border-amber-200']
    ].map(([l, n, c]) => `<div class="rounded-xl border p-2 text-center ${c}"><div class="text-lg font-black">${n}</div><div class="text-[11px] font-semibold">${l}</div></div>`).join('');

    let html = '';
    p.updates.forEach(u => {
      html += `<tr class="border-b border-slate-100"><td class="px-2 py-1.5"><span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">변경</span></td>
        <td class="px-2 py-1.5 font-semibold">${esc(u.item.name)}</td>
        <td class="px-2 py-1.5">${u.changes.map(c => `<div><span class="text-slate-400">${c.label}:</span> <span class="line-through text-slate-400">${fmt(c.field, c.from)}</span> → <b class="${c.field==='currentStock'?'text-blue-700':''}">${fmt(c.field, c.to)}</b></div>`).join('')}</td></tr>`;
    });
    p.adds.forEach(r => {
      html += `<tr class="border-b border-slate-100"><td class="px-2 py-1.5"><span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">신규</span></td>
        <td class="px-2 py-1.5 font-semibold">${esc(r.name || r.id)}</td>
        <td class="px-2 py-1.5">현재고 <b>${fmt('currentStock', r.currentStock)}</b>${r.category ? ' · ' + esc(r.category) : ''}</td></tr>`;
    });
    p.missing.forEach(i => {
      html += `<tr class="border-b border-slate-100 xs-missing"><td class="px-2 py-1.5"><span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">없음</span></td>
        <td class="px-2 py-1.5 font-semibold">${esc(i.name)}</td>
        <td class="px-2 py-1.5 text-slate-400">엑셀에 없는 품목 (기본: 그대로 유지)</td></tr>`;
    });
    document.getElementById('xs-tbody').innerHTML = html || `<tr><td colspan="3" class="py-6 text-center text-slate-400">변경 사항이 없습니다. 웹사이트 재고가 엑셀과 동일합니다.</td></tr>`;

    const rmWrap = document.getElementById('xs-remove-wrap');
    const rm = document.getElementById('xs-remove');
    // 기존 품목과 하나도 겹치지 않으면(=새 장부로 교체) 기존 품목 삭제를 기본 선택
    rm.checked = p.missing.length > 0 && (p.updates.length + p.same.length === 0);
    rmWrap.classList.toggle('hidden', !p.missing.length);

    const apply = document.getElementById('xs-apply');
    apply.disabled = !(p.updates.length || p.adds.length || p.missing.length);
    apply.onclick = applySync;

    modal.classList.remove('hidden'); modal.classList.add('flex');
    lucide.createIcons();
  }

  async function applySync() {
    if (!pendingRows) return;
    const removeMissing = document.getElementById('xs-remove').checked;
    if (removeMissing && !confirm('엑셀에 없는 품목을 웹사이트에서 삭제합니다. 계속할까요?')) return;
    const btn = document.getElementById('xs-apply');
    btn.disabled = true; btn.textContent = '반영 중…';
    try {
      const r = await Storage.applyInventorySync(pendingRows, { removeMissing });
      pendingRows = null;
      closeModal('modal-excel-sync');
      const rmTxt = removeMissing && r.missing.length ? `, 삭제 ${r.missing.length}건` : '';
      App.toast(`✅ 엑셀 반영 완료! (변경 ${r.updates.length}건, 신규 ${r.adds.length}건${rmTxt})`, 'success');
      renderCatFilter(); render(); renderStockInLogs(); Checkout.renderItems(); Dashboard.refresh();
    } catch (e) {
      console.error(e);
      App.toast('반영 중 오류: ' + e.message, 'error');
    } finally {
      btn.textContent = '재고현황에 반영';
    }
  }

  return { init, render, renderStockInLogs, openStockInModal, openNewItemModal, closeModal, handleExcelImport };
})();
