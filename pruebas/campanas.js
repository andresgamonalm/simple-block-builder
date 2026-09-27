// CAMPAÑAS DE SEARCH (campanas.html, mockup 4b aprobado 27-sep-2026) — navegador.
// Recorre las tres pantallas contra el servidor de pruebas (srv.js simula /api/iniciativas
// con versiones en memoria y /api/ia modos campana/corregir/investigar con el núcleo real):
//   crear → trabajar (editar, corregir por partes, averiguar) → aprobar → exportar → publicar
//   → editar de nuevo → exportar SOLO CAMBIOS.
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const URL0 = process.env.SBB_URL || "http://127.0.0.1:8099";
const FOTOS = process.env.SBB_FOTOS || "";
let ok = 0, mal = 0;
const T = (c, n, e) => { if (c) { ok++; console.log("  ok   " + n); } else { mal++; console.log("  MAL  " + n + (e !== undefined ? " → " + e : "")); } };
const foto = async (pg, n) => { if (FOTOS) await pg.screenshot({ path: path.join(FOTOS, n + ".png"), fullPage: false }); };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.SBB_CHROMIUM || undefined });
  const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on("pageerror", e => errs.push(e.message));
  pg.on("console", m => { if (m.type() === "error" && !/fonts\.g|ERR_CERT|net::/.test(m.text())) errs.push(m.text()); });
  pg.on("dialog", d => d.accept());
  const pedidos = [];
  pg.on("request", r => { if (/\/api\/ia$/.test(r.url()) && r.method() === "POST") pedidos.push(JSON.parse(r.postData() || "{}")); });

  // 1 · El Home lleva a la pantalla nueva
  await pg.goto(URL0 + "/home"); await pg.waitForTimeout(800);
  await pg.evaluate(() => crearConIA("ads"));
  await pg.waitForURL(/\/campanas\/nueva$/, { timeout: 5000 }).catch(() => {});
  T(/\/campanas\/nueva$/.test(pg.url()), "la tarjeta Google Search del Home abre /campanas/nueva", pg.url());
  await pg.waitForSelector("#f-que");

  // 2 · Formulario: exige lo mínimo (incluida la frase legal)
  await pg.click("#b-gen");
  T(await pg.$$eval(".f.falta", x => x.length) >= 4, "sin datos no genera: marca los campos que faltan");
  T(/legal/.test(await pg.textContent("#toast")), "el aviso nombra la frase legal");
  await pg.fill("#f-que", "seguro de auto 100% online para particulares en Chile");
  await pg.fill("#f-url", "https://ejemplo.cl/seguro-auto");
  await pg.fill("#f-legal", "no");
  await pg.fill("#f-prod", "auto digital");
  await pg.fill("#f-ppto", "35.000");
  T(await pg.textContent("#nom-prev") === "chl-producto-auto-digital-always-on", "muestra el nombre de la campaña con la taxonomía", await pg.textContent("#nom-prev"));
  await foto(pg, "c1-crear");
  await pg.click("#b-gen");
  await pg.waitForURL(/\/campanas\/ini_/, { timeout: 10000 }).catch(() => {});
  T(/\/campanas\/ini_/.test(pg.url()), "genera, guarda la versión 1 y abre la campaña", pg.url());
  const gen = pedidos.find(p => p.modo === "campana") || {};
  T(gen.opciones && gen.opciones.presupuestoDiario === 35000 && gen.brief.legal === "no" && gen.opciones.tipo === "always-on", "manda presupuesto en CLP entero, legal y tipo", JSON.stringify(gen.opciones));

  // 3 · Trabajar: árbol, detalle, dos anuncios por grupo
  await pg.waitForSelector(".arbol li");
  const grupos = await pg.$$eval(".arbol li.l2", x => x.map(e => e.textContent));
  T(grupos.filter(t => /ao-/.test(t)).length === 2, "el árbol muestra los 2 grupos con su taxonomía", grupos.join(" | "));
  T(await pg.$$eval("[id^=rsa-]", x => x.length) === 2, "el grupo muestra sus DOS anuncios (trámite y respaldo)");
  T(await pg.$$eval(".barreras", x => x.length) === 2 && await pg.$$eval(".bar", x => x.length) === 8, "cada anuncio muestra las barreras cubiertas");
  T(await pg.$eval(".serp .t", e => e.textContent.split(" | ").length === 3), "vista previa como en Google (3 títulos)");
  T(/v1/.test(await pg.textContent("#ver")) && /Borrador/.test(await pg.textContent(".estados .aqui")), "cabecera: versión 1 en Borrador");
  T(/Armé la campaña/.test(await pg.textContent("#pane")), "la conversación abre con el resumen de lo generado y los avisos de la IA");
  await foto(pg, "c2-trabajar");

  // 4 · Edición directa: pasa por el validador del núcleo y crea versión
  const primero = await pg.$eval("[id^=rsa-] tr[data-fila] .ed-txt", e => e.dataset.id);
  await pg.evaluate(id => { const e = document.querySelector(`.ed-txt[data-id="${id}"]`); e.textContent = "Un título que es demasiado largo para Google Ads"; e.dispatchEvent(new Event("blur")); }, primero);
  T(/30 caracteres|30/.test(await pg.textContent("#toast")), "un título de más de 30 se rechaza con su motivo", await pg.textContent("#toast"));
  const rot = await pg.$$eval("[id^=rsa-] tr[data-fila]", x => x.map(r => ({ id: r.dataset.fila, fijo: /Fijo/.test(r.textContent) })).find(r => !r.fijo).id);
  await pg.evaluate(id => { const e = document.querySelector(`.ed-txt[data-id="${id}"]`); e.textContent = "Contrata en 5 pasos"; e.dispatchEvent(new Event("blur")); }, rot);
  await pg.waitForFunction(() => /v2/.test(document.querySelector("#ver").textContent), null, { timeout: 5000 }).catch(() => {});
  T(/v2/.test(await pg.textContent("#ver")), "editar un título guarda la versión 2");

  // 5 · Conversación por partes: solo manda los ids elegidos y muestra antes/después
  await pg.check(`tr[data-fila="${rot}"] input.cb`);
  T(/1 elemento seleccionado/.test(await pg.textContent("#ctx")), "el contexto dice sobre qué trabaja la IA");
  await pg.fill("#entrada", "Hazlo más concreto");
  await pg.click("#b-env");
  await pg.waitForSelector(".cambio .antes", { timeout: 5000 }).catch(() => {});
  const cor = pedidos.filter(p => p.modo === "corregir").pop() || {};
  T(Array.isArray(cor.ids) && cor.ids.length === 1 && cor.ids[0] === rot, "corregir manda SOLO el id seleccionado", JSON.stringify(cor.ids));
  T(await pg.textContent(".cambio .antes") === "Contrata en 5 pasos" && /Contrata sin inspección/.test(await pg.textContent(".cambio .desp")), "la propuesta muestra antes y después");
  await foto(pg, "c3-conversacion");
  await pg.click(".acciones .btn.pri");
  await pg.waitForFunction(() => /v3/.test(document.querySelector("#ver").textContent), null, { timeout: 5000 }).catch(() => {});
  T(await pg.$eval(`.ed-txt[data-id="${rot}"]`, e => e.textContent) === "Contrata sin inspección" && /v3/.test(await pg.textContent("#ver")), "aplicar cambia solo ese título y guarda la versión 3");

  // 6 · Averiguar → ficha
  await pg.click(".modo button:nth-child(2)");
  await pg.fill("#entrada", "¿Cómo se paga?");
  await pg.click("#b-env");
  await pg.waitForSelector("text=Guardar en la ficha", { timeout: 5000 }).catch(() => {});
  await pg.click("text=Guardar en la ficha");
  await pg.click(".tabs button:nth-child(3)");
  T(/Cuotas según plan/.test(await pg.textContent("#pane")), "lo averiguado queda en la ficha");

  // 7 · Revisión
  await pg.click(".tabs button:nth-child(1)");
  T(await pg.$$eval(".grp-t", x => x.length) === 3, "Revisión agrupa errores, avisos y sugerencias");
  await foto(pg, "c4-revision");
  const errores = await pg.evaluate(() => validar().errores);
  T(errores === 0, "la campaña generada no tiene errores que bloqueen", errores);

  // 8 · Aprobar → exportar completa → publicada
  await pg.waitForTimeout(1500);
  await pg.click("text=Aprobar");
  await pg.waitForSelector(".opc", { timeout: 5000 }).catch(() => {});
  T(/Aprobada/.test(await pg.textContent(".estados .aqui")), "aprobar pasa a Aprobada y abre la exportación");
  T(await pg.$eval(".op:nth-child(2)", e => e.disabled), "«solo cambios» no está disponible antes de publicar");
  await foto(pg, "c5-exportar");
  const [d1] = await Promise.all([pg.waitForEvent("download"), pg.click(".pie .btn.pri")]);
  const csv1 = fs.readFileSync(await d1.path(), "utf8");
  T(/^chl-producto-auto-digital-always-on-ads-editor-.*\.csv$/.test(d1.suggestedFilename()), "archivo con el nombre del protocolo", d1.suggestedFilename());
  T(csv1.charCodeAt(0) === 0xFEFF && /Headline 1/.test(csv1) && /Contrata sin inspección/.test(csv1), "CSV de Ads Editor con BOM y los cambios hechos");
  await pg.waitForFunction(() => /Exportada/.test(document.querySelector(".estados .aqui").textContent), null, { timeout: 5000 }).catch(() => {});
  T(/Exportada/.test(await pg.textContent(".estados .aqui")), "descargar marca la versión como Exportada");
  await pg.click("text=Marcar como publicada");
  await pg.waitForFunction(() => /Publicada/.test(document.querySelector(".estados .aqui").textContent), null, { timeout: 5000 }).catch(() => {});
  T(/Publicada/.test(await pg.textContent(".estados .aqui")), "marcar como publicada");

  // 9 · Editar tras publicar → borrador → exportar SOLO CAMBIOS
  await pg.click("text=Volver a la campaña");
  const otro = await pg.$$eval("[id^=rsa-] tr[data-fila]", x => x.filter(r => !/Fijo/.test(r.textContent)).map(r => r.dataset.fila)[2]);
  await pg.evaluate(id => { const e = document.querySelector(`.ed-txt[data-id="${id}"]`); e.textContent = "Tu póliza al instante"; e.dispatchEvent(new Event("blur")); }, otro);
  await pg.waitForFunction(() => /Borrador/.test(document.querySelector(".estados .aqui").textContent), null, { timeout: 5000 }).catch(() => {});
  T(/Borrador/.test(await pg.textContent(".estados .aqui")), "editar una campaña publicada la vuelve a Borrador");
  await pg.waitForTimeout(300);
  await pg.click("text=Aprobar");
  await pg.waitForSelector(".opc", { timeout: 5000 }).catch(() => {});
  await pg.click(".op:nth-child(2)");
  const lista = await pg.$$eval(".lista li", x => x.map(e => e.textContent));
  T(lista.length === 1 && /Reemplaza/.test(lista[0]) && /→ «Tu póliza al instante»/.test(lista[0]) && /Tu póliza al instante/.test(lista[0]), "solo cambios lista exactamente lo editado (el RSA se reemplaza, con el texto que cambia)", lista.join(" | "));
  await foto(pg, "c6-cambios");
  const [d2] = await Promise.all([pg.waitForEvent("download"), pg.click(".pie .btn.pri")]);
  const csv2 = fs.readFileSync(await d2.path(), "utf8");
  T(/-cambios\.csv$/.test(d2.suggestedFilename()) && /Tu póliza al instante/.test(csv2) && csv2.length < csv1.length / 2, "el CSV de cambios es corto y trae lo editado", csv2.length + " vs " + csv1.length);

  // 10 · Historial y lista
  await pg.click("#cab-der >> text=Historial");
  await pg.waitForSelector(".modal tr", { timeout: 5000 }).catch(() => {});
  T(await pg.$$eval(".modal tr", x => x.length) >= 5, "historial lista las versiones");
  await pg.click(".modal .btn.sm");
  await pg.goto(URL0 + "/campanas"); await pg.waitForSelector(".lst");
  T(/Auto digital/.test(await pg.textContent(".lst")), "la lista muestra la campaña");

  // 11 · Móvil
  await pg.setViewportSize({ width: 390, height: 844 });
  await pg.goto(URL0 + "/campanas/nueva"); await pg.waitForSelector("#f-que");
  T(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sin desborde horizontal en móvil");
  await foto(pg, "c7-movil");

  T(errs.length === 0, "sin errores de JS ni de consola", errs.slice(0, 3).join(" | "));
  await b.close();
  console.log(`\n${mal ? "FALLAN " + mal : "TODO BIEN"} · ${ok}/${ok + mal}`);
  process.exit(mal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
