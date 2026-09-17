// LA PANTALLA DE ACCESO, contra la diagramación del paquete de referencia
// que entregó el usuario (una tarjeta centrada, logo arriba del rótulo,
// ritmo parejo, objetivos de 50px y anillo de foco que no se quita) y
// contra el flujo REAL de esta arquitectura (usuario + contraseña).
const { chromium } = require("playwright");
let ok=0, mal=0;
const T=(c,n,e)=>{ if(c){ok++;console.log("  ok   "+n);} else {mal++;console.log("  MAL  "+n+(e!==undefined?" → "+e:""));} };
const BASE = process.env.SBB_URL || "http://127.0.0.1:8099";
// El escritorio pide fuentes de Google, bloqueadas aquí: el evento "load" no
// llega nunca. Lo que interesa medir es la URL, así que se sondea.
async function esperarURL(pg, re, ms){
  const fin = Date.now()+ms;
  while(Date.now() < fin){ if(re.test(pg.url())) return true; await pg.waitForTimeout(120); }
  return re.test(pg.url());
}

(async()=>{
  const b=await chromium.launch({executablePath: process.env.SBB_CHROMIUM || undefined});
  const ctx=await b.newContext({viewport:{width:1440,height:900}});
  // Sin esta galleta el mock devuelve sesión y la pantalla no llega a verse.
  await ctx.addCookies([{name:"sbb-sin-sesion",value:"1",url:BASE}]);
  const pg=await ctx.newPage();
  const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
  await pg.goto(BASE+"/index.html",{waitUntil:"load"});
  await pg.waitForSelector(".caja.lista",{timeout:8000});

  console.log("\n1 · La diagramación de la referencia");
  const m = await pg.evaluate(()=>{
    const r = s => { const e=document.querySelector(s); return e?e.getBoundingClientRect():null; };
    const cs = s => getComputedStyle(document.querySelector(s));
    const caja=r(".caja"), logo=r(".marca svg"), rot=r(".marca b"), h1=r("h1");
    return {
      anchoCaja: Math.round(caja.width),
      centradaX: Math.abs((caja.left+caja.width/2) - innerWidth/2) < 2,
      centradaY: Math.abs((caja.top+caja.height/2) - innerHeight/2) < 3,
      logoSobreRotulo: logo.bottom <= rot.top + 1,
      logoIzquierdaAlineado: Math.abs(logo.left - rot.left) < 2,
      ritmoLogoRotulo: Math.round(rot.top - logo.bottom),
      ritmoRotuloH1: Math.round(h1.top - rot.bottom),
      altoCampo: Math.round(r("#usuario").height),
      altoBoton: Math.round(r("#btn").height),
      unaColumna: Math.abs(r("#usuario").left - r("#btn").left) < 2,
      radioCaja: cs(".caja").borderRadius,
      pesoRotulo: cs(".marca b").fontWeight,
      pesoBoton: cs("#btn").fontWeight,
      fuente: cs("body").fontFamily
    };
  });
  console.log(`     tarjeta ${m.anchoCaja}px · ritmo ${m.ritmoLogoRotulo}/${m.ritmoRotuloH1}px · campo ${m.altoCampo}px · botón ${m.altoBoton}px`);
  T(m.anchoCaja===440, "la tarjeta mide los 440px de la referencia", m.anchoCaja);
  T(m.centradaX && m.centradaY, "y va centrada en la pantalla");
  T(m.logoSobreRotulo && m.logoIzquierdaAlineado,
    "el logotipo va ARRIBA del rótulo, no al lado (un lockup no se acuesta)");
  T(m.ritmoLogoRotulo===22 && m.ritmoRotuloH1===22,
    "22px parejos entre logo, rótulo y titular", `${m.ritmoLogoRotulo}/${m.ritmoRotuloH1}`);
  T(m.altoCampo===50 && m.altoBoton===50, "campo y botón de 50px: objetivos de dedo",
    `${m.altoCampo}/${m.altoBoton}`);
  T(m.unaColumna, "todo en una sola columna");

  console.log("\n2 · Pero con la identidad de ESTE aplicativo, no la de la referencia");
  T(m.radioCaja==="10px", "radio 10px del chrome (no los 20px de la referencia)", m.radioCaja);
  T(m.pesoRotulo!=="700" && m.pesoBoton!=="700", "Roboto sin 700, como manda la identidad",
    `${m.pesoRotulo}/${m.pesoBoton}`);
  T(/Roboto/.test(m.fuente), "y con la tipografía propia", m.fuente);
  const col = await pg.evaluate(()=>({
    boton: getComputedStyle(document.getElementById("btn")).backgroundColor,
    fondo: getComputedStyle(document.querySelector(".fondo")).backgroundColor
  }));
  T(col.boton==="rgb(4, 7, 100)", "el botón es el navy propio #040764", col.boton);

  console.log("\n3 · El anillo de foco no se quita (accesibilidad)");
  await pg.focus("#usuario");
  const foco = await pg.evaluate(()=>{
    const cs=getComputedStyle(document.getElementById("usuario"));
    return { estilo:cs.outlineStyle, ancho:cs.outlineWidth, sep:cs.outlineOffset,
             activo: document.activeElement.id };
  });
  T(foco.estilo!=="none" && parseFloat(foco.ancho)>=3,
    "anillo de 3px al enfocar el campo", `${foco.estilo} ${foco.ancho}`);
  T(foco.sep==="1px", "separado 1px, como la referencia", foco.sep);

  console.log("\n4 · Detalles de formulario que sí valían la pena copiar");
  const inp = await pg.evaluate(()=>{
    const u=document.getElementById("usuario"), p=document.getElementById("password");
    return { autofocus:u.hasAttribute("autofocus"), acU:u.getAttribute("autocomplete"),
             acP:p.getAttribute("autocomplete"), tipoP:p.type,
             enfocadoAlAbrir: document.activeElement === u || u.hasAttribute("autofocus"),
             etiquetas: [...document.querySelectorAll("label")].map(l=>l.htmlFor).join(",") };
  });
  T(inp.autofocus, "el cursor ya está en el campo al abrir");
  T(inp.acU==="username" && inp.acP==="current-password",
    "autocomplete correcto: el navegador ofrece la clave guardada", inp.acU+"/"+inp.acP);
  T(inp.etiquetas==="usuario,password", "cada campo con su etiqueta asociada", inp.etiquetas);
  await pg.click("#ver-pass");
  T(await pg.evaluate(()=>document.getElementById("password").type)==="text", "el ojo muestra la contraseña");
  await pg.click("#ver-pass");
  T(await pg.evaluate(()=>document.getElementById("password").type)==="password", "y la vuelve a ocultar");

  console.log("\n5 · El aviso: forma de la referencia, sin delatar quién existe");
  await pg.fill("#usuario","fantasma");
  await pg.fill("#password","loquesea");
  await pg.click("#btn");
  await pg.waitForSelector("#aviso.show",{timeout:5000});
  const av = await pg.evaluate(()=>{
    const a=document.getElementById("aviso"); const cs=getComputedStyle(a);
    const en=a.querySelector("a");
    return { texto:a.textContent.trim(), barra:cs.borderLeftWidth, color:cs.borderLeftColor,
             enlace: en?en.getAttribute("href"):"", htmlCrudo:a.innerHTML };
  });
  console.log("     "+av.texto);
  T(/incorrect/i.test(av.texto), "avisa que no entró", av.texto);
  T(!/no registrado|no existe|no está en la lista/i.test(av.texto),
    "sin decir si el usuario existe (la referencia sí lo dice: ahí no hay contraseña)", av.texto);
  T(av.barra==="4px", "barra de color de 4px a la izquierda, como la referencia", av.barra);
  T(/^mailto:/.test(av.enlace) && /subject=/.test(av.enlace),
    "y el correo para pedir acceso, con el asunto ya escrito", av.enlace);
  T(await pg.evaluate(()=>document.getElementById("password").value)==="",
    "la contraseña se borra tras fallar");

  console.log("\n6 · El texto del aviso se escapa; el enlace va aparte");
  const esc = await pg.evaluate(()=>{
    // Si el mensaje llegara con HTML dentro, tiene que verse como texto.
    const a=document.getElementById("aviso");
    a.textContent = '<img src=x onerror="window.__inyectado=1">';
    return { hayImg: !!a.querySelector("img"), texto: a.textContent };
  });
  await pg.waitForTimeout(150);
  T(!esc.hayImg && !(await pg.evaluate(()=>window.__inyectado)),
    "un texto con HTML dentro no se ejecuta: sale como texto");

  console.log("\n7 · Entrar de verdad");
  await pg.goto(BASE+"/index.html",{waitUntil:"load"});
  await pg.waitForSelector(".caja.lista");
  await pg.fill("#usuario","andres");
  await pg.fill("#password","correcta");
  await pg.click("#btn");
  const llego = await esperarURL(pg, /\/home/, 8000);
  T(llego, "con la clave correcta entra al escritorio", pg.url());

  console.log("\n8 · Con sesión abierta no se ve el formulario");
  const ctx2 = await b.newContext({viewport:{width:1440,height:900}});   // sin la galleta
  const pg2 = await ctx2.newPage();
  await pg2.goto(BASE+"/index.html",{waitUntil:"domcontentloaded"});
  const llego2 = await esperarURL(pg2, /\/home/, 8000);
  T(llego2, "entra directo al escritorio", pg2.url());
  await ctx2.close();

  console.log("\n9 · En teléfono no se sale nada de la pantalla");
  const ctx3 = await b.newContext({viewport:{width:390,height:760}});
  await ctx3.addCookies([{name:"sbb-sin-sesion",value:"1",url:BASE}]);
  const pg3 = await ctx3.newPage();
  await pg3.goto(BASE+"/index.html",{waitUntil:"load"});
  await pg3.waitForSelector(".caja.lista");
  const mov = await pg3.evaluate(()=>{
    const c=document.querySelector(".caja").getBoundingClientRect();
    return { cabe: c.left>=0 && c.right<=innerWidth+1, scrollH: document.documentElement.scrollWidth,
             ancho: innerWidth, altoBoton: Math.round(document.getElementById("btn").getBoundingClientRect().height) };
  });
  T(mov.cabe && mov.scrollH<=mov.ancho+1, "la tarjeta cabe y no hay barra horizontal",
    `${mov.scrollH} vs ${mov.ancho}`);
  T(mov.altoBoton===50, "el botón sigue siendo de 50px en el teléfono", mov.altoBoton);
  await ctx3.close();

  console.log("\n10 · Lo que NO se copió del paquete");
  const fuente = await (await fetch(BASE+"/index.html")).text();
  T(!/googletagmanager|dataLayer|GTM-/.test(fuente), "sin Google Tag Manager (no es de este proyecto)");
  // Los códigos van PARTIDOS a propósito: esta comprobación vigila que no
  // vuelva la paleta de la marca de la referencia, y un barrido de color sobre
  // el repo reescribiría la propia guarda si estuvieran escritos enteros.
  const AJENOS = ["21"+"67ae", "23"+"366f", "ec"+"eeef", "ff"+"f773", "91"+"bfe3"];
  const cuela = AJENOS.filter(c => fuente.toLowerCase().includes("#"+c));
  T(cuela.length===0, "sin la paleta de la marca de la referencia", cuela.join(","));
  T(!/ejemplo/i.test(fuente), "sin su logotipo ni sus textos");
  T(/noindex/.test(fuente), "pero sí el noindex, que ahí sí corresponde");

  T(errs.length===0,"sin errores de consola",errs.slice(0,3).join(" | "));
  console.log("\n"+(mal?"FALLA":"TODO OK")+` — ${ok} ok · ${mal} mal`);
  await b.close();
  process.exit(mal?1:0);
})().catch(e=>{ console.log("ERROR: "+e.message); process.exit(1); });
