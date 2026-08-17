// Regresión: que los otros caminos del aplicativo sigan funcionando después de
// tocar el motor de banners. Email, libre, Search, export y vista previa.
const { chromium } = require("playwright");
let ok = 0, mal = 0;
const T = (c, n, e) => { if (c) { ok++; console.log("  ok   " + n); } else { mal++; console.log("  MAL  " + n + (e ? " → " + e : "")); } };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.SBB_CHROMIUM || undefined });
  const pg = await b.newPage({ viewport: { width: 1700, height: 1100 } });
  const errs = [];
  pg.on("pageerror", e => errs.push("pageerror: " + e.message));
  pg.on("console", m => { if (m.type() === "error" && !/ERR_CERT|ERR_CONNECTION|favicon/.test(m.text())) errs.push("console: " + m.text()); });
  await pg.goto((process.env.SBB_URL || "http://127.0.0.1:8099") + "/editor.html", { waitUntil: "load" });
  await pg.waitForFunction(() => typeof window.crearComposicion === "function");

  console.log("\n1 · Email por bloques");
  const r1 = await pg.evaluate(() => {
    const pr = { id: uid(), nombre: "Reg", creado: Date.now(), piezas: [], activa: null };
    workspace.proyectos = [pr]; proyectoVistoId = pr.id; proyecto = pr;
    crearPieza("email", "Email de prueba");
    activarPieza(proyecto.activa);
    ["hero", "texto", "cta", "features", "seccion"].forEach(t => agregarBloque(t));
    const p = pieza();
    return { bloques: p.canvas.length, html: (generarHTMLDePieza(p) || "").length, formato: p.formato };
  });
  T(r1.bloques === 5, "añade los 5 bloques", "bloques=" + r1.bloques);
  T(r1.html > 500, "el email exporta HTML", "largo=" + r1.html);

  console.log("\n2 · Formato libre con todos los bloques");
  const r2 = await pg.evaluate(() => {
    crearPieza("libre", "Libre de prueba");
    activarPieza(proyecto.activa);
    const tipos = Object.keys(BLOQUES);
    let fallos = [];
    tipos.forEach(t => { try { BLOQUES[t].render(clone(BLOQUES[t].defaults || {})); } catch (e) { fallos.push(t + ":" + e.message); } });
    return { tipos: tipos.length, fallos };
  });
  T(r2.fallos.length === 0, `los ${r2.tipos} tipos de bloque renderizan`, r2.fallos.join(" · "));

  console.log("\n3 · Campaña de Search");
  const r3 = await pg.evaluate(() => {
    crearPieza("ads", "Search de prueba");
    activarPieza(proyecto.activa);
    const p = pieza();
    p.adsData = { nombre: "Auto", urlFinal: "https://ejemplo.cl", grupos: [{ nombre: "Seguro auto", intencion: "contratar", razonamiento: "compra",
      keywords: [{ t: "seguro auto online", tipo: "exacta" }, { t: "cotizar seguro auto", tipo: "frase" }],
      negativas: ["gratis"], titulares: ["Seguro Auto Digital"], descripciones: ["Contrata en línea hoy."], path1: "auto", path2: "digital" }], negativas: ["empleo"] };
    renderCanvas();
    return { consola: !!document.querySelector(".adsc"), html: (generarHTMLDePieza(p) || "").length };
  });
  T(r3.consola, "la consola de Search se pinta");
  T(r3.html > 300, "Search exporta resumen", "largo=" + r3.html);

  console.log("\n4 · Colección: export HTML y rasterizado de un banner");
  const r4 = await pg.evaluate(async () => {
    crearComposicion("display-desktop");
    const p = pieza();
    setComp("zonas.texto.titular.texto", "Auto protegido");
    setComp("zonas.cta.texto", "Cotiza aquí");
    setComp("zonas.logo.url", "/logo.svg");
    const html = generarHTMLDeComposicion(p, "display-300x250") || "";
    return { largo: html.length, tieneMedidas: /300px/.test(html) };
  });
  T(r4.largo > 400, "la composición exporta HTML", "largo=" + r4.largo);
  T(r4.tieneMedidas, "el HTML lleva las medidas reales del formato");

  console.log("\n5 · Vista previa y dashboard");
  const r5 = await pg.evaluate(() => {
    abrirGaleria();
    const vis = document.getElementById("galeria").classList.contains("show");
    dashIr("proyectos");
    const pg2 = document.getElementById("pg-proyectos");
    return { galeria: vis, proyectos: !!pg2 && pg2.style.display !== "none" };
  });
  T(r5.galeria, "el dashboard abre");
  T(r5.proyectos, "la página Proyectos se muestra");

  console.log("\n" + (mal || errs.length ? "FALLA" : "TODO OK") + ` — ${ok} ok · ${mal} mal`);
  if (errs.length) { console.log("ERRORES:"); [...new Set(errs)].forEach(e => console.log("  " + e)); }
  await b.close();
  process.exit(mal || errs.length ? 1 : 0);
})();
