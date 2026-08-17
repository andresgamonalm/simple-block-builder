// Genera la especificacion legible por maquina desde las MISMAS formulas del
// manual. Ningun valor escrito a mano: si cambia una formula, cambia el archivo.
const fs = require('fs');

const BASE_DISPLAY = { epigrafe:11, titulo:26, bajada:13, cta:13, legal:9, margenPct:5.5, logoPct:8 };
const LINEAS = {
  cuadrados:  { epigrafe:1, titulo:3, bajada:3, cta:1, legal:2 },
  verticales: { epigrafe:1, titulo:3, bajada:3, cta:1, legal:2 },
  grandes:    { epigrafe:1, titulo:2, bajada:2, cta:1, legal:1 },
  franjas:    { epigrafe:1, titulo:1, bajada:1, cta:1, legal:1 }
};
const DISPLAY = [
  {w:300,h:250,fam:'cuadrados',master:true},{w:336,h:280,fam:'cuadrados'},
  {w:250,h:250,fam:'cuadrados'},{w:200,h:200,fam:'cuadrados'},
  {w:300,h:600,fam:'verticales'},{w:160,h:600,fam:'verticales'},
  {w:728,h:90,fam:'franjas'},{w:970,h:90,fam:'franjas'},{w:468,h:60,fam:'franjas'},
  {w:1200,h:628,fam:'grandes'},{w:1200,h:1200,fam:'grandes'}
];
const FACEBOOK = [
  {w:1080,h:1350,fam:'cuadrados',master:true,cubre:['feed']},
  {w:1080,h:1080,fam:'cuadrados',cubre:['feed','marketplace','columna-derecha','audience-network']},
  {w:1200,h:628, fam:'grandes',  cubre:['feed-horizontal','enlaces']}
];
const kDisplay = f => f.fam==='franjas'    ? Math.max(0.55, f.h/110)
                    : f.fam==='verticales' ? Math.max(0.62, f.w/300)
                    : Math.max(0.70, Math.min(f.w/300, f.h/250));
const kFacebook = f => Math.min(f.w/1080, f.h/1350);
const BASE_FB = Object.fromEntries(Object.entries(BASE_DISPLAY)
  .map(([k,v]) => [k, /Pct$/.test(k) ? v : Math.round(v*3.6)]));

function medir(f, base, k){
  const S = Math.min(f.w,f.h), L = LINEAS[f.fam];
  const margen = Math.max(8, Math.round(S*base.margenPct/100));
  const piso = S<=250 ? 9 : 11;
  const px = b => Math.max(piso, Math.round(b*k));
  const circulo = (f.fam==='cuadrados' || (f.fam==='grandes' && f.w===f.h)) ? Math.round(S*0.62) : 0;
  const invade = circulo ? (circulo - Math.round(S*0.08) + Math.round(S*0.04)) : 0;
  const util = Math.max(40, f.w - margen*2 - invade);
  const chars = (fs_, l) => Math.max(4, Math.floor(util/(fs_*0.52))*l);
  const cae = [];
  if(f.fam==='franjas'    && S<=60)  cae.push('bajada','epigrafe');
  if(f.fam==='verticales' && f.w<=160) cae.push('legal');
  const cuerpo = { epigrafe:px(base.epigrafe), titulo:Math.max(piso,Math.round(base.titulo*k)),
                   bajada:px(base.bajada), cta:px(base.cta), legal:px(base.legal) };
  return {
    formato:`${f.w}x${f.h}`, ancho:f.w, alto:f.h, familia:f.fam,
    master: !!f.master, k:+k.toFixed(3),
    margen, anchoUtil:util, pisoLegibilidad:piso,
    circuloDiametro: circulo || null,
    logoAlto: Math.max(14, Math.round(S*base.logoPct/100)),
    cuerpo,
    maxCaracteres: {
      epigrafe: cae.includes('epigrafe') ? null : Math.min(18, chars(cuerpo.epigrafe, L.epigrafe)),
      titulo:   chars(cuerpo.titulo, L.titulo),
      bajada:   cae.includes('bajada')   ? null : chars(cuerpo.bajada, L.bajada),
      cta:      Math.min(24, chars(cuerpo.cta, L.cta)),
      legal:    cae.includes('legal')    ? null : chars(cuerpo.legal, L.legal)
    },
    elementosQueNoVan: cae,
    diagramaciones: f.fam==='verticales' ? ['C','D']
                  : f.fam==='franjas'    ? ['B','D']
                  : f.fam==='grandes'    ? (f.w===f.h ? ['A','B','D'] : ['B','D'])
                  : ['A','B','D']
  };
}

