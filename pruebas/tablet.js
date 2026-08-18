// Fija los dos arreglos reportados por el usuario:
//  1. en tablet ningún botón de la barra queda fuera de la pantalla, y los
//     textos de ayuda se leen como frases, no partidos en columnas.
//  2. editar el texto del banner es fluido: A+/A−/alineación no repintan los 11
//     banners, no cierran la barrita y no pierden el foco.
const { chromium } = require("playwright");
let ok = 0, mal = 0;
const T = (c, n, e) => { if (c) { ok++; console.log("  ok   " + n); } else { mal++; console.log("  MAL  " + n + (e ? " → " + e : "")); } };

const MEDIDAS = [[1024,768,"iPad landscape"],[768,1024,"iPad portrait"],[820,1180,"iPad Air"],[1180,820,"tablet límite"]];

const prepararColeccion = () => {
  const pr = { id: uid(), nombre: "T", creado: Date.now(), piezas: [], activa: null };
  workspace.proyectos = [pr]; proyectoVistoId = pr.id; proyecto = pr;
  crearComposicion("display-desktop");
  // Modelo de 3 ZONAS: es el de las piezas ya guardadas, y esta prueba lo
  // protege. Los banners NUEVOS nacen en el lienzo libre.
  pieza().composicion = composicionDefault(pieza().tema);
  setComp("zonas.texto.titular.texto", "Tu auto listo");
  setComp("zonas.texto.cuerpo.texto", "Cobertura desde hoy");
  setComp("zonas.cta.texto", "Cotiza aquí");
  setComp("zonas.logo.url", "/logo.svg");
  setComp("fondo.color", "#23366F");
};

