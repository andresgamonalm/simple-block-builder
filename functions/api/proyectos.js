// Persistencia del proyecto del usuario en D1.
// El editor maneja UN proyecto por usuario (con varias "piezas" dentro), así
// que guardamos todo el objeto `proyecto` como un único registro por email.
//
//   GET  /api/proyectos  → { ok, proyecto: {...}|null, actualizado_en }
//   POST /api/proyectos  → guarda { proyecto } (upsert). Devuelve { ok, actualizado_en }
//
// Todo requiere sesión válida (cookie firmada). El id de la fila es el email.

import { json, corsPreflight, getUserEmail, nowIso } from './_shared.js';

export const onRequestOptions = () => corsPreflight();

export async function onRequestGet({ request, env }) {
  const email = await getUserEmail(request, env);
  if (!email) return json({ ok: false, error: 'No autenticado' }, 401);

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
  const email = await getUserEmail(request, env);
  if (!email) return json({ ok: false, error: 'No autenticado' }, 401);

  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'JSON inválido' }, 400); }

  const proyecto = body && body.proyecto;
  if (!proyecto || !Array.isArray(proyecto.piezas)) {
    return json({ ok: false, error: 'Falta un proyecto válido (con piezas).' }, 400);
  }

  const piezasJson = JSON.stringify(proyecto);
  // Límite defensivo: D1 admite valores grandes, pero evitamos abusos.
  if (piezasJson.length > 4_000_000) {
    return json({ ok: false, error: 'El proyecto es demasiado grande.' }, 413);
  }

  const nombre = (proyecto.nombre || 'Mi proyecto').slice(0, 200);
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
