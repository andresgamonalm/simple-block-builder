// La planilla XLSX: que sea un XLSX de verdad (ZIP con las partes correctas),
// con una hoja por tipo de dato y la columna de posición de los anclados.
const { chromium } = require("playwright");
const fs = require("fs");
let ok=0, mal=0;
const T=(c,n,e)=>{ if(c){ok++;console.log("  ok   "+n);} else {mal++;console.log("  MAL  "+n+(e?" → "+e:""));} };
(async()=>{
  const b=await chromium.launch({executablePath: process.env.SBB_CHROMIUM || undefined});
  const pg=await b.newPage();
  const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
  await pg.goto((process.env.SBB_URL || "http://127.0.0.1:8099")+"/editor.html",{waitUntil:"load"});
  await pg.waitForFunction(()=>typeof window.construirXLSX==="function");
  const bytes = await pg.evaluate(()=>{
    const pr={id:uid(),nombre:"x",creado:Date.now(),piezas:[],activa:null};
    workspace.proyectos=[pr]; proyectoVistoId=pr.id; proyecto=pr;
    crearPieza("ads","Search"); activarPieza(proyecto.activa);
    pieza().adsData = { nombre:"Seguro Auto", urlFinal:"https://ejemplo.cl/auto",
      grupos:[{ nombre:"Cotizar seguro auto", intencion:"comprar", razonamiento:"transaccional",
        keywords:[{t:"seguro automotriz online",tipo:"exacta"},{t:"cotizar seguro de auto en chile",tipo:"frase"}],
        negativas:["gratis","empleo"],
        titularesFijos:["Zurich Seguro Auto","Seguro Automotriz Online","2 Cuotas Gratis","Cotiza Aquí"],
        titulares:["Zurich Seguro Auto","Seguro Automotriz Online","2 Cuotas Gratis","Cotiza Aquí","Cobertura Desde Hoy","Asistencia en Ruta"],
        descripciones:["Contrata en línea y queda cubierto el mismo día.","Asistencia en ruta las 24 horas."],
        path1:"auto", path2:"digital" }],
      negativas:["curso","segunda mano"],
      sitelinks:[{texto:"Cotizar",desc1:"En 3 minutos",desc2:"Sin papeleo",url:"/cotizar"}] };
    const x = construirXLSX([{nombre:"Keywords",filas:[["a","b"],["1","2"]]}]);
    return Array.from(x);
  });
  fs.writeFileSync("/tmp/prueba.xlsx", Buffer.from(bytes));
  T(bytes[0]===0x50 && bytes[1]===0x4B, "el archivo empieza con la firma ZIP (PK)");
  // Descomprimir con python para confirmar que es un XLSX legible
  const { execSync } = require("child_process");
  const salida = execSync(`python3 -c "
import zipfile
z=zipfile.ZipFile('/tmp/prueba.xlsx')
print('|'.join(sorted(z.namelist())))
print(z.read('xl/worksheets/sheet1.xml').decode()[:200])
print(z.testzip() or 'CRC-OK')
"`).toString();
  T(/\[Content_Types\]\.xml/.test(salida), "lleva [Content_Types].xml");
  T(/xl\/workbook\.xml/.test(salida), "lleva xl/workbook.xml");
  T(/CRC-OK/.test(salida), "los CRC del ZIP son correctos");
  T(/inlineStr/.test(salida), "las celdas van como texto");

  // Ahora la planilla real de la campaña
  const info = await pg.evaluate(()=>{
    let capturado=null;
    const orig = URL.createObjectURL;
    const hojas=[];
    // interceptamos construirXLSX para inspeccionar las hojas que se le pasan
    const cons = window.construirXLSX;
    window.construirXLSX = (h)=>{ hojas.push(...h.map(x=>({nombre:x.nombre, filas:x.filas.length, cab:x.filas[0]}))); return cons(h); };
    descargarPlanillaAds();
    window.construirXLSX = cons;
    return hojas;
  });
  console.log("     hojas: " + info.map(h=>h.nombre+"("+h.filas+")").join(" · "));
  T(info.length===4, "una hoja por tipo de dato + sitelinks", info.length);
  T(info.map(h=>h.nombre).join(",")==="Keywords,Anuncios,Negativas,Sitelinks", "hojas con los nombres correctos");
  const cabAnuncios = (info.find(h=>h.nombre==="Anuncios")||{}).cab||[];
  T(cabAnuncios.includes("Headline 1 position"), "la columna de posición está al lado del titular");
  T(cabAnuncios.filter(c=>/position/.test(c)).length === cabAnuncios.filter(c=>/^Headline \d+$/.test(c)).length,
    "una columna de posición por cada titular");
  const negs = info.find(h=>h.nombre==="Negativas");
  T(negs.filas === 5, "negativas de grupo y de campaña en su hoja", "filas="+negs.filas);

  console.log("\n"+(mal||errs.length?"FALLA":"TODO OK")+` — ${ok} ok · ${mal} mal`);
  if(errs.length) errs.forEach(e=>console.log("  err "+e));
  await b.close(); process.exit(mal||errs.length?1:0);
})();
