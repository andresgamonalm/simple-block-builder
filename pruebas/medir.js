// MEDIR los 11 formatos de Display sobre el render REAL.
// Las 6 comprobaciones del manual: desborde · colisión · legibilidad ·
// contraste · completa · aire. No comprueba "que no reviente": mide.
const { chromium } = require("playwright");

const FMTS = ["display-300x250","display-336x280","display-250x250","display-200x200",
  "display-300x600","display-160x600","display-728x90","display-970x90","display-468x60",
  "display-1200x628","display-1200x1200"];

// Contenido REAL de campaña (largos de verdad, no "Lorem").
const CORTO = process.argv.includes("--corto");
const CONTENIDO = CORTO ? {
  etiqueta: "Seguro",
  titular: "Auto protegido",          // 14 · cabe en el máster (27)
  cuerpo: "Cobertura desde el día uno",  // 26 · cabe en el máster (54)
  cta: "Cotiza aquí",
  burbuja: "2 Cuotas Gratis",
  legal: "Bases legales en www.ejemplo.cl"
} : {
  etiqueta: "Seguro",
  titular: "Tu auto protegido por menos",
  cuerpo: "Cotiza en línea y elige el plan que te acomoda, con cobertura desde el primer día",
  cta: "Cotiza aquí",
  burbuja: "2 Cuotas Gratis",
  legal: "Bases legales y condiciones en www.ejemplo.cl"
};

