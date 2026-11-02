// EL FALLO DEL 8-SEP-2026: Gemini devolvió su RAZONAMIENTO pegado al JSON y la
// generación se cayó con "No se pudo interpretar la respuesta de la IA como
// JSON". Esta prueba usa la respuesta REAL que rompió la app.
const path = require("path");
const RAIZ = process.env.SBB_RAIZ || path.resolve(__dirname, "..");
let ok=0, mal=0;
const T=(c,n,e)=>{ if(c){ok++;console.log("  ok   "+n);} else {mal++;console.log("  MAL  "+n+(e!==undefined?" → "+e:""));} };

(async()=>{
  const src = require("fs").readFileSync(RAIZ+"/functions/api/ia.js","utf8");

  // extraerJSON no se exporta (es interna): se extrae su código y se evalúa.
  const ini = src.indexOf("function extraerJSON(texto) {");
  const fin = src.indexOf("\n// Dos gamas de modelo", ini);
  const extraerJSON = new Function(src.slice(ini, fin) + "\nreturn extraerJSON;")();

  console.log("\n1 · Lo que rompió la aplicación: el modelo pensando en voz alta");
  // Reproducción fiel del error de la captura del usuario.
  const razonando = `Okay, the user wants a banner. Let me look at the candidates.
? Wait, what about \`https://lh3.googleusercontent.com/d/1FvJnVWc6Ck9-HGM9QkzttuSk3nxXxojr=w1600\`? Let's re-read: "IMÁGENES CANDIDATAS (mira las miniaturas)".
I could answer with {"zonas": "algo"} but that is wrong, let me reconsider.
Final answer:
{"nombre":"Seguro Auto","zonas":{"titular":"Protege lo que más quieres","cuerpo":"Cobertura desde hoy","cta":"Cotiza aquí","etiqueta":"Seguro Auto"},"burbuja":"60% dcto.","imagen":""}`;
  const r1 = extraerJSON(razonando);
  T(r1 && r1.zonas && r1.zonas.titular === "Protege lo que más quieres",
    "se saca el JSON bueno aunque venga después del razonamiento", JSON.stringify(r1));
  T(r1 && r1.burbuja === "60% dcto.", "y llega completo, no un fragmento citado", r1 && r1.burbuja);

  console.log("\n2 · Casos que ya funcionaban (no se rompe nada)");
  T(JSON.stringify(extraerJSON('{"a":1}')) === '{"a":1}', "JSON limpio");
  T(JSON.stringify(extraerJSON('```json\n{"a":2}\n```')) === '{"a":2}', "JSON en un bloque de código");
  T(JSON.stringify(extraerJSON('Aquí tienes:\n{"a":3}\nEspero que sirva.')) === '{"a":3}', "JSON entre prosa");
  T(JSON.stringify(extraerJSON('[{"t":"a"}]')) === '[{"t":"a"}]', "un array en la raíz");
  T(extraerJSON("no hay nada aquí") === undefined, "texto sin JSON devuelve indefinido");
  T(extraerJSON('{"roto":') === undefined, "JSON cortado devuelve indefinido");
  const conComillas = 'El modelo dijo: {"cita":"aquí hay una llave { que no cuenta"} y ya.';
  T(extraerJSON(conComillas).cita.includes("llave"), "una llave DENTRO de un texto no confunde al balanceo");

  console.log("\n3 · Se descartan las partes de PENSAMIENTO de la respuesta");
  // Es la línea que causó el fallo: concatenaba todas las partes.
  T(/p\.thought !== true/.test(src), "el código filtra las partes marcadas como pensamiento");
  T(/if \(!texto && Array\.isArray\(parts\)\)/.test(src), "y tiene red de seguridad si el modelo no las marca");
  const filtrar = new Function("parts", `
    const utiles = Array.isArray(parts) ? parts.filter(p => p && p.thought !== true) : [];
    let texto = utiles.map(p => (p && p.text) || '').join('');
    if (!texto && Array.isArray(parts)) texto = parts.map(p => (p && p.text) || '').join('');
    return texto;`);
  T(filtrar([{text:"Let me think...",thought:true},{text:'{"a":1}'}]) === '{"a":1}',
    "con partes marcadas, el pensamiento no llega al parseador");
  T(filtrar([{text:'{"a":1}'}]) === '{"a":1}', "sin marcas, se usa el texto tal cual");
  T(filtrar([{text:"solo pensamiento",thought:true}]) === "solo pensamiento",
    "si TODO viene marcado, no se devuelve vacío (se intenta igual)");

  console.log("\n4 · El reintento cuando el modelo rechaza el parámetro");
  T(/if \(!res\.ok && res\.status === 400\) res = await pedir\(cuerpoSinThinking\(\)/.test(src),
    "un 400 reintenta sin thinkingConfig aunque se hubiera pedido 0");
  T(/MAX_TOKENS/.test(src), "y si se queda sin espacio, el mensaje lo dice claro");

  console.log("\n"+(mal?"FALLA":"TODO OK")+` — ${ok} ok · ${mal} mal`);
  process.exit(mal?1:0);
})().catch(e=>{ console.log("ERROR: "+e.message); process.exit(1); });
