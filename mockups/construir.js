const fs=require('fs');
const D=require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
        WidthType, ShadingType, BorderStyle, AlignmentType, LevelFormat, TableOfContents,
        PageBreak, VerticalAlign } = D;

const B = JSON.parse(fs.readFileSync('bloques.json','utf8'));
const ANCHO = 9360;                     // Carta menos margenes de 1"
const NAVY='23366F', AZUL='2167AE', GRIS='6B7385', LINEA='DFE3EB', SUAVE='F3F6FB';
const AVISO = { no:{borde:'B4453C', fondo:'FBEDEC'}, si:{borde:'2E7D5B', fondo:'EAF4EF'},
                wa:{borde:'8A6212', fondo:'FBF3E0'}, info:{borde:AZUL, fondo:'E7F0F8'} };

const rs = (runs, o={}) => (runs||[]).map(r => new TextRun({
  text:r.t, bold:r.bold||o.bold, color:o.color, size:o.size, font:o.font }));

function tabla(b){
  const cols = Math.max(b.cab.length, ...b.filas.map(f=>f.reduce((n,c)=>n+1,0)));
  const w = Math.floor(ANCHO/cols);
  const anchos = Array(cols).fill(w); anchos[cols-1] = ANCHO - w*(cols-1);
  const celda = (t, opts={}) => new TableCell({
    width:{ size:opts.w||w, type:WidthType.DXA },
    rowSpan: opts.span>1 ? opts.span : undefined,
    shading: opts.cab ? { type:ShadingType.CLEAR, fill:SUAVE } : undefined,
    verticalAlign: VerticalAlign.TOP,
    margins:{ top:60, bottom:60, left:110, right:110 },
    children:[ new Paragraph({ spacing:{before:0,after:0},
      children:[ new TextRun({ text:t, bold:!!opts.cab, size:18,
        color: opts.cab ? GRIS : '1A1F2E' }) ] }) ]
  });
  const filas=[];
  if(b.cab.length) filas.push(new TableRow({ tableHeader:true,
    children: b.cab.map((t,i)=>celda(t,{cab:true, w:anchos[i]})) }));
  b.filas.forEach(f => filas.push(new TableRow({
    children: f.map((c,i)=>celda(c.texto,{ span:c.span, w:anchos[i] })) })));
  return new Table({ columnWidths:anchos, width:{size:ANCHO,type:WidthType.DXA},
    rows:filas,
    borders:{ top:{style:BorderStyle.SINGLE,size:4,color:LINEA},
      bottom:{style:BorderStyle.SINGLE,size:4,color:LINEA},
      left:{style:BorderStyle.SINGLE,size:4,color:LINEA},
      right:{style:BorderStyle.SINGLE,size:4,color:LINEA},
      insideHorizontal:{style:BorderStyle.SINGLE,size:2,color:LINEA},
      insideVertical:{style:BorderStyle.SINGLE,size:2,color:LINEA} } });
}

function aviso(b){
  const c = AVISO[b.clase]||AVISO.info;
  const parr=[];
  if(b.titulo) parr.push(new Paragraph({ spacing:{before:0,after:60},
    children:[new TextRun({text:b.titulo.toUpperCase(), bold:true, size:16, color:c.borde})] }));
  (b.cuerpo||[]).forEach(x=>{
    parr.push(new Paragraph({ spacing:{before:0,after:60},
      indent: x.tipo==='li' ? {left:220, hanging:140} : undefined,
      children: x.tipo==='li' ? [new TextRun({text:'— ',size:20}), ...rs(x.runs,{size:20})]
                              : rs(x.runs,{size:20}) }));
  });
  const celdaAviso = new TableCell({
    width: { size: ANCHO, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: c.fondo },
    margins: { top: 130, bottom: 130, left: 180, right: 180 },
    borders: {
      left:   { style: BorderStyle.SINGLE, size: 18, color: c.borde },
      top:    { style: BorderStyle.NIL },
      bottom: { style: BorderStyle.NIL },
      right:  { style: BorderStyle.NIL }
    },
    children: parr
  });
  return new Table({
    columnWidths: [ANCHO],
    width: { size: ANCHO, type: WidthType.DXA },
    rows: [ new TableRow({ children: [celdaAviso] }) ]
  });
}

const hijos=[];
hijos.push(new Paragraph({ spacing:{after:0},
  children:[new TextRun({text:'FLASH CAMPAIGN', bold:true, size:56, color:NAVY})] }));
hijos.push(new Paragraph({ spacing:{after:360},
  children:[new TextRun({text:'Manual de construcción', size:30, color:GRIS})] }));
hijos.push(new Paragraph({ spacing:{after:120},
  children:[new TextRun({text:'Contenido', bold:true, size:24, color:NAVY})] }));
hijos.push(new TableOfContents('Contenido', { hyperlink:true, headingStyleRange:'1-3' }));
hijos.push(new Paragraph({ children:[new PageBreak()] }));

for(const b of B){
  switch(b.tipo){
    case 'titulo': case 'subtitulo': break;      // ya van en la portada
    case 'salto':  hijos.push(new Paragraph({ children:[new PageBreak()] })); break;
    case 'h1': hijos.push(new Paragraph({ heading:HeadingLevel.HEADING_1,
      spacing:{before:400,after:140}, pageBreakBefore:true,
      children:[new TextRun({text:b.texto, bold:true, size:32, color:NAVY})] })); break;
    case 'h2': hijos.push(new Paragraph({ heading:HeadingLevel.HEADING_2,
      spacing:{before:300,after:100},
      children:[new TextRun({text:b.texto, bold:true, size:26, color:NAVY})] })); break;
    case 'h3': hijos.push(new Paragraph({ heading:HeadingLevel.HEADING_3,
      spacing:{before:220,after:80},
      children:[new TextRun({text:b.texto, bold:true, size:22, color:AZUL})] })); break;
    case 'p':  hijos.push(new Paragraph({ spacing:{after:120}, children:rs(b.runs,{size:21}) })); break;
    case 'li': hijos.push(new Paragraph({ spacing:{after:70}, indent:{left:340,hanging:200},
      children:[new TextRun({text:'•  ',size:21}), ...rs(b.runs,{size:21})] })); break;
    case 'mono': hijos.push(new Paragraph({ spacing:{after:0},
      shading:{type:ShadingType.CLEAR, fill:'F3F6FB'},
      children:[new TextRun({text:b.texto||' ', font:'Consolas', size:18})] })); break;
    case 'tabla': hijos.push(tabla(b)); hijos.push(new Paragraph({spacing:{after:160},children:[]})); break;
    case 'aviso': hijos.push(aviso(b)); hijos.push(new Paragraph({spacing:{after:160},children:[]})); break;
  }
}

const doc = new Document({
  creator:'Flash Campaign', title:'Flash Campaign — Manual de construcción',
  styles:{ default:{ document:{ run:{ font:'Calibri', size:21, color:'1A1F2E' },
                                paragraph:{ spacing:{line:276} } } } },
  sections:[{ properties:{ page:{ size:{width:12240,height:15840},
    margin:{top:1440,bottom:1440,left:1440,right:1440} } }, children:hijos }]
});
Packer.toBuffer(doc).then(buf=>{
  fs.writeFileSync('Flash Campaign - Manual.docx', buf);
  console.log('docx escrito ·', buf.length, 'bytes ·', hijos.length, 'elementos');
});
