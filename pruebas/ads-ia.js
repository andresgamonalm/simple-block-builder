// SEARCH CON INVESTIGACIÓN (sep-2026). Recorre POST /api/ia { producto:'ads' }
// completo, sin red y sin gastar llamadas: Gemini y la landing se simulan.
// Comprueba el pipeline en etapas: investigar → estructurar → criticar →
// filtros duros → ortografía, y que nada se caiga si la investigación falla.
const fs = require("fs"), path = require("path"), os = require("os");
const RAIZ = process.env.SBB_RAIZ || path.resolve(__dirname, "..");
let ok = 0, mal = 0;
const T = (c, n, e) => { if (c) { ok++; console.log("  ok   " + n); } else { mal++; console.log("  MAL  " + n + (e !== undefined ? " → " + e : "")); } };

// ia.js y _shared.js son módulos ES dentro de un paquete CommonJS: se copian
// como .mjs a una carpeta temporal para poder importarlos desde node.
function prepararModulos() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "adsia-"));
  fs.mkdirSync(path.join(dir, "api"));
  const cp = (src, dst, fix) => { let s = fs.readFileSync(path.join(RAIZ, src), "utf8"); if (fix) s = fix(s); fs.writeFileSync(path.join(dir, dst), s); };
  cp("functions/usuarios.js", "usuarios.mjs");
  cp("functions/api/_shared.js", "api/_shared.mjs", s => s.replace("'../usuarios.js'", "'../usuarios.mjs'"));
  cp("functions/api/ia.js", "api/ia.mjs", s => s.replace("'./_shared.js'", "'./_shared.mjs'"));
  return dir;
}

const FICHA = {
  leyoLanding: true, producto: "Seguro Automotriz Full", categoria: "seguro de auto",
  propuestaValor: "Cobertura total con deducible desde 3 UF y auto de reemplazo",
  beneficios: ["Deducible desde 3 UF", "Auto de reemplazo por 15 días", "Grúa ilimitada 24/7"],
  pruebas: ["Más de 40 años en Chile", "4,6 de calificación en Google"],
  ofertas: ["2 cuotas gratis"], condiciones: ["Autos de hasta 15 años"], publico: "conductores en Chile",
  objeciones: ["¿Me suben la prima si choco?"], vocabulario: ["seguro automotriz", "deducible", "auto de reemplazo"],
  busquedas: ["seguro automotriz", "cotizar seguro auto", "seguro auto precio"],
  noOfrece: ["SOAP", "seguro de moto", "seguro de camión"],
  competidores: [{ nombre: "Otra Aseguradora", promesa: "el mejor precio" }],
  mensajesGenericos: ["los mejores precios", "cotiza rápido y fácil"],
  angulosDiferenciales: ["auto de reemplazo por 15 días"]
};
const kws = n => Array.from({ length: n }, (_, i) => ({ t: (i % 2 ? "cotizar seguro automotriz opcion " : "seguro auto ") + i, tipo: i % 2 ? "frase" : "exacta" }));
const GENERADO = {
  nombre: "Seguro auto full",
  grupos: [{
    nombre: "cotizar-seguro-auto", intencion: "Quiere cotizar ya", razonamiento: "Grupo transaccional", angulo: "Auto de reemplazo",
    keywords: kws(14).concat([{ t: "seguro auto moto" }]),
    negativas: [{ t: "empleo", motivo: "Buscan trabajo en aseguradoras" }, { t: "auto", motivo: "mal: bloquea keywords propias" }],
    titularesFijos: ["Seguro Automotriz Full", "Cotiza tu seguro de auto", "Los mejores precios", "Cotiza en línea hoy"],
    titulares: ["Deducible desde 3 UF", "Auto de reemplazo 15 días", "90% de descuento hoy", "Grúa ilimitada 24/7", "Más de 40 años en Chile",
                "Calificación 4,6 en Google", "Rápido y fácil de contratar", "2 cuotas gratis", "Sin sorpresas al chocar", "Cobertura total", "Protege tu auto"],
    descripciones: ["Deducible desde 3 UF y auto de reemplazo por 15 días. Cotiza hoy.", "Calidad garantizada para ti.",
                    "Más de 40 años protegiendo conductores en Chile.", "Grúa ilimitada 24/7 en todo Chile."],
    path1: "Seguro Auto", path2: "cotizar"
  }],
  negativas: [{ t: "soap", motivo: "No vendemos el seguro obligatorio" }, { t: "seguro de moto", motivo: "Solo autos" }, "curso", { t: "seguro auto", motivo: "bloquea" }],
  sitelinks: [{ texto: "Cotizar", desc1: "En minutos", desc2: "Online", url: "/cotizar" }]
};

