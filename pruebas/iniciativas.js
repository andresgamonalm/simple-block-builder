// GUARDADO POR INICIATIVA (functions/api/iniciativas.js) — servidor, sin red.
// La D1 es un SQLite real (node:sqlite) detrás de la misma interfaz que da
// Cloudflare (prepare/bind/first/all/run/batch). La sesión es una cookie
// firmada de verdad. La iniciativa es la campaña de referencia (anonimizada).
const fs = require("fs"), path = require("path"), os = require("os");
const { DatabaseSync } = require("node:sqlite");
const RAIZ = process.env.SBB_RAIZ || path.resolve(__dirname, "..");
const AE = require(path.join(RAIZ, "nucleo/ads-editor.js"));
const V = require(path.join(RAIZ, "nucleo/versiones.js"));
let ok = 0, mal = 0;
const T = (c, n, e) => { if (c) { ok++; console.log("  ok   " + n); } else { mal++; console.log("  MAL  " + n + (e !== undefined ? " → " + e : "")); } };

function prepararModulos() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "inic-"));
  ["functions/api", "nucleo"].forEach(d => fs.mkdirSync(path.join(dir, d), { recursive: true }));
  const cp = (src, dst, fix) => { let s = fs.readFileSync(path.join(RAIZ, src), "utf8"); if (fix) s = fix(s); fs.writeFileSync(path.join(dir, dst), s); };
  cp("functions/usuarios.js", "functions/usuarios.mjs");
  cp("functions/api/_shared.js", "functions/api/_shared.mjs", s => s.replace("'../usuarios.js'", "'../usuarios.mjs'"));
  cp("functions/api/iniciativas.js", "functions/api/iniciativas.mjs", s => s.replace("'./_shared.js'", "'./_shared.mjs'").replace(/nucleo\/(\w+)\.js/g, "nucleo/$1.cjs"));
  ["modelo", "reglas", "versiones"].forEach(n => cp("nucleo/" + n + ".js", "nucleo/" + n + ".cjs", s => s.replace("'./modelo.js'", "'./modelo.cjs'")));
  return dir;
}
// D1 sobre SQLite, con la misma forma que la de Cloudflare.
function d1() {
  const db = new DatabaseSync(":memory:");
  const stmt = (sql, args) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...(args || [])) || null,
    all: async () => ({ results: db.prepare(sql).all(...(args || [])) }),
    run: async () => db.prepare(sql).run(...(args || [])),
    _run: () => db.prepare(sql).run(...(args || []))
  });
  return { prepare: sql => stmt(sql, []), batch: async list => { db.exec("BEGIN"); try { const r = list.map(s => s._run()); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; } }, _db: db };
}