const spec = {
  producto: 'Flash Campaign',
  version: 1,
  nota: 'Valores generados desde las formulas del manual. No editar a mano: editar la formula.',

  formulas: {
    escala: {
      'display.cuadrados_y_grandes': 'max(0.70, min(ancho/300, alto/250))',
      'display.verticales': 'max(0.62, ancho/300)',
      'display.franjas': 'max(0.55, alto/110)',
      'facebook': 'min(ancho/1080, alto/1350)'
    },
    maxCaracteres: 'floor(anchoUtil / (cuerpo * 0.52)) * lineasPermitidas',
    anchoUtil: 'ancho - margen*2 - (diametroCirculo - salidaBorde + hueco)',
    nota: '0.52 em = ancho medio de caracter en Arial'
  },

  masters: { display:'300x250', facebook:'1080x1350' },
  medidasBase: { display: BASE_DISPLAY, facebook: BASE_FB },
  lineasPorFamilia: LINEAS,

  paleta: {
    fondos: [
      { nombre:'navy',    hex:'#23366F', texto:'#FFFFFF', fuente:'manual' },
      { nombre:'azul',    hex:'#2167AE', texto:'#FFFFFF', fuente:'manual' },
      { nombre:'coral',   hex:'#F0736B', texto:'#FFFFFF', fuente:'medido-en-pieza' },
      { nombre:'magenta', hex:'#C2417F', texto:'#FFFFFF', fuente:'medido-en-pieza' },
      { nombre:'beige',   hex:'#D9D2C5', texto:'#23366F', fuente:'medido-en-pieza' },
      { nombre:'durazno', hex:'#E8B87A', texto:'#23366F', fuente:'medido-en-pieza' },
      { nombre:'blanco',  hex:'#FFFFFF', texto:'#23366F', fuente:'manual', obligaBorde:true }
    ],
    acentos: [
      { nombre:'celeste',      hex:'#91BFE3', uso:['formas','circulo-secundario'] },
      { nombre:'cyan',         hex:'#41B6E6', uso:['formas'] },
      { nombre:'beige-forma',  hex:'#D8D2BC', uso:['formas'] },
      { nombre:'verde-salvia', hex:'#8FB89A', uso:['circulo-monto'], fuente:'medido-en-pieza' },
      { nombre:'rojo-cta',     hex:'#C0392B', uso:['cta-solido'] }
    ],
    fotoFiltro: { obligatorio:true, opacidadMin:0.35, opacidadMax:0.60 }
  },

  circuloMonto: {
    diametroPctLadoCorto: 62,
    salidaBordePctLadoCorto: 8,
    maximo: 2,
    cuerpoCifraPctDiametro: 45,
    cuerpoEntradillaPctDiametro: 11,
    cuerpoPalabraPctDiametro: 20,
    requiereCifraReal: true,
    combinaciones: [
      { cantidad:1, fondo:'navy',    colores:['#2167AE'], textos:['#FFFFFF'] },
      { cantidad:1, fondo:'coral',   colores:['#2167AE'], textos:['#FFFFFF'] },
      { cantidad:1, fondo:'magenta', colores:['#FFFFFF'], textos:['#23366F'] },
      { cantidad:1, fondo:'durazno', colores:['#23366F'], textos:['#FFFFFF'] },
      { cantidad:1, fondo:'foto',    colores:['#8FB89A'], textos:['#FFFFFF'] },
      { cantidad:2, fondo:'navy',    colores:['#2167AE','#5B9BD5'], textos:['#FFFFFF','#FFFFFF'] },
      { cantidad:2, fondo:'coral',   colores:['#2167AE','#FFFFFF'], textos:['#FFFFFF','#23366F'] },
      { cantidad:2, fondo:'foto',    colores:['#2167AE','#23366F'], textos:['#FFFFFF','#FFFFFF'] }
    ],
    secundarioPuedeContener: ['cifra','foto-producto-recortada','logo-socio','linea-divisoria','legal']
  },

  voces: {
    'serif-display': { peso:'fino', usoEn:['epigrafe','frase-gancho'] },
    'sans-light':    { peso:'light', usoEn:['nombre-producto','bajada','monto','entradilla','legal'] }
  },

  monto: {
    presentaciones:[
      { tipo:'pildora-contorneada', cuando:'convive con mas datos', bordePx:2, fondo:'transparente' },
      { tipo:'desnudo', cuando:'el precio es el mensaje', esElementoMayor:true }
    ],
    simboloMonedaMasChico:true, asteriscoSiHayCondiciones:true,
    entradillaArriba:true, aclaracionAbajo:true
  },

  cta: [
    { forma:'pildora-solida',           fondo:'#C0392B', texto:'#FFFFFF', cuando:'venta directa' },
    { forma:'pildora-contorneada-flecha', fondo:'transparente', borde:'color-texto', cuando:'invitacion' },
    { forma:'solo-texto',               peso:'negrita', cuando:'el canal no es un clic' }
  ],

  logo: [
    { posicion:'arriba-izquierda', version:'clara', fondo:'ninguno' },
    { posicion:'arriba-centro',    version:'clara', fondo:'ninguno' },
    { posicion:'abajo-derecha',    version:'color', fondo:'circulo-claro-que-asoma' }
  ],

  foto: [
    { tratamiento:'fondo-a-sangre', filtro:true,  sujetoAlLadoContrarioDelTexto:true },
    { tratamiento:'recorte-circular', filtro:false, lados:['izquierda','derecha'], asomaPorBorde:true,
      diametroPctAlto:85 },
    { tratamiento:'producto-en-circulo', filtro:false, sinFondo:true }
  ],

  formas: {
    repertorio:['circulo','cuarto-de-circulo','trazo-pincel','linea-divisoria'],
    colores:['#91BFE3','#41B6E6','#2167AE','#23366F','#E9EDF2','#D8D2BC'],
    cantidadMin:3, cantidadMax:5,
    escalasPctLadoCorto:[28,16,9],
    anclaje:'borde', porDetrasDelContenido:true,
    nuncaDosDelMismoColorTocandose:true
  },

  espaciado: {
    'epigrafe->titulo':6, 'titulo->bajada':10, 'bajada->cta':16,
    'cta->legal':10, 'logo->primer-texto':18, 'texto->circulo':'4% lado corto'
  },

  prioridadDeCaida: ['legal','bajada','formas','epigrafe'],
  nuncaSeCaen: ['titulo','cta','logo'],

  inspector: {
    reglas:[
      { id:'desborde',  criterio:'ningun elemento fuera del marco' },
      { id:'colision',  criterio:'ningun texto sobre otro ni sobre el circulo' },
      { id:'legible',   criterio:'cuerpo >= 9px si lado corto <= 250, >= 11px en el resto' },
      { id:'contraste', criterio:'texto contra su fondo real >= 4.5:1' },
      { id:'completa',  criterio:'titulo, cta y logo presentes' },
      { id:'aire',      criterio:'ninguna zona muerta > 30% del alto' }
    ],
    intentosAntesDeEntregarConAviso: 3
  },

  formatos: {
    display:  DISPLAY.map(f => medir(f, BASE_DISPLAY, kDisplay(f))),
    facebook: FACEBOOK.map(f => Object.assign(medir(f, BASE_FB, kFacebook(f)), { cubre:f.cubre }))
  },

  facebookTextosDelAnuncio: {
    nota:'Meta trunca en silencio. Validar contra el limite VISIBLE, no el maximo.',
    textoPrincipal:{ maximo:500, visible:125 },
    titular:{ maximo:255, visible:40, visibleMovilChico:27 },
    descripcion:{ visible:30, opcional:true },
    archivo:{ formatos:['jpg','png'], maxMB:30, minLadoCortoPx:1080, minAnchoPx:600 },
    textoEnImagenPctMax:20
  },

  search: {
    keywordsPorGrupo:{ min:20, max:25 },
    concordancias:['exacta','frase'],
    concordanciaProhibida:'amplia',
    mezclaMinPorTipo:0.30,
    criterioAsignacion:{ 'exacta':'2-3 palabras, intencion precisa', 'frase':'4-5 palabras, cola larga' },
    negativasCampanaMin:5,
    competenciaProhibida:true,
    marcaPropia:'solo acompanada de producto o promocion',
    titulares:{ fijos:4, rotan:11, maxCaracteres:30, posicionesAncladas:[1,2,3,3] },
    descripciones:{ cantidad:4, maxCaracteres:90 },
    rutas:{ cantidad:2, maxCaracteres:15 },
    sitelinks:{ min:4, max:6, maxTexto:25, maxDescripcion:35 },
    exportacion:{ formato:'xlsx', cabecerasEn:'ingles', unaHojaPor:['keywords','anuncios','negativas'] }
  }
};

fs.writeFileSync('/home/user/simple-block-builder/mockups/flash-campaign-spec.json',
                 JSON.stringify(spec, null, 2));
console.log('spec generada ·', JSON.stringify(spec).length, 'bytes');
console.log('formatos display:', spec.formatos.display.length, '· facebook:', spec.formatos.facebook.length);
console.log('\nmuestra 300x250:'); console.log(JSON.stringify(spec.formatos.display[0], null, 1));
console.log('\nmuestra facebook 1080x1350:'); console.log(JSON.stringify(spec.formatos.facebook[0], null, 1));
