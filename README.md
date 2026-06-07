# Parque Río La Silla — Red Comunitaria

Red social hiperlocal basada en mapa para la comunidad del Parque Río La Silla, Guadalupe, N.L.

## Stack
- Leaflet.js — mapa interactivo
- Firebase Auth — login con Google
- Firebase Firestore — publicaciones en tiempo real
- Cloudflare Pages — hosting gratuito

## Configuración Firebase (paso obligatorio)

1. Ve a https://console.firebase.google.com
2. Crea un proyecto nuevo: `rio-la-silla-social`
3. Activa **Authentication → Google**
4. Activa **Firestore Database** (modo producción)
5. Ve a Configuración del proyecto → Agregar app web
6. Copia los datos de configuración y reemplaza en `index.html`:

```js
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROJECT.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  ...
};
```

## Reglas de Firestore

En Firebase Console → Firestore → Reglas, pega esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow delete: if request.auth != null && request.auth.uid == resource.data.uid;
    }
  }
}
```

## Deploy en Cloudflare Pages

1. Sube la carpeta a GitHub (repositorio nuevo)
2. En Cloudflare Pages → Crear proyecto → Conectar repositorio
3. Framework: ninguno (HTML estático)
4. Build command: vacío
5. Output directory: `/`

## Archivos
- `index.html` — app principal
- `style.css` — estilos
- `rio_overlay.geojson` — datos reales del Río La Silla y parques (OpenStreetMap)
