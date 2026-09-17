// LAS MAQUETAS DEL USUARIO (10-sep-2026), medidas sobre el render real.
//   FRANJA  → 25 % logo | 50 % promoción (40 promo + 10 legal) | 25 % CTA, en COLUMNAS
//   VERTICAL→ 20 % logo · 50 % promoción · 20 % CTA · 10 % legal, APILADO
//   «Legal es relativo, no siempre está» → sin legal, su parte se reparte.
const { chromium } = require("playwright");
let ok=0, mal=0;
const T=(c,n,e)=>{ if(c){ok++;console.log("  ok   "+n);} else {mal++;console.log("  MAL  "+n+(e!==undefined?" → "+e:""));} };
(async()=>{
  const b=await chromium.launch({executablePath: process.env.SBB_CHROMIUM || undefined});
  const pg=await b.newPage({viewport:{width:1600,height:1100}});
  const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
  await pg.goto((process.env.SBB_URL||"http://127.0.0.1:8099")+"/editor.html",{waitUntil:"load"});
  await pg.waitForFunction(()=>typeof window.bandasDe==="function");

  console.log("\n1 · Las bandas salen tal como están en las maquetas");
  const b1 = await pg.evaluate(()=>({
    franja:   bandasDe("display-728x90", true),
    franjaSL: bandasDe("display-728x90", false),
    vert:     bandasDe("display-160x600", true),
    vertSL:   bandasDe("display-160x600", false)
  }));
  const pct = v => Math.round(v*1000)/10;
  console.log(`     FRANJA   logo ${pct(b1.franja.logo.w)}% | promo ${pct(b1.franja.promo.w)}% | cta ${pct(b1.franja.cta.w)}%`);
  console.log(`     VERTICAL logo ${pct(b1.vert.logo.h)}% · promo ${pct(b1.vert.promo.h)}% · cta ${pct(b1.vert.cta.h)}% · legal ${pct(b1.vert.legal.h)}%`);
  T(b1.franja.dir==="row","la franja reparte en COLUMNAS",b1.franja.dir);
  T(pct(b1.franja.logo.w)===25 && pct(b1.franja.promo.w)===50 && pct(b1.franja.cta.w)===25,
    "franja: 25 / 50 / 25 exacto", `${pct(b1.franja.logo.w)}/${pct(b1.franja.promo.w)}/${pct(b1.franja.cta.w)}`);
  T(b1.franja.legal && b1.franja.legal.x===b1.franja.promo.x,
    "el legal de la franja va DENTRO de la banda del medio", JSON.stringify(b1.franja.legal));
  T(b1.franja.legal && Math.abs(b1.franja.legal.h - 0.2) < 0.001,
    "y ocupa la quinta parte de su alto (40 % promo + 10 % legal)", pct(b1.franja.legal.h)+"%");
  T(b1.vert.dir==="col","el vertical reparte APILADO",b1.vert.dir);
  T(pct(b1.vert.logo.h)===20 && pct(b1.vert.promo.h)===50 && pct(b1.vert.cta.h)===20 && pct(b1.vert.legal.h)===10,
    "vertical: 20 / 50 / 20 / 10 exacto",
    `${pct(b1.vert.logo.h)}/${pct(b1.vert.promo.h)}/${pct(b1.vert.cta.h)}/${pct(b1.vert.legal.h)}`);
  T(b1.vertSL.legal===null,"«legal es relativo»: sin legal, esa banda no existe");
  T(Math.abs(b1.vertSL.logo.h+b1.vertSL.promo.h+b1.vertSL.cta.h - 1) < 0.001,
    "y su 10 % se reparte entre las otras tres, sin hueco muerto",
    pct(b1.vertSL.logo.h)+"/"+pct(b1.vertSL.promo.h)+"/"+pct(b1.vertSL.cta.h));
  T(b1.franjaSL.legal===null && Math.abs(b1.franjaSL.promo.h-1)<0.001,
    "en la franja sin legal, la promoción usa todo el alto de su banda");

  console.log("\n2 · El papel de cada elemento se deduce solo");
  const r2 = await pg.evaluate(()=>({
    logo:  rolLibre({tipo:"logo"}),
    cta:   rolLibre({tipo:"figura", link:"https://ejemplo.cl"}),
    legal: rolLibre({tipo:"texto", esLegal:true}),
    texto: rolLibre({tipo:"texto", texto:"Protege tu auto"}),
    manda: rolLibre({tipo:"texto", link:"https://x.cl", rol:"promo"})
  }));
  T(r2.logo==="logo" && r2.cta==="cta" && r2.legal==="legal" && r2.texto==="promo",
    "logo, botón (por su enlace), legal y promoción", JSON.stringify(r2));
  T(r2.manda==="promo","y lo que fijes a mano manda sobre la deducción",r2.manda);

  console.log("\n3 · REPLICAR reparte de verdad: el horizontal y el lateral quedan bien");
  const r3 = await pg.evaluate(async()=>{
    const pr={id:uid(),nombre:"Prop",creado:Date.now(),piezas:[],activa:null};
    workspace.proyectos=[pr]; proyecto=pr; proyectoVistoId=pr.id;
    crearComposicion("display-desktop");
    const p=pieza(), c=p.composicion;
    c.fondo.color="#040764";
    c.elementos=[
      nuevoElementoLibre("logo",  {ancla:"tl",dx:14,dy:14,w:90,h:28,url:"/logo.svg",z:5}),
      nuevoElementoLibre("texto", {ancla:"mc",dx:0,dy:-10,w:200,h:60,texto:"Protege lo que más quieres",tam:22,color:"#fff",z:2}),
      nuevoElementoLibre("figura",{ancla:"bc",dx:0,dy:40,w:120,h:34,forma:"rect",relleno:"#e8590c",radio:6,link:"https://ejemplo.cl",z:3}),
      nuevoElementoLibre("texto", {ancla:"bc",dx:0,dy:6,w:240,h:16,texto:"Legal — Legal — Legal",tam:10,color:"#fff",esLegal:true,z:4})
    ];
    renderTablero();
    await new Promise(r=>setTimeout(r,600));
    replicarBanner();
    await new Promise(r=>setTimeout(r,900));
    // Dónde acabó cada elemento en la franja y en el lateral, en % del marco.
    const mide=(fmt)=>{
      const F=FORMATOS[fmt];
      const ef=composicionEfectiva(pieza(), fmt);
      const out={};
      (ef.elementos||[]).forEach(e=>{
        const q=cajaLibre(e,fmt);
        out[rolLibre(e)] = { cx:Math.round((q.left+q.w/2)/F.ancho*100), cy:Math.round((q.top+q.h/2)/F.alto*100),
                             dentro: q.left>=-1 && q.top>=-1 && q.left+q.w<=F.ancho+1 && q.top+q.h<=F.alto+1 };
      });
      return out;
    };
    return { franja:mide("display-728x90"), vert:mide("display-160x600"),
             master:mide("display-300x250"), tira:mide("display-468x60") };
  });
  const f=r3.franja, v=r3.vert;
  const sinEl = "—";
  console.log(`     728×90   logo x=${f.logo.cx}%  promo x=${f.promo.cx}%  cta x=${f.cta.cx}%  legal y=${f.legal?f.legal.cy+"%":sinEl}`);
  console.log(`     160×600  logo y=${v.logo.cy}%  promo y=${v.promo.cy}%  cta y=${v.cta.cy}%  legal y=${v.legal?v.legal.cy+"%":sinEl}`);
  console.log(`     468×60   logo x=${r3.tira.logo.cx}%  promo x=${r3.tira.promo.cx}%  cta x=${r3.tira.cta.cx}%  legal ${r3.tira.legal?"y="+r3.tira.legal.cy+"%":sinEl}`);
  T(f.logo.cx < f.promo.cx && f.promo.cx < f.cta.cx,
    "FRANJA: logo a la izquierda, promoción al centro, botón a la derecha",
    `${f.logo.cx} < ${f.promo.cx} < ${f.cta.cx}`);
  T(f.logo.cx>=8 && f.logo.cx<=17, "el logo cae dentro de su 25 % izquierdo", f.logo.cx+"%");
  T(f.cta.cx>=83 && f.cta.cx<=92, "y el botón dentro de su 25 % derecho", f.cta.cx+"%");
  T(f.legal && f.legal.cy > f.promo.cy, "el legal va bajo la promoción, en su franja de abajo",
    f.legal ? `${f.legal.cy} > ${f.promo.cy}` : "no salió");
  T(v.legal && v.logo.cy < v.promo.cy && v.promo.cy < v.cta.cy && v.cta.cy < v.legal.cy,
    "VERTICAL: logo, promoción, botón y legal en ese orden de arriba abajo",
    `${v.logo.cy} < ${v.promo.cy} < ${v.cta.cy} < ${v.legal ? v.legal.cy : "(sin legal)"}`);
  T(v.logo.cy<=15, "el logo en su 20 % de arriba", v.logo.cy+"%");
  T(v.legal && v.legal.cy>=92, "y el legal en su 10 % de abajo", v.legal ? v.legal.cy+"%" : "no salió");
  T(Object.values(f).every(x=>x.dentro) && Object.values(v).every(x=>x.dentro),
    "nada se sale del marco en ninguno de los dos");

  console.log("\n4 · «Legal es relativo»: cae donde no cabe legible, no se encoge");
  T(!r3.tira.legal, "en la tira de 468×60 el legal NO se pinta ilegible: se cae",
    r3.tira.legal ? "salió igual" : "");
  T(!!r3.tira.logo && !!r3.tira.promo && !!r3.tira.cta,
    "y lo que nunca cae —logo, promoción y botón— sigue ahí");
  T(!!f.legal && !!v.legal, "donde sí cabe, se pinta (franja de 728×90 y lateral de 160×600)");

  console.log("\n5 · El máster se queda como lo dibujaste");
  T(r3.master.logo.cy < 30 && r3.master.cta.cy > 60,
    "replicar NO toca el diseño del máster", JSON.stringify(r3.master.logo)+" "+JSON.stringify(r3.master.cta));

  console.log("\n6 · Después de replicar, los 11 siguen sanos");
  await pg.waitForTimeout(1800);
  const insp = await pg.evaluate(()=>{ const r=pieza()._inspeccion||{};
    return { n:Object.keys(r).length, malos:Object.keys(r).filter(f=>!r[f].ok).map(f=>f+":"+r[f].fallos.map(x=>x.id).join("/")) }; });
  T(insp.n>=11,"el inspector mide los once",insp.n);
  T(insp.malos.length===0,"y los once pasan tras el reparto",insp.malos.join(" · "));

  T(errs.length===0,"sin errores de consola",errs.slice(0,3).join(" | "));
  console.log("\n"+(mal?"FALLA":"TODO OK")+` — ${ok} ok · ${mal} mal`);
  await b.close();
  process.exit(mal?1:0);
})().catch(e=>{ console.log("ERROR: "+e.message); process.exit(1); });