(async () => {
  const b = await chromium.launch({ executablePath: process.env.SBB_CHROMIUM || undefined });
  const errs = [];

  console.log("\n1 · TABLET: nada fuera de la pantalla, nada partido");
  for (const [w, h, nombre] of MEDIDAS) {
    const pg = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true });
    pg.on("pageerror", e => errs.push(nombre + ": " + e.message));
    await pg.goto((process.env.SBB_URL || "http://127.0.0.1:8099")+"/editor.html", { waitUntil: "load" });
    await pg.waitForFunction(() => typeof window.crearComposicion === "function");
    await pg.evaluate(prepararColeccion);
    await pg.waitForTimeout(800);
    const r = await pg.evaluate(() => {
      const doc = document.documentElement;
      const acc = [...document.querySelectorAll(".topbar .tb-r1 .tb-act")].map(x => {
        const q = x.getBoundingClientRect();
        return { t: (x.textContent || "").trim().slice(0, 9), dentro: q.left >= 0 && q.right <= innerWidth + 1 && q.width > 0 };
      });
      // Un texto "partido en columnas" se detecta midiendo su ancho: si el
      // contenedor es flex, cada palabra en negrita queda como item suelto y el
      // bloque acaba mucho más alto que las líneas que le tocan.
      const prosa = s => { const e = document.querySelector(s); if (!e) return null;
        const cs = getComputedStyle(e);
        const lineas = e.getBoundingClientRect().height / parseFloat(cs.lineHeight);
        return { flex: /flex/.test(cs.display), lineas: Math.round(lineas) }; };
      return { desborda: doc.scrollWidth > doc.clientWidth + 1,
        acc, fuera: acc.filter(x => !x.dentro).length,
        ayuda: prosa(".lz-ayuda"), hint: prosa(".cmp-hint-lienzo") || prosa(".se-nota"),
        banners: document.querySelectorAll(".ab .cmp").length,
        // `top` resuelve a pixeles cuando hay `bottom`, asi que se mide la
        // posicion REAL: el toast debe caer bajo la barra de herramientas.
        toastAbajo: (()=>{ const t=document.getElementById("toast"); if(!t) return false;
          const q=t.getBoundingClientRect(); const tb=document.querySelector(".topbar");
          return q.top > (tb ? tb.getBoundingClientRect().bottom : 100); })() };
    });
    console.log(`\n  ${nombre} (${w}×${h})`);
    T(!r.desborda, "no desborda a lo ancho");
    T(r.acc.length >= 3 && r.fuera === 0, "Guardar, Exportar y Salir alcanzables",
      r.acc.map(x => x.t + (x.dentro ? "" : " FUERA")).join(","));
    T(r.ayuda && !r.ayuda.flex && r.ayuda.lineas <= 4, "la ayuda del lienzo se lee como frase", JSON.stringify(r.ayuda));
    T(!r.hint || (!r.hint.flex && r.hint.lineas <= 5), "el aviso del panel se lee como frase", JSON.stringify(r.hint));
    T(r.banners === 11, "los 11 banners se dibujan", r.banners);
    T(r.toastAbajo, "el toast no tapa la barra de herramientas");
    await pg.close();
  }

  console.log("\n2 · EDICIÓN FLUIDA del texto del banner");
  const pg = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  pg.on("pageerror", e => errs.push("edicion: " + e.message));
  await pg.goto((process.env.SBB_URL || "http://127.0.0.1:8099")+"/editor.html", { waitUntil: "load" });
  await pg.waitForFunction(() => typeof window.crearComposicion === "function");
  await pg.evaluate(prepararColeccion);
  await pg.evaluate(() => {
    window._n = { tablero: 0, insp: 0 };
    const rt = window.renderTablero; window.renderTablero = function () { window._n.tablero++; return rt.apply(this, arguments); };
    const it = window.inspeccionarTablero; window.inspeccionarTablero = function () { window._n.insp++; return it.apply(this, arguments); };
  });
  await pg.waitForTimeout(800);

  // Escribir no debe repintar
  await (await pg.$(".lienzo-edit")).click();
  await pg.waitForTimeout(120);
  await pg.evaluate(() => { window._n = { tablero: 0, insp: 0 }; });
  await pg.keyboard.type(" hoy", { delay: 30 });
  const rEsc = await pg.evaluate(() => ({ ...window._n }));
  T(rEsc.tablero === 0, "escribir no repinta el tablero", "renders=" + rEsc.tablero);

  // A+ tres veces seguidas: sin repintar, sin perder foco ni barrita
  const antesPx = await pg.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".lienzo .cmp-tit")).fontSize));
  for (let i = 0; i < 3; i++) { await pg.click('.lienzo-textbar button[data-act="mas"]'); await pg.waitForTimeout(60); }
  const rMas = await pg.evaluate(() => ({ ...window._n,
    px: parseFloat(getComputedStyle(document.querySelector(".lienzo .cmp-tit")).fontSize),
    barra: !!document.getElementById("lienzo-textbar"),
    foco: document.activeElement && document.activeElement.className }));
  T(rMas.tablero === 0, "tres clics en A+ no repintan el tablero", "renders=" + rMas.tablero);
  T(rMas.barra, "la barrita de texto sigue abierta");
  T(/lienzo-edit/.test(rMas.foco || ""), "el foco sigue en el texto", rMas.foco);
  T(rMas.px !== antesPx, "el tamaño cambió en vivo en el banner", antesPx + " → " + rMas.px);

  // Alineación: igual de fluida
  await pg.click('.lienzo-textbar button[data-aln="center"]');
  await pg.waitForTimeout(80);
  const rAln = await pg.evaluate(() => ({ ...window._n,
    align: getComputedStyle(document.querySelector(".lienzo .cmp-tit")).textAlign,
    barra: !!document.getElementById("lienzo-textbar") }));
  T(rAln.tablero === 0, "alinear no repinta el tablero", "renders=" + rAln.tablero);
  T(rAln.align === "center", "el texto se centró en vivo", rAln.align);
  T(rAln.barra, "la barrita sigue abierta tras alinear");

  // Al salir: UN solo repintado y UNA sola inspección, y queda guardado
  await pg.evaluate(() => document.querySelector(".lienzo-edit").blur());
  await pg.waitForTimeout(900);
  const rFin = await pg.evaluate(() => ({ ...window._n,
    guardado: getPath(composicionEfectiva(pieza(), pieza().activaFmt), "zonas.texto.titular.texto"),
    tam: getPath(composicionEfectiva(pieza(), pieza().activaFmt), "zonas.texto.titular.tamano"),
    aln: getPath(composicionEfectiva(pieza(), pieza().activaFmt), "zonas.texto.alinH") }));
  T(rFin.tablero === 1, "al salir del texto repinta UNA vez", "renders=" + rFin.tablero);
  T(rFin.insp === 1, "y el inspector corre UNA vez", "inspecciones=" + rFin.insp);
  T(/hoy/.test(rFin.guardado || ""), "el texto quedó guardado", rFin.guardado);
  T(String(rFin.aln) === "center", "la alineación quedó guardada", rFin.aln);
  T(parseInt(rFin.tam) > 26, "el tamaño quedó guardado", rFin.tam);

  console.log("\n" + (mal || errs.length ? "FALLA" : "TODO OK") + ` — ${ok} ok · ${mal} mal`);
  if (errs.length) [...new Set(errs)].forEach(e => console.log("  err " + e));
  await b.close();
  process.exit(mal || errs.length ? 1 : 0);
})();
