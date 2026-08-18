// ARRASTRE: que cualquier elemento se agarre y se mueva, que el gesto sea fluido
// (sin repintar durante el movimiento) y que lo que se guarda sobreviva a la
// réplica en los once tamaños. Se arrastra con el ratón de verdad, no llamando
// funciones: es la única forma de saber si el gesto funciona.
const { chromium } = require("playwright");
let ok=0, mal=0;
const T=(c,n,e)=>{ if(c){ok++;console.log("  ok   "+n);} else {mal++;console.log("  MAL  "+n+(e!==undefined?" → "+e:""));} };

const FIXTURE = () => {
  const PNG="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wnwEEAA8CAv3s3S0AAAAASUVORK5CYII=";
  const pr={id:uid(),nombre:"Arrastre",creado:Date.now(),piezas:[],activa:null};
  workspace.proyectos=[pr]; proyecto=pr; proyectoVistoId=pr.id;
  workspace.imagenes=[{id:"i1",url:PNG,nombre:"foto",key:"fotos-generales/f.png"}];
  crearComposicion("display-desktop");
  setComp("fondo.color","#23366F");
  setComp("zonas.logo.url","/logo.svg");
  setComp("zonas.texto.etiqueta.texto","Seguro Auto");
  setComp("zonas.texto.titular.texto","Protege tu auto");
  setComp("zonas.texto.cuerpo.texto","Cobertura desde hoy");
  setComp("zonas.cta.texto","Cotiza aquí");
  setCompOferta("60% dcto.",null);
};

