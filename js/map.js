import { S, bus, $, refreshIcons, canModerate } from './state.js';
import { CATS, MAP_CENTER } from './config.js';

export let map, clusterGroup;
let placingCb = null;

export function initMap(){
  map = L.map('map', { zoomControl:false }).setView(MAP_CENTER, 14);
  L.control.zoom({ position:'bottomright' }).addTo(map);
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
