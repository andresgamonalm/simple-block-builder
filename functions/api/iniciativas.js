// GUARDADO POR INICIATIVA, con versiones y estados (paso 3 de la nueva arquitectura).
//
// Una iniciativa (modelo nucleo/modelo.js, espejo de Google Ads Editor) se guarda
// por VERSIONES completas y avanza por ESTADOS (nucleo/versiones.js):
//   borrador → aprobada → exportada → publicada   (· archivada)
// No usa el "workspace" de último-en-escribir-gana: aquí cada guardado dice
// sobre qué versión trabajó (`base`) y si otro guardó antes, se responde 409
// en vez de pisar su trabajo.
//
//   GET  /api/iniciativas                       → lista (sin contenido)            ?archivadas=1 las incluye
//   GET  /api/iniciativas?id=X[&version=N]      → la iniciativa (la actual o la versión N)
//   GET  /api/iniciativas?id=X&historial=1      → versiones y eventos (quién, cuándo, qué estado)
//   GET  /api/iniciativas?id=X&desde=N[&hasta=M]→ qué cambió entre dos versiones (por id)
//   POST { accion:'guardar', iniciativa, base, nota? }      → versión nueva (vuelve a borrador)
//   POST { accion:'estado', id, estado, base, nota? }       → transición (aprobada exige 0 errores)
//
// Tablas (se crean solas): iniciativas · iniciativa_versiones · iniciativa_eventos.

import { json, corsPreflight, getSesion, tienePermiso, nowIso } from './_shared.js';
import V from '../../nucleo/versiones.js';
import R from '../../nucleo/reglas.js';

export const onRequestOptions = () => corsPreflight();

const MAX_BYTES = 2_000_000;
const VERSIONES_A_CONSERVAR = 50;

async function asegurarTablas(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS iniciativas (
      id TEXT PRIMARY KEY, ws TEXT NOT NULL, nombre TEXT, estado TEXT NOT NULL, version INTEGER NOT NULL,
      exportada_version INTEGER, publicada_version INTEGER,
      creado_en TEXT, actualizado_en TEXT, actualizado_por TEXT)`),
    db.prepare('CREATE INDEX IF NOT EXISTS iniciativas_ws ON iniciativas (ws)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS iniciativa_versiones (
      iniciativa_id TEXT NOT NULL, version INTEGER NOT NULL, datos_json TEXT NOT NULL, huella_len INTEGER,
      nota TEXT, autor TEXT, creado_en TEXT, PRIMARY KEY (iniciativa_id, version))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS iniciativa_eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, iniciativa_id TEXT NOT NULL, version INTEGER, de TEXT, a TEXT,
      nota TEXT, autor TEXT, creado_en TEXT)`)
  ]);
}

// Fecha de hoy en Chile (las fechas de término se comparan contra esto).
const hoyChile = () => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date()); } catch { return new Date().toISOString().slice(0, 10); } };

async function sesionValida(request, env) {
  const s = await getSesion(request, env);
  if (!s) return { error: json({ ok: false, error: 'No autenticado' }, 401) };
  if (!tienePermiso(s, 'ads') && !tienePermiso(s, 'banner')) return { error: json({ ok: false, error: 'No tienes acceso a campañas' }, 403) };
  if (!env.DB) return { error: json({ ok: false, error: 'Base de datos no configurada' }, 500) };
  await asegurarTablas(env.DB);
  return { s };
}
const meta = (db, id) => db.prepare('SELECT * FROM iniciativas WHERE id = ?').bind(id).first();
async function leerVersion(db, id, version) {
  const r = await db.prepare('SELECT datos_json FROM iniciativa_versiones WHERE iniciativa_id = ? AND version = ?').bind(id, version).first();
  if (!r) return null;
  try { return JSON.parse(r.datos_json); } catch { return null; }
}
const publico = m => m && { id: m.id, nombre: m.nombre, estado: m.estado, version: m.version, exportada_version: m.exportada_version,
  publicada_version: m.publicada_version, creado_en: m.creado_en, actualizado_en: m.actualizado_en, actualizado_por: m.actualizado_por };

