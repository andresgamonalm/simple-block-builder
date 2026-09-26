// SEARCH SOBRE EL MODELO (paso 4): POST /api/ia modos 'campana', 'corregir' e
// 'investigar'. Sin red: Gemini y la landing se simulan. Comprueba que la IA
// genera la campaña en el modelo con el protocolo, que corrige POR PARTES (solo
// ve lo pedido, responde con operaciones, se repara una vez si se equivoca) y
// que investiga una pregunta puntual actualizando solo esa parte de la ficha.
const fs = require("fs"), path = require("path"), os = require("os");
const RAIZ = process.env.SBB_RAIZ || path.resolve(__dirname, "..");
const AE = require(path.join(RAIZ, "nucleo/ads-editor.js"));
const R = require(path.join(RAIZ, "nucleo/reglas.js"));
let ok = 0, mal = 0;
const T = (c, n, e) => { if (c) { ok++; console.log("  ok   " + n); } else { mal++; console.log("  MAL  " + n + (e !== undefined ? " → " + e : "")); } };

function prepararModulos() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cmpia-"));
  fs.mkdirSync(path.join(dir, "api"));
  const cp = (src, dst, fix) => { let s = fs.readFileSync(path.join(RAIZ, src), "utf8"); if (fix) s = fix(s); fs.writeFileSync(path.join(dir, dst), s); };
  cp("functions/usuarios.js", "usuarios.mjs");
  cp("functions/api/_shared.js", "api/_shared.mjs", s => s.replace("'../usuarios.js'", "'../usuarios.mjs'"));
  cp("functions/api/ia.js", "api/ia.mjs", s => s.replace("'./_shared.js'", "'./_shared.mjs'").replace(/'\.\.\/\.\.\/nucleo\//g, "'" + path.join(RAIZ, "nucleo") + "/"));
  return dir;
}
const FICHA = {
  leyoLanding: true, producto: "Seguro Automotriz Full", categoria: "seguro de auto", propuestaValor: "Cobertura total con deducible desde 3 UF",
  beneficios: ["Deducible desde 3 UF", "Auto de reemplazo por 15 días"], pruebas: ["Más de 40 años en Chile"], ofertas: ["2 cuotas gratis"],
  condiciones: [], publico: "conductores", objeciones: ["¿Me suben la prima?"], vocabulario: ["seguro automotriz"], busquedas: ["seguro automotriz"],
  noOfrece: ["SOAP"], competidores: [{ nombre: "Otra", promesa: "precio" }], mensajesGenericos: ["los mejores precios"], angulosDiferenciales: ["auto de reemplazo"]
};
const kws = (base, n) => Array.from({ length: n }, (_, i) => ({ t: base + " " + i, tipo: i % 2 ? "frase" : "exacta" }));
const GENERADO = {
  nombre: "Seguro auto full",
  grupos: [
    { nombre: "Cotizar seguro auto", intencion: "Quiere cotizar ya", razonamiento: "Transaccional", angulo: "Auto de reemplazo 15 días",
      keywords: kws("cotizar seguro automotriz", 22), negativas: [{ t: "empleo", motivo: "Buscan trabajo" }],
      titularesFijos: ["Seguro Automotriz Acme", "Acme Seguro de Auto", "2 cuotas gratis en Acme", "Acme: deducible desde 3 UF", "Seguro Full con 2 cuotas gratis"],
      titulares: ["Cotiza seguro automotriz", "Seguro automotriz online", "Cotizar seguro auto", "Deducible desde 3 UF", "Auto de reemplazo 15 días", "Grúa en todo Chile",
                  "Más de 40 años en Chile", "Sin sorpresas al chocar", "Tu auto nunca se detiene", "Cotiza en 3 minutos"],
      descripciones: ["Deducible desde 3 UF y auto de reemplazo por 15 días. Cotiza hoy.", "Si chocas, no te quedas a pie: auto de reemplazo.",
                      "Más de 40 años protegiendo conductores en Chile.", "Grúa en todo Chile y 2 cuotas gratis."],
      path1: "seguro-auto", path2: "cotizar" },
    { nombre: "Precio seguro auto", intencion: "Compara precios", razonamiento: "Comparación", angulo: "Deducible bajo",
      keywords: kws("precio seguro automotriz", 21), negativas: [],
      titularesFijos: ["Precio Seguro Acme", "Acme desde 3 UF de deducible", "Acme con 2 cuotas gratis", "Seguro Acme para tu auto", "Acme: cotiza tu precio"],
      titulares: ["Precio seguro automotriz", "Seguro auto precio", "Cuánto cuesta tu seguro", "Deducible desde 3 UF", "Auto de reemplazo 15 días", "Grúa en todo Chile",
                  "Más de 40 años en Chile", "Compara y decide", "Precio claro sin letra chica", "Cotiza ahora"],
      descripciones: ["Conoce tu precio en minutos, con deducible desde 3 UF.", "Precio claro y 2 cuotas gratis."], path1: "precio", path2: "" }
  ],
  negativas: [{ t: "soap", motivo: "No vendemos el seguro obligatorio" }, { t: "curso", motivo: "Formación" }],
  sitelinks: [{ texto: "Cotizar", desc1: "En minutos", desc2: "100% online", url: "/cotizar" }, { texto: "Coberturas", desc1: "Todo incluido", desc2: "Revisa el detalle", url: "/coberturas" },
              { texto: "Deducibles", desc1: "Desde 3 UF", desc2: "Elige el tuyo", url: "/deducibles" }, { texto: "Contacto", desc1: "Te llamamos", desc2: "Sin compromiso", url: "/contacto" }],
  destacados: ["Grúa 24/7!", "Cotizar seguro auto", "Pago mensual", "Auto de reemplazo", "Sin letra chica"]
};
function respuestaGemini(obj, extra) {
  return new Response(JSON.stringify(Object.assign({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: "STOP" }] }, extra || {})),
    { status: 200, headers: { "Content-Type": "application/json" } });
}