(async () => {
  const url = process.env.SBB_URL || "http://127.0.0.1:8099";
  const conFoto = process.argv.includes("--foto");
  const b = await chromium.launch({ executablePath: process.env.SBB_CHROMIUM || undefined });
  const pg = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errores = [];
  pg.on("pageerror", e => errores.push("pageerror: " + e.message));
  pg.on("console", m => { if (m.type() === "error" && !/ERR_CERT|favicon/.test(m.text())) errores.push("console: " + m.text()); });

  await pg.goto(url + "/editor.html", { waitUntil: "load" });
  await pg.waitForFunction(() => typeof window.crearComposicion === "function", { timeout: 15000 });

  // Crea la colección display-desktop sin pasar por el diálogo de nombre.
  await pg.evaluate((C) => {
    workspace.proyectos = workspace.proyectos || [];
    const pr = { id: uid(), nombre: "Medición", creado: Date.now(), piezas: [], activa: null };
    workspace.proyectos.push(pr);
    proyectoVistoId = pr.id; proyecto = pr;
    crearComposicion("display-desktop");
    // Modelo de 3 ZONAS: es el de las piezas ya guardadas, y esta prueba lo
    // protege. Los banners NUEVOS nacen en el lienzo libre.
    pieza().composicion = composicionDefault(pieza().tema);
    const p = pieza();
    p.nombre = "Medición";
    setComp("zonas.texto.etiqueta.texto", C.etiqueta);
    setComp("zonas.texto.titular.texto", C.titular);
    setComp("zonas.texto.cuerpo.texto", C.cuerpo);
    setComp("zonas.cta.texto", C.cta);
    setComp("zonas.logo.url", "/logo.svg");
    setComp("burbuja.texto", C.burbuja);
    setComp("burbuja.visible", true);
    setComp("deco.visible", true);
    setComp("fondo.color", "#23366F");
    setComp("legal", C.legal);
  }, CONTENIDO);

  if (conFoto) await pg.evaluate(() => {
    setComp("fondo.tipo", "imagen"); setComp("fondo.imagen.url", "/foto.svg");
  });

  // Renderiza cada formato a tamaño REAL en un contenedor aparte y lo mide.
  const res = await pg.evaluate(async (FMTS) => {
    const salida = [];
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:0;top:0;z-index:99999;opacity:0;pointer-events:none;";
    document.body.appendChild(host);

    const rgba = (c) => {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c || "");
      if (!m) return null;
      return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : parseFloat(m[4]) };
    };
    const lumDe = (c) => { const f = (v) => { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    // Fondo REAL detrás de un elemento: acumula las capas translúcidas de los
    // padres (una píldora blanca al 18% sobre navy NO es blanco) hasta llegar a
    // una opaca. Si hay foto por medio se anota: ahí el contraste depende del velo.
    const fondoReal = (el, raiz) => {
      const capas = []; let n = el, foto = false;
      while (n && n !== raiz.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.backgroundImage && cs.backgroundImage !== "none") foto = true;
        const c = rgba(cs.backgroundColor);
        if (c && c.a > 0.001) { capas.push(c); if (c.a >= 0.999) break; }
        n = n.parentElement;
      }
      if (!capas.length) return { col: null, foto };
      // Composita de atrás hacia adelante.
      let out = capas[capas.length - 1];
      for (let i = capas.length - 2; i >= 0; i--) { const f = capas[i];
        out = { r: f.r * f.a + out.r * (1 - f.a), g: f.g * f.a + out.g * (1 - f.a),
                b: f.b * f.a + out.b * (1 - f.a), a: 1 }; }
      return { col: out, foto };
    };
    const contraste = (L1, L2) => (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);

    for (const fmt of FMTS) {
      const F = FORMATOS[fmt];
      const ef = composicionEfectiva(pieza(), fmt);
      host.innerHTML = `<div class="canvas-frame" style="width:${F.ancho}px">${renderComposicion(ef, fmt)}</div>`;
      const cmp = host.querySelector(".cmp");
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const marco = cmp.getBoundingClientRect();
      const S = Math.min(F.ancho, F.alto);
      const piso = S <= 250 ? 9 : 11;

      // Cajas de texto reales (con contenido) + logo + cta + círculo.
      const sels = { tit: ".cmp-tit", cue: ".cmp-cue", etq: ".cmp-etq", cta: ".cmp-cta", logo: ".cmp-logo", bub: ".cmp-burbuja", legal: ".cmp-legal" };
      const el = {}; for (const k in sels) el[k] = cmp.querySelector(sels[k]);
      const caja = (e) => { if (!e) return null; const r = e.getBoundingClientRect();
        return { x: r.left - marco.left, y: r.top - marco.top, w: r.width, h: r.height, r: r.right - marco.left, b: r.bottom - marco.top }; };
      const C = {}; for (const k in el) C[k] = caja(el[k]);

      const f = { fmt, w: F.ancho, h: F.alto, fallos: [], cuerpos: {}, presentes: {} };
      for (const k in el) f.presentes[k] = !!el[k];

      // 1 · DESBORDE — ningún elemento fuera del marco (1px de tolerancia por redondeo).
      const T = 1.0;
      for (const k in C) { const c = C[k]; if (!c || !c.w) continue;
        if (k === "bub" || k === "deco") continue;   // el círculo sale por el borde a propósito
        if (c.x < -T || c.y < -T || c.r > F.ancho + T || c.b > F.alto + T)
          f.fallos.push(`desborde:${k}(${Math.round(c.x)},${Math.round(c.y)} ${Math.round(c.w)}x${Math.round(c.h)})`);
      }
      // Desborde de TEXTO dentro de su propia caja (scrollHeight > clientHeight):
      // es el "texto cortado a la mitad".
      ["tit","cue","cta","etq"].forEach(k => { const e = el[k]; if (!e) return;
        if (e.scrollHeight > e.clientHeight + 1) f.fallos.push(`cortado:${k}(${e.scrollHeight}>${e.clientHeight})`);
        if (e.scrollWidth > e.clientWidth + 1) f.fallos.push(`cortadoH:${k}(${e.scrollWidth}>${e.clientWidth})`);
      });

      // 2 · COLISIÓN — ningún texto montado sobre otro ni sobre el círculo.
      const solapa = (a, b) => a && b && a.w && b.w &&
        a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1;
      const pares = [["tit","cue"],["tit","cta"],["cue","cta"],["etq","tit"],["logo","tit"],
                     ["tit","bub"],["cue","bub"],["cta","bub"],["logo","bub"],["etq","bub"]];
      pares.forEach(([a, c]) => { if (solapa(C[a], C[c])) f.fallos.push(`colision:${a}~${c}`); });

      // 3 · LEGIBILIDAD — nada bajo el piso del formato.
      ["tit","cue","cta","etq","legal"].forEach(k => { const e = el[k]; if (!e) return;
        const fs = parseFloat(getComputedStyle(e).fontSize);
        f.cuerpos[k] = Math.round(fs * 10) / 10;
        if (fs < piso - 0.5) f.fallos.push(`ilegible:${k}(${Math.round(fs)}px<${piso})`);
      });

      // 4 · CONTRASTE — texto contra su fondo real ≥ 4,5:1.
      ["tit","cue","cta","etq"].forEach(k => { const e = el[k]; if (!e) return;
        const ct = rgba(getComputedStyle(e).color); const fb = fondoReal(e, cmp);
        if (!ct || !fb.col) return;
        const r = contraste(lumDe(ct), lumDe(fb.col));
        f["contraste_" + k] = Math.round(r * 10) / 10;
        if (r < 4.5 && !fb.foto) f.fallos.push(`contraste:${k}(${r.toFixed(1)}:1)`);
        if (r < 4.5 && fb.foto) f.fallos.push(`contraste-foto:${k}(${r.toFixed(1)}:1)`);
      });

      // 5 · COMPLETA — título, CTA y logo presentes.
      if (!el.tit || !C.tit.w) f.fallos.push("falta:titulo");
      if (!el.cta || !C.cta.w) f.fallos.push("falta:cta");
      if (!el.logo || !C.logo.w) f.fallos.push("falta:logo");
      if (!el.cue || !C.cue.w) f.fallos.push("sin-bajada");   // aviso, no fallo duro

      // 6 · AIRE — ninguna zona muerta > 30% DEL ALTO (así lo dice el manual).
      // Bandas horizontales de 2px: banda muerta = sin ningún elemento de
      // contenido. La racha continua mayor es la zona muerta.
      const cont = ["tit","cue","etq","cta","logo","bub","legal"].map(k => C[k]).filter(c => c && c.w);
      let racha = 0, peor = 0;
      for (let y = 0; y < F.alto; y += 2) {
        const hay = cont.some(c => c.y - 2 <= y && y <= c.b + 2);
        if (hay) racha = 0; else { racha += 2; if (racha > peor) peor = racha; }
      }
      f.muerta = Math.round(peor / F.alto * 100);
      if (f.muerta > 30) f.fallos.push(`aire:${f.muerta}%`);

      salida.push(f);
    }
    host.remove();
    return salida;
  }, FMTS);

  await b.close();

  // Informe
  const pad = (s, n) => String(s).padEnd(n);
  console.log("\n" + pad("FORMATO", 16) + pad("TÍT", 6) + pad("BAJ", 6) + pad("CTA", 6) + pad("EPÍ", 6) + pad("MUERTA", 8) + "FALLOS");
  console.log("-".repeat(110));
  // "sin-bajada" es un AVISO, no un fallo: significa que la escalera de caída
  // quitó la bajada porque el copy no cabía en ese tamaño, que es lo que el
  // manual manda hacer. Se cuentan aparte para que el informe no alarme.
  let conAviso = 0, conFallo = 0, totalFallos = 0;
  for (const f of res) {
    const c = f.cuerpos;
    const duros = f.fallos.filter(x => !/^sin-bajada$/.test(x));
    if (duros.length) conFallo++; else if (f.fallos.length) conAviso++;
    totalFallos += duros.length;
    console.log(pad(f.fmt.replace("display-", ""), 16) + pad(c.tit ?? "—", 6) + pad(c.cue ?? "—", 6) +
      pad(c.cta ?? "—", 6) + pad(c.etq ?? "—", 6) + pad(f.muerta + "%", 8) +
      (f.fallos.length ? f.fallos.join(" · ") : "OK"));
  }
  console.log("-".repeat(110));
  console.log(`FALLOS: ${conFallo}/${res.length} formatos (${totalFallos} en total)` +
    ` · avisos (bajada omitida porque el copy no cabe): ${conAviso}/${res.length}`);
  if (errores.length) { console.log("\nERRORES DE PÁGINA:"); errores.forEach(e => console.log("  " + e)); }
  require("fs").writeFileSync(process.argv[3] || "/tmp/medicion.json", JSON.stringify(res, null, 1));
  process.exit(0);
})();
