// MOTOR DE REGLAS (nucleo/reglas.js) — sin navegador.
// 1) Sobre el CSV de referencia (copia anonimizada del real) tiene que encontrar
//    EXACTAMENTE lo que se encontró a mano en la auditoría, y nada inventado.
// 2) Cada regla se dispara con un caso hecho a propósito.
// 3) Una campaña bien armada no produce errores ni avisos falsos.
const fs = require("fs"), path = require("path");
const RAIZ = process.env.SBB_RAIZ || path.resolve(__dirname, "..");
const M = require(path.join(RAIZ, "nucleo/modelo.js"));
const AE = require(path.join(RAIZ, "nucleo/ads-editor.js"));
const R = require(path.join(RAIZ, "nucleo/reglas.js"));
let ok = 0, mal = 0;
const T = (c, n, e) => { if (c) { ok++; console.log("  ok   " + n); } else { mal++; console.log("  MAL  " + n + (e !== undefined ? " → " + e : "")); } };
const HOY = "2026-09-26";
const cuenta = v => { const c = {}; v.hallazgos.forEach(h => { c[h.codigo] = (c[h.codigo] || 0) + 1; }); return c; };

console.log("\n1 · El archivo real (anonimizado): lo que encontró la auditoría, ni más ni menos");
const ini = AE.importar(fs.readFileSync(path.join(RAIZ, "pruebas/datos/ads-editor-referencia.csv"), "utf8")).iniciativa;
const v = R.validar(ini, { hoy: HOY, marca: "Acme" });
const c = cuenta(v);
const esperado = { G03: 2, C01: 2, K01: 2, K02: 2, K03: 2, K05: 2, K06: 2, C05: 4, K09: 1, K10: 26, P01: 6, P02: 4, P06: 3, P08: 2 };
T(JSON.stringify(Object.keys(c).sort().map(k => k + ":" + c[k])) === JSON.stringify(Object.keys(esperado).sort().map(k => k + ":" + esperado[k])), "hallazgos por regla exactamente los esperados", JSON.stringify(c));
T(v.errores === 4 && !v.exportable, "4 errores → no se puede exportar así");
T(v.hallazgos.filter(h => h.codigo === "G03").every(h => /"\[\]"/.test(h.mensaje)), "G03: la fecha de inicio «[]» de las dos campañas");
const c01 = v.hallazgos.filter(h => h.codigo === "C01");
T(c01.every(h => M.buscarPorId(ini, h.id).obj.texto === "comprar auto" && M.buscarPorId(ini, h.detalle.keywordId).obj.texto === "comprar seguro de auto"),
  "C01: la negativa amplia «comprar auto» bloquea la keyword «comprar seguro de auto» (exacta y frase)");
T(v.hallazgos.filter(h => h.codigo === "K01").every(h => h.mensaje.includes("$25")), "K01: presupuesto de $25 CLP diarios");
T(["G05", "G06", "G07", "G09", "G10"].every(k => !c[k]), "ningún texto fuera de los límites de Google (como en la revisión a mano)");
T(v.hallazgos.every(h => h.id && typeof h.ruta === "string" && M.buscarPorId(ini, h.id)), "cada hallazgo apunta a un elemento real (id + ruta)");
T(!c.C04 && !c.P03 && !c.P04, "tu protocolo de 5 títulos fijados en la posición 1 (con la marca) + 10 que rotan ya NO se marca como error");
T(v.hallazgos.filter(h => h.codigo === "P06").map(h => h.donde.split("«").pop().replace("»", "")).join("|") === "Cotiza Auto Digital|Cotiza con 3 Cuotas|3 Cuotas Gratis",
  "P06: los 3 sitelinks que llevan a la misma URL que el anuncio");
T(v.hallazgos.filter(h => h.codigo === "P08").length === 2 && v.hallazgos.filter(h => h.codigo === "P02").every(h => /ads-/.test(h.mensaje)), "P08: sin UTM · P02: anuncios sin nombre ads-…");

