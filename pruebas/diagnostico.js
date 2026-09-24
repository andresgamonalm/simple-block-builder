// TU CAMPAÑA ACTUAL — servidor (sin navegador, sin red). Datos INVENTADOS en
// pruebas/datos/: un informe de términos de búsqueda como lo exporta Google Ads
// en español (UTF-8, dos líneas de título, montos en CLP) y uno de keywords
// como lo exporta Ads Editor (inglés, UTF-16, tabuladores). Gemini se simula.
const fs = require("fs"), path = require("path"), os = require("os");
const RAIZ = process.env.SBB_RAIZ || path.resolve(__dirname, "..");
let ok = 0, mal = 0;
const T = (c, n, e) => { if (c) { ok++; console.log("  ok   " + n); } else { mal++; console.log("  MAL  " + n + (e !== undefined ? " → " + e : "")); } };

function prepararModulos() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "diag-"));
  fs.mkdirSync(path.join(dir, "api"));
  const cp = (src, dst, fix) => { let s = fs.readFileSync(path.join(RAIZ, src), "utf8"); if (fix) s = fix(s); fs.writeFileSync(path.join(dir, dst), s); };
  cp("functions/usuarios.js", "usuarios.mjs");
  cp("functions/api/_shared.js", "api/_shared.mjs", s => s.replace("'../usuarios.js'", "'../usuarios.mjs'"));
  cp("functions/api/ia.js", "api/ia.mjs", s => s.replace("'./_shared.js'", "'./_shared.mjs'"));
  return dir;
}
const leerUTF16 = f => new TextDecoder("utf-16le").decode(fs.readFileSync(f).subarray(2));

