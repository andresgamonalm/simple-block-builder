// TU CAMPAÑA ACTUAL — en el editor de Search (navegador). Datos INVENTADOS de
// pruebas/datos/. /api/ia se intercepta para ver EXACTAMENTE qué manda la app.
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), os = require("os");
const { execSync } = require("child_process");
const RAIZ = process.env.SBB_RAIZ || path.resolve(__dirname, "..");
let ok = 0, mal = 0;
const T = (c, n, e) => { if (c) { ok++; console.log("  ok   " + n); } else { mal++; console.log("  MAL  " + n + (e !== undefined ? " → " + e : "")); } };

const DIAG = { ok: true, avisos: [{ tipo: "info", texto: "Se descartaron 1 negativas propuestas porque bloquearían búsquedas que SÍ convierten." }],
  diagnostico: {
    resumen: "El 45% del gasto se va en búsquedas que no son tu producto.",
    metricas: { costo: 1245900, clics: 662, impr: 14500, conv: 28, cpc: 1882, ctr: 4.57, cpa: 44496 }, gastoSinConversion: 560900,
    problemas: [{ titulo: "Concordancia amplia sin control", evidencia: "«seguro automotriz» en amplia se llevó $351.000", impacto: "alto", ahorro: "$560.900" },
                { titulo: "Nivel de calidad 2 a 3", evidencia: "CPC de $1.882", impacto: "medio", ahorro: "" }],
    negativas: [{ t: "soap", motivo: "No vendes el seguro obligatorio", nivel: "campaña", gasto: 322500 },
                { t: "trabajo", motivo: "Buscan empleo", nivel: "campaña", gasto: 39600 },
                { t: "moto", motivo: "Solo autos", nivel: "Cotizar seguro auto", gasto: 88000 }],
    pausar: [{ keyword: "seguro obligatorio", grupo: "Genérico auto", motivo: "$176.000 sin conversiones" }],
    concordancia: [{ keyword: "seguro automotriz", de: "amplia", a: "frase", motivo: "controlar el gasto" }],
    ajustes: [{ ajuste: "Red de búsqueda asociada", recomendacion: "Apagar", motivo: "tráfico de baja calidad" }],
    anuncios: [{ problema: "Titulares genéricos", recomendacion: "Usar el deducible desde 3 UF" }],
    noHacer: ["No usar concordancia amplia en «seguro automotriz»", "No mezclar SOAP con seguro automotriz"],
    convierten: ["cotizar seguro auto"], campanas: ["Seguro Auto 2026"] } };
