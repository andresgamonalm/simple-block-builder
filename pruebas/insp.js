// Verifica el INSPECTOR dentro de la app: que corra sobre el tablero, que avise
// junto a la pieza, y que DETECTE de verdad una pieza rota a mano.
const { chromium } = require("playwright");
let ok = 0, mal = 0;
const T = (c, n, extra) => { if (c) { ok++; console.log("  ok   " + n); } else { mal++; console.log("  MAL  " + n + (extra ? " → " + extra : "")); } };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.SBB_CHROMIUM || undefined });
  const pg = await b.newPage({ viewport: { width: 1700, height: 1100 } });
  const errs = [];
  pg.on("pageerror", e => errs.push(e.message));
  pg.on("console", m => { if (m.type() === "error" && !/ERR_CERT|ERR_CONNECTION|favicon/.test(m.text())) errs.push("console: " + m.text()); });
  await pg.goto((process.env.SBB_URL || "http://127.0.0.1:8099") + "/editor.html", { waitUntil: "load" });
  await pg.waitForFunction(() => typeof window.crearComposicion === "function");

  console.log("\n1 · Colección con contenido sano");
  await pg.evaluate(() => {
    const pr = { id: uid(), nombre: "Insp", creado: Date.now(), piezas: [], activa: null };
    workspace.proyectos = [pr]; proyectoVistoId = pr.id; proyecto = pr;
    crearComposicion("display-desktop");
    setComp("zonas.texto.etiqueta.texto", "Seguro");
    setComp("zonas.texto.titular.texto", "Tu auto listo");
    setComp("zonas.texto.cuerpo.texto", "Cobertura desde hoy");
    setComp("zonas.cta.texto", "Cotiza aquí");
    setComp("zonas.logo.url", "/logo.svg");
    setComp("burbuja.texto", "2 Cuotas Gratis"); setComp("burbuja.visible", true);
    setComp("fondo.color", "#23366F");
    setComp("legal", "Bases legales en www.ejemplo.cl");
    renderTablero();
  });
  await pg.waitForTimeout(700);
  const r1 = await pg.evaluate(() => {
    const p = pieza(), res = p._inspeccion || {};
    return { fmts: Object.keys(res).length, malos: Object.keys(res).filter(f => !res[f].ok),
      barra: (document.getElementById("ed-inspector") || {}).textContent || "",
      clase: (document.getElementById("ed-inspector") || {}).className || "",
      avisos: document.querySelectorAll(".insp-aviso").length };
  });
  T(r1.fmts === 11, "el inspector mide los 11 tamaños", "midió " + r1.fmts);
  T(r1.malos.length === 0, "los 11 pasan las 6 comprobaciones", r1.malos.join(","));
  T(/11 tamaños revisados/.test(r1.barra), "la barra informa el estado", JSON.stringify(r1.barra));
  T(/ok/.test(r1.clase), "la barra está en verde", r1.clase);
  T(r1.avisos === 0, "sin avisos cuando todo está bien", "avisos=" + r1.avisos);

  console.log("\n2 · El inspector DETECTA una pieza rota por el usuario");
  // Un titular larguísimo con cuerpo forzado fuera de rango: el sistema acota el
  // cuerpo, así que lo que debe fallar es el desborde/colisión por el texto.
  await pg.evaluate(() => {
    setComp("zonas.texto.titular.texto", "Protegemos tu automóvil con la cobertura más completa del mercado nacional durante todo el año");
    setComp("zonas.texto.cuerpo.texto", "Incluye asistencia en ruta, auto de reemplazo, cobertura de daños a terceros y deducible rebajado");
    renderTablero();
  });
  await pg.waitForTimeout(700);
  const r2 = await pg.evaluate(() => {
    const res = pieza()._inspeccion || {};
    const malos = Object.keys(res).filter(f => !res[f].ok);
    return { malos, ids: malos.map(f => res[f].fallos.map(x => x.id)).flat(),
      avisos: document.querySelectorAll(".insp-aviso").length,
      clase: (document.getElementById("ed-inspector") || {}).className || "" };
  });
  T(r2.malos.length > 0, "detecta al menos un tamaño roto", "malos=" + r2.malos.length);
  T(r2.avisos > 0, "pinta el aviso junto a la pieza", "avisos=" + r2.avisos);
  T(/mal/.test(r2.clase), "la barra pasa a aviso", r2.clase);
  console.log("     tamaños con aviso: " + r2.malos.map(f => f.replace("display-", "")).join(" · "));
  console.log("     tipos de fallo: " + [...new Set(r2.ids)].join(" · "));

  console.log("\n3 · Contraste: texto blanco sobre fondo claro tiene que fallar");
  await pg.evaluate(() => {
    setComp("zonas.texto.titular.texto", "Tu auto listo");
    setComp("zonas.texto.cuerpo.texto", "Cobertura desde hoy");
    setComp("fondo.color", "#FFFFFF");   // blanco: el texto sigue en blanco
    renderTablero();
  });
  await pg.waitForTimeout(700);
  const r3 = await pg.evaluate(() => {
    const res = pieza()._inspeccion || {};
    const ids = Object.keys(res).map(f => res[f].fallos.map(x => x.id)).flat();
    const cmp = document.querySelector(".ab .cmp");
    return { contraste: ids.filter(i => i === "contraste").length,
      borde: cmp ? getComputedStyle(cmp).borderTopWidth : "?" };
  });
  T(r3.contraste > 0, "detecta el contraste insuficiente", "casos=" + r3.contraste);
  T(r3.borde === "1px", "fondo claro → borde de 1px obligatorio", "borde=" + r3.borde);

  console.log("\n4 · Círculo de oferta sin cifra: no se dibuja");
  await pg.evaluate(() => {
    setComp("fondo.color", "#23366F");
    setComp("burbuja.texto", "Aprovecha ahora");   // sin número
    renderTablero();
  });
  await pg.waitForTimeout(600);
  const r4 = await pg.evaluate(() => document.querySelectorAll(".ab .cmp-burbuja").length);
  T(r4 === 0, "sin cifra no hay círculo", "círculos=" + r4);
  await pg.evaluate(() => { setComp("burbuja.texto", "60% dcto."); renderTablero(); });
  await pg.waitForTimeout(600);
  const r4b = await pg.evaluate(() => document.querySelectorAll(".ab .cmp-burbuja").length);
  T(r4b > 0, "con cifra sí hay círculo", "círculos=" + r4b);

  console.log("\n5 · Velo obligatorio sobre foto (35–60 %)");
  await pg.evaluate(() => {
    setComp("fondo.tipo", "imagen"); setComp("fondo.imagen.url", "/foto.svg");
    setComp("fondo.imagen.oscurecer", 0);   // el usuario lo pone a cero
    renderTablero();
  });
  await pg.waitForTimeout(700);
  const r5 = await pg.evaluate(() => {
    const v = document.querySelector(".ab .cmp-veil");
    const m = v ? /rgba?\([^)]*?([\d.]+)\)$/.exec(getComputedStyle(v).backgroundColor) : null;
    return m ? parseFloat(m[1]) : -1;
  });
  T(r5 >= 0.34 && r5 <= 0.61, "el velo se acota al rango del manual", "alfa=" + r5);

  console.log("\n6 · Legal: banda reservada, una línea, no sobre la foto");
  const r6 = await pg.evaluate(() => {
    const cmp = [...document.querySelectorAll(".ab")].find(a => a.dataset.fmt === "display-300x600").querySelector(".cmp");
    const banda = cmp.querySelector(".cmp-legalbanda"), leg = cmp.querySelector(".cmp-legal");
    const cs = banda ? getComputedStyle(banda) : null;
    const zonas = cmp.querySelector(".cmp-zonas");
    return { hay: !!banda, lineas: leg ? Math.round(leg.scrollHeight / parseFloat(getComputedStyle(leg).lineHeight)) : 0,
      respaldo: cs ? cs.backgroundColor : "", padBottom: zonas ? parseFloat(getComputedStyle(zonas).paddingBottom) : 0,
      altoBanda: banda ? banda.getBoundingClientRect().height : 0 };
  });
  T(r6.hay, "la banda legal existe");
  T(r6.lineas === 1, "el legal ocupa una sola línea", "líneas=" + r6.lineas);
  T(!/rgba\(0, 0, 0, 0\)/.test(r6.respaldo), "sobre foto la banda lleva respaldo sólido", r6.respaldo);
  T(r6.padBottom >= r6.altoBanda, "el contenido reserva el espacio de la banda", r6.padBottom + " vs " + r6.altoBanda);

  console.log("\n" + (mal ? "FALLA" : "TODO OK") + ` — ${ok} ok · ${mal} mal`);
  if (errs.length) { console.log("ERRORES DE PÁGINA:"); errs.forEach(e => console.log("  " + e)); }
  await b.close();
  process.exit(mal || errs.length ? 1 : 0);
})();
