// ¿CIERRA CADA MODAL? Un overlay que queda puesto no se ve, pero se come todos
// los clics: el aplicativo parece congelado. Se abre cada modal, se cierra con su
// propia × y se comprueba que (a) no queda ninguna capa visible y (b) se puede
// volver a pulsar un botón de la barra.
const { chromium } = require("playwright");
let ok = 0, mal = 0;
const T = (c, n, e) => { if (c) { ok++; console.log("  ok   " + n); } else { mal++; console.log("  MAL  " + n + (e ? " → " + e : "")); } };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.SBB_CHROMIUM || undefined });
  const pg = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  pg.on("pageerror", e => errs.push(e.message));
  pg.on("dialog", d => d.dismiss().catch(() => {}));
  await pg.goto((process.env.SBB_URL || "http://127.0.0.1:8099")+"/editor.html", { waitUntil: "load" });
  await pg.waitForFunction(() => typeof window.crearComposicion === "function");

  // Entra al EDITOR: ahí estos paneles son modales de verdad.
  await pg.evaluate(() => {
    const pr = { id: uid(), nombre: "Cierres", creado: Date.now(), piezas: [], activa: null };
    workspace.proyectos = [pr]; proyectoVistoId = pr.id; proyecto = pr;
    workspace.marcas = [{ id: "m1", nombre: "Prueba" }];
    crearComposicion("display-desktop");
    // Modelo de 3 ZONAS: es el de las piezas ya guardadas, y esta prueba lo
    // protege. Los banners NUEVOS nacen en el lienzo libre.
    pieza().composicion = composicionDefault(pieza().tema);
    setComp("zonas.texto.titular.texto", "Tu auto listo");
    setComp("zonas.cta.texto", "Cotiza aquí");
    setComp("zonas.logo.url", "/logo.svg");
  });
  await pg.waitForTimeout(700);

  // Todos los modales que declara el HTML
  const modales = await pg.evaluate(() => [...document.querySelectorAll(".modal-bg")].map(m => m.id));
  console.log("Modales declarados: " + modales.join(" · ") + "\n");

  const ABREN = {
    "modal-ia": "abrirIA()",
    "modal-imagenes": "abrirImagenes(()=>{})",   // como selector → sí es modal
    "modal-marcas": "abrirMarcas()",
    "modal-export": "abrirExportar()"
    // modal-papelera NO se abre nunca: es el contenedor de origen de
    // #papelera-cont, que montarPapeleraEnPagina() reparenta a la página del
    // dashboard. Su contrato se comprueba aparte, más abajo.
  };

  for (const id of modales) {
    const fn = ABREN[id];
    if (!fn) { console.log(`  (${id}: sin abridor conocido, se omite)`); continue; }
    console.log(`  ${id}`);
    const abre = await pg.evaluate((f) => { try { eval(f); } catch (e) { return { err: e.message }; }
      return { show: document.querySelectorAll(".modal-bg.show").length }; }, fn);
    await pg.waitForTimeout(300);
    if (abre.err) { T(false, "abre", abre.err); continue; }
    T(abre.show >= 1, "abre", "capas visibles=" + abre.show);

    // Cierra con su propio botón ×
    const cerrado = await pg.evaluate((id) => {
      const m = document.getElementById(id);
      const x = m && (m.querySelector(".modal-close") || m.querySelector("[onclick*='cerrarModal']"));
      if (!x) return { sinBoton: true };
      x.click();
      return { sinBoton: false };
    }, id);
    await pg.waitForTimeout(300);
    if (cerrado.sinBoton) { T(false, "tiene botón de cerrar"); continue; }
    const estado = await pg.evaluate(() => {
      const puestos = [...document.querySelectorAll(".modal-bg.show")].map(m => m.id);
      // ¿queda alguna capa comiéndose los clics en el centro de la pantalla?
      const enMedio = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      const tapado = !!(enMedio && enMedio.closest && enMedio.closest(".modal-bg"));
      return { puestos, tapado, arriba: enMedio ? (enMedio.className || enMedio.tagName) : "?" };
    });
    T(estado.puestos.length === 0, "cierra y no deja capas puestas", estado.puestos.join(","));
    T(!estado.tapado, "nada tapa el centro de la pantalla", String(estado.arriba).slice(0, 50));

    // Y el aplicativo sigue respondiendo: se puede pulsar un botón de la barra
    const responde = await pg.evaluate(() => {
      const bt = document.querySelector(".topbar .tb-act");
      if (!bt) return { sinBoton: true };
      const r = bt.getBoundingClientRect();
      const enc = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { alcanzable: !!(enc && (enc === bt || bt.contains(enc))), quien: enc ? (enc.className || enc.tagName) : "?" };
    });
    T(responde.sinBoton || responde.alcanzable, "la barra vuelve a ser clicable", responde.quien);
  }

  // La Papelera no es modal: su contrato es mostrar la PÁGINA del dashboard con
  // el contenido reparentado. Eso es lo que hay que comprobar.
  console.log("\n  Papelera (página, no modal)");
  const pap = await pg.evaluate(() => {
    try { abrirPapelera(); } catch (e) { return { err: e.message }; }
    const pagina = document.getElementById("pg-papelera");
    const cont = document.getElementById("papelera-cont");
    return { err: null, dash: document.getElementById("galeria").classList.contains("show"),
      visible: !!pagina && pagina.offsetParent !== null,
      contenidoEnLaPagina: !!(cont && pagina && pagina.contains(cont)),
      modalPuesto: document.querySelectorAll(".modal-bg.show").length };
  });
  await pg.waitForTimeout(250);
  T(!pap.err, "abrirPapelera() no falla", pap.err);
  T(pap.visible, "muestra la página de la papelera");
  T(pap.contenidoEnLaPagina, "el contenido queda montado DENTRO de la página");
  T(pap.modalPuesto === 0, "y no deja ningún modal puesto", "puestos=" + pap.modalPuesto);
  // vuelve al editor para la prueba de Escape
  await pg.evaluate(() => { const p = pieza(); if (p) activarPieza(p.id); });
  await pg.waitForTimeout(300);

  // Tecla Escape en el modal más grande
  console.log("\n  Escape cierra");
  await pg.evaluate(() => abrirIA());
  await pg.waitForTimeout(250);
  await pg.keyboard.press("Escape");
  await pg.waitForTimeout(250);
  const esc = await pg.evaluate(() => document.querySelectorAll(".modal-bg.show").length);
  if (esc > 0) console.log("     (Escape no cierra el asistente · mejora posible, no falla)");
  else console.log("     ok   Escape cierra el asistente");

  console.log("\n" + (mal || errs.length ? "FALLA" : "TODO OK") + ` — ${ok} ok · ${mal} mal`);
  if (errs.length) [...new Set(errs)].forEach(e => console.log("  err " + e));
  await b.close();
  process.exit(mal || errs.length ? 1 : 0);
})();
