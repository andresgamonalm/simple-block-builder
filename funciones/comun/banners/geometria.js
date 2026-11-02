/* ══════════════════════════════════════════════════════════════════
   BANNERS · GEOMETRÍA  ·  funciones/comun/banners/geometria.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: La k de cada familia de tamaño (cuadrados, verticales, franjas, Facebook), cuerpos de letra y piso de legibilidad (manual Flash Campaign).
   QUIÉN LO USA: MOTOR COMPARTIDO.
   SECCIONES (en orden):
     1. GEOMETRÍA CERRADA DE BANNERS
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// ═══ GEOMETRÍA CERRADA DE BANNERS ════════════════════════════════════════
// Manual de Diagramación · Flash Campaign. Un banner NO se diseña once veces:
// se diseña una vez en el máster (300×250 en Display, 1080×1350 en Facebook) y
// se deriva con un factor k propio de cada FAMILIA. Ningún número de aquí se
// elige a mano: todos salen de estas fórmulas, y por eso la pieza es
// comprobable. La IA aporta texto, foto y diagramación; la geometría no se toca.
//
// Verificado formato a formato contra mockups/flash-campaign-spec.json
// (autotest en geomAutotest(), se corre en la verificación con Playwright).
const GEOM = {
  // Medidas base = las del máster (k = 1).
  base: {
    display:  { epigrafe:11, titulo:26, bajada:13, cta:13, legal:9 },
    facebook: { epigrafe:40, titulo:94, bajada:47, cta:47, legal:32 }
  },
  // Hasta dónde puede moverlo el usuario sin salirse del sistema. Los rangos
  // existen para que ninguna decisión del usuario rompa la pieza.
  rango: {
    display:  { epigrafe:[10,12], titulo:[24,28], bajada:[12,14], cta:[12,14], legal:[8,10] },
    facebook: { epigrafe:[36,44], titulo:[85,103], bajada:[42,52], cta:[42,52], legal:[29,35] }
  },
  margenPct:5.5, margenMin:8, logoPct:8, logoMin:14,
  // Las líneas NO son globales: en una franja de 90 px de alto no cabe un
  // titular de tres líneas, y permitirlo daba límites absurdos (261 caracteres
  // en 970×90).
  // El legal va SIEMPRE en una línea (decisión del usuario, 17-ago): en vez de
  // un párrafo legal que compite con el mensaje, cada banner reserva una banda
  // inferior de una línea. Por eso legal:1 en las cuatro familias, aunque la
  // tabla original del manual permitía dos en cuadrados y verticales.
  lineas: {
    cuadrado:{ epigrafe:1, titulo:3, bajada:3, cta:1, legal:1 },
    vertical:{ epigrafe:1, titulo:3, bajada:3, cta:1, legal:1 },
    grande:  { epigrafe:1, titulo:2, bajada:2, cta:1, legal:1 },
    franja:  { epigrafe:1, titulo:1, bajada:1, cta:1, legal:1 }
  },
  circuloPct:62, salePct:8, huecoPct:4, segundoPct:62, cifraPctDia:45,
  // ⌀ del círculo en el MÁSTER = 62 % de 250 = 155 px. El manual lo define como
  // "62 % del lado corto" en todos los formatos, pero eso lo hace crecer más
  // rápido que la tipografía: en un 1200×1200 daba 744 px de círculo y dejaba
  // una columna de texto con sitio para DOCE caracteres de titular. Aquí el
  // círculo escala con la MISMA k que todo lo demás (155 × k) y el 62 % queda
  // como techo. En el máster y en 336×280 el número es idéntico al del manual.
  circuloBase:155,
  // ⌀ del círculo en el máster de Facebook: 62 % de 1080 sería enorme, así que se
  // usa la misma proporción que en Display respecto del máster (155/250 del lado
  // corto = 62 %), pero escalada con la k de Facebook.
  circuloBaseFb:670,
  emArial:0.52,                 // ancho medio de carácter en Arial
  topeChars:{ epigrafe:18, cta:24, cifra:6 },
  // El aire también es una medida fija: si se deja libre, unos formatos salen
  // apretados y otros desparramados.
  espaciado:{ epiTit:6, titBaj:10, bajCta:16, ctaLegal:10, logoTexto:18, textoCirculoPct:4 },
  // Si no cabe se reduce hasta el piso; si aun así no cabe, se QUITA en este
  // orden. Título, CTA y logo nunca se caen.
  // El legal va ÚLTIMO (no primero como en el manual original): con banda
  // reservada de una línea cuesta muy poco alto, y la campaña lo exige. El
  // propio manual contempla esta excepción: "salvo que la campaña lo exija por
  // ley, y entonces cae la bajada antes".
  caida:["bajada","adornos","epigrafe","legal"],
  nuncaCaen:["titulo","cta","logo"],
  decoPct:[28,16,9], decoCantidad:3,
  velo:[35,60]                  // sobre foto el velo es obligatorio
};
// Familia del formato SEGÚN EL MANUAL (cuatro, no tres): la familia decide la
// fórmula de k, las líneas permitidas y qué diagramaciones caben.
function familiaGeom(fmt){
  const F = FORMATOS[fmt]; if(!F) return "cuadrado";
  const w=F.ancho, h=F.alto, r=w/h;
  if(r>=2.2) return "franja";
  if(r<=0.6) return "vertical";
  if(Math.min(w,h)>=600 && w>=1000) return "grande";   // 1200×628 · 1200×1200
  return "cuadrado";
}
// k por familia. Verticales y franjas NO se escalan por el lado corto: se
// romperían igual que se rompían antes (un 1200×628 daba titulares de 104 px
// dentro de 628 px de alto porque la escala salía solo del ancho).
function factorK(fmt){
  const F = FORMATOS[fmt]; if(!F) return 1;
  const w=F.ancho, h=F.alto;
  if(esFacebookFmt(fmt)) return Math.min(w/1080, h/1350);
  const fam = familiaGeom(fmt);
  if(fam==="franja")   return Math.max(0.55, h/110);
  if(fam==="vertical") return Math.max(0.62, w/300);
  return Math.max(0.70, Math.min(w/300, h/250));
}
const _geomCache = {};
// Tabla cerrada de un formato: k, márgenes, cuerpos, ancho útil, círculo,
// máximo de caracteres y qué elementos no caben en ese tamaño.
function geomDe(fmt){
  if(_geomCache[fmt]) return _geomCache[fmt];
  const F = FORMATOS[fmt] || FORMATOS["display-300x250"];
  const w=F.ancho, h=F.alto, S=Math.min(w,h);
  const fam = familiaGeom(fmt), k = factorK(fmt);
  const set = esFacebookFmt(fmt) ? "facebook" : "display";
  const B = GEOM.base[set], L = GEOM.lineas[fam];
  // Piso de legibilidad: por debajo de esto no se encoge — o sube al piso, o el
  // elemento se cae. Es el mismo umbral que aplica el inspector.
  const piso = S<=250 ? 9 : 11;
  // Margen: en Display es el 5,5 % del lado corto REAL de cada formato (así lo
  // fija su tabla: 14 px en 300×250, 66 px en 1200×1200). En Facebook la tabla lo
  // deriva del máster con la k (59 px en 1080×1350, 47 en el cuadrado), porque
  // los tres tamaños son de la misma familia visual y el salto de lado corto
  // engañaría. Dos familias, dos reglas — las dos del manual.
  const margen = esFacebookFmt(fmt)
    ? Math.max(GEOM.margenMin, Math.round(Math.round(1080*GEOM.margenPct/100)*k))
    : Math.max(GEOM.margenMin, Math.round(S*GEOM.margenPct/100));
  const logoAlto = Math.max(GEOM.logoMin, Math.round(S*GEOM.logoPct/100));
  // El círculo solo existe donde la diagramación lo admite.
  // En Facebook la diagramación preferida es la A (foto + círculo), así que el
  // círculo entra también en el 4:5 vertical, no solo en el cuadrado.
  const admiteCirculo = (fam==="cuadrado") || (fam==="grande" && w===h)
                     || (esFacebookFmt(fmt) && h/w <= 1.3);
  const circulo = admiteCirculo ? Math.round(S*GEOM.circuloPct/100) : 0;   // el del manual (tabla/spec)
  // El que se dibuja: escalado con k y con el 62 % como techo.
  const base = esFacebookFmt(fmt) ? GEOM.circuloBaseFb : GEOM.circuloBase;
  const circuloK = admiteCirculo ? Math.min(Math.round(base*k), circulo) : 0;
  const sale = Math.round(S*GEOM.salePct/100), hueco = Math.round(S*GEOM.huecoPct/100);
  // El círculo se mete en el lienzo su diámetro MENOS lo que sale por el borde:
  // el bloque de texto DESCUENTA eso de su ancho o el círculo le tapa el título.
  const invade = circulo ? (circulo - sale + hueco) : 0;
  const anchoUtil = Math.max(40, w - margen*2 - invade);
  const cuerpo = {}, maxChars = {};
  for(const p in B) cuerpo[p] = Math.max(piso, Math.round(B[p]*k));
  // No se eligen: se calculan. Caben ancho ÷ (cuerpo × 0,52) por línea.
  const chars = (fs, li) => Math.max(4, Math.floor(anchoUtil/(fs*GEOM.emArial))*li);
  // Un elemento que solo cabe forzándolo al piso en un formato mínimo, se cae.
  const noVan = [];
  if(fam==="franja" && S<=60) noVan.push("bajada","epigrafe","legal");
  if(fam==="vertical" && w<=160) noVan.push("legal");
  if(fam==="franja" || S<=250) noVan.push("adornos");
  for(const p in B){
    let n = chars(cuerpo[p], L[p]);
    if(GEOM.topeChars[p]) n = Math.min(GEOM.topeChars[p], n);
    maxChars[p] = noVan.includes(p) ? 0 : n;
  }
  if(circulo) maxChars.cifra = GEOM.topeChars.cifra;
  const g = { fmt, ancho:w, alto:h, corto:S, familia:fam, k, piso, margen, logoAlto,
    circulo, circuloK, sale, hueco, invade, anchoUtil, cuerpo, maxChars, noVan,
    master: fmt===(esFacebookFmt(fmt)?"fb-1080x1350":"display-300x250") };
  _geomCache[fmt] = g;
  return g;
}
// Cuerpo efectivo de una parte: el usuario mueve la BASE dentro de su rango y
// el formato la escala con su k. Nunca por debajo del piso de legibilidad.
function cuerpoDe(fmt, parte, valUsuario){
  const g = geomDe(fmt), set = esFacebookFmt(fmt) ? "facebook" : "display";
  const rg = (GEOM.rango[set]||{})[parte];
  if(!rg) return g.cuerpo[parte] || g.piso;
  const v = parseFloat(valUsuario);
  const b = (v && isFinite(v)) ? Math.max(rg[0], Math.min(rg[1], v)) : GEOM.base[set][parte];
  return Math.max(g.piso, Math.round(b * g.k));
}
// Espaciado entre elementos, escalado con k y nunca por debajo de 2 px.
function aireDe(fmt, cual){ return Math.max(2, Math.round((GEOM.espaciado[cual]||0) * geomDe(fmt).k)); }
// ¿Hay una CIFRA real? El círculo de oferta solo existe si la hay: un círculo
// vacío o con una frase sin número es el error gráfico más visible del sistema.
function tieneCifra(t){ return /\d/.test(String(t||"")); }
// Autotest: la tabla calculada tiene que dar los valores del spec. Si una
// fórmula se toca y desincroniza los números, esto lo grita.
function geomAutotest(){
  const esperado = {
    "display-300x250":  {k:1,    margen:14, anchoUtil:127, titulo:26,  circulo:155, cTitulo:27},
    "display-336x280":  {k:1.12, margen:15, anchoUtil:143, titulo:29,  circulo:174, cTitulo:27},
    "display-250x250":  {k:0.83, margen:14, anchoUtil:77,  titulo:22,  circulo:155, cTitulo:18},
    "display-200x200":  {k:0.7,  margen:11, anchoUtil:62,  titulo:18,  circulo:124, cTitulo:18},
    "display-300x600":  {k:1,    margen:17, anchoUtil:266, titulo:26,  circulo:0,   cTitulo:57},
    "display-160x600":  {k:0.62, margen:9,  anchoUtil:142, titulo:16,  circulo:0,   cTitulo:51},
    "display-728x90":   {k:0.82, margen:8,  anchoUtil:712, titulo:21,  circulo:0,   cTitulo:65},
    "display-970x90":   {k:0.82, margen:8,  anchoUtil:954, titulo:21,  circulo:0,   cTitulo:87},
    "display-468x60":   {k:0.55, margen:8,  anchoUtil:452, titulo:14,  circulo:0,   cTitulo:62},
    "display-1200x628": {k:2.51, margen:35, anchoUtil:1130,titulo:65,  circulo:0,   cTitulo:66},
    "display-1200x1200":{k:4,    margen:66, anchoUtil:372, titulo:104, circulo:744, cTitulo:12}
  };
  const fallos = [];
  for(const fmt in esperado){
    const g = geomDe(fmt), e = esperado[fmt];
    const chk = (n, real, esp) => { if(Math.abs(real-esp) > (n==="k"?0.01:0)) fallos.push(`${fmt}.${n}=${real} esperado ${esp}`); };
    chk("k", Math.round(g.k*100)/100, e.k);
    chk("margen", g.margen, e.margen);
    chk("anchoUtil", g.anchoUtil, e.anchoUtil);
    chk("titulo", g.cuerpo.titulo, e.titulo);
    chk("circulo", g.circulo, e.circulo);
    chk("cTitulo", g.maxChars.titulo, e.cTitulo);
  }
  return fallos;
}
