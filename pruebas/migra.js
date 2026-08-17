// ¿SOBREVIVEN LOS DATOS YA GUARDADOS?
// El cambio a geometría cerrada acota valores que las piezas viejas traen fuera
// de rango (logo de 48 px, titular de 40, burbuja de 96) y hay piezas con el
// modelo de 6 capas anterior o con un layout de marca que hoy está apagado.
// Esto abre cada uno de esos casos como los abriría el usuario y comprueba que
// se dibujen, se puedan exportar y no pierdan su texto.
const { chromium } = require("playwright");
let ok = 0, mal = 0;
const T = (c, n, e) => { if (c) { ok++; console.log("  ok   " + n); } else { mal++; console.log("  MAL  " + n + (e ? " → " + e : "")); } };

// Piezas tal como quedaron guardadas en versiones anteriores del aplicativo.
const VIEJAS = {
  seisCapas: {
    id: "v1", nombre: "Campaña 6 capas", formato: "display-300x250", esSet: true,
    masterFmt: "display-300x250", activaFmt: "display-300x250",
    artboards: [{ fmt: "display-300x250" }, { fmt: "display-728x90" }, { fmt: "display-300x600" }],
    canvas: [], tema: { font: "Arial", primary: "#2167AE", text: "#23366F", bg: "#ffffff" },
    // modelo ANTIGUO: sin `zonas`
    composicion: {
      imagen: { url: "/foto.svg", foco: "center", fit: "cover", zoom: 100, oscurecer: 20 },
      fondoColor: { color: "#23366F" },
      logo: { url: "/logo.svg", tamano: 60, maxw: 80, alinH: "left", visible: true },
      titular: { texto: "Seguro con todo incluido", tamano: 34, color: "#ffffff", alinH: "left" },
      cuerpo: { texto: "Cobertura completa para tu auto desde el primer día", tamano: 18, color: "#ffffff" },
      cta: { texto: "Cotiza ahora", url: "https://ejemplo.cl", colorFondo: "#C0392B", colorTexto: "#ffffff", alinH: "left" }
    }
  },
  conLayoutMarca: {
    id: "v2", nombre: "Campaña con layout de marca", formato: "display-300x250", esSet: true,
    masterFmt: "display-300x250", activaFmt: "display-300x250",
    artboards: [{ fmt: "display-300x250" }, { fmt: "display-160x600" }],
    canvas: [], tema: { font: "Arial", primary: "#2167AE", text: "#23366F", bg: "#ffffff" },
    composicion: {
      layout: "z-circulo",                      // apagado hoy: debe caer a 3 zonas
      fondo: { tipo: "color", color: "#1d2e7a", imagen: { url: "", oscurecer: 40 } },
      prop: [25, 50, 25],
      zonas: {
        logo: { bg: "hereda", url: "/logo.svg", alto: 48, maxw: 70, visible: true, alinH: "left", alinV: "center" },
        texto: { bg: "hereda", alinH: "left", alinV: "center",
                 etiqueta: { texto: "Seguro", tamano: 11, color: "#d9e05f", colorTexto: "#23366F" },
                 titular: { texto: "2 cuotas gratis", tamano: 40, color: "#ffffff" },      // fuera de rango
                 cuerpo: { texto: "Aprovecha hasta el 14 de julio", tamano: 22, color: "#ffffff" } },
        cta: { bg: "hereda", texto: "Contrata aquí", url: "", colorFondo: "#e71313", colorTexto: "#ffffff", radio: 20, tamano: 18 }
      },
      burbuja: { visible: true, texto: "2 Cuotas Gratis", color: "#d9e05f", colorTexto: "#23366F", tamano: 96, pos: "tr" },
      deco: { visible: true, color1: "#72ccfd", color2: "#2167ae" }
    }
  },
  displaySuelto: {
    id: "v3", nombre: "Display suelto (sin colección)", formato: "display-300x250",
    canvas: [{ id: "b1", tipo: "texto", datos: { texto: "Banner viejo por bloques", tamano: "16" } }],
    tema: { font: "Arial", primary: "#2167AE", text: "#23366F", bg: "#ffffff" }
  },
  emailViejo: {
    id: "v4", nombre: "Email de antes", formato: "email",
    canvas: [{ id: "e1", tipo: "hero", datos: { titulo: "Bienvenido", sub: "Gracias por sumarte", url: "/foto.svg" } },
             { id: "e2", tipo: "cta", datos: { texto: "Ver más", url: "https://ejemplo.cl" } }],
    tema: { font: "Arial", primary: "#2167AE", text: "#23366F", bg: "#ffffff" }
  }
};

