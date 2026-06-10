import { auth, db, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut,
         onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         updateProfile, sendEmailVerification, doc, getDoc, setDoc } from './fb.js';
import { S, $, emit, refreshIcons, canModerate } from './state.js';
import { ADMIN_UIDS } from './config.js';

const provider = new GoogleAuthProvider();

window.signInGoogle = async () => {
  try { await signInWithPopup(auth, provider); closeAuthModal(); }
  catch(e){ console.error(e); }
};

window.signOut = () => fbSignOut(auth);

window.signInEmail = async () => {
  const email = $('login-email').value.trim();
  const pw = $('login-password').value;
  const err = $('login-error');
  err.textContent = '';
  try {
    await signInWithEmailAndPassword(auth, email, pw);
    if(!auth.currentUser.emailVerified){
      err.textContent = 'Verifica tu correo antes de entrar. Revisa tu bandeja.';
      fbSignOut(auth); return;
    }
    closeAuthModal();
  } catch(e){ err.textContent = friendlyAuthError(e); }
};

window.registerEmail = async () => {
  const name = $('reg-name').value.trim();
  const email = $('reg-email').value.trim();
  const pw = $('reg-password').value;
  const terms = $('terms-check').checked;
  const err = $('reg-error');
  err.style.color = 'var(--red)'; err.textContent = '';
  if(!terms){ err.textContent = 'Debes aceptar los términos de uso.'; return; }
  if(!name){ err.textContent = 'Escribe tu nombre.'; return; }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    await updateProfile(cred.user, { displayName: name });
    await sendEmailVerification(cred.user);
    await fbSignOut(auth);
    err.style.color = 'var(--green)';
    err.textContent = '✓ Cuenta creada. Revisa tu correo para verificarla.';
  } catch(e){ err.textContent = friendlyAuthError(e); }
};

function friendlyAuthError(e){
  const c = e.code || '';
  if(c.includes('invalid-credential') || c.includes('wrong-password')) return 'Correo o contraseña incorrectos.';
  if(c.includes('email-already-in-use')) return 'Ese correo ya tiene cuenta.';
  if(c.includes('weak-password')) return 'La contraseña necesita al menos 6 caracteres.';
  if(c.includes('invalid-email')) return 'El correo no es válido.';
  return 'Error: ' + (e.message || c);
}

window.switchTab = tab => {
  $('auth-login-form').classList.toggle('hidden', tab==='register');
  $('auth-register-form').classList.toggle('hidden', tab==='login');
  $('tab-login').classList.toggle('active', tab==='login');
  $('tab-register').classList.toggle('active', tab==='register');
};

window.openAuthModal  = () => $('auth-modal').classList.remove('hidden');
window.closeAuthModal = () => $('auth-modal').classList.add('hidden');
window.closeAuthOnBackdrop = e => { if(e.target.id==='auth-modal') closeAuthModal(); };

// ── Profile (telegram) ──
window.openProfileModal = async () => {
  if(!S.user) return;
  const snap = await getDoc(doc(db,'users',S.user.uid));
  $('profile-telegram').value = snap.exists() ? (snap.data().telegram||'') : '';
  $('profile-modal').classList.remove('hidden');
};
window.closeProfileModal = () => $('profile-modal').classList.add('hidden');
window.closeProfileOnBackdrop = e => { if(e.target.id==='profile-modal') closeProfileModal(); };
window.saveProfile = async () => {
  let tg = $('profile-telegram').value.trim().replace(/^@/,'');
  await setDoc(doc(db,'users',S.user.uid), { telegram: tg }, { merge:true });
  closeProfileModal();
};

// ── Auth state ──
onAuthStateChanged(auth, async user => {
  S.user = user;
  S.isAdmin = !!user && ADMIN_UIDS.includes(user.uid);
  S.isMod = false;
  if(user){
    if(user.email){
      const modDoc = await getDoc(doc(db,'moderators',user.email.toLowerCase()));
      S.isMod = modDoc.exists() && !S.isAdmin;
    }
    setDoc(doc(db,'users',user.uid),
      { name: user.displayName||'', photo: user.photoURL||'' }, { merge:true });

    $('btn-login').classList.add('hidden');
    $('user-info').classList.remove('hidden');
    $('btn-publish').classList.remove('hidden');
    $('fab-publish').classList.remove('hidden');
    const av = $('user-avatar');
    if(user.photoURL){ av.src = user.photoURL; av.classList.remove('hidden'); $('user-initial').classList.add('hidden'); }
    else { av.classList.add('hidden'); $('user-initial').textContent = (user.displayName||'?').charAt(0).toUpperCase(); $('user-initial').classList.remove('hidden'); }
    $('badge-admin').classList.toggle('hidden', !S.isAdmin);
    $('badge-mod').classList.toggle('hidden', !S.isMod);
  } else {
    $('btn-login').classList.remove('hidden');
    $('user-info').classList.add('hidden');
    $('btn-publish').classList.add('hidden');
    $('fab-publish').classList.add('hidden');
  }
  emit('auth-changed');
  refreshIcons();
});
