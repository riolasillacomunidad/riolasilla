import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
         doc, updateDoc, deleteDoc, getDoc } from './fb.js';
import { S, $, emit, timeAgo, refreshIcons, canModerate } from './state.js';
import { CATS, CLOUDINARY, SITE_URL } from './config.js';
import { map, startPlacing } from './map.js';

const CAT_HINTS = {
  arte:            'Describe la obra o elemento artístico: qué es, dónde está y por qué vale la pena conocerlo.',
  comunidad:       'Cuenta la actividad o iniciativa vecinal: quiénes participan y cómo pueden sumarse otros.',
  denuncia:        'Incluye la ubicación exacta, una foto del problema y desde cuándo lo observas.',
  deporte:         'Describe el espacio o actividad: horarios, condiciones y recomendaciones para quien quiera ir.',
  educacion:       'Comparte el dato o recurso educativo y, si aplica, cita tu fuente.',
  flora:           'Describe lo que observaste: especie, fecha y condición en que se encuentra.',
  historia:        'Cuenta la historia: quién, cuándo y dónde. Si viene de un libro o de una persona, menciona la fuente.',
  infraestructura: 'Describe el elemento (puente, sendero, señalética) y su estado actual.',
  mascotas:        'Indica si es avistamiento, extravío o adopción; incluye una foto y señas particulares.',
  mobiliario:      'Describe el mobiliario (banca, juego, luminaria) y su estado o lo que necesita.',
};

window.updateCatHint = () => {
  const hint = CAT_HINTS[$('pub-cat').value] || '';
  $('cat-hint').textContent = hint;
  $('cat-hint').style.display = hint ? 'block' : 'none';
};

window.openAboutModal = () => { $('about-modal').classList.remove('hidden'); refreshIcons(); };
window.closeAboutModal = () => $('about-modal').classList.add('hidden');
window.closeAboutOnBackdrop = e => { if(e.target.id==='about-modal') window.closeAboutModal(); };

// ── Subscribe ──
export function subscribePosts(){
  const q = query(collection(db,'posts'), orderBy('createdAt','desc'));
  onSnapshot(q, snap => {
    S.posts = [];
    snap.forEach(d => S.posts.push({ id:d.id, ...d.data() }));
    emit('posts-changed');
    if(S.currentPostId){
      const p = S.posts.find(x=>x.id===S.currentPostId);
      if(p) renderDetail(p);
    }
    handleDeepLink();
  });
}

function handleDeepLink(){
  if(S.deepLinkDone) return;
  const id = new URLSearchParams(location.search).get('punto');
  if(id && S.posts.some(p=>p.id===id)){
    S.deepLinkDone = true;
    setTimeout(()=>window.openDetail(id), 400);
  } else if(S.posts.length) S.deepLinkDone = true;
}

// ── Detail ──
window.openDetail = id => {
  S.currentPostId = id;
  const p = S.posts.find(x=>x.id===id);
  if(!p) return;
  renderDetail(p);
  $('detail-sheet').classList.add('open');
  if(p.lat) map.setView([p.lat, p.lng], Math.max(map.getZoom(),16));
};

window.closeDetail = () => {
  $('detail-sheet').classList.remove('open');
  S.currentPostId = null;
};