export async function onRequestGet({ request, env }) {
  const { s, error } = await sesionValida(request, env);
  if (error) return error;
  const db = env.DB, u = new URL(request.url), id = u.searchParams.get('id');

  if (!id) {
    const archivadas = u.searchParams.get('archivadas') === '1';
    const r = await db.prepare(`SELECT * FROM iniciativas WHERE ws = ?${archivadas ? '' : " AND estado <> 'archivada'"} ORDER BY actualizado_en DESC`).bind(s.ws).all();
    return json({ ok: true, iniciativas: (r.results || []).map(publico) });
  }

  const m = await meta(db, id);
  if (!m || m.ws !== s.ws) return json({ ok: false, error: 'No existe esa iniciativa' }, 404);

  if (u.searchParams.get('historial') === '1') {
    const vs = await db.prepare('SELECT version, huella_len, nota, autor, creado_en FROM iniciativa_versiones WHERE iniciativa_id = ? ORDER BY version DESC').bind(id).all();
    const ev = await db.prepare('SELECT version, de, a, nota, autor, creado_en FROM iniciativa_eventos WHERE iniciativa_id = ? ORDER BY id DESC LIMIT 200').bind(id).all();
    return json({ ok: true, meta: publico(m), versiones: vs.results || [], eventos: ev.results || [] });
  }

  if (u.searchParams.has('desde')) {
    const desde = parseInt(u.searchParams.get('desde'), 10), hasta = parseInt(u.searchParams.get('hasta') || m.version, 10);
    const a = await leerVersion(db, id, desde), b = await leerVersion(db, id, hasta);
    if (!a || !b) return json({ ok: false, error: 'Versión no encontrada' }, 404);
    const cambios = V.diferencias(a, b).map(({ cambio, entidad, id, donde }) => ({ cambio, entidad, id, donde }));
    return json({ ok: true, desde, hasta, cambios });
  }

  const version = u.searchParams.has('version') ? parseInt(u.searchParams.get('version'), 10) : m.version;
  const iniciativa = await leerVersion(db, id, version);
  if (!iniciativa) return json({ ok: false, error: 'Versión no encontrada' }, 404);
  return json({ ok: true, meta: publico(m), version, iniciativa });
}