(async () => {
  const dir = prepararModulos();
  const api = await import(path.join(dir, "functions/api/iniciativas.mjs"));
  const sh = await import(path.join(dir, "functions/api/_shared.mjs"));
  const env = { DB: d1(), JWT_SECRET: "secreto-de-prueba" };
  const cookie = async u => "sbb_session=" + await sh.signJWT({ u }, env.JWT_SECRET);
  const C = { andres: await cookie("andres"), lorena: await cookie("lorena") };
  const llamar = async (quien, metodo, q, body) => {
    const request = new Request("https://mi-publicidad.gamonal.app/api/iniciativas" + (q || ""), { method: metodo,
      headers: Object.assign({ "content-type": "application/json" }, quien ? { cookie: C[quien] } : {}), body: body ? JSON.stringify(body) : undefined });
    const r = await (metodo === "GET" ? api.onRequestGet : api.onRequestPost)({ request, env });
    return { status: r.status, ...(await r.json()) };
  };
  const ini = AE.importar(fs.readFileSync(path.join(RAIZ, "pruebas/datos/ads-editor-referencia.csv"), "utf8")).iniciativa;
  const id = ini.id;

  console.log("\n1 · Acceso");
  T((await llamar(null, "GET")).status === 401, "sin sesión → 401");

  console.log("\n2 · Guardar crea versiones");
  let r = await llamar("andres", "POST", "", { accion: "guardar", iniciativa: ini, base: 0, nota: "Importada del CSV" });
  T(r.ok && r.version === 1 && r.estado === "borrador" && r.creada, "primera vez: versión 1, borrador", JSON.stringify(r));
  r = await llamar("andres", "GET");
  T(r.iniciativas.length === 1 && r.iniciativas[0].nombre === ini.nombre && !("datos_json" in r.iniciativas[0]), "la lista trae la iniciativa (sin su contenido)");
  r = await llamar("andres", "GET", "?id=" + id);
  T(r.ok && V.huella(r.iniciativa) === V.huella(ini), "se lee exactamente lo guardado");
  r = await llamar("andres", "POST", "", { accion: "guardar", iniciativa: ini, base: 1 });
  T(r.ok && r.sinCambios && r.version === 1, "guardar sin cambios no crea versión");
  ini.campanas[0].presupuestoDiario = 25000;
  r = await llamar("andres", "POST", "", { accion: "guardar", iniciativa: ini, base: 1 });
  T(r.ok && r.version === 2, "con cambios → versión 2");

  console.log("\n3 · No pisa el trabajo de otro");
  ini.campanas[0].presupuestoDiario = 26000;
  r = await llamar("andres", "POST", "", { accion: "guardar", iniciativa: ini, base: 1 });
  T(r.status === 409 && r.conflicto && r.version === 2, "guardar sobre una versión vieja → 409 (conflicto), no sobrescribe", JSON.stringify(r));
  r = await llamar("lorena", "GET", "?id=" + id);
  T(r.status === 404 && (await llamar("lorena", "GET")).iniciativas.length === 0, "otro espacio de trabajo no la ve");
  r = await llamar("lorena", "POST", "", { accion: "guardar", iniciativa: ini, base: 2 });
  T(r.status === 403, "ni la puede sobrescribir");

  console.log("\n4 · Estados");
  r = await llamar("andres", "POST", "", { accion: "estado", id, estado: "aprobada", base: 2 });
  T(r.status === 422 && r.hallazgos.length === 4 && r.hallazgos.every(h => h.nivel === "error"), "aprobar con los 4 errores del CSV real → rechazado, con los errores por id", r.hallazgos && r.hallazgos.length);
  ini.campanas.forEach(c => { c.inicio = ""; c.fin = "2099-12-31"; c.negativas = c.negativas.filter(n => n.texto !== "comprar auto"); });
  r = await llamar("andres", "POST", "", { accion: "guardar", iniciativa: ini, base: 2, nota: "Corrige fechas y la negativa que bloqueaba" });
  T(r.version === 3, "corregido → versión 3");
  r = await llamar("andres", "POST", "", { accion: "estado", id, estado: "publicada", base: 3 });
  T(r.status === 422, "no se puede publicar un borrador (sin pasar por aprobada y exportada)");
  r = await llamar("andres", "POST", "", { accion: "estado", id, estado: "aprobada", base: 3 });
  T(r.ok && r.estado === "aprobada", "sin errores → aprobada", JSON.stringify(r));
  r = await llamar("andres", "POST", "", { accion: "estado", id, estado: "exportada", base: 3 });
  T(r.ok && r.exportada_version === 3, "exportada: queda anotada la versión 3");
  r = await llamar("andres", "POST", "", { accion: "estado", id, estado: "publicada", base: 2 });
  T(r.status === 409, "cambiar el estado de una versión que no es la actual → 409");
  r = await llamar("andres", "POST", "", { accion: "estado", id, estado: "publicada", base: 3, nota: "Subida a Google Ads" });
  T(r.ok && r.publicada_version === 3, "publicada: versión 3");

  console.log("\n5 · Después de publicar");
  const renombrada = JSON.parse(JSON.stringify(ini)); renombrada.campanas[0].nombre = "chl-producto-auto-digital-always-on";
  r = await llamar("andres", "POST", "", { accion: "guardar", iniciativa: renombrada, base: 3 });
  T(r.status === 422 && r.nombresFijos.length === 1, "renombrar una campaña publicada → rechazado (Ads Editor crearía un duplicado)", r.error);
  ini.campanas[0].presupuestoDiario = 30000;
  r = await llamar("andres", "POST", "", { accion: "guardar", iniciativa: ini, base: 3 });
  T(r.ok && r.version === 4 && r.estado === "borrador" && r.volvioABorrador, "editar lo publicado → versión 4, vuelve a borrador");
  r = await llamar("andres", "GET", "?id=" + id);
  T(r.meta.publicada_version === 3 && r.meta.exportada_version === 3 && r.meta.estado === "borrador", "la versión publicada (3) queda anotada para exportar solo los cambios");
  r = await llamar("andres", "GET", "?id=" + id + "&desde=3");
  T(r.ok && r.cambios.length === 1 && r.cambios[0].entidad === "campaña" && r.cambios[0].cambio === "modificado", "qué cambió desde la publicada: la campaña (presupuesto)", JSON.stringify(r.cambios));
  const pub = (await llamar("andres", "GET", "?id=" + id + "&version=3")).iniciativa;
  const cam = V.cambiosParaEditor(pub, ini);
  T(cam.total === 1 && /,30000,/.test(AE.exportar(cam.iniciativa)), "archivo de solo cambios: una fila de campaña con el presupuesto nuevo");
  r = await llamar("andres", "GET", "?id=" + id + "&historial=1");
  T(r.versiones.length === 4 && r.eventos.map(e => e.a).join(",") === "borrador,publicada,exportada,aprobada,borrador", "historial: 4 versiones y los eventos con autor y hora", r.eventos.map(e => e.a).join(","));
  T(r.versiones[1].nota === "Corrige fechas y la negativa que bloqueaba" || r.versiones.some(v => v.nota === "Corrige fechas y la negativa que bloqueaba"), "cada versión conserva su nota");

  console.log("\n6 · Poda: últimas 50 versiones + la exportada y la publicada");
  let base = 4;
  for (let i = 0; i < 55; i++) { ini.campanas[0].presupuestoDiario = 31000 + i; r = await llamar("andres", "POST", "", { accion: "guardar", iniciativa: ini, base }); base = r.version; }
  r = await llamar("andres", "GET", "?id=" + id + "&historial=1");
  const nums = r.versiones.map(v => v.version);
  T(base === 59 && nums.length === 51 && nums.includes(3) && nums[0] === 59 && !nums.includes(4), "59 versiones → se guardan 50 recientes + la 3 (exportada y publicada)", nums.length + " · " + nums.slice(-3).join(","));
  T((await llamar("andres", "GET", "?id=" + id + "&version=3")).ok, "la versión publicada sigue legible");

  console.log(`\n${mal ? "FALLAN " + mal : "TODO BIEN"} · ${ok}/${ok + mal}`);
  process.exit(mal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
