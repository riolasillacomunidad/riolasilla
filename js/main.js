import './auth.js';
import './moderation.js';
import { initMap } from './map.js';
import { subscribePosts } from './posts.js';
import { S, bus, $, emit, timeAgo, refreshIcons, canModerate, visiblePosts } from './state.js';
import { CATS } from './config.js';
import { getOpenReports } from './moderation.js';

initMap();
subscribePosts();

bus.addEventListener('posts-changed', () => { renderNav(); refreshOpenResults(); });
bus.addEventListener('auth-changed', renderNav);

function refreshOpenResults(){
  if(!$('results-panel').classList.contains('open')) return;
  if(S.cat === '__reports') return; // reports list refreshes on its own actions
  if(S.search){
    const list = visiblePosts().filter(p=>p.text?.toLowerCase().includes(S.search));
    showResults(`Resultados: "${S.search}"`, list);
    return;
  }
  const cat = S.cat;
  const list =
    cat===null        ? visiblePosts() :
    cat==='__pending' ? S.posts.filter(p=>!p.approved) :
    cat==='__inactive'? S.posts.filter(p=>p.approved && p.active===false) :
    visiblePosts().filter(p=>p.cat===cat);
  const title =
    cat===null ? 'Todas las publicaciones' :
    cat==='__pending' ? 'Pendientes de aprobación' :
    cat==='__inactive' ? 'Puntos inactivos' :
    CATS[cat]?.label || cat;
  showResults(title, list);
}

// ── Sidebar (desktop) + chips (mobile) ──
function renderNav(){
  const vis = visiblePosts();
  const pending  = S.posts.filter(p=>!p.approved);
  const inactive = S.posts.filter(p=>p.approved && p.active===false);
  const counts = {};
  Object.keys(CATS).forEach(k => counts[k] = vis.filter(p=>p.cat===k).length);

  // Desktop sidebar
  let side = catRow(null,'layers','Todas',vis.length,'#1D9E75');
  Object.entries(CATS).forEach(([k,v]) => side += catRow(k, v.icon, v.label, counts[k], v.color));
  if(canModerate()){
    side += `<div class="side-divider"></div>`;
    side += catRow('__pending','clock','Pendientes',pending.length,'#7C3AED');
    side += catRow('__inactive','eye-off','Inactivos',inactive.length,'#6B7280');
    side += catRow('__reports','flag','Reportes','…','#E03131');
  }
  if(S.isAdmin){
    side += `<div class="side-divider"></div>
      <div class="cat-item" onclick="openAdminModal()">
        <span class="cat-ic" style="color:#5C677D"><i data-lucide="settings"></i></span>
        <span class="cat-label">Administración</span>
      </div>`;
  }
  $('cat-list').innerHTML = side;

  // Mobile chips
  let chips = chip(null,'layers','Todas',vis.length,'#1D9E75');
  Object.entries(CATS).forEach(([k,v]) => chips += chip(k, v.icon, v.label, counts[k], v.color));
  if(canModerate()){
    chips += chip('__pending','clock','Pendientes',pending.length,'#7C3AED');
    chips += chip('__inactive','eye-off','Inactivos',inactive.length,'#6B7280');
    chips += chip('__reports','flag','Reportes','','#E03131');
  }
  if(S.isAdmin) chips += `<button class="chip" onclick="openAdminModal()"><i data-lucide="settings"></i></button>`;
  $('chips-row').innerHTML = chips;

  if(canModerate()) updateReportCounts();
  refreshIcons();
}

function catRow(key, icon, label, count, color){
  const active = S.cat===key && key!==undefined ? 'active' : (key===null && S.cat===null && !S.search ? '' : '');
  const sel = S.cat===key ? 'active' : '';
  return `<div class="cat-item ${sel}" onclick="selectCat(${key===null?'null':`'${key}'`})">
    <span class="cat-ic" style="color:${color}"><i data-lucide="${icon}"></i></span>
    <span class="cat-label">${label}</span>
    <span class="cat-count" ${key==='__reports'?'id="rep-count-side"':''}>${count}</span>
  </div>`;
}

function chip(key, icon, label, count, color){
  const sel = S.cat===key ? 'sel' : '';
  return `<button class="chip ${sel}" style="--c:${color}" onclick="selectCat(${key===null?'null':`'${key}'`})">
    <i data-lucide="${icon}"></i> ${label}${count!==''?` <b ${key==='__reports'?'id="rep-count-chip"':''}>${count}</b>`:''}
  </button>`;
}