(async () => {
  const b = await chromium.launch({ executablePath: process.env.SBB_CHROMIUM || undefined });
  const pg = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = [];
  pg.on("pageerror", e => errs.push(e.message));
  pg.on("console", m => { if (m.type() === "error" && !/ERR_CERT|ERR_CONN|favicon/.test(m.text())) errs.push("consola: " + m.text().slice(0, 120)); });
  await pg.goto((process.env.SBB_URL || "http://127.0.0.1:8099")+"/editor.html", { waitUntil: "load" });
  await pg.waitForFunction(() => typeof window.activarPieza === "function");

  for (const [clave, pieza] of Object.entries(VIEJAS)) {
    console.log("\n" + clave);
    const r = await pg.evaluate(async ({ pieza }) => {
      const pr = { id: "pr" + pieza.id, nombre: "Guardado antiguo", creado: Date.now(), piezas: [JSON.parse(JSON.stringify(pieza))], activa: pieza.id };
      workspace.proyectos = [pr]; proyectoVistoId = pr.id; proyecto = pr;
      const out = {};
      try { activarPieza(pieza.id); } catch (e) { out.errAbrir = e.message; return out; }
      await new Promise(r => setTimeout(r, 400));
      const p = pieza_ = window.pieza();
      out.abre = !!p;
      out.textoIntacto = JSON.stringify(p).indexOf("Cotiza ahora") >= 0 || JSON.stringify(p).indexOf("cuotas gratis") >= 0
                      || JSON.stringify(p).indexOf("Banner viejo") >= 0 || JSON.stringify(p).indexOf("Bienvenido") >= 0;
      out.dibuja = document.querySelectorAll("#canvas .cmp, #canvas .bw, #canvas .ab").length;
      try { out.html = (generarHTMLDePieza(p) || "").length; } catch (e) { out.errHtml = e.message; }
      // Si es colección, que el inspector la mida y que NADA quede sin título/CTA
      if (typeof esComposicion === "function" && esComposicion(p)) {
        const insp = p._inspeccion || {};
        out.inspeccionados = Object.keys(insp).length;
        out.conFallos = Object.keys(insp).filter(f => !insp[f].ok);
        out.fallos = out.conFallos.map(f => f + ":" + insp[f].fallos.map(x => x.id).join("/"));
        // valores acotados
        const P = planDeBanner(composicionEfectiva(p, p.masterFmt), p.masterFmt, 0);
        out.cuerpoTitulo = P.cuerpo.titulo;
        out.logoAlto = P.logoAlto;
        out.dia = P.dia;
      }
      return out;
    }, { pieza });
    await pg.waitForTimeout(700);
    const r2 = await pg.evaluate(() => {
      const p = window.pieza(); const insp = (p && p._inspeccion) || {};
      return { n: Object.keys(insp).length, malos: Object.keys(insp).filter(f => !insp[f].ok).map(f => f + ":" + insp[f].fallos.map(x => x.id).join("/")) };
    });

    T(!r.errAbrir && r.abre, "la pieza guardada abre", r.errAbrir);
    T(r.textoIntacto, "conserva su texto");
    T(r.dibuja > 0, "se dibuja en el lienzo", "elementos=" + r.dibuja);
    T(!r.errHtml && r.html > 200, "exporta HTML", r.errHtml || ("bytes=" + r.html));
    if (r.inspeccionados !== undefined) {
      console.log(`       geometría acotada: título ${r.cuerpoTitulo}px · logo ${r.logoAlto}px · ⌀ ${r.dia}px`);
      T(r.cuerpoTitulo <= 28, "el titular fuera de rango se acota", r.cuerpoTitulo + "px");
      T(r.logoAlto <= 40, "el logo gigante se acota", r.logoAlto + "px");
      T(r2.malos.length === 0, "el inspector no encuentra fallos", r2.malos.join(" · "));
    }
  }

  console.log("\n" + (mal || errs.length ? "FALLA" : "TODO OK") + ` — ${ok} ok · ${mal} mal`);
  if (errs.length) [...new Set(errs)].forEach(e => console.log("  err " + e));
  await b.close();
  process.exit(mal || errs.length ? 1 : 0);
})();