console.log("\n2 · Cada regla se dispara");
function base() {
  const i = M.nuevaIniciativa("prueba");
  const cm = M.nuevaCampana(M.nombreCampana({ pais: "chl", producto: "demo", tipo: "always-on" }));
  Object.assign(cm, { presupuestoDiario: 20000, puja: "Maximize conversions", inicio: "2026-10-01", fin: "2026-12-31", estado: "Paused",
    otrasColumnas: { "Targeting method": "Presence" } });
  cm.ubicaciones.push({ id: M.uid("ubi"), nombre: "Chile", idGoogle: "2152", comentario: "" });
  const g = M.nuevoGrupo(M.nombreGrupo("always-on", "cotizar"));
  g.keywords.push(Object.assign(M.nuevaKeyword("cotizar seguro auto", "exacta"), { urlFinal: "https://ejemplo.cl/auto" }));
  const a = M.nuevoAnuncioRSA(M.nombreAnuncio("anual")); a.urlFinal = "https://ejemplo.cl/auto"; a.ruta1 = "seguro"; a.ruta2 = "auto";
  ["Demo Seguros", "Seguro Auto Demo", "Cotiza con Demo", "Demo en Línea", "Contrata Demo Hoy"].forEach(t => a.titulos.push(M.nuevoTitulo(t, "1")));
  ["Cotizar Seguro Auto", "Deducible Desde 3 UF", "Grúa 24/7 Incluida", "Elige Tu Plan", "Cobertura Total", "Asistencia en Ruta",
   "Pago Mensual Fijo", "Atención Todo el Año", "Planes Flexibles", "Contrata en Minutos"].forEach(t => a.titulos.push(M.nuevoTitulo(t)));
  ["Cotiza en línea y elige tu plan.", "Deducible desde 3 UF y grúa 24/7."].forEach(t => a.descripciones.push(M.nuevaDescripcion(t)));
  g.anuncios.push(a); cm.grupos.push(g);
  [["Cotizar", "/cotizar"], ["Planes", "/planes"], ["Coberturas", "/coberturas"], ["Contacto", "/contacto"]].forEach(([t, u]) =>
    cm.sitelinks.push({ id: M.uid("sl"), texto: t, linea1: "En minutos", linea2: "Cien por ciento online", urlFinal: "https://ejemplo.cl" + u }));
  ["Grúa 24/7", "Cotiza Online", "Tres Planes", "Pago Mensual"].forEach(t => cm.destacados.push({ id: M.uid("co"), texto: t }));
  cm.fragmentos.push({ id: M.uid("sn"), encabezado: "Tipos", valores: ["Básico", "Estándar", "Premium"], idioma: "es", estado: "Enabled" });
  i.campanas.push(cm);
  M.aplicarUTM(i);
  return { i, cm, g, a };
}
const CX = { hoy: HOY, ficha: "Deducible desde 3 UF. Grúa 24/7.", marca: "Demo" };
const limpio = R.validar(base().i, CX);
T(limpio.hallazgos.length === 0, "una campaña armada con tu protocolo: cero hallazgos (sin falsos positivos)", JSON.stringify(limpio.hallazgos.map(h => h.codigo + " " + h.mensaje)));