async function renderDetail(p){
  const c = CATS[p.cat] || { label:p.cat, color:'#888', icon:'map-pin' };
  const ts = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('es-MX',{year:'numeric',month:'long',day:'numeric'}) : '';

  $('d-cat').innerHTML = `<i data-lucide="${c.icon}" style="width:13px;height:13px"></i> ${c.label}`;
  $('d-cat').style.background = c.color+'18';
  $('d-cat').style.color = c.color;
  $('d-user').textContent = `${p.userName} · ${ts}`;
  $('d-text').textContent = p.text || '';
  $('d-coords').textContent = p.lat ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : '';

  let media = '';
  if(p.photoURL) media += `<img src="${p.photoURL}" class="detail-img" loading="lazy"/>`;
  if(p.audioURL) media += `<audio controls src="${p.audioURL}" class="detail-audio"></audio>`;
  if(p.docURL)   media += `<a href="${p.docURL}" target="_blank" class="btn ghost sm"><i data-lucide="file-text"></i> Ver documento</a>`;
  $('d-media').innerHTML = media;

  const isOwner = S.user && p.uid===S.user.uid;
  const canEdit = isOwner || canModerate();

  $('d-btn-report').classList.toggle('hidden', !S.user || isOwner);
  $('d-btn-share').classList.remove('hidden');

  // Telegram contact
  const tgBtn = $('d-btn-telegram');
  tgBtn.classList.add('hidden');
  if(S.user && !isOwner){
    try {
      const u = await getDoc(doc(db,'users',p.uid));
      if(u.exists() && u.data().telegram){
        tgBtn.href = 'https://t.me/' + u.data().telegram;
        tgBtn.classList.remove('hidden');
      }
    } catch(e){}
  }

  // Gestión / moderación
  $('d-admin').classList.toggle('hidden', !canEdit);
  $('d-admin-title').textContent = canModerate() ? 'Moderación' : 'Tu publicación';
  $('d-btn-move').classList.toggle('hidden', !canEdit);
  $('d-btn-edit').classList.toggle('hidden', !canEdit);
  $('d-btn-delete').classList.toggle('hidden', !canEdit);
  $('d-btn-approve').classList.toggle('hidden', !canModerate() || p.approved);
  $('d-btn-deactivate').classList.toggle('hidden', !canModerate() || !p.approved || p.active===false);
  $('d-btn-activate').classList.toggle('hidden', !canModerate() || !p.approved || p.active!==false);

  // Rating
  const avg = p.ratingAvg||0, count = p.ratingCount||0;
  $('d-stars-display').innerHTML =
    [1,2,3,4,5].map(n=>`<i data-lucide="star" class="star-d ${n<=Math.round(avg)?'on':''}"></i>`).join('') +
    `<span class="rating-avg">${avg.toFixed(1)} · ${count} ${count===1?'voto':'votos'}</span>`;

  const myRating = S.user && p.ratings ? p.ratings[S.user.uid] : null;
  const rateArea = $('d-rate-area');
  rateArea.classList.toggle('hidden', !S.user || !!myRating);
  if(S.user && !myRating){
    S.tempRating = 0;
    $('d-stars-input').innerHTML = [1,2,3,4,5].map(n=>
      `<i data-lucide="star" class="star-i" data-n="${n}" onclick="selectRating(${n})"></i>`).join('');
    $('d-rating-preview').classList.remove('show');
    $('d-rating-confirm').classList.add('hidden');
  }

  renderComments(p);
  $('d-btn-comment').classList.toggle('hidden', !S.user);
  $('d-comment-form').classList.add('hidden');
  refreshIcons();
}

function renderComments(p){
  const comments = p.comments||[];
  const div = $('d-comments');
  if(!comments.length){ div.innerHTML = '<p class="muted-sm">Sin comentarios aún.</p>'; return; }
  div.innerHTML = comments.map((c,i)=>{
    const canDel = S.user && (c.uid===S.user.uid || canModerate());
    return `<div class="comment">
      <div class="comment-header">
        <span class="comment-user">${c.userName}</span>
        <span class="comment-time">${timeAgo(new Date(c.createdAt))}</span>
      </div>
      <p class="comment-text">${c.text}</p>
      ${canDel?`<button class="btn-link" onclick="deleteComment(${i})"><i data-lucide="trash-2" style="width:12px;height:12px"></i> Borrar</button>`:''}
    </div>`;
  }).join('');
}

// ── Rating actions ──
window.selectRating = n => {
  S.tempRating = n;
  document.querySelectorAll('#d-stars-input .star-i').forEach((s,i)=>s.classList.toggle('on', i<n));
  $('d-rating-preview').textContent = `Tu calificación: ${n} de 5 estrellas. ¿Confirmas?`;
  $('d-rating-preview').classList.add('show');
  $('d-rating-confirm').classList.remove('hidden');
};
window.cancelRating = () => {
  S.tempRating = 0;
  document.querySelectorAll('#d-stars-input .star-i').forEach(s=>s.classList.remove('on'));
  $('d-rating-preview').classList.remove('show');
  $('d-rating-confirm').classList.add('hidden');
};
window.confirmRating = async () => {
  if(!S.tempRating || !S.currentPostId) return;
  const p = S.posts.find(x=>x.id===S.currentPostId); if(!p) return;
  const ratings = { ...(p.ratings||{}), [S.user.uid]: S.tempRating };
  const vals = Object.values(ratings);
  const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
  await updateDoc(doc(db,'posts',S.currentPostId),
    { ratings, ratingAvg: Math.round(avg*10)/10, ratingCount: vals.length });
};

