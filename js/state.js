export const S = {
  user: null, isAdmin: false, isMod: false,
  posts: [], cat: null, search: '',
  currentPostId: null, editingPostId: null,
  pendingLatLng: null, tempRating: 0,
  fileData: { photo:null, audio:null, doc:null },
  existingUrls: { photoURL:null, audioURL:null, docURL:null },
  moderators: [], deepLinkDone: false,
};

export const bus = new EventTarget();
export const emit = name => bus.dispatchEvent(new Event(name));
export const $ = id => document.getElementById(id);

export function timeAgo(date){
  const s = Math.floor((Date.now()-date)/1000);
  if(s<60) return 'ahora';
  if(s<3600) return `hace ${Math.floor(s/60)} min`;
  if(s<86400) return `hace ${Math.floor(s/3600)} h`;
  return `hace ${Math.floor(s/86400)} días`;
}

export function refreshIcons(){
  if(window.lucide) window.lucide.createIcons();
}

export function canModerate(){ return S.isAdmin || S.isMod; }
export function visiblePosts(){
  return S.posts.filter(p => p.approved && p.active!==false);
}
