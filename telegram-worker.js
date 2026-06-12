// Worker de Cloudflare — Anuncia puntos aprobados en un canal de Telegram
// Variables requeridas (Settings → Variables and Secrets del Worker):
//   BOT_TOKEN        (tipo Secret)  → token del bot de @BotFather
//   CHANNEL          (tipo Text)    → @nombre_del_canal
//   FIREBASE_PROJECT (tipo Text)    → id del proyecto, ej: rio-la-silla-comunidad
//   SITE_URL         (tipo Text)    → ej: https://riolasillacomunidad.github.io/riolasilla/

const CATS = {
  arte:'🎨 Arte y cultura', comunidad:'🤝 Comunidad y eventos',
  denuncia:'🚨 Denuncia y reportes', deporte:'⚽ Deporte y esparcimiento',
  educacion:'📚 Educación ambiental', flora:'🦋 Flora, Fauna y Agua',
  historia:'📖 Historia y relatos', infraestructura:'🏗️ Infraestructura',
  mobiliario:'🪑 Mobiliario Urbano', paisajes:'🏔️ Paisajes'
};

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Solo POST', { status: 405, headers: cors });

    let body;
    try { body = await request.json(); }
    catch { return new Response('JSON inválido', { status: 400, headers: cors }); }

    const postId = String(body.postId || '').replace(/[^A-Za-z0-9_-]/g, '');
    if (!postId) return new Response('Falta postId', { status: 400, headers: cors });

    // Leer el punto desde Firestore (lectura pública) — solo se anuncia contenido real y aprobado
    const fsUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT}/databases/(default)/documents/posts/${postId}`;
    const fsRes = await fetch(fsUrl);
    if (!fsRes.ok) return new Response('Punto no encontrado', { status: 404, headers: cors });

    const f = (await fsRes.json()).fields || {};
    if (!f.approved?.booleanValue) return new Response('Punto no aprobado', { status: 403, headers: cors });

    const text = f.text?.stringValue || '';
    const cat = f.cat?.stringValue || '';
    const userName = f.userName?.stringValue || '';
    const photo = f.photoURL?.stringValue || null;
    const link = `${env.SITE_URL}?punto=${postId}`;

    const caption = `${CATS[cat] || '📍'}\n\n${text.substring(0, 700)}\n\n👤 ${userName}\n🗺️ Ver en el mapa: ${link}`;
    const tg = `https://api.telegram.org/bot${env.BOT_TOKEN}/`;

    const payload = photo
      ? { url: tg + 'sendPhoto',   body: { chat_id: env.CHANNEL, photo, caption } }
      : { url: tg + 'sendMessage', body: { chat_id: env.CHANNEL, text: caption } };

    const tgRes = await fetch(payload.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload.body)
    });

    return new Response(tgRes.ok ? 'OK' : 'Error de Telegram',
      { status: tgRes.ok ? 200 : 502, headers: cors });
  }
};