// ── Comments actions ──
window.openCommentForm = () => { $('d-comment-form').classList.remove('hidden'); $('d-btn-comment').classList.add('hidden'); };
window.cancelComment = () => {
  $('d-comment-form').classList.add('hidden');
  $('d-btn-comment').classList.remove('hidden');
  $('d-comment-text').value='';
};
window.submitComment = async () => {
  const text = $('d-comment-text').value.trim();
  if(!text || !S.currentPostId) return;
  const p = S.posts.find(x=>x.id===S.currentPostId);
  const comments = [...(p.comments||[]), { uid:S.user.uid, userName:S.user.displayName, text, createdAt:Date.now() }];
  await updateDoc(doc(db,'posts',S.currentPostId), { comments });
  window.cancelComment();
};
window.deleteComment = async idx => {
  const p = S.posts.find(x=>x.id===S.currentPostId); if(!p) return;
  const comments = [...(p.comments||[])]; comments.splice(idx,1);
  await updateDoc(doc(db,'posts',S.currentPostId), { comments });
};

// ── Share ──
window.sharePost = async () => {
  const url = `${SITE_URL}?punto=${S.currentPostId}`;
  const p = S.posts.find(x=>x.id===S.currentPostId);
  if(navigator.share){
    try { await navigator.share({ title:'Río La Silla', text:p?.text?.substring(0,80)||'', url }); return; } catch(e){}
  }
  await navigator.clipboard.writeText(url);
  const btn = $('d-btn-share');
  btn.innerHTML = '<i data-lucide="check"></i>'; refreshIcons();
  setTimeout(()=>{ btn.innerHTML='<i data-lucide="share-2"></i>'; refreshIcons(); }, 1500);
};

// ── Report ──
window.reportPost = async () => {
  if(!S.user || !S.currentPostId) return;
  const reason = prompt('Describe brevemente el problema:');
  if(!reason) return;
  await addDoc(collection(db,'reports'), {
    postId:S.currentPostId, reportedBy:S.user.uid, reporterName:S.user.displayName,
    reason, resolved:false, createdAt:serverTimestamp()
  });
  alert('Reporte enviado. El equipo de moderación lo revisará.');
};

// ── Publish / Edit ──
window.openPublishFlow = () => {
  if(!S.user){ window.openAuthModal(); return; }
  S.editingPostId = null;
  S.pendingLatLng = null;
  S.fileData = { photo:null, audio:null, doc:null };
  S.existingUrls = { photoURL:null, audioURL:null, docURL:null };
  startPlacing(null, latlng => {
    S.pendingLatLng = latlng;
    openForm('Nueva publicación');
  });
};

window.openEditModal = () => {
  const p = S.posts.find(x=>x.id===S.currentPostId); if(!p) return;
  S.editingPostId = S.currentPostId;
  S.pendingLatLng = { lat:p.lat, lng:p.lng };
  S.existingUrls = { photoURL:p.photoURL||null, audioURL:p.audioURL||null, docURL:p.docURL||null };
  S.fileData = { photo:null, audio:null, doc:null };
  window.closeDetail();
  openForm('Editar publicación', p);
};

window.startMovePoint = () => {
  const id = S.currentPostId;
  const p = S.posts.find(x=>x.id===id); if(!p) return;
  window.closeDetail();
  startPlacing({ lat:p.lat, lng:p.lng }, async latlng => {
    await updateDoc(doc(db,'posts',id), { lat:latlng.lat, lng:latlng.lng });
  });
};

function openForm(title, p){
  $('publish-modal-title').textContent = title;
  $('pub-coords').textContent = S.pendingLatLng ? `${S.pendingLatLng.lat.toFixed(5)}, ${S.pendingLatLng.lng.toFixed(5)}` : '—';
  $('pub-text').value = p?.text || '';
  $('pub-cat').value = p?.cat || 'flora';
  $('manual-coords-row').classList.add('hidden');
  renderFilePreviews();
  window.updateCatHint();
  $('publish-modal').classList.remove('hidden');
  refreshIcons();
}

window.closePublishModal = () => { $('publish-modal').classList.add('hidden'); S.editingPostId=null; };
window.closePublishOnBackdrop = e => { if(e.target.id==='publish-modal') window.closePublishModal(); };

window.relocateFromForm = () => {
  $('publish-modal').classList.add('hidden');
  startPlacing(S.pendingLatLng, latlng => {
    S.pendingLatLng = latlng;
    $('pub-coords').textContent = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    $('publish-modal').classList.remove('hidden');
    refreshIcons();
  });
};

window.toggleManualCoords = () => $('manual-coords-row').classList.toggle('hidden');
window.applyManualCoords = () => {
  const parts = $('manual-coords-input').value.trim().split(',').map(s=>parseFloat(s.trim()));
  if(parts.length===2 && !isNaN(parts[0]) && !isNaN(parts[1])){
    S.pendingLatLng = { lat:parts[0], lng:parts[1] };
    $('pub-coords').textContent = `${parts[0].toFixed(5)}, ${parts[1].toFixed(5)}`;
    map.setView([parts[0],parts[1]], 16);
    $('manual-coords-row').classList.add('hidden');
  } else alert('Formato: 25.65600, -100.22600');
};