const NUEVA = { ok: true, nombre: "Seguro auto sin desperdicio", urlFinal: "https://ejemplo.cl/auto", negativas: ["soap", "curso"], negativasMotivos: { soap: "Dato de tu campaña actual" }, sitelinks: [],
  avisos: [{ tipo: "info", texto: "Se quitaron 1 keywords que en tu campaña actual gastaban sin resultado." }],
  grupos: [{ nombre: "Cotizar seguro auto", intencion: "cotizar", keywords: [{ t: "cotizar seguro auto", tipo: "exacta" }], negativas: [], titulares: ["Seguro Auto"], titularesFijos: ["Seguro Auto"], descripciones: ["Cotiza hoy."] }] };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.SBB_CHROMIUM || undefined });
  const ctx = await b.newContext({ acceptDownloads: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on("pageerror", e => errs.push(e.message));
  pg.on("dialog", d => d.accept());
  const pedidos = [];
  await pg.route("**/api/ia", async route => {
    const body = JSON.parse(route.request().postData() || "{}");
    pedidos.push(body);
    const r = body.modo === "diagnostico" ? DIAG : body.producto === "ads" ? NUEVA : { ok: false, error: "no simulado" };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(r) });
  });
  await pg.goto((process.env.SBB_URL || "http://127.0.0.1:8099") + "/editor.html", { waitUntil: "load" });
  await pg.waitForFunction(() => typeof window.adsVistaActual === "function" && typeof window.construirXLSX === "function");

  // Pieza de Search con campaña y OBJETIVO guardado (como la deja el asistente).
  await pg.evaluate(() => {
    const pr = { id: uid(), nombre: "Campaña · Seguro auto", creado: Date.now(), piezas: [], activa: null };
    workspace.proyectos = [pr]; proyectoVistoId = pr.id; proyecto = pr;
    crearPieza("ads", "Search"); activarPieza(proyecto.activa);
    document.getElementById("galeria").classList.remove("show");
    pieza().adsData = { nombre: "Seguro Auto", urlFinal: "https://ejemplo.cl/auto",
      brief: { que: "Seguro automotriz para conductores de Santiago", accion: "Cotizar", ctaUrl: "https://ejemplo.cl/auto", legal: "no" },
      grupos: [{ nombre: "Cotizar seguro auto", intencion: "cotizar", keywords: [{ t: "seguro auto online", tipo: "exacta" }], negativas: [], titulares: ["Seguro Auto"], titularesFijos: ["Seguro Auto"], descripciones: ["Cotiza hoy."] }],
      negativas: ["curso"], sitelinks: [] };
    adsVista = "res"; renderCanvas();
  });

  console.log("\n1 · Está en el editor y es opcional");
  T(await pg.locator(".adsc-pill-actual").count() === 1, "píldora «Tu campaña actual» en la consola de Search");
  T(await pg.locator("#pane-ads", { hasText: "Tu campaña actual · opcional" }).count() === 1, "entrada en el panel lateral, marcada como opcional");
  await pg.locator(".adsc-pill-actual").click();
  T(await pg.locator("#ads-drop").isVisible(), "abre el formulario con la zona para soltar archivos");
  T((await pg.inputValue("#ads-actual-objetivo")) === "Seguro automotriz para conductores de Santiago", "el objetivo guardado de la campaña viene precargado");

  console.log("\n2 · Adjuntar: CSV, CSV UTF-16, Excel y capturas (archivo y Ctrl+V)");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ca-"));
  const xlsx = await pg.evaluate(() => Array.from(construirXLSX([{ nombre: "Hoja1", filas: [["Search term", "Clicks", "Cost", "Conversions"], ["soap barato", "40", "80000", "0"], ["cotizar seguro auto", "10", "17000", "3"]] }])));
  fs.writeFileSync(path.join(tmp, "terminos.xlsx"), Buffer.from(xlsx));
  const cap = await pg.screenshot({ clip: { x: 0, y: 0, width: 400, height: 240 } });
  fs.writeFileSync(path.join(tmp, "captura.png"), cap);
  await pg.setInputFiles("#ads-file", [path.join(RAIZ, "pruebas/datos/terminos-busqueda.csv"), path.join(RAIZ, "pruebas/datos/keywords-ads-editor.csv"), path.join(tmp, "terminos.xlsx"), path.join(tmp, "captura.png")]);
  await pg.waitForFunction(() => _adsAdj.length === 4);
  const adj = await pg.evaluate(() => _adsAdj.map(a => ({ tipo: a.tipo, nombre: a.nombre, largo: (a.texto || a.data || "").length, texto: (a.texto || "").slice(0, 400) })));
  T(adj.filter(a => a.tipo === "tabla").length === 3 && adj.filter(a => a.tipo === "img").length === 1, "3 informes y 1 captura adjuntos", JSON.stringify(adj.map(a => a.tipo)));
  T(adj.find(a => a.nombre === "keywords-ads-editor.csv").texto.startsWith("Keyword\tMatch type"), "el CSV UTF-16 de Ads Editor se lee bien (no sale con caracteres raros)");
  T(adj.find(a => a.nombre === "terminos.xlsx").texto.includes("soap barato\t40\t80000\t0"), "el Excel se lee como tabla", adj.find(a => a.nombre === "terminos.xlsx").texto);
  T(adj.find(a => a.tipo === "img").largo < 400000, "la captura se achica antes de mandarla");
  // Ctrl+V de una captura
  await pg.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const dt = new DataTransfer(); dt.items.add(new File([bin], "pegada.png", { type: "image/png" }));
    document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
  }, cap.toString("base64"));
  await pg.waitForFunction(() => _adsAdj.length === 5);
  T(await pg.locator(".adsc-item", { hasText: "pegada.png" }).count() === 1, "Ctrl+V de una captura la agrega a la lista");
  await pg.locator(".adsc-item", { hasText: "pegada.png" }).locator("button").click();
  T(await pg.evaluate(() => _adsAdj.length) === 4, "se puede quitar un adjunto");

  console.log("\n3 · Analizar: manda objetivo + queja + informes + capturas");
  await pg.fill("#ads-actual-notas", "Pago $2.000 por clic a la landing y es un caos");
  await pg.click("#ads-analizar");
  await pg.waitForFunction(() => pieza().adsData.actual && pieza().adsData.actual.diagnostico);
  const pd = pedidos.find(x => x.modo === "diagnostico");
  T(pd && pd.brief.que === "Seguro automotriz para conductores de Santiago", "manda el objetivo de la campaña");
  T(pd && pd.actual.notas.includes("$2.000 por clic"), "manda la queja");
  T(pd && pd.actual.tablas.length === 3 && pd.actual.tablas.some(t => t.texto.includes("soap 2026")), "manda los 3 informes como texto");
  T(pd && pd.actual.imagenes.length === 1 && /^data:image\/jpeg;base64,/.test(pd.actual.imagenes[0].data), "manda la captura");
  T(await pg.locator(".adsc-intent .gnm", { hasText: "45% del gasto" }).count() === 1, "muestra el diagnóstico");
  T(await pg.locator(".adsc-stat", { hasText: "$1.882" }).count() === 1 && await pg.locator(".adsc-stat", { hasText: "$560.900" }).count() === 1, "cifras en CLP: CPC promedio y gasto sin convertir");
  T(await pg.locator(".adsc-card", { hasText: "Lo que NO hay que repetir" }).locator(".adsc-item").count() === 2, "lista lo que no hay que repetir");
  T(await pg.locator("#ia-avisos", { hasText: "bloquearían" }).count() === 1, "muestra los avisos del servidor");
  const guardado = await pg.evaluate(() => JSON.stringify(workspace));
  T(guardado.includes("No mezclar SOAP") && !guardado.includes("base64"), "se guarda el diagnóstico, no las capturas (no pesa)");
  T(await pg.evaluate(() => _adsAdj.length) === 0, "los adjuntos se limpian tras analizar");

  console.log("\n4 · Accionar: negativas a la campaña y planilla para Ads Editor");
  await pg.locator("button", { hasText: "Agregar 3 a esta campaña" }).click();
  const tras = await pg.evaluate(() => { const d = pieza().adsData; return { neg: d.negativas, grp: d.grupos[0].negativas, mot: d.negativasMotivos }; });
  T(tras.neg.includes("soap") && tras.neg.includes("trabajo") && tras.neg.includes("curso"), "las negativas de campaña se suman a las que ya había", tras.neg.join(","));
  T(tras.grp.includes("moto"), "la negativa de grupo va a su grupo");
  T(/campaña actual/.test(tras.mot.soap), "cada una guarda su motivo");
  T(await pg.locator(".adsc-cnt", { hasText: "agregada" }).count() === 3, "quedan marcadas como agregadas");
  const [dl] = await Promise.all([pg.waitForEvent("download"), pg.locator("button", { hasText: "Cambios para Ads Editor" }).click()]);
  const archivo = path.join(tmp, "cambios.xlsx"); await dl.saveAs(archivo);
  const py = execSync(`python3 -c "
import zipfile,re
z=zipfile.ZipFile('${archivo}')
wb=z.read('xl/workbook.xml').decode()
print('|'.join(re.findall(r'name=\\"([^\\"]+)\\"',wb)))
print(z.read('xl/worksheets/sheet1.xml').decode())
print(z.testzip() or 'CRC-OK')"`).toString();
  T(/Negativas\|Pausar\|Concordancia\|Diagnostico/.test(py), "XLSX con hojas Negativas · Pausar · Concordancia · Diagnóstico", py.split("\n")[0]);
  T(py.includes("soap") && py.includes("Negative Phrase") && py.includes("Seguro Auto 2026"), "negativas listas para Ads Editor, con el nombre real de la campaña");
  T(py.includes("CRC-OK"), "el archivo no está corrupto");

  console.log("\n5 · Rearmar con el aprendizaje, sin olvidar el objetivo");
  pedidos.length = 0;
  await pg.locator("button", { hasText: "Rearmar la campaña con este aprendizaje" }).click();
  await pg.waitForFunction(() => pieza().adsData.nombre === "Seguro auto sin desperdicio");
  const pr = pedidos.find(x => x.producto === "ads");
  T(pr && pr.brief.que === "Seguro automotriz para conductores de Santiago", "el objetivo viaja como el encargo");
  T(pr && pr.brief.aprendizaje && pr.brief.aprendizaje.noHacer.length === 2 && pr.brief.aprendizaje.pausar.length === 1, "el aprendizaje viaja como aporte");
  T(pr && !JSON.stringify(pr).includes("base64"), "sin capturas en el pedido de generación");
  const d2 = await pg.evaluate(() => { const d = pieza().adsData; return { g: d.grupos.length, previa: !!d._previa, actual: !!d.actual, brief: d.brief.que, vista: adsVista }; });
  T(d2.g === 1 && d2.previa && d2.actual && d2.vista === "res", "reemplaza la campaña, guarda la anterior y conserva el diagnóstico", JSON.stringify(d2));
  await pg.locator(".adsc-pill-actual").click();
  await pg.locator("button", { hasText: "Volver a la versión anterior" }).click();
  T(await pg.evaluate(() => pieza().adsData.nombre) === "Seguro Auto", "se puede volver a la versión anterior");

  console.log("\n6 · Antes de tener campaña: se puede partir por la actual");
  await pg.evaluate(() => { crearPieza("ads", "Search 2"); activarPieza(proyecto.activa); adsVista = "res"; renderCanvas(); });
  T(await pg.locator("button", { hasText: "¿Ya tienes una campaña corriendo?" }).count() === 1, "el estado vacío ofrece traerla (opcional)");
  await pg.locator("button", { hasText: "¿Ya tienes una campaña corriendo?" }).click();
  T(await pg.locator("#ads-drop").isVisible(), "abre el mismo formulario");

  console.log("\n7 · El asistente (Char-B) también recibe el aprendizaje");
  pedidos.length = 0;
  await pg.evaluate(() => { const i = proyecto.piezas.findIndex(x => x.adsData && x.adsData.actual); activarPieza(proyecto.piezas[i].id); });
  await pg.evaluate(() => {
    abrirIA("ads");
    document.getElementById("ia-que").value = "Seguro automotriz para conductores de Santiago";
    document.getElementById("ia-legal").value = "no";
    if (typeof iaSetFormato === "function") iaSetFormato("ads");
    return generarConIA();
  });
  const pa = pedidos.find(x => x.producto === "ads");
  T(pa && pa.brief.aprendizaje && pa.brief.aprendizaje.noHacer.length === 2, "la generación desde el asistente lleva el aprendizaje de la pieza abierta");
  const n = await pg.evaluate(() => { const p = pieza(); return { brief: p.adsData.brief && p.adsData.brief.que, actual: !!p.adsData.actual }; });
  T(n.brief === "Seguro automotriz para conductores de Santiago" && n.actual, "la campaña nueva guarda su objetivo y hereda el diagnóstico", JSON.stringify(n));

  T(errs.length === 0, "sin errores de JavaScript", errs.join(" | "));
  await b.close();
  console.log(`\n${mal ? "FALLAN " + mal : "TODO BIEN"} · ${ok}/${ok + mal}`);
  process.exit(mal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