(async()=>{
  const b=await chromium.launch({executablePath: process.env.SBB_CHROMIUM || undefined});
  const pg=await b.newPage({viewport:{width:1600,height:1100}});
  const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
  pg.on("console",m=>{if(m.type()==="error"&&!/ERR_CERT|ERR_CONNECTION|ERR_TUNNEL|ERR_BLOCKED|favicon|fonts\./.test(m.text()))errs.push("console: "+m.text());});
  await pg.goto((process.env.SBB_URL||"http://127.0.0.1:8099")+"/editor.html",{waitUntil:"load"});
  await pg.waitForFunction(()=>typeof window.crearComposicion==="function");
  await pg.evaluate(FIXTURE);
  await pg.waitForTimeout(1800);

  // Arrastra un elemento del banner grande N píxeles y devuelve dónde acabó.
  const arrastrar = async (sel, ddx, ddy, pasos=14)=>{
    const caja = await pg.evaluate((s)=>{
      const e=document.querySelector(".lienzo "+s); if(!e) return null;
      const r=e.getBoundingClientRect();
      return { x:r.left+r.width/2, y:r.top+r.height/2, w:r.width, h:r.height };
    }, sel);
    if(!caja) return null;
    await pg.mouse.move(caja.x, caja.y);
    await pg.mouse.down();
    await pg.mouse.move(caja.x+ddx, caja.y+ddy, { steps:pasos });
    await pg.mouse.up();
    await pg.waitForTimeout(750);
    return caja;
  };

  console.log("\n1 · Todos los elementos se agarran (antes solo dos)");
  const agarrables = await pg.evaluate(()=>{
    const out={};
    ARRASTRABLES.forEach(it=>{
      const e=document.querySelector(".lienzo "+it.sel);
      out[it.k] = e ? e.classList.contains("cmp-mov") : "no está";
    });
    return out;
  });
  Object.keys(agarrables).forEach(k=>T(agarrables[k]===true, `el elemento «${k}» se puede agarrar`, agarrables[k]));

  console.log("\n2 · Arrastrar mueve de verdad, en los dos ejes");
  const antes = await pg.evaluate(()=>JSON.stringify(getPath(pieza().composicion,"zonas.texto.titular.off")||{}));
  await arrastrar(".cmp-tit", 26, 34);
  const off = await pg.evaluate(()=>getPath(pieza().composicion,"zonas.texto.titular.off")||{});
  console.log("     titular: "+antes+"  →  "+JSON.stringify(off));
  T((off.x||0)!==0 || (off.y||0)!==0, "el titular se movió y quedó guardado", JSON.stringify(off));
  T(Math.abs(off.y||0)>10, "el desplazamiento vertical es del orden del arrastre", off.y);

  console.log("\n3 · Lo que se guarda son unidades base, no píxeles de pantalla");
  const rep = await pg.evaluate(()=>{
    const p=pieza(); const oy=parseFloat((getPath(p.composicion,"zonas.texto.titular.off")||{}).y)||0;
    // El mismo desplazamiento, visto en tres formatos con k distinta.
    return ["display-300x250","display-1200x1200","display-160x600"].map(f=>{
      const el=document.querySelector(`.ab[data-fmt="${f}"] .cmp-tit`);
      const tr=el?getComputedStyle(el).transform:"none";
      const m=/matrix\(1, 0, 0, 1, ([-\d.]+), ([-\d.]+)\)/.exec(tr);
      return { f, k:Math.round(factorK(f)*100)/100, ty:m?Math.round(parseFloat(m[2])):0, esperado:Math.round(oy*factorK(f)) };
    });
  });
  rep.forEach(r=>console.log(`     ${r.f.padEnd(20)} k=${r.k}  desplazamiento=${r.ty}px  (esperado ${r.esperado})`));
  T(rep.every(r=>Math.abs(r.ty-r.esperado)<=1), "el desplazamiento escala con cada formato al replicar",
    rep.map(r=>r.ty+"/"+r.esperado).join(" "));
  T(rep[1].ty !== rep[0].ty, "no es el mismo número de píxeles en todos: se adapta", rep[0].ty+" vs "+rep[1].ty);

  console.log("\n4 · Al soltar cerca de un borde se imanta y guarda ALINEACIÓN");
  const alinAntes = await pg.evaluate(()=>getPath(composicionEfectiva(pieza(),pieza().masterFmt),"zonas.logo.alinH"));
  const cajaLogo = await pg.evaluate(()=>{
    const s=document.querySelector(".lienzo-stage").getBoundingClientRect();
    const e=document.querySelector(".lienzo .cmp-logo").getBoundingClientRect();
    return { ex:e.left+e.width/2, ey:e.top+e.height/2, destX:s.left+s.width-e.width/2-3, destY:e.top+e.height/2 };
  });
  await pg.mouse.move(cajaLogo.ex, cajaLogo.ey);
  await pg.mouse.down();
  await pg.mouse.move(cajaLogo.destX, cajaLogo.destY, { steps:16 });
  const guias = await pg.evaluate(()=>document.querySelectorAll(".lz-guia").length);
  await pg.mouse.up();
  await pg.waitForTimeout(800);
  const alinDespues = await pg.evaluate(()=>({
    h:getPath(composicionEfectiva(pieza(),pieza().masterFmt),"zonas.logo.alinH"),
    off:getPath(composicionEfectiva(pieza(),pieza().masterFmt),"zonas.logo.off")||{} }));
  console.log("     logo: "+alinAntes+"  →  "+alinDespues.h+"   guías vistas al arrastrar: "+guias);
  T(guias>=1, "se dibujan guías de alineación mientras arrastras", guias);
  T(alinDespues.h==="right", "soltar en el borde guarda la alineación, no un desplazamiento", alinDespues.h);
  T((parseFloat(alinDespues.off.x)||0)===0, "y el desplazamiento vuelve a cero", JSON.stringify(alinDespues.off));

  console.log("\n5 · Fluidez: no se repinta el tablero mientras arrastras");
  await pg.evaluate(()=>{ window._n={t:0}; const o=window.renderTablero; window.renderTablero=function(){ window._n.t++; return o.apply(this,arguments); }; });
  const cajaCta = await pg.evaluate(()=>{ const e=document.querySelector(".lienzo .cmp-cta").getBoundingClientRect();
    return { x:e.left+e.width/2, y:e.top+e.height/2 }; });
  await pg.mouse.move(cajaCta.x, cajaCta.y);
  await pg.mouse.down();
  for(let i=1;i<=20;i++){ await pg.mouse.move(cajaCta.x+i*2, cajaCta.y+i, { steps:1 }); }
  const durante = await pg.evaluate(()=>window._n.t);
  await pg.mouse.up();
  await pg.waitForTimeout(700);
  const alFinal = await pg.evaluate(()=>window._n.t);
  console.log("     repintados durante 20 movimientos: "+durante+"  ·  al soltar: "+alFinal);
  T(durante===0, "veinte movimientos del ratón no repintan ni una vez", durante);
  T(alFinal===1, "al soltar repinta exactamente una vez", alFinal);

  console.log("\n6 · Un clic corto sigue sirviendo para escribir el texto");
  const cajaTit = await pg.evaluate(()=>{ const e=document.querySelector(".lienzo .cmp-tit").getBoundingClientRect();
    return { x:e.left+e.width/2, y:e.top+e.height/2 }; });
  const offPrevio = await pg.evaluate(()=>JSON.stringify(getPath(pieza().composicion,"zonas.texto.titular.off")||{}));
  await pg.mouse.move(cajaTit.x, cajaTit.y);
  await pg.mouse.down(); await pg.mouse.move(cajaTit.x+2, cajaTit.y+1, {steps:2}); await pg.mouse.up();
  await pg.waitForTimeout(500);
  const offTrasClic = await pg.evaluate(()=>JSON.stringify(getPath(pieza().composicion,"zonas.texto.titular.off")||{}));
  T(offPrevio===offTrasClic, "un clic de 2 píxeles NO mueve el elemento", offPrevio+" → "+offTrasClic);

  console.log("\n7 · Mover a mano no rompe los once tamaños");
  // Se devuelven los elementos a su sitio y se comprueba que la pieza queda sana:
  // el desplazamiento libre no puede dejar un banner roto por sí mismo.
  await pg.evaluate(async()=>{
    setComp("zonas.texto.titular.off",{x:0,y:0});
    setComp("zonas.texto.cuerpo.off",{x:0,y:0});
    setComp("zonas.cta.off",{x:0,y:0});
    setComp("zonas.logo.off",{x:0,y:0});
    renderTablero(); await new Promise(r=>setTimeout(r,200));
  });
  await pg.waitForTimeout(1900);
  const insp = await pg.evaluate(()=>{ const r=pieza()._inspeccion||{};
    return { n:Object.keys(r).length, malos:Object.keys(r).filter(f=>!r[f].ok).map(f=>f+":"+r[f].fallos.map(x=>x.id).join("/")) }; });
  T(insp.n>=11, "el inspector mide los once", insp.n);
  T(insp.malos.length===0, "los once quedan sanos con los elementos en su sitio", insp.malos.join(" · "));
  // Un desplazamiento moderado tampoco los rompe.
  await pg.evaluate(async()=>{ setComp("zonas.texto.titular.off",{x:6,y:-4}); renderTablero(); });
  await pg.waitForTimeout(1900);
  const insp2 = await pg.evaluate(()=>{ const r=pieza()._inspeccion||{};
    return Object.keys(r).filter(f=>!r[f].ok).map(f=>f+":"+r[f].fallos.map(x=>x.id).join("/")); });
  T(insp2.length===0, "un ajuste fino a mano se replica sano en los once", insp2.join(" · "));

  console.log("\n8 · Si lo mueves encima de otra cosa, el inspector te avisa");
  // Es la red de seguridad del arrastre libre: mover es libre, pero nadie
  // entrega un banner con el titular encima del botón sin que se lo digan.
  await pg.evaluate(async()=>{ setComp("zonas.texto.titular.off",{x:0,y:90}); renderTablero(); });
  await pg.waitForTimeout(1900);
  const insp3 = await pg.evaluate(()=>{ const r=pieza()._inspeccion||{};
    const malos=Object.keys(r).filter(f=>!r[f].ok);
    return { n:malos.length, ids:[...new Set(malos.flatMap(f=>r[f].fallos.map(x=>x.id)))] }; });
  console.log("     tamaños marcados: "+insp3.n+"  ·  motivos: "+insp3.ids.join(", "));
  T(insp3.n>0 && insp3.ids.includes("colision"), "el inspector detecta el solape que provocaste", JSON.stringify(insp3));
  T(!insp3.ids.includes("cortado"), "y el elemento NO se corta: se ve dónde lo pusiste", insp3.ids.join(","));
  await pg.evaluate(()=>{ setComp("zonas.texto.titular.off",{x:0,y:0}); renderTablero(); });
  await pg.waitForTimeout(900);

  T(errs.length===0, "sin errores de consola", errs.slice(0,3).join(" | "));
  console.log("\n"+(mal?"FALLA":"TODO OK")+` — ${ok} ok · ${mal} mal`);
  await b.close();
  process.exit(mal?1:0);
})().catch(e=>{ console.log("ERROR: "+e.message); process.exit(1); });
