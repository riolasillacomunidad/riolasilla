import { db, collection, doc, updateDoc, deleteDoc, setDoc, getDocs, serverTimestamp } from './fb.js';
import { S, $, refreshIcons } from './state.js';
import { announceTelegram } from './posts.js';

window.approvePost = async () => {
  if(!S.currentPostId) return;
  const id = S.currentPostId;
  await updateDoc(doc(db,'posts',id), { approved:true, active:true });
  announceTelegram(id);
};

window.toggleActive = async active => {
  if(!S.currentPostId) return;
  await updateDoc(doc(db,'posts',S.currentPostId), { active });
};

// ── Reports ──
export async function getOpenReports(){
  const snap = await getDocs(collection(db,'reports'));
  return snap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>!r.resolved);
}

window.resolveReport = async (rId) => {
  await updateDoc(doc(db,'reports',rId), { resolved:true });
  window.showReportsList();
};

// ── Moderators ──
export async function loadModerators(){
  const snap = await getDocs(collection(db,'moderators'));
  S.moderators = snap.docs.map(d=>({ email:d.id, ...d.data() }));
}

window.openAdminModal = async () => {
  await loadModerators();
  renderModList();
  $('admin-modal').classList.remove('hidden');
  refreshIcons();
};
window.closeAdminModal = () => $('admin-modal').classList.add('hidden');
window.closeAdminOnBackdrop = e => { if(e.target.id==='admin-modal') window.closeAdminModal(); };

window.addModerator = async () => {
  const email = $('mod-email-input').value.trim().toLowerCase();
  if(!email || !email.includes('@')){ alert('Escribe un correo válido.'); return; }
  await setDoc(doc(db,'moderators',email), { addedBy:S.user.uid, addedAt:serverTimestamp() });
  await loadModerators();
  renderModList();
  $('mod-email-input').value='';
};

function renderModList(){
  $('mod-list').innerHTML = S.moderators.map(m=>`
    <div class="mod-row">
      <span>${m.email}</span>
      <button class="btn-link" onclick="removeModerator('${m.email}')"><i data-lucide="trash-2" style="width:13px;height:13px"></i></button>
    </div>`).join('') || '<p class="muted-sm">Sin moderadores.</p>';
  refreshIcons();
}

window.removeModerator = async email => {
  if(!confirm(`¿Quitar a ${email} como moderador?`)) return;
  await deleteDoc(doc(db,'moderators',email));
  await loadModerators();
  renderModList();
};

// ── Export ──
window.exportData = async () => {
  const snap = await getDocs(collection(db,'posts'));
  const data = snap.docs.map(d=>({ id:d.id, ...d.data(),
    createdAt: d.data().createdAt?.toDate?.()?.toISOString() }));
  const blob = new Blob([JSON.stringify(data,null,2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rio-la-silla-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
};
