// ========== 메인 앱 컨트롤러 ==========
const App = (function() {
  let tab = 'dashboard';
  let pollId = null;

  async function init() {
    const st = await Storage.init();
    updateBadge(st);
    Dashboard.init();
    Checkout.init();
    Inventory.init();
    bindNav();
    bindData();

    const copy = document.getElementById('btn-copy-url');
    if (copy) copy.onclick = () => {
      const u = document.getElementById('mobile-url')?.textContent;
      if (u) navigator.clipboard.writeText(u).then(() => toast('주소가 복사되었습니다!','success')).catch(() => toast(u,'info'));
    };

    startPoll();
    lucide.createIcons();
  }

  /* ── 탭 네비게이션 ── */
  function bindNav() {
    document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  }

  function switchTab(id) {
    tab = id;
    document.querySelectorAll('.tab-section').forEach(s => s.classList.add('hidden'));
    const sec = document.getElementById('sec-' + id);
    if (sec) sec.classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(b => {
      const active = b.dataset.tab === id;
      b.classList.toggle('bg-blue-600', active);
      b.classList.toggle('text-white', active);
      b.classList.toggle('shadow-sm', active);
      b.classList.toggle('text-slate-600', !active);
    });
    document.querySelectorAll('.mob-btn').forEach(b => {
      b.classList.toggle('text-blue-600', b.dataset.tab === id);
      b.classList.toggle('text-slate-400', b.dataset.tab !== id);
    });

    if (id === 'dashboard') Dashboard.refresh();
    else if (id === 'checkout') { Checkout.renderItems(); Checkout.renderLogs(); }
    else if (id === 'inventory') { Inventory.render(); Inventory.renderStockInLogs(); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    lucide.createIcons();
  }

  /* ── 연결 상태 뱃지 ── */
  function updateBadge(st) {
    const b = document.getElementById('conn-badge');
    const t = document.getElementById('conn-text');
    if (!b || !t) return;
    if (st.mode === 'server') {
      b.className = 'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200';
      t.textContent = '실시간 연동 (Wi-Fi: ' + st.serverInfo.localIp + ')';
    } else {
      b.className = 'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200';
      t.textContent = '오프라인 로컬 모드';
    }
  }

  /* ── 자동 동기화 ── */
  function startPoll() {
    if (pollId) clearInterval(pollId);
    pollId = setInterval(async () => {
      if (await Storage.poll()) {
        toast('다른 기기에서 변경된 내용이 동기화되었습니다.','info');
        Dashboard.refresh();
        Checkout.renderItems();
        Checkout.renderLogs();
        Inventory.render();
      }
    }, 8000);
  }

  /* ── 데이터 관리 이벤트 ── */
  function bindData() {
    document.querySelectorAll('.btn-excel').forEach(b => b.addEventListener('click', () => { Storage.exportExcel(); toast('엑셀 다운로드를 시작합니다.','success'); }));
    const ej = document.getElementById('btn-json');
    if (ej) ej.onclick = () => { Storage.exportJson(); toast('JSON 백업이 저장되었습니다.','success'); };
    const fi = document.getElementById('file-json');
    if (fi) fi.onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = async ev => { try { await Storage.importJson(ev.target.result); toast('복원 완료!','success'); setTimeout(() => location.reload(), 800); } catch(e) { toast(e.message,'error'); } };
      reader.readAsText(f);
    };
    const fm = document.getElementById('form-member');
    if (fm) fm.onsubmit = async e => {
      e.preventDefault();
      const n = document.getElementById('in-member-name'), t = document.getElementById('in-member-team');
      if (!n.value.trim()) return;
      await Storage.addTeamMember(n.value.trim(), t.value.trim());
      toast(n.value.trim() + ' 추가 완료','success');
      n.value = '';
      renderMembers();
    };
    renderMembers();
  }

  function renderMembers() {
    const el = document.getElementById('members-list');
    if (!el) return;
    el.innerHTML = Storage.getTeamMembers().map(m => `
      <div class="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
        <div class="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">${m.name[0]}</div>
        <div><div class="text-xs font-bold">${m.name}</div><div class="text-[11px] text-slate-500">${m.team}</div></div>
      </div>`).join('');
  }

  /* ── 토스트 알림 ── */
  function toast(msg, type='info') {
    const c = document.getElementById('toast-box');
    if (!c) return;
    const colors = { success:'bg-emerald-600', error:'bg-rose-600', warning:'bg-amber-500', info:'bg-slate-800' };
    const icons = { success:'check-circle-2', error:'alert-triangle', warning:'alert-circle', info:'info' };
    const d = document.createElement('div');
    d.className = `flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-xs font-semibold toast-enter ${colors[type]||colors.info}`;
    d.innerHTML = `<i data-lucide="${icons[type]||'info'}" class="w-4 h-4 shrink-0"></i><span>${msg}</span>`;
    c.appendChild(d);
    lucide.createIcons();
    setTimeout(() => { d.style.opacity='0'; d.style.transform='translateY(8px)'; d.style.transition='all 0.3s'; setTimeout(() => d.remove(), 300); }, 3500);
  }

  function confetti() {
    if (typeof window.confetti === 'function') window.confetti({ particleCount:45, spread:55, origin:{y:0.8}, colors:['#2563eb','#10b981','#f59e0b','#ec4899'] });
  }

  return { init, switchTab, toast, confetti };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
