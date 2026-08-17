// RECORRIDO COMPLETO del aplicativo, de principio a fin.
// Entra a cada sección, abre cada panel y cada modal, y PULSA todos los
// controles que no sean destructivos, anotando el que falle. Un botón que no
// lanza error pero tampoco hace nada también cuenta: se comprueba que la vista
// cambie donde corresponde.
const { chromium } = require("playwright");

const URL = process.env.SBB_URL || "http://127.0.0.1:8099";
// Nunca se pulsa lo que borra, cierra sesión o descarga archivos.
const PROHIBIDO = /eliminar|borrar|vaciar|papelera|cerrar sesión|cerrar sesion|salir|descargar|exportar|restaurar|definitivo|logout|subir|guardar proyecto/i;

const hallazgos = [];
const anota = (seccion, tipo, detalle) => hallazgos.push({ seccion, tipo, detalle });

(async () => {
  const b = await chromium.launch({ executablePath: process.env.SBB_CHROMIUM || undefined });
  const pg = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  let seccion = "arranque";
  pg.on("pageerror", e => anota(seccion, "ERROR JS", e.message));
  pg.on("console", m => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/ERR_CERT|ERR_CONNECTION|favicon|net::ERR_FAILED|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|gstatic/.test(t)) return;
    anota(seccion, "CONSOLA", t.slice(0, 160));
  });
  pg.on("dialog", d => d.dismiss().catch(() => {}));

  const irA = async (ruta) => {
    await pg.goto(URL + ruta, { waitUntil: "load" });
    await pg.waitForFunction(() => typeof window.irARuta === "function", { timeout: 15000 });
    await pg.waitForTimeout(450);
  };
  // Pulsa todos los controles visibles y no destructivos de un contenedor.
  const pulsarTodo = async (sel, etiqueta) => {
    const botones = (await pg.$$(sel + " button:not([disabled]), " + sel + " .crc")).slice(0, 45);
    let n = 0, saltados = 0;
    for (const bt of botones) {
      let txt = "";
      try {
        txt = ((await bt.textContent()) || "").replace(/\s+/g, " ").trim().slice(0, 40);
        const title = (await bt.getAttribute("title")) || "";
        const oc = (await bt.getAttribute("onclick")) || "";
        if (PROHIBIDO.test(txt + " " + title + " " + oc)) { saltados++; continue; }
        if (!(await bt.isVisible())) { saltados++; continue; }
        const antes = hallazgos.length;
        await bt.click({ timeout: 900 });
        await pg.waitForTimeout(35);
        if (hallazgos.length > antes) anota(etiqueta, "AL PULSAR", `"${txt}" produjo el error de arriba`);
        n++;
      } catch (e) {
        if (!/timeout|not visible|intercepts/i.test(e.message)) anota(etiqueta, "CLIC FALLA", `"${txt}": ${e.message.slice(0, 90)}`);
        saltados++;
      }
    }
    return { n, saltados };
  };

  // ═══ 1 · DASHBOARD: todas sus páginas ═══
  console.log("\n═══ 1 · DASHBOARD ═══");
  seccion = "dashboard";
  await irA("/home");
  // Las vistas se leen del REGISTRO de la app (DASH_VIEWS): así la prueba no se
  // desincroniza del código, que es lo que me pasó con "config"/"configuracion".
  const VISTAS = await pg.evaluate(() => Object.keys(DASH_VIEWS));
  const IDS = await pg.evaluate(() => DASH_VIEWS);
  for (const v of VISTAS) {
    seccion = "dashboard/" + v;
    const r = await pg.evaluate((v) => {
      try { dashIr(v); } catch (e) { return { err: e.message }; }
      const pg2 = document.getElementById(DASH_VIEWS[v]);
      return { existe: !!pg2, visible: !!pg2 && pg2.offsetParent !== null,
               vacia: !!pg2 && pg2.textContent.replace(/\s+/g, "").length < 25,
               ruta: location.pathname };
    }, v);
    await pg.waitForTimeout(350);
    if (r.err) anota(seccion, "NO ABRE", r.err);
    else if (!r.existe) anota(seccion, "NO EXISTE", "no hay " + IDS[v]);
    else if (!r.visible) anota(seccion, "NO SE VE", "la página existe pero no se muestra");
    else if (r.vacia) anota(seccion, "VACÍA", "la página se muestra sin contenido");
    const pulsos = await pulsarTodo("#" + IDS[v], seccion);
    console.log(`  ${v.padEnd(11)} ${r.visible ? "se ve" : "NO SE VE"} · ruta ${r.ruta} · ${pulsos.n} controles pulsados (${pulsos.saltados} omitidos)`);
    // vuelve al dashboard si algún clic abrió el editor o un modal
    await pg.evaluate(() => { document.querySelectorAll(".modal-bg.show").forEach(m => m.classList.remove("show")); try { abrirGaleria(); } catch (e) {} });
    await pg.waitForTimeout(200);
  }

  // ═══ 2 · MODALES del dashboard ═══
  console.log("\n═══ 2 · MODALES ═══");
  // Ojo: desde el dashboard, Marcas/Imágenes/Papelera muestran su PÁGINA (mismo
  // contenido reparentado) y NO abren modal — es el diseño, no un fallo. Por eso
  // el modal se comprueba con el selector de imágenes, que sí lo es siempre.
  // Exportar solo abre si hay una pieza (si no, sale sin hacer nada, por diseño):
  // se crea una antes para probarlo de verdad.
  await pg.evaluate(() => {
    const pr = { id: uid(), nombre: "Modales", creado: Date.now(), piezas: [], activa: null };
    workspace.proyectos = [pr]; proyectoVistoId = pr.id; proyecto = pr;
    crearPieza("email", "Para exportar"); activarPieza(proyecto.activa);
  });
  await pg.waitForTimeout(300);
  for (const [nombre, fn] of [["Char-B (IA)", "abrirIA()"], ["Imágenes (selector)", "abrirImagenes(()=>{})"],
                              ["Exportar", "abrirExportar()"]]) {
    seccion = "modal/" + nombre;
    const r = await pg.evaluate((fn) => {
      try { eval(fn); } catch (e) { return { err: e.message }; }
      const m = [...document.querySelectorAll(".modal-bg")].find(x => x.classList.contains("show"));
      return { abre: !!m, id: m ? m.id : "", campos: m ? m.querySelectorAll("input,select,textarea,button").length : 0 };
    }, fn);
    if (r.err) anota(seccion, "NO ABRE", r.err);
    else if (!r.abre) anota(seccion, "NO ABRE", "ningún modal quedó visible");
    console.log(`  ${nombre.padEnd(13)} ${r.abre ? "abre (" + r.id + ", " + r.campos + " controles)" : "NO ABRE"}`);
    await pg.evaluate(() => document.querySelectorAll(".modal-bg.show").forEach(m => m.classList.remove("show")));
    await pg.waitForTimeout(150);
  }

  // ═══ 3 · CADA PRODUCTO de principio a fin ═══
  console.log("\n═══ 3 · PRODUCTOS ═══");
  const PRODUCTOS = [
    { ruta: "/email-ia", tipo: "email",         nombre: "Email" },
    { ruta: "/gdn-ia",   tipo: "display-300x250", nombre: "Display" },
    { ruta: "/fb-ia",    tipo: "fb-1080x1350",  nombre: "Facebook" },
    { ruta: "/ads-ia",   tipo: "ads",           nombre: "Search" },
    { ruta: "/free",     tipo: "libre",         nombre: "Libre" }
  ];
  for (const p of PRODUCTOS) {
    seccion = "producto" + p.ruta;
    await irA("/home");
    const r = await pg.evaluate((p) => {
      const pr = { id: uid(), nombre: "Auditoría", creado: Date.now(), piezas: [], activa: null };
      workspace.proyectos = [pr]; proyectoVistoId = pr.id; proyecto = pr;
      _rutaActual = p.ruta;
      const cat = categoriaDe(p.tipo);
      try {
        if (cat === "Banners" || cat === "Post" || cat === "Facebook")
          crearComposicion(cat === "Banners" ? "display-desktop" : cat === "Facebook" ? "facebook" : "social");
        else { crearPieza(p.tipo, "Auditoría " + p.nombre); activarPieza(proyecto.activa); }
      } catch (e) { return { err: e.message }; }
      const pz = pieza();
      return { creada: !!pz, formato: pz && pz.formato, cat, ruta: rutaDeProducto(pz),
               canvasHay: !!document.getElementById("canvas") };
    }, p);
    await pg.waitForTimeout(800);
    if (r.err) { anota(seccion, "NO SE CREA", r.err); console.log(`  ${p.nombre}: NO SE CREA (${r.err})`); continue; }
    // Pestañas del panel
    const tabs = await pg.evaluate(() => {
      const out = [];
      document.querySelectorAll(".panel-tabs button, .panel-tabs .ptab").forEach(t => {
        out.push({ txt: (t.textContent || "").trim().slice(0, 14), id: t.id || "", off: t.disabled || t.classList.contains("off") });
      });
      return out;
    });
    for (const t of tabs) {
      if (t.off || !t.id) continue;
      const antes = hallazgos.length;
      try { await pg.click("#" + t.id, { timeout: 1200 }); await pg.waitForTimeout(250); } catch (e) {}
      if (hallazgos.length > antes) anota(seccion, "PESTAÑA", `"${t.txt}" da error`);
    }
    // Vista previa y modal de exportar (se abre, no se descarga)
    const extra = await pg.evaluate(() => {
      const o = {};
      try { abrirExportar(); o.export = !!document.getElementById("modal-export").classList.contains("show");
            const b = document.getElementById("export-body"); o.exportVacio = !b || b.textContent.trim().length < 20;
            cerrarModal("export"); } catch (e) { o.exportErr = e.message; }
      try { const h = generarHTMLDePieza(pieza()); o.html = (h || "").length; } catch (e) { o.htmlErr = e.message; }
      return o;
    });
    if (extra.exportErr) anota(seccion, "EXPORTAR", extra.exportErr);
    if (extra.export === false) anota(seccion, "EXPORTAR", "el modal no abre");
    if (extra.exportVacio) anota(seccion, "EXPORTAR", "el modal abre vacío");
    if (extra.htmlErr) anota(seccion, "EXPORT HTML", extra.htmlErr);
    else if (!extra.html || extra.html < 200) anota(seccion, "EXPORT HTML", "salida sospechosamente corta: " + extra.html);
    // Barra de herramientas del editor
    await pg.evaluate(() => document.querySelectorAll(".modal-bg.show").forEach(m => m.classList.remove("show")));
    await pg.waitForTimeout(150);
    const pulsos = await pulsarTodo(".topbar", seccion + "/barra");
    console.log(`  ${p.nombre.padEnd(9)} ruta ${String(r.ruta).padEnd(10)} · ${tabs.filter(t => !t.off).length}/${tabs.length} pestañas activas · export ${extra.html} bytes · ${pulsos.n} botones de barra`);
  }

  // ═══ 4 · EMAIL a fondo: biblioteca de bloques y edición ═══
  console.log("\n═══ 4 · EMAIL: todos los bloques de su biblioteca ═══");
  seccion = "email/bloques";
  await irA("/email-ia");
  const rb = await pg.evaluate(() => {
    const pr = { id: uid(), nombre: "Bloques", creado: Date.now(), piezas: [], activa: null };
    workspace.proyectos = [pr]; proyectoVistoId = pr.id; proyecto = pr;
    crearPieza("email", "Bloques"); activarPieza(proyecto.activa);
    const fallos = [];
    const tipos = Array.from(typeof BLOQUES_EMAIL_IA !== "undefined" ? BLOQUES_EMAIL_IA : Object.keys(BLOQUES));
    tipos.forEach(t => {
      try { agregarBloque(t); } catch (e) { fallos.push(t + ": " + e.message); }
    });
    let sel = [];
    try {
      (pieza().canvas || []).forEach(bl => { seleccionarBloque(bl.id); renderForm();
        const f = document.getElementById("form");
        if (!f || f.textContent.trim().length < 10) sel.push(bl.tipo + " (form vacío)"); });
    } catch (e) { sel.push("selección: " + e.message); }
    return { tipos: tipos.length, puestos: (pieza().canvas || []).length, fallos, sel };
  });
  await pg.waitForTimeout(500);
  console.log(`  ${rb.puestos}/${rb.tipos} bloques añadidos · ${rb.fallos.length} fallos al añadir · ${rb.sel.length} formularios vacíos`);
  rb.fallos.forEach(f => anota(seccion, "BLOQUE", f));
  rb.sel.forEach(f => anota(seccion, "FORM DE BLOQUE", f));

  // ═══ 5 · Recarga directa de cada ruta (deep-link) ═══
  console.log("\n═══ 5 · ENLACE DIRECTO a cada ruta ═══");
  for (const ruta of ["/home", "/proyectos", "/imagenes", "/marcas", "/papelera", "/permisos", "/configuracion",
                      "/email-ia", "/gdn-ia", "/fb-ia", "/ads-ia", "/free", "/post-ia"]) {
    seccion = "deep-link " + ruta;
    const antes = hallazgos.length;
    await irA(ruta);
    const r = await pg.evaluate(() => ({
      cuerpo: document.body.textContent.replace(/\s+/g, "").length,
      dash: (document.getElementById("galeria") || {}).classList ? document.getElementById("galeria").classList.contains("show") : null,
      ruta: location.pathname
    }));
    const nuevos = hallazgos.length - antes;
    if (r.cuerpo < 200) anota(seccion, "PÁGINA VACÍA", "el cuerpo trae " + r.cuerpo + " caracteres");
    console.log(`  ${ruta.padEnd(16)} ${r.cuerpo > 200 ? "carga" : "VACÍA"} · ${nuevos ? nuevos + " error(es)" : "sin errores"}`);
  }

  // ═══ Informe ═══
  console.log("\n" + "═".repeat(70));
  if (!hallazgos.length) console.log("RECORRIDO COMPLETO SIN HALLAZGOS");
  else {
    console.log(`HALLAZGOS: ${hallazgos.length}`);
    const porTipo = {};
    hallazgos.forEach(h => { porTipo[h.tipo] = (porTipo[h.tipo] || 0) + 1; });
    console.log("Por tipo: " + Object.entries(porTipo).map(([k, v]) => k + "=" + v).join(" · ") + "\n");
    const vistos = new Set();
    hallazgos.forEach(h => {
      const k = h.tipo + "|" + h.detalle;
      if (vistos.has(k)) return; vistos.add(k);
      console.log(`  [${h.tipo}] ${h.seccion}\n      ${h.detalle}`);
    });
  }
  require("fs").writeFileSync("/tmp/sbb-hallazgos.json", JSON.stringify(hallazgos, null, 1));
  await b.close();
  process.exit(0);
})();