// ── Files + compression ──
window.handleFile = type => {
  const input = $(`file-${type}`);
  const file = input.files[0]; if(!file) return;
  const maxMB = { photo:5, audio:10, doc:5 }[type];
  if(file.size > maxMB*1024*1024){ alert(`Máximo ${maxMB}MB.`); input.value=''; return; }
  S.fileData[type] = file;
  renderFilePreviews();
};

function renderFilePreviews(){
  const div = $('file-previews');
  const f = S.fileData, e = S.existingUrls;
  let html='';
  const item = (icon,label,clear) =>
    `<span class="chip-file"><i data-lucide="${icon}" style="width:12px;height:12px"></i> ${label}
     <button onclick="${clear}"><i data-lucide="x" style="width:12px;height:12px"></i></button></span>`;
  if(f.photo) html += item('image', f.photo.name, "clearFile('photo')");
  else if(e.photoURL) html += item('image','Foto actual',"clearExisting('photoURL')");
  if(f.audio) html += item('music', f.audio.name, "clearFile('audio')");
  else if(e.audioURL) html += item('music','Audio actual',"clearExisting('audioURL')");
  if(f.doc) html += item('file-text', f.doc.name, "clearFile('doc')");
  else if(e.docURL) html += item('file-text','Documento actual',"clearExisting('docURL')");
  div.innerHTML = html;
  refreshIcons();
}
window.clearFile = t => { S.fileData[t]=null; $(`file-${t}`).value=''; renderFilePreviews(); };
window.clearExisting = k => { S.existingUrls[k]=null; renderFilePreviews(); };

async function compressImage(file){
  if(!file.type.startsWith('image/')) return file;
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1600;
      let { width:w, height:h } = img;
      if(w<=MAX && h<=MAX && file.size < 600*1024) return resolve(file);
      if(w>h && w>MAX){ h = h*MAX/w; w = MAX; }
      else if(h>=w && h>MAX){ w = w*MAX/h; h = MAX; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(b => resolve(b || file), 'image/jpeg', 0.82);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

async function uploadToCloudinary(file, type){
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY.preset);
  fd.append('folder', 'riolasilla');
  const rtype = type==='audio' ? 'video' : type==='doc' ? 'raw' : 'image';
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloud}/${rtype}/upload`, { method:'POST', body:fd });
  const data = await res.json();
  if(data.error) throw new Error(data.error.message);
  return data.secure_url;
}

window.submitPost = async () => {
  const text = $('pub-text').value.trim();
  const cat = $('pub-cat').value;
  if(!text){ alert('Escribe una descripción.'); return; }
  if(!S.pendingLatLng){ alert('Falta la ubicación.'); return; }
  const btn = $('btn-submit-post');
  btn.disabled = true; btn.textContent = 'Publicando…';
  try {
    let { photoURL, audioURL, docURL } = S.existingUrls;
    if(S.fileData.photo){
      const compressed = await compressImage(S.fileData.photo);
      photoURL = await uploadToCloudinary(compressed, 'photo');
    }
    if(S.fileData.audio) audioURL = await uploadToCloudinary(S.fileData.audio, 'audio');
    if(S.fileData.doc)   docURL   = await uploadToCloudinary(S.fileData.doc, 'doc');

    if(S.editingPostId){
      await updateDoc(doc(db,'posts',S.editingPostId),
        { text, cat, lat:S.pendingLatLng.lat, lng:S.pendingLatLng.lng, photoURL, audioURL, docURL });
    } else {
      await addDoc(collection(db,'posts'), {
        text, cat, lat:S.pendingLatLng.lat, lng:S.pendingLatLng.lng,
        uid:S.user.uid, userName:S.user.displayName, userPhoto:S.user.photoURL||'',
        createdAt:serverTimestamp(),
        approved:canModerate(), active:true,
        photoURL, audioURL, docURL,
        ratings:{}, ratingAvg:0, ratingCount:0, comments:[]
      });
      if(!canModerate()) alert('✓ Publicación enviada. Aparecerá cuando sea aprobada.');
    }
    window.closePublishModal();
  } catch(e){ alert('Error: '+e.message); }
  finally { btn.disabled = false; btn.textContent = 'Publicar'; }
};

window.deletePost = async () => {
  if(!S.currentPostId || !confirm('¿Eliminar esta publicación definitivamente?')) return;
  await deleteDoc(doc(db,'posts',S.currentPostId));
  window.closeDetail();
};