const casos = [
  ["G01", x => { x.cm.puja = "Gastar mucho"; }],
  ["G02", x => { x.cm.presupuestoDiario = "25.000"; }],
  ["G03", x => { x.cm.fin = "2026-09-01"; }],
  ["G04", x => { x.g.anuncios = []; }],
  ["G05", x => { x.g.keywords.push(M.nuevaKeyword("seguro auto!", "exacta")); }],
  ["G06", x => { x.a.titulos.push(M.nuevoTitulo("Un título que se pasa de los treinta")); }],
  ["G07", x => { x.a.titulos.push(M.nuevoTitulo("Cotiza Ya!")); }],
  ["G08", x => { x.a.titulos[0].posicion = "4"; }],
  ["G09", x => { x.cm.sitelinks[0].linea2 = ""; }],
  ["G10", x => { x.cm.destacados.push({ id: "co_x", texto: "Un texto destacado demasiado largo" }); }],
  ["G11", x => { x.cm.negativas.push(M.nuevaNegativa("", "amplia")); }],
  ["G12", x => { x.a.descripciones[0].texto = "COTIZA AHORA MISMO tu seguro."; }],
  ["C01", x => { x.cm.negativas.push(M.nuevaNegativa("auto cotizar", "amplia")); }],
  ["C02", x => { const g2 = M.nuevoGrupo("ao-otro"); g2.keywords.push(M.nuevaKeyword("cotizar seguro auto", "exacta")); g2.anuncios.push(x.a); x.cm.grupos.push(g2); }],
  ["C03", x => { x.a.titulos.push(M.nuevoTitulo("Promo Hasta el 15/10")); }],
  ["C04", x => { x.a.titulos[5].posicion = "1"; }],
  ["C05", x => { x.a.titulos.push(M.nuevoTitulo("Seguro Auto Cotizar")); }],
  ["C07", x => { x.a.titulos.forEach((t, k) => { t.texto = "Titular Numero " + "ABCDEFGHIJKLMNO"[k]; }); }],
  ["C08", x => { x.a.titulos.push(M.nuevoTitulo("90% de Descuento")); }],
  ["C09", x => { x.g.keywords[0].urlFinal = "https://otro.cl/x"; }],
  ["K01", x => { x.cm.presupuestoDiario = 25; }],
  ["K02", x => { x.cm.puja = "Maximize clicks"; }],
  ["K03", x => { x.cm.redes = ["Google Search", "Search Partners"]; }],
  ["K04", x => { x.cm.ubicaciones = []; }],
  ["K05", x => { delete x.cm.otrasColumnas; }],
  ["K06", x => { x.cm.edadesExcluidas.push({ id: "eda_x", edad: "Unknown" }); }],
  ["K07", x => { x.g.keywords.push(M.nuevaKeyword("seguro", "amplia")); }],
  ["K08", x => { x.cm.estado = "Enabled"; }],
  ["K09", x => { const c2 = JSON.parse(JSON.stringify(x.cm)); c2.id = "cmp_2"; c2.nombre = "chl-producto-demo-promociones"; for (let k = 0; k < 20; k++) { const n = M.nuevaNegativa("palabra" + k, "amplia"); x.cm.negativas.push(n); c2.negativas.push(JSON.parse(JSON.stringify(n))); } x.i.campanas.push(c2); }],
  ["K10", x => { x.g.keywords.push(M.nuevaKeyword("cotizar seguro auto", "frase")); }],
  ["G13", x => { x.cm.fragmentos[0].encabezado = "Beneficios"; }],
  ["G14", x => { x.cm.precios = { tipo: "Servicios", items: [{ id: "pr1", encabezado: "Plan Básico", descripcion: "", precio: 9990, urlFinal: "https://ejemplo.cl/b" }] }; }],
  ["P01", x => { x.g.nombre = "AO | Cotizar"; }],
  ["P02", x => { x.g.nombre = "cotizar"; }],
  ["P03", x => { x.a.titulos.splice(0, 1); }],
  ["P04", x => { x.a.titulos[0].texto = "Cobertura Amplia Hoy"; }],
  ["P05", x => { x.cm.sitelinks.pop(); }],
  ["P06", x => { x.cm.sitelinks[0].urlFinal = "https://ejemplo.cl/auto"; }],
  ["P07", x => { x.cm.destacados.pop(); }],
  ["P08", x => { x.cm.sufijoUrlFinal = "utm_source=google&utm_medium=cpc&utm_campaign=Otra"; }],
  ["P09", x => { x.a.urlFinal = "http://ejemplo.cl/auto"; }]
];
for (const [cod, romper] of casos) {
  const x = base(); romper(x);
  const r = R.validar(x.i, CX);
  T(r.hallazgos.some(h => h.codigo === cod), `${cod} · ${R.REGLAS.find(q => q.codigo === cod).que.slice(0, 80)}`, JSON.stringify(r.hallazgos.map(h => h.codigo)));
}
T(casos.length === R.REGLAS.length, "todas las reglas del catálogo tienen su caso de prueba", casos.length + " de " + R.REGLAS.length);

