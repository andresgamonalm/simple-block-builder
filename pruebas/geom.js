// Autotest de la geometría cerrada: la tabla calculada tiene que dar los
// valores del spec, formato a formato.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ executablePath: process.env.SBB_CHROMIUM || undefined });
  const pg = await b.newPage();
  const errs = [];
  pg.on("pageerror", e => errs.push(e.message));
  await pg.goto((process.env.SBB_URL || "http://127.0.0.1:8099") + "/editor.html", { waitUntil: "load" });
  await pg.waitForFunction(() => typeof window.geomAutotest === "function", { timeout: 15000 });
  const fallos = await pg.evaluate(() => geomAutotest());
  const tabla = await pg.evaluate(() => ["display-300x250","display-336x280","display-250x250","display-200x200",
    "display-300x600","display-160x600","display-728x90","display-970x90","display-468x60",
    "display-1200x628","display-1200x1200"].map(f => { const g = geomDe(f);
      return [f.replace("display-",""), g.familia, Math.round(g.k*100)/100, g.margen, g.anchoUtil,
        g.cuerpo.titulo, g.cuerpo.bajada, g.cuerpo.cta, g.cuerpo.epigrafe, g.cuerpo.legal,
        g.circulo, g.piso, JSON.stringify(g.maxChars), g.noVan.join("+")].join(" | "); }));
  console.log("FORMATO | FAM | k | MARG | ÚTIL | TÍT | BAJ | CTA | EPÍ | LEG | ⌀ | PISO | MAXCHARS | NO VAN");
  tabla.forEach(t => console.log(t));
  console.log("\n" + (fallos.length ? "AUTOTEST FALLA:\n  " + fallos.join("\n  ") : "AUTOTEST GEOM: 11/11 OK — la tabla calza con el spec"));
  if (errs.length) console.log("PAGEERRORS:\n  " + errs.join("\n  "));
  await b.close();
  process.exit(fallos.length || errs.length ? 1 : 0);
})();
