// Persistencia del proyecto del usuario en D1.
// El editor maneja UN proyecto por usuario (con varias "piezas" dentro), así
// que guardamos todo el objeto `proyecto` como un único registro por email.
//
//   GET  /api/proyectos  → { ok, proyecto: {...}|null, actualizado_en }
//   POST /api/proyectos  → guarda { proyecto } (upsert). Devuelve { ok, actualizado_en }
//
// Todo requiere sesión válida (cookie firmada). El id de la fila es el email.

import { json, corsPreflight, getSesion, listaUsuarios, nowIso } from './_shared.js';

export const onRequestOptions = () => corsPreflight();

export async function onRequestGet({ request, env }) {
  const s = await getSesion(request, env);
  if (!s) return json({ ok: false, error: 'No autenticado' }, 401);
  const email = s.ws;

  // Vista de ADMIN: los espacios de TODOS los usuarios (solo lectura, para el
  // dashboard del administrador — cada tarjeta lleva el dueño).
  const u = new URL(request.url);
  if (u.searchParams.get('todos') === '1') {
    if (s.rol !== 'admin') return json({ ok: false, error: 'Solo el administrador' }, 403);
    const espacios = [];
    for (const usr of listaUsuarios()) {
      const wsKey = usr.workspace || usr.usuario;
      if (wsKey === s.ws) continue;   // el propio ya lo tiene la app
      const row = await env.DB.prepare('SELECT piezas_json, actualizado_en FROM proyectos WHERE id = ?').bind(wsKey).first();
      if (!row) { espacios.push({ usuario: usr.usuario, proyectos: [], actualizado_en: null }); continue; }
      let ws = null; try { ws = JSON.parse(row.piezas_json); } catch {}
      espacios.push({ usuario: usr.usuario, proyectos: (ws && ws.proyectos) || [], actualizado_en: row.actualizado_en });
    }
    return json({ ok: true, espacios });
  }

  const row = await env.DB
    .prepare('SELECT piezas_json, actualizado_en FROM proyectos WHERE id = ?')
    .bind(email)
    .first();

  if (!row) return json({ ok: true, proyecto: null, actualizado_en: null });

  let proyecto = null;
  try { proyecto = JSON.parse(row.piezas_json); } catch { proyecto = null; }
  return json({ ok: true, proyecto, actualizado_en: row.actualizado_en });
}

export async function onRequestPost({ request, env }) {
  const s = await getSesion(request, env);
  if (!s) return json({ ok: false, error: 'No autenticado' }, 401);
  const email = s.ws;

  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'JSON inválido' }, 400); }

  // Acepta el espacio nuevo (body.workspace con proyectos[]) y, por
  // compatibilidad, el formato viejo (body.proyecto con piezas[]).
  const data = body && (body.workspace || body.proyecto);
  if (!data || (!Array.isArray(data.proyectos) && !Array.isArray(data.piezas))) {
    return json({ ok: false, error: 'Falta un espacio válido (con proyectos).' }, 400);
  }

  const piezasJson = JSON.stringify(data);
  // Límite defensivo: D1 admite valores grandes, pero evitamos abusos.
  if (piezasJson.length > 4_000_000) {
    return json({ ok: false, error: 'El espacio es demasiado grande.' }, 413);
  }

  const nombre = (data.nombre || 'Mi espacio').slice(0, 200);
  const ahora = nowIso();

  // Upsert: si existe la fila del usuario, actualiza; si no, la crea.
  await env.DB
    .prepare(`INSERT INTO proyectos (id, user_email, nombre, piezas_json, creado_en, actualizado_en)
              VALUES (?1, ?1, ?2, ?3, ?4, ?4)
              ON CONFLICT(id) DO UPDATE SET
                nombre = ?2,
                piezas_json = ?3,
                actualizado_en = ?4`)
    .bind(email, nombre, piezasJson, ahora)
    .run();

  return json({ ok: true, actualizado_en: ahora });
}