async function updateReportCounts(){
  const reports = await getOpenReports();
  const s = $('rep-count-side'); if(s) s.textContent = reports.length;
  const c = $('rep-count-chip'); if(c) c.textContent = reports.length;
}

// ── Category selection ──
window.selectCat = cat => {
  S.cat = cat; S.search = '';
  $('search-input').value = '';
  const sd = $('search-input-d'); if(sd) sd.value = '';
  if(cat === '__reports'){ window.showReportsList(); renderNav(); return; }
  const list =
    cat===null        ? visiblePosts() :
    cat==='__pending' ? S.posts.filter(p=>!p.approved) :
    cat==='__inactive'? S.posts.filter(p=>p.approved && p.active===false) :
    visiblePosts().filter(p=>p.cat===cat);
  const title =
    cat===null ? 'Todas las publicaciones' :
    cat==='__pending' ? 'Pendientes de aprobación' :
    cat==='__inactive' ? 'Puntos inactivos' :
    CATS[cat]?.label || cat;
  showResults(title, list);
  renderNav();
};

// ── Search ──
window.handleSearch = () => {
  const q = $('search-input').value.toLowerCase().trim();
  S.search = q;
  if(!q){ closeResults(); renderNav(); return; }
  S.cat = null;
  const list = visiblePosts().filter(p=>p.text?.toLowerCase().includes(q));
  showResults(`Resultados: "${q}"`, list);
  renderNav();
};

// ── Results panel ──
function showResults(title, posts){
  $('results-title').textContent = title;
  const list = $('results-list');
  if(!posts.length){
    list.innerHTML = '<p class="muted-sm" style="padding:16px">Sin resultados.</p>';
  } else {
    list.innerHTML = posts.map(p=>{
      const c = CATS[p.cat] || { label:p.cat, color:'#888', icon:'map-pin' };
      const ts = p.createdAt?.toDate ? timeAgo(p.createdAt.toDate()) : '';
      const stars = p.ratingAvg ? `★ ${p.ratingAvg.toFixed(1)}` : '';
      const badge = !p.approved ? '<span class="badge pend">Pendiente</span>'
        : p.active===false ? '<span class="badge inact">Inactivo</span>' : '';
      const thumb = p.photoURL ? `<img src="${p.photoURL}" class="card-thumb" loading="lazy"/>` : '';
      return `<div class="post-card" onclick="openDetail('${p.id}')">
        ${thumb}
        <div class="card-body">
          <div class="card-top" style="color:${c.color}">
            <i data-lucide="${c.icon}" style="width:13px;height:13px"></i> ${c.label} ${badge}
          </div>
          <p class="card-text">${p.text?.substring(0,90)}${p.text?.length>90?'…':''}</p>
          <div class="card-meta"><span>${p.userName} · ${ts}</span><span class="card-stars">${stars}</span></div>
        </div>
      </div>`;
    }).join('');
  }
  $('results-panel').classList.add('open');
  refreshIcons();
}

window.closeResults = () => $('results-panel').classList.remove('open');

// ── Reports list ──
window.showReportsList = async () => {
  const reports = await getOpenReports();
  $('results-title').textContent = `Reportes abiertos (${reports.length})`;
  $('results-list').innerHTML = reports.length ? reports.map(r=>{
    const p = S.posts.find(x=>x.id===r.postId);
    return `<div class="report-card">
      <div class="report-top">
        <strong>${r.reporterName}</strong>
        <button class="btn primary sm" onclick="resolveReport('${r.id}')">Resuelto</button>
      </div>
      <p class="muted-sm">${r.reason}</p>
      ${p?`<button class="btn-link" onclick="openDetail('${p.id}')">Ver punto: "${(p.text||'').substring(0,40)}…"</button>`:'<p class="muted-sm">(punto eliminado)</p>'}
    </div>`;
  }).join('') : '<p class="muted-sm" style="padding:16px">Sin reportes abiertos.</p>';
  $('results-panel').classList.add('open');
  refreshIcons();
};

// ── Mobile search toggle ──
window.toggleSearchBar = () => {
  $('search-wrap').classList.toggle('show');
  if($('search-wrap').classList.contains('show')) $('search-input').focus();
};

refreshIcons();
