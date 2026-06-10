export const firebaseConfig = {
  apiKey: "AIzaSyDZCv1BsUFiy6JxUFpCmd8fV3biRKmp1XI",
  authDomain: "rio-la-silla-comunidad.firebaseapp.com",
  projectId: "rio-la-silla-comunidad",
  storageBucket: "rio-la-silla-comunidad.firebasestorage.app",
  messagingSenderId: "911759383073",
  appId: "1:911759383073:web:a8ac1748ac62abc115a160"
};

export const CLOUDINARY = { cloud: 'dfkfaae4l', preset: 'riolasilla_uploads' };
export const ADMIN_UIDS = ['B25MIYOUPEZ1wEwXUCddDxAOzxh1'];

export const CATS = {
  arte:            { label:'Arte y belleza',        icon:'palette',        color:'#D6336C' },
  comunidad:       { label:'Comunidad',              icon:'heart-handshake',color:'#9C36B5' },
  denuncia:        { label:'Denuncia y reportes',    icon:'alert-triangle', color:'#E03131' },
  deporte:         { label:'Deporte',                icon:'bike',           color:'#E8590C' },
  educacion:       { label:'Educación',              icon:'book-open',      color:'#1971C2' },
  flora:           { label:'Flora, Fauna y Agua',    icon:'leaf',           color:'#2F9E44' },
  historia:        { label:'Historia y relatos',     icon:'scroll',         color:'#846358' },
  infraestructura: { label:'Infraestructura',        icon:'hard-hat',       color:'#5C677D' },
  mascotas:        { label:'Mascotas',               icon:'paw-print',      color:'#D9480F' },
  mobiliario:      { label:'Mobiliario Urbano',      icon:'armchair',       color:'#0B7285' },
};

export const MAP_CENTER = [25.6560, -100.2260];
export const SITE_URL = location.origin + location.pathname.replace(/index\.html$/,'');
