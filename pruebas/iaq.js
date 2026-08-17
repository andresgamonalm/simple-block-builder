// Verifica el bloque de IA: límites de caracteres calculados, exclusión de logos
// por carpeta, avisos que llegan al usuario, y el encogido antes de partir palabra.
const { chromium } = require("playwright");
let ok = 0, mal = 0;
const T = (c, n, e) => { if (c) { ok++; console.log("  ok   " + n); } else { mal++; console.log("  MAL  " + n + (e ? " → " + e : "")); } };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.SBB_CHROMIUM || undefined });
  const pg = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  pg.on("pageerror", e => errs.push(e.message));
  await pg.goto((process.env.SBB_URL || "http://127.0.0.1:8099")+"/editor.html", { waitUntil: "load" });
  await pg.waitForFunction(() => typeof window.limitesParaIA === "function");

  console.log("\n1 · Límites que se le pasan a la IA");
  // El circulo de oferta le come la mitad del ancho a la columna de texto, asi que
  // los limites se piden segun si la campana lleva oferta o no: dar por hecho que
  // siempre la lleva recortaba el titular de TODA campana.
  const L  = await pg.evaluate(() => limitesParaIA("display-300x250", true));   // con oferta
  const LS = await pg.evaluate(() => limitesParaIA("display-300x250", false));  // sin oferta
  console.log("     con oferta: " + JSON.stringify(L));
  console.log("     sin oferta: " + JSON.stringify(LS));
  T(L.titulo > 10 && L.titulo < 40, "con círculo de oferta, límite de titular razonable", L.titulo);
  T(LS.titulo > L.titulo, "sin oferta el titular dispone del ancho completo", LS.titulo + " vs " + L.titulo);
  T(L.cuerpo > L.titulo, "la bajada admite más que el titular", L.cuerpo + " vs " + L.titulo);
  T(L.palabra >= 6 && L.palabra <= 12, "palabra más larga sale del formato más angosto", L.palabra);

  console.log("\n2 · Logos excluidos por CARPETA, no por nombre");
  const r2 = await pg.evaluate(() => ({
    logoCarpeta: sirveComoFondo({ url: "/api/upload?k=logos/Foto-Bonita-Playa.png" }),
    fotoCarpeta: sirveComoFondo({ url: "/api/upload?k=fotos-seguros/Logo-Mundial.jpg" }),
    subida:      sirveComoFondo({ url: "/api/upload?k=subidas/familia.jpg" }),
    legadoLogo:  sirveComoFondo({ url: "/api/upload?k=zurich/Logo-Zurich.png" }),
    legadoFoto:  sirveComoFondo({ url: "/api/upload?k=zurich/persona-auto.jpg" })
  }));
  T(r2.logoCarpeta === false, "logos/ nunca es fondo, aunque el archivo se llame Foto-Bonita");
  T(r2.fotoCarpeta === true, "fotos-seguros/ SÍ es fondo, aunque el archivo se llame Logo-Mundial");
  T(r2.subida === true, "subidas/ es fondo");
  T(r2.legadoLogo === false, "carpeta desconocida: se cae al nombre y descarta el logo");
  T(r2.legadoFoto === true, "carpeta desconocida: una foto normal pasa");

  console.log("\n3 · Encoger antes de partir una palabra");
  const r3 = await pg.evaluate(() => {
    const pr = { id: uid(), nombre: "q", creado: Date.now(), piezas: [], activa: null };
    workspace.proyectos = [pr]; proyectoVistoId = pr.id; proyecto = pr;
    crearComposicion("display-desktop");
    setComp("zonas.texto.titular.texto", "Auto protegido");
    setComp("burbuja.texto", "2 Cuotas Gratis"); setComp("burbuja.visible", true);
    const P = planDeBanner(composicionEfectiva(pieza(), "display-200x200"), "display-200x200", 0);
    const Pm = planDeBanner(composicionEfectiva(pieza(), "display-300x250"), "display-300x250", 0);
    return { chico: P.cuerpo.titulo, master: Pm.cuerpo.titulo, piso: P.g.piso, ancho: P.anchoTexto };
  });
  T(r3.chico < 18 && r3.chico >= r3.piso, "el titular baja de 18px para que «protegido» entre", r3.chico + "px, piso " + r3.piso);
  T(r3.master === 26, "el máster no se toca", r3.master + "px");

  console.log("\n4 · Los avisos se muestran en pantalla");
  const r4 = await pg.evaluate(() => {
    mostrarAvisosIA([{ tipo: "url-no-leida", texto: "No se pudo leer https://x.cl" },
                     { tipo: "discrepancia", texto: "Tu gancho dice 40% y la página 30%" }]);
    const c = document.getElementById("ia-avisos");
    return { hay: !!c, items: c ? c.querySelectorAll("li").length : 0, texto: c ? c.textContent : "" };
  });
  T(r4.hay && r4.items === 2, "el panel de avisos aparece con los dos avisos", "items=" + r4.items);
  T(/40%/.test(r4.texto), "el aviso de discrepancia muestra las dos cifras");

  console.log("\n" + (mal || errs.length ? "FALLA" : "TODO OK") + ` — ${ok} ok · ${mal} mal`);
  if (errs.length) errs.forEach(e => console.log("  err " + e));
  await b.close(); process.exit(mal || errs.length ? 1 : 0);
})();
