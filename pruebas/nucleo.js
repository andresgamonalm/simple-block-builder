// NÚCLEO — modelo de campaña + importador/exportador de Google Ads Editor.
// Sin navegador. La prueba de oro: importar el CSV que el usuario sube hoy a
// Ads Editor y volver a exportarlo tiene que dar el MISMO archivo, byte a byte.
// pruebas/datos/ads-editor-referencia.csv = copia ANONIMIZADA (marca "Acme")
// del archivo real. Para correr contra el real: MP_CSV_REAL=/ruta/archivo.csv
const fs = require("fs"), path = require("path");
const RAIZ = process.env.SBB_RAIZ || path.resolve(__dirname, "..");
const M = require(path.join(RAIZ, "nucleo/modelo.js"));
const AE = require(path.join(RAIZ, "nucleo/ads-editor.js"));
let ok = 0, mal = 0;
const T = (c, n, e) => { if (c) { ok++; console.log("  ok   " + n); } else { mal++; console.log("  MAL  " + n + (e !== undefined ? " → " + e : "")); } };

const ref = fs.readFileSync(path.join(RAIZ, "pruebas/datos/ads-editor-referencia.csv"), "utf8");

console.log("\n1 · Prueba de oro: ida y vuelta idéntica");
const r = AE.importar(ref);
T(AE.exportar(r.iniciativa) === ref, "importar + exportar = el mismo archivo, byte a byte (BOM, comas, CRLF, 60 columnas, orden de filas)");
T(r.avisos.length === 0 && r.iniciativa.extras.length === 0, "ninguna fila quedó sin reconocer", r.avisos.join(" | "));
const c = r.conteo;
T(c.campanas === 2 && c.grupos === 4 && c.keywords === 52 && c.anuncios === 4, "2 campañas · 4 grupos · 52 keywords · 4 anuncios", JSON.stringify(c));
T(c.negativas === 218 && c.sitelinks === 16 && c.destacados === 20 && c.fragmentos === 6 && c.ubicaciones === 10, "218 negativas · 16 sitelinks · 20 destacados · 6 fragmentos · 10 ubicaciones");
if (process.env.MP_CSV_REAL) {
  const real = fs.readFileSync(process.env.MP_CSV_REAL, "utf8");
  T(AE.exportar(AE.importar(real).iniciativa) === real, "el archivo REAL también vuelve idéntico");
}

console.log("\n2 · El modelo entiende lo que lee");
const cmp = r.iniciativa.campanas[0];
T(cmp.tipo === "Search" && cmp.redes.join("|") === "Google Search|Search Partners" && cmp.presupuestoDiario === 25, "campaña: tipo, redes separadas y presupuesto como número CLP");
T(cmp.puja === "Maximize clicks" && cmp.estado === "Paused" && cmp.fin === "2026-12-31", "puja, estado y fecha de término");
T(cmp.inicio === "[]", "la fecha inválida «[]» se conserva tal cual (el exportador es fiel; corregir es del motor de reglas)");
T(cmp.ubicaciones[0].idGoogle === "20160" && cmp.edadesExcluidas.map(e => e.edad).join(",") === "18-24,Unknown", "ubicaciones con su ID y edades excluidas");
const g = cmp.grupos[0], a = g.anuncios[0];
T(a.titulos.length === 15 && a.titulos.filter(t => t.posicion === "1").length === 5 && a.descripciones.length === 4, "anuncio: 15 títulos (5 fijados en la posición 1) y 4 descripciones");
T(g.keywords.every(k => k.concordancia === "exacta" || k.concordancia === "frase") && g.keywords[0].urlFinal.startsWith("https://"), "keywords con concordancia en español y su URL final");
T(cmp.negativas.every(n => n.concordancia === "amplia") && cmp.negativas[0].texto === "soap", "negativas «Campaign negative» leídas como amplias");
T(cmp.fragmentos[0].valores.length === 3 && cmp.sitelinks[0].linea1.length > 0, "fragmentos con sus valores y sitelinks con sus dos líneas");

