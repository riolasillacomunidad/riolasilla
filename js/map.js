import { S, bus, $, refreshIcons, canModerate } from './state.js';
import { CATS, MAP_CENTER } from './config.js';

export let map, clusterGroup;
let placingCb = null;

export function initMap(){
  map = L.map('map', { zoomControl:false }).setView(MAP_CENTER, 14);
  L.control.zoom({ position:'bottomleft' }).addTo(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:'© <a href="https://openstreetmap.org">OpenStreetMap</a>', maxZoom:19
  }).addTo(map);

  clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 50, showCoverageOnHover: false,
    iconCreateFunction: cluster => L.divIcon({
      className:'', iconSize:[40,40],
      html:`<div class="cluster-pin">${cluster.getChildCount()}</div>`
    })
  });
  map.addLayer(clusterGroup);

  fetch('rio_overlay.geojson').then(r=>r.json()).then(data=>{
    L.geoJSON(data, {
      style: f => {
        const p = f.properties;
        if(p.waterway==='river')  return { color:'#1D9E75', weight:3, opacity:0.85 };
        if(p.waterway==='stream') return { color:'#5DCAA5', weight:1.5, opacity:0.6 };
        if(p.leisure==='park')    return { color:'#639922', weight:1, fillColor:'#639922', fillOpacity:0.07 };
        return { color:'#aaa', weight:1, opacity:0.15 };
      },
      onEachFeature: (f,l)=>{ if(f.properties.name) l.bindPopup(f.properties.name); }
    }).addTo(map);
  });

  map.on('zoomend moveend', () => setTimeout(refreshIcons, 80));
  clusterGroup.on('animationend', () => setTimeout(refreshIcons, 80));

  bus.addEventListener('posts-changed', renderMarkers);
  bus.addEventListener('auth-changed', renderMarkers);
}

function makeIcon(cat, photoURL){
  const color = CATS[cat]?.color || '#888';
  if(photoURL){
    return L.divIcon({ className:'',
      html:`<div class="photo-pin" style="border-color:${color}"><img src="${photoURL}" loading="lazy"/></div>`,
      iconSize:[42,42], iconAnchor:[21,21] });
  }
  const iconName = CATS[cat]?.icon || 'map-pin';
  return L.divIcon({ className:'',
    html:`<div class="cat-pin" style="background:${color}">
      <i data-lucide="${iconName}" style="width:15px;height:15px;color:#fff"></i>
    </div>`,
    iconSize:[32,40], iconAnchor:[16,40] });
}

export function renderMarkers(){
  clusterGroup.clearLayers();
  S.posts.filter(p => p.lat && (p.approved && p.active!==false || canModerate()))
    .forEach(post => {
      const m = L.marker([post.lat, post.lng], { icon: makeIcon(post.cat, post.photoURL) });
      m.on('click', () => window.openDetail(post.id));
      clusterGroup.addLayer(m);
    });
  setTimeout(refreshIcons, 50);
}

// ── Placing mode: pan map under a fixed center pin ──
export function startPlacing(initial, cb){
  placingCb = cb;
  if(initial) map.setView([initial.lat, initial.lng], Math.max(map.getZoom(), 16));
  $('placing-overlay').classList.remove('hidden');
  document.body.classList.add('placing');
  refreshIcons();
}

window.confirmPlacing = () => {
  const c = map.getCenter();
  endPlacing();
  if(placingCb){ const cb = placingCb; placingCb = null; cb({ lat:c.lat, lng:c.lng }); }
};
window.cancelPlacing = () => { placingCb = null; endPlacing(); };

function endPlacing(){
  $('placing-overlay').classList.add('hidden');
  document.body.classList.remove('placing');
}


// ── Geolocalización ──
let watchId = null, userMarker = null, accCircle = null, lastPos = null, firstFix = false;

const userIcon = () => L.divIcon({ className:'', html:'<div class="user-dot"></div>', iconSize:[18,18], iconAnchor:[9,9] });

window.toggleMyLocation = () => {
  if(!navigator.geolocation){ alert('Tu navegador no soporta geolocalización.'); return; }
  if(watchId !== null){
    if(lastPos) map.setView(lastPos, Math.max(map.getZoom(), 17));
    return;
  }
  $('btn-locate').classList.add('active');
  firstFix = false;
  watchId = navigator.geolocation.watchPosition(pos => {
    lastPos = [pos.coords.latitude, pos.coords.longitude];
    if(!userMarker){
      userMarker = L.marker(lastPos, { icon:userIcon(), zIndexOffset:900, interactive:false }).addTo(map);
      accCircle = L.circle(lastPos, { radius:pos.coords.accuracy, color:'#1971C2', weight:1, fillColor:'#1971C2', fillOpacity:.12, interactive:false }).addTo(map);
    } else {
      userMarker.setLatLng(lastPos);
      accCircle.setLatLng(lastPos).setRadius(pos.coords.accuracy);
    }
    if(!firstFix){ firstFix = true; map.setView(lastPos, 17); }
  }, err => {
    stopLocation();
    alert(err.code===1
      ? 'Permiso de ubicación denegado. Actívalo en la configuración de tu navegador.'
      : 'No se pudo obtener tu ubicación.');
  }, { enableHighAccuracy:true, maximumAge:5000, timeout:15000 });
};

function stopLocation(){
  if(watchId !== null){ navigator.geolocation.clearWatch(watchId); watchId = null; }
  const b = $('btn-locate'); if(b) b.classList.remove('active');
}

window.useMyLocation = () => {
  if(lastPos){ map.setView(lastPos, 18); return; }
  if(!navigator.geolocation){ alert('Tu navegador no soporta geolocalización.'); return; }
  navigator.geolocation.getCurrentPosition(
    pos => map.setView([pos.coords.latitude, pos.coords.longitude], 18),
    () => alert('No se pudo obtener tu ubicación. Verifica el permiso en tu navegador.'),
    { enableHighAccuracy:true, timeout:15000 }
  );
};