function respuestaGemini(obj, extra) {
  return new Response(JSON.stringify(Object.assign({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: "STOP" }] }, extra || {})),
    { status: 200, headers: { "Content-Type": "application/json" } });
}

(async () => {
  const dir = prepararModulos();
  const ia = await import(path.join(dir, "api/ia.mjs"));
  const sh = await import(path.join(dir, "api/_shared.mjs"));
  const admin = sh.listaUsuarios().find(u => u.rol === "admin");
  const env = { GEMINI_API_KEY: "x", JWT_SECRET: "s" };
  const cookie = "sbb_session=" + await sh.signJWT({ u: admin.usuario }, "s");
  const nombreCookie = (fs.readFileSync(path.join(RAIZ, "functions/api/_shared.js"), "utf8").match(/SESSION_COOKIE\s*=\s*['"]([^'"]+)/) || [])[1] || "sbb_session";

  const pedidos = [];
  let fallarInvestigacion = false, landingCaida = false;
  global.fetch = async (url, init) => {
    url = String(url);
    if (!url.includes("generativelanguage")) {
      if (landingCaida) return new Response("", { status: 500 });
      return new Response("<html><head><title>Seguro Automotriz Full</title></head><body><h1>Seguro Automotriz Full</h1><p>Deducible desde 3 UF. 2 cuotas gratis. Más de 40 años en Chile.</p><a href='/cotizar'>Cotizar ahora</a></body></html>", { status: 200 });
    }
    const body = JSON.parse(init.body);
    const prompt = body.contents[0].parts.map(p => p.text || "").join("");
    pedidos.push({ prompt, body });
    if (prompt.includes("Investiga ANTES")) {
      if (fallarInvestigacion) return new Response("{}", { status: 400 });
      return respuestaGemini(FICHA, {
        candidates: [{ content: { parts: [{ text: "Razonando…", thought: true }, { text: JSON.stringify(FICHA) }] }, finishReason: "STOP",
          urlContextMetadata: { urlMetadata: [{ retrievedUrl: "https://ejemplo.cl/seguro-auto", urlRetrievalStatus: "URL_RETRIEVAL_STATUS_SUCCESS" }] },
          groundingMetadata: { groundingChunks: [{ web: { title: "otraaseguradora.cl", uri: "https://x" } }] } }]
      });
    }
    if (prompt.includes("MATAR LO GENÉRICO")) {
      return respuestaGemini({ grupos: [{ i: 0, titularesFijos: ["Seguro Automotriz Full", "Cotiza tu seguro de auto", "Auto de reemplazo 15 días", "Cotiza en línea hoy"],
        titulares: ["Deducible desde 3 UF", "Un titular larguísimo que no cabe en treinta"], descripciones: ["Si chocas, tu auto de reemplazo llega en 24 horas."] }] });
    }
    if (prompt.includes("Completa las keywords")) return respuestaGemini({ grupos: [{ nombre: "cotizar seguro auto", keywords: kws(30).map(k => ({ t: k.t.replace("seguro", "poliza"), tipo: k.tipo })) }] });
    if (prompt.includes("corrector ortográfico")) { const m = prompt.slice(prompt.indexOf("TEXTOS A REVISAR:") + 17); return respuestaGemini(JSON.parse(m)); }
    if (prompt.includes("especialista senior en Google Ads (Search) de")) return respuestaGemini(GENERADO);
    return respuestaGemini({});
  };

  const llamar = async (brief) => {
    const req = new Request("https://mi-publicidad.gamonal.app/api/ia", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie.replace("sbb_session", nombreCookie) },
      body: JSON.stringify({ producto: "ads", brief, marca: { nombre: "Aseguradora Demo", negocio: "seguros" } }) });
    const res = await ia.onRequestPost({ request: req, env });
    return { status: res.status, data: await res.json() };
  };
  const brief = { que: "Campaña de seguro automotriz full", accion: "Cotizar", ctaUrl: "https://ejemplo.cl/seguro-auto", refs: [], notas: "", legal: "no" };

  console.log("\n1 · Investigación previa: lee la landing y busca la competencia");
  const r = await llamar(brief);
  T(r.status === 200 && r.data.ok, "la generación responde bien", r.status + " " + JSON.stringify(r.data).slice(0, 200));
  const inv = pedidos.find(p => p.prompt.includes("Investiga ANTES"));
  T(inv && JSON.stringify(inv.body.tools).includes("url_context") && JSON.stringify(inv.body.tools).includes("google_search"), "pide a Gemini leer la URL y buscar en Google");
  T(inv && !inv.body.generationConfig.responseMimeType, "con herramientas no fuerza el modo JSON (Gemini lo rechaza)");
  const gen = pedidos.find(p => p.prompt.includes("especialista senior en Google Ads (Search) de"));
  T(gen && gen.prompt.includes("Auto de reemplazo por 15 días") && gen.prompt.includes("MENSAJES GENÉRICOS"), "la ficha de la investigación entra al prompt del generador");
  T(gen && gen.prompt.includes("Deducible desde 3 UF. 2 cuotas gratis"), "el texto de la landing leído por el servidor también entra");
  const d = r.data, g = d.grupos && d.grupos[0];
  T(d.analisis && d.analisis.competidores.length === 1 && d.analisis.fuentes.includes("otraaseguradora.cl"), "devuelve el análisis con competidores y fuentes de Google");

  console.log("\n2 · Crítico: reescribe lo genérico, respeta los límites");
  T(pedidos.some(p => p.prompt.includes("MATAR LO GENÉRICO")), "se llama al crítico");
  T(g.titularesFijos[2] === "Auto de reemplazo 15 días", "reemplaza el titular fijo trillado", g.titularesFijos.join(" | "));
  T(!g.titulares.some(t => t.length > 30), "ningún titular pasa de 30 caracteres");
  T(!g.titulares.includes("Un titular larguísimo que no cabe en treinta"), "rechaza la reescritura que no cabe");

  console.log("\n3 · Filtros duros del servidor");
  T(!g.titulares.some(t => /90%/.test(t)), "descarta la cifra inventada (90%)", g.titulares.join(" | "));
  T(!g.titulares.some(t => /r[aá]pido y f[aá]cil/i.test(t)), "descarta el cliché \"rápido y fácil\"");
  T(!g.descripciones.some(t => /calidad garantizada/i.test(t)), "descarta la descripción \"calidad garantizada\"");
  T(g.titulares.includes("Deducible desde 3 UF") && g.titulares.includes("2 cuotas gratis"), "conserva las cifras reales de la landing");
  T(g.titulares.length >= 8 && g.descripciones.length >= 2, "el anuncio sigue completo (≥8 titulares, ≥2 descripciones)", g.titulares.length + "/" + g.descripciones.length);
  T(Array.isArray(d.avisos) && d.avisos.some(a => /descartaron/.test(a.texto)), "avisa lo que descartó");

  console.log("\n4 · Negativas razonadas");
  T(d.negativas.includes("soap") && d.negativasMotivos.soap === "No vendemos el seguro obligatorio", "negativa de campaña con su motivo");
  T(d.negativas.includes("curso"), "acepta negativas en formato texto (compat)");
  T(!d.negativas.includes("seguro auto"), "saca la negativa que bloquearía keywords propias");
  T(!g.negativas.includes("auto") && g.negativas.includes("empleo"), "lo mismo en las negativas del grupo");
  T(d.avisos.some(a => /bloqueado keywords/.test(a.texto)), "avisa las negativas quitadas");
  T(d.negativas.every(n => typeof n === "string"), "la lista sigue siendo de textos (consola, XLSX y CSV no cambian)");

  console.log("\n5 · Estructura (sin regresiones)");
  T(g.nombre === "cotizar seguro auto", "nombre legible, no slug", g.nombre);
  T(g.keywords.length >= 20 && g.keywords.length <= 25, "rellena el grupo flaco hasta 20-25 keywords", g.keywords.length);
  T(g.keywords.every(k => k.tipo === "exacta" || k.tipo === "frase"), "solo exacta y frase");
  T(g.path1 === "seguro-auto", "path en minúsculas con guiones", g.path1);
  T(/Ángulo: Auto de reemplazo/.test(g.razonamiento), "el ángulo diferencial queda visible en el razonamiento del grupo");

  console.log("\n6 · Si la investigación falla, igual genera y lo dice");
  pedidos.length = 0; fallarInvestigacion = true;
  const r2 = await llamar(brief);
  T(r2.status === 200 && r2.data.ok, "genera con el texto de la landing", r2.status);
  T(pedidos.some(p => p.prompt.includes("Investiga ANTES") && JSON.stringify(p.body.tools) === '[{"google_search":{}}]'), "reintenta la investigación solo con Google antes de rendirse");
  T(r2.data.avisos.some(a => /análisis de la landing y la competencia/.test(a.texto)), "avisa que se armó sin investigación");
  T(r2.data.analisis === null, "sin análisis inventado");

  console.log("\n7 · Landing ilegible para el servidor pero leída por Gemini: sin aviso falso");
  pedidos.length = 0; fallarInvestigacion = false; landingCaida = true;
  const r3 = await llamar(brief);
  T(r3.status === 200 && !r3.data.avisos.some(a => a.tipo === "url-no-leida"), "no avisa \"no se pudo leer\" si Gemini sí la leyó", JSON.stringify(r3.data.avisos));

  console.log(`\n${mal ? "FALLAN " + mal : "TODO BIEN"} · ${ok}/${ok + mal}`);
  process.exit(mal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