console.log("\n3 · Identificadores estables → correcciones por partes");
const idx = M.indiceDeIds(r.iniciativa);
const ids = Object.keys(idx);
T(ids.length === 413 && new Set(ids).size === ids.length, "cada elemento tiene un id único (413)", ids.length);
T(/^campanas\[0\]\.grupos\[0\]\.anuncios\[0\]\.titulos\[2\]$/.test(idx[a.titulos[2].id]), "el id lleva a su ruta exacta", idx[a.titulos[2].id]);
// Cambiar UN título por su id y exportar: solo cambia esa fila.
const copia = AE.importar(ref).iniciativa;
const h = M.buscarPorId(copia, copia.campanas[0].grupos[0].anuncios[0].titulos[5].id);
h.obj.texto = "Cotiza En 3 Minutos";
const a1 = ref.split("\r\n"), b1 = AE.exportar(copia).split("\r\n");
const distintas = a1.filter((l, i) => l !== b1[i]).length;
T(distintas === 1 && b1.some(l => l.includes("Cotiza En 3 Minutos")), "cambiar un título por su id cambia UNA sola línea del archivo", distintas);

console.log("\n4 · Casos que el archivo de referencia no trae");
const ini = M.nuevaIniciativa("prueba");
const cc = M.nuevaCampana("Search | Demo | Prueba"); cc.presupuestoDiario = 15000; cc.puja = "Maximize clicks";
cc.negativas.push(M.nuevaNegativa("gratis", "frase"), M.nuevaNegativa("soap", "exacta"), M.nuevaNegativa("empleo", "amplia"));
const gg = M.nuevoGrupo("AD | Cotizar"); gg.keywords.push(M.nuevaKeyword("cotizar seguro, auto", "frase"));
gg.negativas.push(M.nuevaNegativa("moto", "frase"));
const aa = M.nuevoAnuncioRSA(); aa.urlFinal = "https://ejemplo.cl"; aa.titulos.push(M.nuevoTitulo("Título con \"comillas\""), M.nuevoTitulo("B"), M.nuevoTitulo("C"));
aa.descripciones.push(M.nuevaDescripcion("Una, dos"), M.nuevaDescripcion("Otra"));
gg.anuncios.push(aa); cc.grupos.push(gg); ini.campanas.push(cc);
const csv = AE.exportar(ini);
T(/Campaign negative phrase,gratis,/.test(csv) && /Campaign negative exact,soap,/.test(csv) && /Campaign negative broad,empleo,/.test(csv) && /Negative phrase,moto,/.test(csv), "negativas nuevas: la concordancia va en el tipo de fila, como en el archivo que el usuario sube hoy");
{ const imp = AE.importar("\uFEFFCampaign,Ad Group,Type,Keyword\r\nC,,Campaign negative phrase,comprar auto\r\nC,G,Negative exact,zurich\r\nC,,Campaign negative,[soap]\r\n").iniciativa, cn = imp.campanas[0];
  T(cn.negativas[0].concordancia === "frase" && cn.grupos[0].negativas[0].concordancia === "exacta" && cn.negativas[1].concordancia === "exacta", "al importar, la concordancia se lee del tipo de fila («Campaign negative phrase») o de la notación […]"); }