export async function onRequestPost({ request, env }) {
  const { s, error } = await sesionValida(request, env);
  if (error) return error;
  const db = env.DB;
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'JSON inválido' }, 400); }
  const ahora = nowIso();
  const evento = (id, version, de, a, nota) => db.prepare('INSERT INTO iniciativa_eventos (iniciativa_id, version, de, a, nota, autor, creado_en) VALUES (?,?,?,?,?,?,?)')
    .bind(id, version, de, a, (nota || '').slice(0, 500), s.usuario, ahora);

  /* ── GUARDAR: versión nueva ───────────────────────────────────────── */
  if (body.accion === 'guardar') {
    const ini = body.iniciativa;
    if (!ini || typeof ini !== 'object' || !/^ini_[\w-]+$/.test(ini.id || '') || !Array.isArray(ini.campanas)) return json({ ok: false, error: 'Falta una iniciativa válida (id ini_… y campañas).' }, 400);
    if (ini.esquema && ini.esquema !== 'mp-campana/1') return json({ ok: false, error: `Esquema desconocido: ${ini.esquema}` }, 400);
    const datos = JSON.stringify(ini);
    if (datos.length > MAX_BYTES) return json({ ok: false, error: 'La iniciativa es demasiado grande.' }, 413);
    const base = Number(body.base) || 0;
    const m = await meta(db, ini.id);
    if (m && m.ws !== s.ws) return json({ ok: false, error: 'Esa iniciativa pertenece a otro espacio.' }, 403);

    if (!m) {
      if (base !== 0) return json({ ok: false, error: 'La iniciativa ya no existe.', conflicto: true }, 409);
      await db.batch([
        db.prepare('INSERT INTO iniciativas (id, ws, nombre, estado, version, creado_en, actualizado_en, actualizado_por) VALUES (?,?,?,?,?,?,?,?)')
          .bind(ini.id, s.ws, String(ini.nombre || '').slice(0, 200), 'borrador', 1, ahora, ahora, s.usuario),
        db.prepare('INSERT INTO iniciativa_versiones (iniciativa_id, version, datos_json, huella_len, nota, autor, creado_en) VALUES (?,?,?,?,?,?,?)')
          .bind(ini.id, 1, datos, datos.length, (body.nota || '').slice(0, 500), s.usuario, ahora),
        evento(ini.id, 1, null, 'borrador', 'Creada')
      ]);
      return json({ ok: true, version: 1, estado: 'borrador', creada: true });
    }

    if (base !== m.version) return json({ ok: false, conflicto: true, version: m.version, actualizado_por: m.actualizado_por, actualizado_en: m.actualizado_en,
      error: `Otra persona o pestaña guardó la versión ${m.version} mientras editabas la ${base}. Recarga antes de guardar para no pisar ese trabajo.` }, 409);
    const anterior = await leerVersion(db, ini.id, m.version);
    if (anterior && V.huella(anterior) === V.huella(ini)) return json({ ok: true, version: m.version, estado: m.estado, sinCambios: true });

    if (m.publicada_version) {
      const publicada = await leerVersion(db, ini.id, m.publicada_version);
      const fijos = V.nombresFijos(publicada, ini);
      if (fijos.length) return json({ ok: false, nombresFijos: fijos,
        error: 'Tras publicar, los nombres de campañas y grupos quedan fijos (Ads Editor los reconoce por nombre y crearía un duplicado): ' +
          fijos.map(f => `${f.entidad} «${f.antes}» → «${f.ahora}»`).join('; ') + '.' }, 422);
    }

    const v = m.version + 1;
    const volvio = m.estado !== 'borrador';
    const ops = [
      db.prepare('INSERT INTO iniciativa_versiones (iniciativa_id, version, datos_json, huella_len, nota, autor, creado_en) VALUES (?,?,?,?,?,?,?)')
        .bind(ini.id, v, datos, datos.length, (body.nota || '').slice(0, 500), s.usuario, ahora),
      // Condición en el UPDATE: si alguien guardó entre la lectura y aquí, no pisa.
      db.prepare("UPDATE iniciativas SET version = ?, estado = 'borrador', nombre = ?, actualizado_en = ?, actualizado_por = ? WHERE id = ? AND version = ?")
        .bind(v, String(ini.nombre || '').slice(0, 200), ahora, s.usuario, ini.id, m.version)
    ];
    if (volvio) ops.push(evento(ini.id, v, m.estado, 'borrador', 'Editada'));
    // Poda: se guardan las últimas N versiones + la exportada y la publicada.
    ops.push(db.prepare('DELETE FROM iniciativa_versiones WHERE iniciativa_id = ? AND version <= ? AND version NOT IN (?, ?)')
      .bind(ini.id, v - VERSIONES_A_CONSERVAR, m.exportada_version || 0, m.publicada_version || 0));
    await db.batch(ops);
    return json({ ok: true, version: v, estado: 'borrador', volvioABorrador: volvio });
  }

  /* ── ESTADO: transición ───────────────────────────────────────────── */
  if (body.accion === 'estado') {
    const m = await meta(db, String(body.id || ''));
    if (!m || m.ws !== s.ws) return json({ ok: false, error: 'No existe esa iniciativa' }, 404);
    const a = body.estado;
    if (!V.ESTADOS.includes(a)) return json({ ok: false, error: `Estado desconocido: ${a}` }, 400);
    if (Number(body.base) !== m.version) return json({ ok: false, conflicto: true, version: m.version,
      error: `La iniciativa va en la versión ${m.version}; revisaste la ${body.base}. Recarga antes de cambiar su estado.` }, 409);
    if (!V.puedePasar(m.estado, a)) return json({ ok: false, error: `No se puede pasar de «${V.ETIQUETAS[m.estado]}» a «${V.ETIQUETAS[a]}».` }, 422);
    const campos = { estado: a };
    if (a === 'aprobada' || a === 'exportada') {
      const ini = await leerVersion(db, m.id, m.version);
      const r = R.validar(ini, { hoy: hoyChile() });
      if (!r.exportable) return json({ ok: false, error: `Tiene ${r.errores} error(es) que Google rechazaría. Corrígelos antes de ${a === 'aprobada' ? 'aprobar' : 'exportar'}.`,
        hallazgos: r.hallazgos.filter(h => h.nivel === 'error') }, 422);
      if (a === 'exportada') campos.exportada_version = m.version;
    }
    if (a === 'publicada') {
      if (m.exportada_version !== m.version) return json({ ok: false, error: 'Solo se publica la versión que se exportó.' }, 422);
      campos.publicada_version = m.version;
    }
    const sets = Object.keys(campos).map(k => k + ' = ?').join(', ');
    await db.batch([
      db.prepare(`UPDATE iniciativas SET ${sets}, actualizado_en = ?, actualizado_por = ? WHERE id = ? AND version = ?`)
        .bind(...Object.values(campos), ahora, s.usuario, m.id, m.version),
      evento(m.id, m.version, m.estado, a, body.nota)
    ]);
    return json({ ok: true, estado: a, version: m.version, exportada_version: campos.exportada_version ?? m.exportada_version, publicada_version: campos.publicada_version ?? m.publicada_version });
  }

  return json({ ok: false, error: 'Acción desconocida (guardar | estado).' }, 400);
}
