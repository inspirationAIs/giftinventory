// ========== 반출 일지 모듈 ==========
const Checkout = (function() {
  let selItem = null, selReq = '', selTeam = '';

  // 자연어 키워드 매핑
  const KW = [
    {kw:['우산','장우산','3단우산'],id:'ITEM-001'},
    {kw:['보조배터리','배터리','무선충전','맥세이프'],id:'ITEM-002'},
    {kw:['텀블러','보온병','스타벅스','스벅'],id:'ITEM-003'},
    {kw:['케이블','충전선','멀티케이블','c타입'],id:'ITEM-004'},
    {kw:['볼펜','다이어리','수첩'],id:'ITEM-005'},
    {kw:['디퓨저','방향제'],id:'ITEM-006'},
    {kw:['골프','골프공','볼마커'],id:'ITEM-007'},
    {kw:['물티슈','소독','티슈'],id:'ITEM-008'}
  ];

  function init() {
    bindEvents();
    renderReps();
    renderItems();
    renderLogs();
    const m = Storage.getTeamMembers();
    let savedRep = null;
    try { savedRep = JSON.parse(localStorage.getItem('promo_my_rep') || 'null'); } catch(e){}
    if (savedRep && m.some(x => x.name === savedRep.name)) {
      pickReq(savedRep.name, savedRep.team);
    } else if (m.length) {
      pickReq(m[0].name, m[0].team);
    }
  }

  function bindEvents() {
    // 스마트 입력
    const si = document.getElementById('smart-input');
    if (si) {
      si.addEventListener('input', e => parseSmart(e.target.value));
      si.addEventListener('keypress', e => { if (e.key==='Enter'){e.preventDefault();submitSmart();} });
    }
    const sb = document.getElementById('btn-smart');
    if (sb) sb.onclick = submitSmart;

    // 수량 +-
    const minus = document.getElementById('qty-minus'), plus = document.getElementById('qty-plus'), qtyIn = document.getElementById('co-qty');
    if (minus && plus && qtyIn) {
      minus.onclick = () => { let v=parseInt(qtyIn.value)||1; if(v>1) qtyIn.value=v-1; };
      plus.onclick = () => { qtyIn.value = (parseInt(qtyIn.value)||0)+1; };
    }
    document.querySelectorAll('.qty-chip').forEach(c => c.onclick = () => {
      const inp = document.getElementById('co-qty');
      inp.value = (parseInt(inp.value)||0) + parseInt(c.dataset.add);
    });

    // 목적 칩
    document.querySelectorAll('.purpose-chip').forEach(c => c.onclick = () => {
      document.querySelectorAll('.purpose-chip').forEach(x => { x.classList.remove('bg-blue-600','text-white'); x.classList.add('bg-slate-100','text-slate-700'); });
      c.classList.remove('bg-slate-100','text-slate-700'); c.classList.add('bg-blue-600','text-white');
      const inp = document.getElementById('co-purpose');
      if (inp) inp.value = c.dataset.purpose;
    });

    // 고객사 칩
    document.querySelectorAll('.client-chip').forEach(c => c.onclick = () => {
      const inp = document.getElementById('co-recipient');
      if (inp) { inp.value = c.dataset.client; inp.focus(); }
    });

    // 폼 제출
    const form = document.getElementById('co-form');
    if (form) form.onsubmit = handleSubmit;

    // 로그 검색/필터
    const search = document.getElementById('co-search');
    if (search) search.oninput = () => renderLogs();
    const filter = document.getElementById('co-filter');
    if (filter) filter.onchange = () => renderLogs();
  }

  /* ── 자연어 파서 ── */
  function parseSmart(text) {
    const box = document.getElementById('smart-preview');
    if (!text?.trim()) { if(box) box.classList.add('hidden'); return null; }
    let clean = text.trim(), qty = 1, foundId = null, matchedMember = null;

    // 1. 담당자(팀원 이름) 감지
    for (const m of Storage.getTeamMembers()) {
      if (clean.includes(m.name)) {
        matchedMember = m;
        clean = clean.replace(m.name, ' ').trim();
        break;
      }
    }

    // 2. 수량 감지
    const qm = clean.match(/(\d+)\s*(개|세트|팩|박스|ea)?/i);
    if (qm) { qty = parseInt(qm[1]); clean = clean.replace(qm[0],' ').trim(); }

    // 3. 품목 감지
    for (const r of KW) { for (const k of r.kw) { if (clean.includes(k)) { foundId=r.id; clean=clean.replace(k,' ').trim(); break; } } if(foundId) break; }
    if (!foundId) {
      for (const item of Storage.getItems()) {
        for (const w of item.name.split(' ')) { if(w.length>=2 && clean.includes(w)){foundId=item.id;clean=clean.replace(w,' ').trim();break;} }
        if(foundId)break;
      }
    }

    const matched = foundId ? Storage.getItem(foundId) : null;
    let recipient = clean.replace(/\s+/g,' ').trim() || '지정 고객사';
    const activeReq = matchedMember?.name || selReq || '미지정';

    if (box) {
      box.classList.remove('hidden');
      box.innerHTML = `<div class="flex items-center gap-1.5 text-xs font-semibold text-blue-700 mb-1"><i data-lucide="sparkles" class="w-3.5 h-3.5"></i>자동 감지 결과</div>
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-medium">담당: <b>${activeReq}</b></span>
          <span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">대상: <b>${recipient}</b></span>
          <span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">품목: <b>${matched?.name||'선택 필요'}</b></span>
          <span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">수량: <b>${qty}개</b></span>
        </div>`;
      lucide.createIcons();
    }
    return { recipient, itemId: foundId, quantity: qty, matchedMember };
  }

  async function submitSmart() {
    const inp = document.getElementById('smart-input');
    if (!inp?.value.trim()) { App.toast('입력란에 "황시은 구글 운영팀 우산 1개" 형식으로 입력하세요.','warning'); return; }
    const p = parseSmart(inp.value);
    if (!p?.itemId) { App.toast('품목을 인식하지 못했습니다. 품목명을 포함해 주세요.','warning'); return; }
    const item = Storage.getItem(p.itemId);
    if (!item) { App.toast('품목을 찾을 수 없습니다.','error'); return; }
    if (item.currentStock < p.quantity) { App.toast(`재고 부족 (${item.name}: ${item.currentStock}개)`,'error'); return; }
    const req = p.matchedMember?.name || selReq || Storage.getTeamMembers()[0]?.name || '담당자';
    const team = p.matchedMember?.team || selTeam || Storage.getTeamMembers()[0]?.team || '영업팀';
    try {
      await Storage.addCheckout({ itemId:item.id, quantity:p.quantity, recipient:p.recipient, requester:req, team, purpose:'스마트 간편 반출', memo:'[스마트입력] "'+inp.value.trim()+'"' });
      inp.value='';
      document.getElementById('smart-preview')?.classList.add('hidden');
      App.confetti();
      App.toast(`✅ [${req}] ${item.name} ${p.quantity}${item.unit} → ${p.recipient} 반출 완료!`,'success');
      renderItems(); renderLogs(); Dashboard.refresh(); Inventory.render();
    } catch(e) { App.toast(e.message,'error'); }
  }

  /* ── 담당자 선택 ── */
  function renderReps() {
    const el = document.getElementById('reps-box');
    if (!el) return;
    el.innerHTML = Storage.getTeamMembers().map(m =>
      `<button type="button" data-name="${m.name}" data-team="${m.team}" class="rep-btn px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selReq===m.name?'bg-blue-600 text-white border-blue-600 shadow-sm':'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}">${m.name} <span class="opacity-70 text-[10px]">(${m.team})</span></button>`
    ).join('');
    el.querySelectorAll('.rep-btn').forEach(b => b.onclick = () => pickReq(b.dataset.name, b.dataset.team));
  }

  function pickReq(name, team) {
    selReq = name; selTeam = team;
    try { localStorage.setItem('promo_my_rep', JSON.stringify({ name, team })); } catch(e){}
    const ri = document.getElementById('co-requester'), ti = document.getElementById('co-team');
    if (ri) ri.value = name; if (ti) ti.value = team;
    renderReps();
  }

  /* ── 품목 선택 카드 ── */
  function renderItems() {
    const el = document.getElementById('items-box');
    if (!el) return;
    const items = Storage.getItems();
    if (!selItem && items.length) selItem = items[0].id;

    el.innerHTML = items.map(i => {
      const sel = selItem===i.id, low = i.currentStock<=i.safeStock, out = i.currentStock<=0;
      return `<div data-id="${i.id}" class="item-card cursor-pointer p-2.5 rounded-xl border transition-all ${sel?'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20':'border-slate-200 bg-white hover:border-slate-300'} ${out?'opacity-50':''}">
        <div class="flex justify-between mb-1"><span class="text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">${i.category}</span><span class="text-xs font-bold ${out?'text-red-600':low?'text-amber-600':'text-emerald-600'}">${i.currentStock}${i.unit}</span></div>
        <div class="text-xs font-medium text-slate-800 line-clamp-1 mb-0.5">${i.name}</div>
        <div class="text-[11px] text-slate-400">${i.location||''} ${low&&!out?'<span class="text-red-600 font-medium">재고주의</span>':''}</div>
      </div>`;
    }).join('');

    el.querySelectorAll('.item-card').forEach(c => c.onclick = () => {
      const id=c.dataset.id, item=Storage.getItem(id);
      if(item?.currentStock<=0){App.toast(item.name+' 재고 없음','warning');return;}
      selItem=id; renderItems();
      const sel = document.getElementById('co-item-sel');
      if(sel) sel.value = id;
    });

    const sel = document.getElementById('co-item-sel');
    if (sel) sel.innerHTML = items.map(i => `<option value="${i.id}" ${i.id===selItem?'selected':''}>${i.name} (${i.currentStock}${i.unit})</option>`).join('');
  }

  /* ── 폼 제출 ── */
  async function handleSubmit(e) {
    e.preventDefault();
    const itemId = document.getElementById('co-item-sel')?.value || selItem;
    const qty = parseInt(document.getElementById('co-qty')?.value) || 1;
    const recipient = document.getElementById('co-recipient')?.value.trim();
    const requester = document.getElementById('co-requester')?.value.trim();
    const team = document.getElementById('co-team')?.value.trim();
    const purpose = document.getElementById('co-purpose')?.value.trim() || '고객 미팅';
    const memo = document.getElementById('co-memo')?.value.trim();

    if (!itemId) { App.toast('품목을 선택하세요.','warning'); return; }
    if (!recipient) { App.toast('전달 대상을 입력하세요.','warning'); document.getElementById('co-recipient')?.focus(); return; }
    if (!requester) { App.toast('반출자를 선택하세요.','warning'); return; }

    try {
      const r = await Storage.addCheckout({ itemId, quantity:qty, recipient, requester, team, purpose, memo });
      App.confetti();
      App.toast(`✅ 반출 완료! (${r.item.name} 잔여: ${r.remaining}${r.item.unit})`,'success');
      document.getElementById('co-qty').value = 1;
      document.getElementById('co-recipient').value = '';
      document.getElementById('co-memo').value = '';
      renderItems(); renderLogs(); Dashboard.refresh(); Inventory.render();
    } catch(e) { App.toast(e.message,'error'); }
  }

  /* ── 반출 일지 테이블 ── */
  function renderLogs() {
    const tbody = document.getElementById('co-tbody'), empty = document.getElementById('co-empty');
    if (!tbody) return;
    let logs = Storage.getCheckouts();
    const sv = document.getElementById('co-search')?.value.toLowerCase().trim();
    const fv = document.getElementById('co-filter')?.value || 'all';

    if (sv) logs = logs.filter(c => c.itemName.toLowerCase().includes(sv)||c.recipient.toLowerCase().includes(sv)||c.requester.toLowerCase().includes(sv)||(c.memo||'').toLowerCase().includes(sv));
    if (fv === 'today') { const t=new Date().toISOString().slice(0,10); logs=logs.filter(c=>c.date.startsWith(t)); }
    else if (fv === 'week') { const w=new Date(); w.setDate(w.getDate()-7); logs=logs.filter(c=>new Date(c.date)>=w); }
    else if (fv === 'month') { const m=new Date().toISOString().slice(0,7); logs=logs.filter(c=>c.date.startsWith(m)); }

    if (!logs.length) { tbody.innerHTML=''; if(empty) empty.classList.remove('hidden'); return; }
    if(empty) empty.classList.add('hidden');

    tbody.innerHTML = logs.map(c => `
      <tr class="border-b border-slate-100 hover:bg-slate-50/80">
        <td class="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">${c.date}</td>
        <td class="px-3 py-2.5 text-xs font-semibold">${c.itemName}</td>
        <td class="px-3 py-2.5 text-xs font-bold text-blue-600 text-center">${c.quantity}개</td>
        <td class="px-3 py-2.5 text-xs"><span class="bg-slate-100 px-1.5 py-0.5 rounded font-medium">${c.requester}</span><br><span class="text-[11px] text-slate-400">${c.team}</span></td>
        <td class="px-3 py-2.5 text-xs text-blue-700 font-semibold">${c.recipient}</td>
        <td class="px-3 py-2.5 text-xs text-slate-600">${c.purpose}</td>
        <td class="px-3 py-2.5 text-xs text-slate-400 max-w-[120px] truncate">${c.memo||'-'}</td>
        <td class="px-3 py-2.5 text-right"><button data-id="${c.id}" class="cancel-btn text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50"><i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i></button></td>
      </tr>`).join('');

    tbody.querySelectorAll('.cancel-btn').forEach(b => b.onclick = async () => {
      if (!confirm('반출 취소 (재고 자동 복구)?')) return;
      try { await Storage.cancelCheckout(b.dataset.id); App.toast('반출 취소됨','info'); renderLogs(); renderItems(); Dashboard.refresh(); Inventory.render(); } catch(e){App.toast(e.message,'error');}
    });
    lucide.createIcons();
  }

  return { init, renderItems, renderLogs };
})();