const vuelta = AE.importar(csv).iniciativa.campanas[0];
T(vuelta.negativas.map(n => n.concordancia).join(",") === "frase,exacta,amplia" && vuelta.grupos[0].negativas[0].texto === "moto", "vuelven con su concordancia (campaña y grupo)");
T(vuelta.grupos[0].keywords[0].texto === "cotizar seguro, auto" && vuelta.grupos[0].anuncios[0].titulos[0].texto === 'Título con "comillas"', "comas y comillas dentro de los textos sobreviven");
T(vuelta.presupuestoDiario === 15000, "presupuesto en CLP como entero");
T(AE.exportar(AE.importar(csv).iniciativa) === csv, "ida y vuelta también idéntica en un archivo creado por la app");
// Separado por tabuladores (como exporta Ads Editor) y columna desconocida
const tsv = "Campaign\tAd Group\tAd Group Status\tMax CPC\r\nX\tG\tEnabled\t500\r\n";
const rt = AE.importar(tsv);
T(rt.iniciativa.campanas[0].grupos[0].nombre === "G" && rt.iniciativa.campanas[0].soloReferencia === true, "lee archivos con tabuladores; una campaña solo nombrada queda como referencia (no se re-crea)");
T(AE.exportar(rt.iniciativa).includes("Max CPC") && AE.exportar(rt.iniciativa).includes(",500"), "una columna que el modelo aún no entiende (Max CPC) no se pierde");
const raro = AE.importar("Campaign,Foo\r\nX,bar\r\n");
T(raro.avisos.length === 1 && AE.exportar(raro.iniciativa).includes("bar"), "una fila desconocida se avisa y se conserva");

console.log("\n4b · Archivo con columnas propias y filas en otro orden (como la v7 del usuario)");
const cab = "Campaign,Campaign type,Networks,Language,Campaign daily budget,Bid strategy type,Ad Group,Ad Group type,Ad Group Status,Max CPC,Flexible reach,Status,Type,Keyword,Final URL,Headline 1,Headline 2,Headline 3,Description 1,Description 2,Comment";
const v7 = "\uFEFF" + [cab,
  "chl-producto-demo-always-on,Search,Google Search,es,35000,Manual CPC,,,,,,,,,,,,,,,",
  "chl-producto-demo-always-on,,,,,,ao-cotizar,Standard,Enabled,1800,,,,,,,,,,,grupo antes que sus anuncios",
  "chl-producto-demo-always-on,,,,,,ao-precio,Standard,Enabled,25,,,,,,,,,,,",
  "chl-producto-demo-always-on,,,,,,ao-cotizar,,,,,Enabled,,,https://ejemplo.cl,Uno,Dos,Tres,Desc uno.,Desc dos.,",
  "chl-producto-demo-always-on,,,,,,ao-cotizar,,,,,Enabled,Exact,cotizar seguro auto,https://ejemplo.cl,,,,,,"].join("\r\n") + "\r\n";
const r7 = AE.importar(v7);
T(AE.exportar(r7.iniciativa) === v7, "vuelve idéntico: respeta el orden de columnas (con columnas vacías propias) y el orden de filas");
T(r7.iniciativa.campanas[0].grupos.map(g => g.cpcMax).join(",") === "1800,25", "Max CPC se lee como puja del grupo en CLP (1800 y 25)");
const nv = AE.importar(v7).iniciativa; nv.campanas[0].grupos[0].keywords.push(M.nuevaKeyword("seguro auto online", "frase"));
const csvNv = AE.exportar(nv);
T(csvNv.includes("seguro auto online") && csvNv.replace("\uFEFF", "").split("\r\n")[0] === cab, "con un elemento nuevo se exporta con el mismo encabezado del archivo");

console.log("\n5 · El esquema, tal como lo lee la IA");
const txt = M.esquemaParaIA();
T(txt.includes("máx 30 car.") && txt.includes("máx 90 car.") && txt.includes("máx 25 car."), "incluye los límites de Google");
T(txt.includes("CLP") && txt.includes("NUNCA lo cambies"), "fija la moneda y la regla de los ids");
T(M.ESQUEMA.every(e => e.campos.every(f => f.campo === "id" || f.campo.length)), "cada campo del esquema está documentado");
const colsEsquema = new Set(M.ESQUEMA.flatMap(e => e.campos.map(f => f.columna)).filter(Boolean).flatMap(c => c.split(/ \+ |…/)).map(s => s.trim()));
T(["Campaign", "Networks", "Campaign daily budget", "Keyword", "Sitelink text", "Callout text", "Header", "Snippet Values", "Comment"].every(k => colsEsquema.has(k) && AE.COLUMNAS.includes(k)), "las columnas que nombra el esquema existen en el contrato de 60 columnas");

console.log(`\n${mal ? "FALLAN " + mal : "TODO BIEN"} · ${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);