(async () => {
  const dir = prepararModulos();
  const ia = await import(path.join(dir, "api/ia.mjs"));
  const sh = await import(path.join(dir, "api/_shared.mjs"));
  const env = { GEMINI_API_KEY: "x", JWT_SECRET: "s" };
  const cookie = async u => "sbb_session=" + await sh.signJWT({ u }, "s");
  const C = { andres: await cookie("andres"), equipo: await cookie("equipo") };
  const pedidos = [];
  let colaCorregir = [];      // respuestas simuladas para el modo corregir, en orden
  global.fetch = async (url, init) => {
    url = String(url);
    if (!url.includes("generativelanguage")) return new Response("<html><body><h1>Seguro Automotriz Full</h1><p>Deducible desde 3 UF. 2 cuotas gratis.</p><a href='/cotizar'>Cotizar</a></body></html>", { status: 200 });
    const body = JSON.parse(init.body);
    const prompt = body.contents[0].parts.map(p => p.text || "").join("");
    pedidos.push({ prompt, body });
    if (prompt.includes("Investiga ANTES")) return respuestaGemini(FICHA);
    if (prompt.includes("MATAR LO GENÉRICO")) return respuestaGemini({ grupos: [] });
    if (prompt.includes("Completa las keywords")) return respuestaGemini({ grupos: [] });
    if (prompt.includes("corrector ortográfico")) { const m = JSON.parse(prompt.slice(prompt.indexOf("TEXTOS A REVISAR:") + 17)); m.textos = m.textos.map(t => t.replace(/tambien/g, "también")); return respuestaGemini(m); }
    if (prompt.includes("especialista senior en Google Ads (Search) de")) return respuestaGemini(GENERADO);
    if (prompt.includes("Corriges una campaña YA ARMADA")) { const f = colaCorregir.shift(); return respuestaGemini(typeof f === "function" ? f(prompt) : (f || { explicacion: "", operaciones: [] })); }
    if (prompt.includes("UNA pregunta puntual")) return respuestaGemini({ respuesta: "Compiten Beta y Gama; Beta promete precio bajo.", ficha: { competidores: [{ nombre: "Beta", promesa: "precio bajo" }, { nombre: "Gama", promesa: "rapidez" }] } },
      { candidates: [{ content: { parts: [{ text: JSON.stringify({ respuesta: "Compiten Beta y Gama; Beta promete precio bajo.", ficha: { competidores: [{ nombre: "Beta", promesa: "precio bajo" }, { nombre: "Gama", promesa: "rapidez" }] } }) }] }, finishReason: "STOP",
        groundingMetadata: { groundingChunks: [{ web: { title: "beta.cl", uri: "https://x" } }] } }] });
    return respuestaGemini({});
  };
  const llamar = async (quien, payload) => {
    const req = new Request("https://mi-publicidad.gamonal.app/api/ia", { method: "POST", headers: { "Content-Type": "application/json", Cookie: C[quien] }, body: JSON.stringify(payload) });
    const res = await ia.onRequestPost({ request: req, env });
    return { status: res.status, ...(await res.json()) };
  };
  const marca = { nombre: "Acme", negocio: "seguros" };
  const brief = { que: "Seguro automotriz full para conductores en Chile", accion: "Cotizar", gancho: "2 cuotas gratis", ctaUrl: "https://www.acme.cl/seguro-auto", refs: [] };

  console.log("\n1 · Generar la campaña EN EL MODELO, con el protocolo");
  let r = await llamar("andres", { modo: "campana", brief, marca, opciones: { producto: "seguro automotriz", tipo: "always-on", presupuestoDiario: 20000, puja: "Maximize conversions" } });
  T(r.status === 200 && r.ok, "responde", r.status + " " + (r.error || ""));
  const ini = r.iniciativa, c = ini.campanas[0];
  const gen = pedidos.find(p => p.prompt.includes("especialista senior en Google Ads (Search) de"));
  T(gen.prompt.includes('"titularesFijos": [ "5 titulares') && gen.prompt.includes("fijados en la posición 1"), "pide 5 títulos fijados en la posición 1 + 10 que rotan (protocolo)");
  T(c.nombre === "chl-producto-seguro-automotriz-always-on" && c.grupos.map(g => g.nombre).join(",") === "ao-cotizar-seguro-auto,ao-precio-seguro-auto", "nombres con la taxonomía: campaña y grupos", c.nombre + " · " + c.grupos.map(g => g.nombre));
  const a = c.grupos[0].anuncios[0];
  T(a.titulos.filter(t => t.posicion === "1").length === 5 && a.titulos.filter(t => !t.posicion).length === 10 && a.nombre === "ads-auto-de-reemplazo-15", "anuncio: 5 fijados en la posición 1 + 10 que rotan, nombre ads-…", a.nombre);
  T(c.sufijoUrlFinal === "utm_source=gads&utm_medium=conversion&utm_campaign=chl-producto-seguro-automotriz-always-on" && a.sufijoUrlFinal.endsWith("utm_content=" + a.nombre), "UTM de campaña y de anuncio (medio «conversion» por la puja)");
  T(c.sitelinks.length === 4 && c.sitelinks[0].urlFinal === "https://www.acme.cl/cotizar", "sitelinks con URL absoluta https de la landing");
  T(c.destacados.map(d => d.texto).join("|") === "Grúa 24/7|Pago mensual|Auto de reemplazo|Sin letra chica", "destacados: sin «!» y sin el que repetía un título", c.destacados.map(d => d.texto).join("|"));
  T(c.grupos[0].intencion === "Quiere cotizar ya" && c.negativas[0].comentario === "No vendemos el seguro obligatorio", "el grupo guarda su intención y la negativa su motivo (columna Comment)");
  T(ini.ficha && ini.ficha.producto === "Seguro Automotriz Full" && ini.objetivo.gancho === "2 cuotas gratis" && c.presupuestoDiario === 20000 && c.estado === "Paused", "la iniciativa guarda la ficha y el objetivo; presupuesto CLP; se importa pausada");
  T(r.validacion && r.validacion.errores === 0 && r.validacion.exportable, "sale sin errores: exportable", JSON.stringify(r.validacion && r.validacion.hallazgos.filter(h => h.nivel === "error")));
  T(!r.validacion.hallazgos.some(h => /^P0[1-9]|P10/.test(h.codigo) && h.nivel !== "sugerencia"), "cumple el protocolo de la casa (sin avisos P)", JSON.stringify(r.validacion.hallazgos.filter(h => /^P/.test(h.codigo)).map(h => h.codigo + " " + h.mensaje)));
  const csv = AE.exportar(ini);
  T(AE.exportar(AE.importar(csv).iniciativa) === csv && csv.includes("chl-producto-seguro-automotriz-always-on,Search,"), "se exporta al CSV de Ads Editor y vuelve idéntico");

  console.log("\n2 · Con ficha guardada no se vuelve a investigar");
  const n0 = pedidos.filter(p => p.prompt.includes("Investiga ANTES")).length;
  r = await llamar("andres", { modo: "campana", brief, marca, ficha: ini.ficha, opciones: { producto: "seguro automotriz", tipo: "promociones" } });
  T(r.ok && pedidos.filter(p => p.prompt.includes("Investiga ANTES")).length === n0 && r.iniciativa.campanas[0].nombre.endsWith("-promociones") && r.iniciativa.campanas[0].grupos[0].nombre.startsWith("promo-"),
    "reutiliza la ficha (0 investigaciones nuevas) · tipo promociones → grupos promo-…");

  console.log("\n3 · Corregir POR PARTES");
  const g0 = c.grupos[0], g1 = c.grupos[1], t8 = g0.anuncios[0].titulos[8];
  colaCorregir = [
    { explicacion: "Cambié el título por uno con el ángulo diferencial.", operaciones: [
      { op: "cambiar", id: t8.id, campo: "texto", valor: "Auto de reemplazo tambien" },
      { op: "cambiar", id: g0.anuncios[0].titulos[9].id, campo: "texto", valor: "Un título larguísimo que no cabe en treinta" } ] },
    { explicacion: "Acorté el segundo.", operaciones: [{ op: "cambiar", id: g0.anuncios[0].titulos[9].id, campo: "texto", valor: "Tu auto sigue andando" }] }
  ];
  const p0 = pedidos.length;
  r = await llamar("andres", { modo: "corregir", iniciativa: ini, instruccion: "Los títulos 9 y 10 del grupo de cotizar son genéricos, cámbialos", ids: [t8.id, g0.anuncios[0].titulos[9].id], marca });
  const pc = pedidos.slice(p0).filter(p => p.prompt.includes("Corriges una campaña YA ARMADA"));
  T(r.ok && r.parcial && pc.length === 2, "hace la corrección y UNA ronda de reparación (el primer intento traía un título de más de 30)", r.error);
  T(pc[0].prompt.includes("2 cuotas gratis") && pc[0].prompt.includes("FICHA DEL PRODUCTO") && pc[0].prompt.includes("[" + g1.id + "]"), "la IA recibe el objetivo, la ficha guardada y el índice con ids");
  const kwOtroGrupo = g1.keywords[3].texto;
  T(!pc[0].prompt.includes(kwOtroGrupo) && !pc[0].prompt.includes(g0.keywords[5].texto), "pero NO la campaña entera: solo las partes pedidas (ni las keywords del grupo ni las del otro)");
  const a2 = r.iniciativa.campanas[0].grupos[0].anuncios[0];
  T(a2.titulos[8].texto === "Auto de reemplazo también" && a2.titulos[9].texto === "Tu auto sigue andando" && r.rechazadas.length === 0 && r.reparada, "quedan los dos títulos nuevos (con ortografía revisada) y nada rechazado");
  T(JSON.stringify(r.iniciativa.campanas[0].grupos[1]) === JSON.stringify(g1) && a2.titulos[0].texto === g0.anuncios[0].titulos[0].texto, "todo lo demás queda intacto");

  console.log("\n4 · Corregir a partir de un hallazgo (y reparar el error que la IA introduce)");
  const ref = AE.importar(fs.readFileSync(path.join(RAIZ, "pruebas/datos/ads-editor-referencia.csv"), "utf8")).iniciativa;
  const v0 = R.validar(ref, { hoy: "2026-09-26" });
  const h = v0.hallazgos.find(x => x.codigo === "C01");
  const negMala = ref.campanas[0].negativas.find(n => n.texto === "comprar auto");
  colaCorregir = [
    { explicacion: "Cambio la negativa por una de frase y agrego otra.", operaciones: [
      { op: "quitar", id: negMala.id },
      { op: "agregar", en: ref.campanas[0].id, lista: "negativas", elemento: { texto: "seguro", concordancia: "amplia", comentario: "error a propósito" } } ] },
    prompt => { const m = prompt.match(/"id":"(neg_[^"]+)","texto":"seguro"/); return { explicacion: "Quité la que bloqueaba.", operaciones: m ? [{ op: "quitar", id: m[1] }] : [] }; }
  ];
  const p1 = pedidos.length;
  r = await llamar("andres", { modo: "corregir", iniciativa: ref, hallazgos: [h.codigo + ":" + h.id] });
  const pc2 = pedidos.slice(p1).filter(p => p.prompt.includes("Corriges una campaña YA ARMADA"));
  T(r.ok && pc2[0].prompt.includes("HALLAZGOS A RESOLVER") && pc2[0].prompt.includes("[C01]"), "la instrucción puede ser un hallazgo del motor de reglas (sin escribir nada)");
  T(pc2.length === 2 && pc2[1].prompt.includes("ERRORES que aparecieron tras tus cambios"), "la negativa nueva bloqueaba keywords: se le devuelve el error a la IA");
  T(r.erroresNuevos.length === 0 && !r.validacion.hallazgos.some(x => x.codigo === "C01"), "al final no queda ningún bloqueo (C01)", JSON.stringify(r.erroresNuevos));
  T(r.antes.errores === 4 && r.validacion.errores === 2, "errores de la campaña: 4 → 2 (quedan solo las fechas «[]», que no se pidieron)", r.antes.errores + " → " + r.validacion.errores);

  console.log("\n5 · Investigar una parte");
  r = await llamar("andres", { modo: "investigar", iniciativa: ini, pregunta: "¿Quiénes compiten por «seguro automotriz» en Google Chile?" });
  const pi = pedidos.slice(-1)[0];
  T(r.ok && r.cambiados.join() === "competidores" && r.ficha.competidores.length === 2 && r.ficha.beneficios.join() === ini.ficha.beneficios.join(), "actualiza SOLO los competidores; el resto de la ficha queda igual");
  T(JSON.stringify(pi.body.tools).includes("google_search") && r.fuentes.includes("beta.cl") && r.respuesta.includes("Beta"), "busca en Google y devuelve respuesta y fuentes");

  console.log("\n6 · Permisos");
  r = await llamar("equipo", { modo: "corregir", iniciativa: ini, instruccion: "x" });
  T(r.status === 403, "un usuario sin permiso de Search no puede corregir campañas");

  console.log(`\n${mal ? "FALLAN " + mal : "TODO BIEN"} · ${ok}/${ok + mal}`);
  process.exit(mal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
