/* ══════════════════════════════════════════════════════════════════
   ARCHIVOS CSV / ZIP / XLSX  ·  funciones/comun/archivos.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Armado de CSV y de planillas Excel sin librerías. Lo usan Search (planillas) y el diagnóstico de campaña actual.
   QUIÉN LO USA: Compartido.
   SECCIONES (en orden):
     1. CSV de campaña Google Search (import directo en Google Ads Editor)
     2. PLANILLA XLSX
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// ── CSV de campaña Google Search (import directo en Google Ads Editor) ──
// Cabeceras en inglés porque son las que Ads Editor reconoce automáticamente
// (con cabeceras en español pide mapear columnas a mano).
function _csvCelda(v){ v = String(v==null?"":v); return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; }
function _descargarCSV(nombre, filas){
  const txt = "\ufeff" + filas.map(r => r.map(_csvCelda).join(",")).join("\r\n");
  const blob = new Blob([txt], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
// ── PLANILLA XLSX ───────────────────────────────────────────────────────
// El manual pide XLSX, nunca CSV, con UNA HOJA POR TIPO DE DATO. Se escribe a
// mano (ZIP sin comprimir + XML mínimo) porque el aplicativo es un solo archivo
// servido por Pages y no puede cargar librerías externas.
function _crc32(buf){
  let c, tabla = _crc32.t;
  if(!tabla){
    tabla = _crc32.t = new Int32Array(256);
    for(let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++) c = c&1 ? 0xEDB88320 ^ (c>>>1) : c>>>1; tabla[n]=c; }
  }
  let crc = -1;
  for(let i=0;i<buf.length;i++) crc = (crc>>>8) ^ tabla[(crc ^ buf[i]) & 0xFF];
  return (crc ^ -1) >>> 0;
}
// ZIP "store" (sin compresión): suficiente para planillas de texto y sin dependencias.
function _zip(archivos){
  const enc = new TextEncoder();
  const partes = [], central = [];
  let offset = 0;
  const u16 = v => [v & 0xFF, (v>>>8) & 0xFF];
  const u32 = v => [v & 0xFF, (v>>>8) & 0xFF, (v>>>16) & 0xFF, (v>>>24) & 0xFF];
  archivos.forEach(f => {
    const nombre = enc.encode(f.nombre);
    const datos = typeof f.datos === "string" ? enc.encode(f.datos) : f.datos;
    const crc = _crc32(datos);
    const cab = [].concat([0x50,0x4B,0x03,0x04], u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(datos.length), u32(datos.length), u16(nombre.length), u16(0));
    partes.push(new Uint8Array(cab), nombre, datos);
    central.push({ crc, len:datos.length, nombre, offset });
    offset += cab.length + nombre.length + datos.length;
  });
  const dir = [];
  central.forEach(c => {
    const cab = [].concat([0x50,0x4B,0x01,0x02], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(c.crc), u32(c.len), u32(c.len), u16(c.nombre.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.offset));
    dir.push(new Uint8Array(cab), c.nombre);
  });
  const dirLen = dir.reduce((a,x)=>a+x.length, 0);
  const fin = new Uint8Array([].concat([0x50,0x4B,0x05,0x06], u16(0), u16(0),
    u16(central.length), u16(central.length), u32(dirLen), u32(offset), u16(0)));
  const todo = partes.concat(dir, [fin]);
  const total = todo.reduce((a,x)=>a+x.length, 0);
  const out = new Uint8Array(total);
  let p = 0; todo.forEach(x => { out.set(x, p); p += x.length; });
  return out;
}
const _xmlEsc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
function _colXLSX(n){ let s=""; n++; while(n>0){ const r=(n-1)%26; s=String.fromCharCode(65+r)+s; n=Math.floor((n-1)/26); } return s; }
// hojas = [{ nombre, filas:[[celda,...],...] }]. Todo va como texto (inlineStr):
// las keywords y los titulares son texto, y así Excel no reinterpreta nada.
function construirXLSX(hojas){
  const hs = hojas.slice(0, 10).map((h,i) => ({ nombre:String(h.nombre||("Hoja"+(i+1))).slice(0,31).replace(/[\\\/\?\*\[\]:]/g,"-"), filas:h.filas||[] }));
  const sheetXML = h => {
    const filas = h.filas.map((fila,r) => {
      const celdas = fila.map((v,c) => {
        const t = String(v==null?"":v);
        return t === "" ? "" : `<c r="${_colXLSX(c)}${r+1}" t="inlineStr"><is><t xml:space="preserve">${_xmlEsc(t)}</t></is></c>`;
      }).join("");
      return `<row r="${r+1}">${celdas}</row>`;
    }).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${filas}</sheetData></worksheet>`;
  };
  const archivos = [
    { nombre:"[Content_Types].xml", datos:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${
      hs.map((h,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>` },
    { nombre:"_rels/.rels", datos:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nombre:"xl/workbook.xml", datos:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${
      hs.map((h,i)=>`<sheet name="${_xmlEsc(h.nombre)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("")}</sheets></workbook>` },
    { nombre:"xl/_rels/workbook.xml.rels", datos:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${
      hs.map((h,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")}</Relationships>` }
  ].concat(hs.map((h,i)=>({ nombre:`xl/worksheets/sheet${i+1}.xml`, datos:sheetXML(h) })));
  return _zip(archivos);
}
function descargarXLSX(nombre, hojas){
  const blob = new Blob([construirXLSX(hojas)], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