console.log("\n3 · Cuándo una negativa bloquea (según SU concordancia)");
const kw = { texto: "comprar seguro de auto" };
T(R.bloquea({ texto: "comprar auto", concordancia: "amplia" }, kw), "amplia «comprar auto»: bloquea (todas sus palabras, en cualquier orden)");
T(!R.bloquea({ texto: "comprar auto", concordancia: "frase" }, kw), "frase «comprar auto»: no bloquea (la secuencia no está)");
T(R.bloquea({ texto: "seguro de auto", concordancia: "frase" }, kw), "frase «seguro de auto»: bloquea");
T(!R.bloquea({ texto: "seguro de auto", concordancia: "exacta" }, kw) && R.bloquea({ texto: "comprar seguro de auto", concordancia: "exacta" }, kw), "exacta: solo bloquea la búsqueda idéntica");
T(R.bloquea({ texto: "Cómprar AUTO", concordancia: "amplia" }, kw), "sin distinguir tildes ni mayúsculas");

console.log("\n4 · Taxonomía y UTM del protocolo");
T(M.nombreCampana({ pais: "chl", producto: "Auto Digital", tipo: "Always On" }) === "chl-producto-auto-digital-always-on", "campaña: chl-producto-auto-digital-always-on");
T(M.nombreGrupo("always-on", "Coberturas") === "ao-coberturas" && M.nombreGrupo("promociones", "Cuotas") === "promo-cuotas", "grupos: ao-coberturas · promo-cuotas");
T(M.nombreAnuncio("3 Cuotas Gratis") === "ads-3-cuotas-gratis" && M.nombreAnuncio("Bienal") === "ads-bienal", "anuncios: ads-3-cuotas-gratis · ads-bienal");
const u = base();
T(u.cm.sufijoUrlFinal === "utm_source=gads&utm_medium=conversion&utm_campaign=chl-producto-demo-always-on", "sufijo de campaña: gads · conversion (la puja es de conversiones) · nombre de la campaña", u.cm.sufijoUrlFinal);
T(u.a.sufijoUrlFinal.endsWith("&utm_content=ads-anual"), "el anuncio suma utm_content con su nombre");
u.cm.puja = "Maximize clicks"; u.cm.utmEn = "plantilla"; M.aplicarUTM(u.i);
T(u.cm.plantillaSeguimiento === "{lpurl}?utm_source=gads&utm_medium=clics&utm_campaign=chl-producto-demo-always-on" && !u.a.sufijoUrlFinal, "modo plantilla: {lpurl}?… con medio «clics» y sin sufijos (no se mezclan)");
const csv = AE.exportar(u.i);
T(csv.split("\r\n")[0].includes(",Comment,Tracking template,") && !csv.split("\r\n")[0].includes("Final URL suffix") && AE.importar(csv).iniciativa.campanas[0].utmEn === "plantilla", "la columna Tracking template solo aparece cuando se usa, y vuelve al importar");
const u2 = base(); const csv2 = AE.exportar(u2.i); const vuelta = AE.importar(csv2).iniciativa;
T(csv2.split("\r\n")[0].includes(",Comment,Final URL suffix,") && !csv2.split("\r\n")[0].includes("Tracking template") && vuelta.campanas[0].grupos[0].anuncios[0].nombre === "ads-anual", "Final URL suffix en campaña y anuncio; el nombre del anuncio vuelve desde su utm_content");
T(AE.exportar(vuelta) === csv2, "ida y vuelta idéntica también con UTM");
const dos = M.nuevaIniciativa("x"); ["always-on", "promociones"].forEach(t => dos.campanas.push(M.nuevaCampana(M.nombreCampana({ producto: "auto digital", tipo: t }))));
T(AE.nombreArchivo(dos, "2026-09-26") === "chl-producto-auto-digital-ads-editor-2026-09-26.csv" && AE.nombreArchivo(u2.i, "2026-09-26") === "chl-producto-demo-always-on-ads-editor-2026-09-26.csv",
  "nombre del archivo exportado según la taxonomía (una campaña o el prefijo común de varias)");

console.log("\n5 · Para la IA");
const txt = R.reglasParaIA();
T(R.REGLAS.every(r => txt.includes(r.codigo)), "el texto para la IA lista las " + R.REGLAS.length + " reglas");

console.log(`\n${mal ? "FALLAN " + mal : "TODO BIEN"} · ${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);