(async () => {
  const dir = prepararModulos();
  const ia = await import(path.join(dir, "api/ia.mjs"));
  const sh = await import(path.join(dir, "api/_shared.mjs"));
  const terminos = fs.readFileSync(path.join(RAIZ, "pruebas/datos/terminos-busqueda.csv"), "utf8");
  const keywords = leerUTF16(path.join(RAIZ, "pruebas/datos/keywords-ads-editor.csv"));

  console.log("\n1 · Números como los escribe Google Ads");
  const N = ia.numeroAds;
  T(N("$2.000") === 2000, "$2.000 (CLP) → 2000", N("$2.000"));
  T(N("$1.245.900") === 1245900, "$1.245.900 → 1245900");
  T(N("1.234,5") === 1234.5, "1.234,5 → 1234,5");
  T(N("2,000.50") === 2000.5, "2,000.50 → 2000,5");
  T(N("7,50%") === 7.5, "7,50% → 7,5");
  T(N("0.75") === 0.75 && N("--") === 0, "0.75 y -- (vacío)");

  console.log("\n2 · Lee los informes (aunque traigan títulos arriba o vengan en UTF-16)");
  const a = ia.analizarTabla("terminos-busqueda.csv", terminos);
  T(a && a.tipo === "terminos" && a.filas === 10, "términos: encuentra la cabecera tras las líneas de título y descarta la fila Total", a && a.filas);
  T(a.totales.costo === 1245900 && a.totales.clics === 662, "totales exactos (costo y clics)", JSON.stringify(a.totales));
  T(a.totales.cpc === 1882, "CPC promedio calculado: $1.882", a.totales.cpc);
  T(a.gastoSinConversion === 560900, "gasto sin conversión: $560.900", a.gastoSinConversion);
  T(a.sinConversion[0].t === "soap 2026", "lo que más gasta sin convertir va primero", a.sinConversion[0].t);
  T(a.convierten.some(x => x.t === "cotizar seguro auto"), "detecta lo que SÍ convierte");
  const k = ia.analizarTabla("keywords.csv", keywords);
  T(k && k.tipo === "keywords" && k.filas === 4, "keywords en UTF-16 con tabuladores", k && k.filas);
  T(k.amplias.length === 2 && k.amplias[0].t === "seguro automotriz", "detecta la concordancia amplia (Broad)", JSON.stringify(k.amplias.map(x => x.t)));
  T(k.calidadBaja.length === 2, "detecta nivel de calidad bajo 5", k.calidadBaja.map(x => x.t + ":" + x.calidad).join(","));
  T(ia.analizarTabla("otra-cosa.csv", "nombre,edad\nana,3") === null, "un archivo que no es de Google Ads no se inventa como informe");

  // ── Gemini simulado ──
  const pedidos = [];
  let respuesta = null;
  global.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    const prompt = body.contents[0].parts.map(p => p.text || "").join("");
    pedidos.push({ prompt, body });
    let obj = {};
    if (prompt.includes("auditor senior de Google Ads")) obj = respuesta;
    else if (prompt.includes("corrector ortográfico")) obj = JSON.parse(prompt.slice(prompt.indexOf("TEXTOS A REVISAR:") + 17));
    else if (prompt.includes("Investiga ANTES")) obj = { producto: "Seguro Automotriz", beneficios: ["Deducible desde 3 UF"] };
    else if (prompt.includes("MATAR LO GENÉRICO")) obj = { grupos: [] };
    else if (prompt.includes("especialista senior en Google Ads (Search) de")) obj = {
      nombre: "Seguro auto", negativas: [{ t: "curso", motivo: "formación" }],
      grupos: [{ nombre: "Cotizar", intencion: "cotizar", keywords: [{ t: "seguro obligatorio", tipo: "exacta" }].concat(Array.from({ length: 21 }, (_, i) => ({ t: "cotizar seguro auto " + i, tipo: i % 2 ? "frase" : "exacta" }))),
        titularesFijos: ["Seguro Auto", "Cotiza tu seguro auto", "Deducible desde 3 UF", "Cotiza en línea"], titulares: ["Deducible desde 3 UF bajo"], descripciones: ["Deducible desde 3 UF.", "Cotiza hoy."] }] };
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: "STOP" }] }), { status: 200 });
  };
  const admin = sh.listaUsuarios().find(u => u.rol === "admin");
  const env = { GEMINI_API_KEY: "x", JWT_SECRET: "s" };
  const cookie = "sbb_session=" + await sh.signJWT({ u: admin.usuario }, "s");
  const llamar = async (body) => {
    const res = await ia.onRequestPost({ request: new Request("https://mi-publicidad.gamonal.app/api/ia", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body) }), env });
    return { status: res.status, data: await res.json() };
  };

  console.log("\n3 · Diagnóstico: la IA recibe objetivo + queja + cifras + capturas");
  respuesta = {
    resumen: "El 45% del gasto se va en búsquedas que no son tu producto.",
    problemas: [{ titulo: "Concordancia amplia", evidencia: "seguro automotriz en amplia gastó $1.187.550", impacto: "alto", ahorro: "$560.900" }],
    negativas: [{ t: "soap", motivo: "No vendes el seguro obligatorio", nivel: "campaña" }, { t: "trabajo", motivo: "Buscan empleo" },
                { t: "cotizar", motivo: "error: bloquearía lo que convierte" }, { t: "automotriz", motivo: "error: es el producto" }, { t: "SOAP", motivo: "duplicada" }],
    pausar: [{ keyword: "seguro obligatorio", grupo: "Genérico auto", motivo: "$176.000 sin conversiones" }],
    concordancia: [{ keyword: "seguro automotriz", de: "amplia", a: "frase", motivo: "controlar el gasto" }],
    ajustes: [{ ajuste: "Estrategia de puja", recomendacion: "Tope de CPC de $1.200", motivo: "CPC de $1.882" }],
    anuncios: [], noHacer: ["No mezclar SOAP con seguro automotriz"]
  };
  const png = Buffer.alloc(300, 7).toString("base64");
  const r = await llamar({ modo: "diagnostico", brief: { que: "Seguro automotriz para conductores", ctaUrl: "https://ejemplo.cl/auto" },
    actual: { notas: "Pago $2.000 por clic y no convierte", tablas: [{ nombre: "terminos-busqueda.csv", texto: terminos }, { nombre: "keywords.csv", texto: keywords }, { nombre: "notas.txt", texto: "hola" }],
              imagenes: [{ nombre: "captura.png", mime: "image/png", data: "data:image/png;base64," + png }] } });
  T(r.status === 200 && r.data.ok, "responde bien", r.status + " " + JSON.stringify(r.data).slice(0, 160));
  const pd = pedidos.find(p => p.prompt.includes("auditor senior"));
  T(pd && pd.prompt.includes("Seguro automotriz para conductores") && pd.prompt.indexOf("OBJETIVO") < pd.prompt.indexOf("LE PARECE MAL"), "el OBJETIVO va primero y manda");
  T(pd && pd.prompt.includes("Pago $2.000 por clic"), "la queja del usuario entra al prompt");
  T(pd && pd.prompt.includes("Gasto SIN ninguna conversión: $560.900"), "las cifras calculadas entran al prompt");
  T(pd && pd.body.contents[0].parts.some(p => p.inline_data && p.inline_data.mime_type === "image/png" && p.inline_data.data === png), "la captura viaja como imagen (sin el prefijo data:)");
  const dg = r.data.diagnostico;
  T(dg.metricas && dg.metricas.costo === 1697550, "las métricas vienen del cálculo, no de la IA", JSON.stringify(dg.metricas));
  const ts = dg.negativas.map(n => n.t);
  T(ts.includes("soap") && ts.includes("trabajo"), "acepta las negativas que corresponden", ts.join(","));
  T(!ts.includes("cotizar"), "descarta la negativa que bloquearía lo que SÍ convierte");
  T(!ts.includes("automotriz"), "descarta la negativa que bloquearía el producto del objetivo");
  T(ts.filter(t => t === "soap").length === 1, "sin duplicadas");
  T(dg.negativas.find(n => n.t === "soap").gasto === 322500, "cada negativa trae lo que gastó sin convertir ($322.500 en soap)", dg.negativas.find(n => n.t === "soap").gasto);
  T(dg.noHacer.some(t => /amplia/i.test(t)), "suma la lección de la concordancia amplia (sale de los datos)");
  T(r.data.avisos.some(a => /bloquearían/.test(a.texto)) && r.data.avisos.some(a => /no parecían un informe/.test(a.texto)), "avisa lo descartado y el archivo que no era informe");

  console.log("\n4 · Sin nada que analizar, lo dice");
  const vacio = await llamar({ modo: "diagnostico", brief: { que: "x" }, actual: {} });
  T(vacio.status === 400 && /captura/.test(vacio.data.error), "pide una captura, un informe o una descripción");

  console.log("\n5 · La generación usa el aprendizaje sin perder el objetivo");
  pedidos.length = 0;
  const g = await llamar({ producto: "ads", brief: { que: "Seguro automotriz para conductores", ctaUrl: "", aprendizaje: {
    resumen: dg.resumen, noHacer: dg.noHacer, pausar: dg.pausar, convierten: dg.convierten, negativas: dg.negativas } } });
  T(g.status === 200 && g.data.ok, "genera", g.status + " " + JSON.stringify(g.data).slice(0, 160));
  const pg = pedidos.find(p => p.prompt.includes("especialista senior en Google Ads (Search) de"));
  T(pg && pg.prompt.includes("APRENDIZAJE DE LA CAMPAÑA ACTUAL") && pg.prompt.includes("No mezclar SOAP"), "el prompt recibe lo que no hay que repetir");
  T(pg && pg.prompt.indexOf("EL ENCARGO") < pg.prompt.indexOf("APRENDIZAJE"), "el encargo va antes y sigue mandando");
  T(pg && pg.prompt.includes("cotizar seguro auto"), "le pasa lo que SÍ convierte");
  const kws = g.data.grupos[0].keywords.map(x => x.t);
  T(!kws.includes("seguro obligatorio"), "no vuelve a proponer la keyword pausada");
  T(g.data.negativas.includes("soap") && g.data.negativas.includes("curso"), "suma las negativas confirmadas por datos a las propias", g.data.negativas.join(","));
  T(/campaña actual/.test(g.data.negativasMotivos.soap || ""), "la negativa aprendida guarda su origen");

  console.log(`\n${mal ? "FALLAN " + mal : "TODO BIEN"} · ${ok}/${ok + mal}`);
  process.exit(mal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
