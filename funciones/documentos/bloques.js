/* ══════════════════════════════════════════════════════════════════
   DOCUMENTOS · BLOQUES  ·  funciones/documentos/bloques.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Registro BLOQUES (35 tipos) del editor de documentos: email y formato libre.
   QUIÉN LO USA: Email y Libre ya no se crean desde el Home; se conservan para abrir, editar y exportar las piezas guardadas.
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   BLOCKS
   ═══════════════════════════════════════════════════════════════ */
const BLOQUES = {
  header: {
    cat:"Estructura", nombre:"Header", icono:"", sub:"Logo + título + bajada",
    defaults: Object.assign({}, styleDefaults, { alinH:"center", padTop:"32", padBottom:"32", logoUrl:"", logoAncho:"160", mostrarEyebrow:false, eyebrow:"", titulo:"Título", bajada:"", tamanoTitulo:"26", tamanoBajada:"14", colorTitulo:"", colorBajada:"" }),
    campos: [
      {key:"logoUrl",label:"Logo / imagen (vacío = sin logo)",tipo:"imgurl"},
      {key:"logoAncho",label:"Ancho del logo (px)",tipo:"range",min:40,max:400,step:10},
      {key:"mostrarEyebrow",label:"Mostrar etiqueta superior",tipo:"check"},
      {key:"eyebrow",label:"Etiqueta",tipo:"text"},
      {key:"titulo",label:"Título",tipo:"text"},
      {key:"bajada",label:"Bajada (vacío = sin bajada)",tipo:"textarea"},
      {grupo:"Tamaños"},
      {tipo:"row2", izq:{key:"tamanoTitulo",label:"Título (px)",tipo:"range",min:14,max:60,step:1}, der:{key:"tamanoBajada",label:"Bajada (px)",tipo:"range",min:10,max:24,step:1}},
      {tipo:"row2", izq:{key:"colorTitulo",label:"Color título (vacío=tema)",tipo:"color"}, der:{key:"colorBajada",label:"Color bajada (vacío=tema)",tipo:"color"}},
      ...styleFields()
    ],
    render: (d) => {
      const ta = d.alinH || "center";
      const inner = `<div class="sbb-header" style="text-align:${esc(ta)};">
        ${d.logoUrl ? `<img src="${esc(d.logoUrl)}" alt="Logo" style="width:${esc(d.logoAncho)}px;margin:${ta==="center"?"0 auto 14px":ta==="right"?"0 0 14px auto":"0 0 14px"};">` : ""}
        ${d.mostrarEyebrow && d.eyebrow ? `<p class="eyebrow">${esc(d.eyebrow)}</p>` : ""}
        <h1 style="font-size:${esc(d.tamanoTitulo)}px;${d.colorTitulo?`color:${esc(d.colorTitulo)};`:""}">${esc(d.titulo)}</h1>
        ${d.bajada ? `<p style="font-size:${esc(d.tamanoBajada)}px;${d.colorBajada?`color:${esc(d.colorBajada)};`:""}">${esc(d.bajada)}</p>` : ""}
      </div>`;
      return wrap(d, inner);
    }
  },
  texto: {
    cat:"Contenido", nombre:"Texto", icono:"", sub:"Párrafo con título opcional",
    defaults: Object.assign({}, styleDefaults, { alinH:"left", titulo:"", contenido:"Texto", tamano:"14", color:"", negrita:false, italica:false }),
    campos: [
      {key:"titulo",label:"Título (opcional)",tipo:"text"},
      {key:"contenido",label:"Contenido",tipo:"textarea"},
      {tipo:"mergetag"},
      {grupo:"Estilo"},
      {key:"tamano",label:"Tamaño (px)",tipo:"range",min:10,max:60,step:1},
      {key:"color",label:"Color del texto (vacío = tema)",tipo:"color"},
      {tipo:"row2", izq:{key:"negrita",label:"Negrita",tipo:"check"}, der:{key:"italica",label:"Itálica",tipo:"check"}},
      ...styleFields()
    ],
    render: (d) => wrap(d, `<div class="sbb-texto" style="font-size:${esc(d.tamano)}px;text-align:${esc(d.alinH)};${d.color?`color:${esc(d.color)};`:""}${d.negrita?"font-weight:600;":""}${d.italica?"font-style:italic;":""}">${d.titulo?`<h2 data-edit="titulo" data-linea="1">${esc(d.titulo)}</h2>`:""}<div data-edit="contenido">${escMultiline(d.contenido)}</div></div>`)
  },
  heading: {
    cat:"Contenido", nombre:"Encabezado", icono:"", sub:"Título H1 / H2 / H3",
    defaults: Object.assign({}, styleDefaults, { alinH:"left", padTop:"10", padBottom:"6", nivel:"h2", texto:"Escribe un título", tamano:"", color:"" }),
    campos: [
      {key:"texto",label:"Texto del encabezado",tipo:"text"},
      {key:"nivel",label:"Nivel (jerarquía del título)",tipo:"select",opciones:[["h1","Título 1 (H1) · 28px"],["h2","Título 2 (H2) · 22px"],["h3","Título 3 (H3) · 18px"]]},
      {grupo:"Estilo"},
      {key:"tamano",label:"Tamaño (px · vacío = automático por nivel)",tipo:"text",placeholder:"auto"},
      {key:"color",label:"Color (vacío = tema)",tipo:"color"},
      ...styleFields()
    ],
    render: (d) => {
      const nv = ["h1","h2","h3"].includes(d.nivel) ? d.nivel : "h2";
      const tam = (d.tamano && /^\d+$/.test(String(d.tamano))) ? d.tamano : (nv==="h1" ? "28" : nv==="h2" ? "22" : "18");
      return wrap(d, `<${nv} class="sbb-heading" data-edit="texto" data-linea="1" style="font-size:${tam}px;line-height:1.25;margin:0;font-weight:700;text-align:${esc(d.alinH)};${d.color?`color:${esc(d.color)};`:""}">${esc(d.texto)}</${nv}>`);
    }
  },
  video: {
    cat:"Contenido", nombre:"Video", icono:"", sub:"Miniatura de YouTube con Play",
    defaults: Object.assign({}, styleDefaults, { padLeft:"0", padRight:"0", url:"", titulo:"" }),
    campos: [
      {key:"url",label:"Enlace del video (YouTube)",tipo:"text",placeholder:"https://www.youtube.com/watch?v=…"},
      {key:"titulo",label:"Texto bajo el video (opcional)",tipo:"text"},
      ...styleFields()
    ],
    render: (d) => {
      const m = String(d.url||"").match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
      const id = m ? m[1] : "";
      const inner = id
        ? `<a href="${esc(d.url)}" target="_blank" rel="noopener" class="sbb-video" style="display:block;position:relative;line-height:0;"><img src="https://img.youtube.com/vi/${esc(id)}/hqdefault.jpg" alt="${esc(d.titulo||"Ver video")}" style="width:100%;display:block;"><span class="sbb-video-play"></span></a>`
        : `<div class="sbb-video-vacio">Pega un enlace de YouTube y aquí aparecerá la miniatura con su botón de Play, enlazada al video real</div>`;
      return wrap(d, inner + (d.titulo ? `<div class="sbb-video-cap" data-edit="titulo">${esc(d.titulo)}</div>` : ""));
    }
  },
  imagen: {
    cat:"Contenido", nombre:"Imagen", icono:"", sub:"Imagen ajustable",
    defaults: Object.assign({}, styleDefaults, { url:"https://placehold.co/600x300/e5e7ea/9ca3af?text=Imagen", alt:"", link:"", caption:"", anchoImg:"100", radio:"0", aspecto:"", zoom:"100", altoImg:"", posicion:"center" }),
    campos: [
      {key:"url",label:"URL de la imagen",tipo:"imgurl"},
      {key:"alt",label:"Texto alternativo",tipo:"text"},
      {key:"link",label:"Enlace (opcional)",tipo:"text"},
      {key:"caption",label:"Pie de imagen (opcional)",tipo:"text"},
      {tipo:"row2", izq:{key:"anchoImg",label:"Ancho (%)",tipo:"range",min:20,max:100,step:5}, der:{key:"radio",label:"Radio (px)",tipo:"range",min:0,max:40,step:1}},
      {key:"aspecto",label:"Forma / relación de aspecto",tipo:"select",opciones:[["","Original (sin recorte)"],["16/9","Apaisado 16:9"],["3/2","Foto 3:2"],["4/3","Clásico 4:3"],["1/1","Cuadrado 1:1"],["4/5","Vertical 4:5"],["9/16","Alto (story) 9:16"]]},
      {tipo:"row2", izq:{key:"zoom",label:"Acercar / Zoom (%)",tipo:"range",min:100,max:300,step:5}, der:{key:"posicion",label:"Qué parte se ve (foco)",tipo:"select",opciones:[["center","Centro"],["top","Arriba"],["bottom","Abajo"],["left","Izquierda"],["right","Derecha"],["top left","Arriba-izq"],["top right","Arriba-der"],["bottom left","Abajo-izq"],["bottom right","Abajo-der"]]}},
      {key:"altoImg",label:"Alto fijo (px · opcional · vacío=usa la forma)",tipo:"text",placeholder:"auto"},
      ...styleFields()
    ],
    render: (d) => {
      const foco = d.posicion || "center";
      const zoom = Math.max(100, Math.min(400, parseFloat(d.zoom)||100))/100;
      const radio = `border-radius:${esc(d.radio)}px;`;
      const ratio = (d.aspecto && /^\d+\/\d+$/.test(d.aspecto)) ? d.aspecto : "";
      const imgIn = `<img src="${esc(d.url)}" alt="${esc(d.alt)}" data-edit-img="url" title="Clic para cambiar la imagen" style="width:100%;height:100%;object-fit:cover;object-position:${esc(foco)};transform:scale(${zoom});transform-origin:${esc(foco)};display:block;">`;
      let media;
      if(ratio){
        media = `<div style="width:${esc(d.anchoImg)}%;aspect-ratio:${ratio};overflow:hidden;${radio}display:inline-block;line-height:0;vertical-align:top;">${imgIn}</div>`;
      } else if(d.altoImg){
        media = `<div style="width:${esc(d.anchoImg)}%;height:${esc(d.altoImg)}px;overflow:hidden;${radio}display:inline-block;line-height:0;vertical-align:top;">${imgIn}</div>`;
      } else {
        media = `<img src="${esc(d.url)}" alt="${esc(d.alt)}" data-edit-img="url" title="Clic para cambiar la imagen" style="width:${esc(d.anchoImg)}%;${radio}display:inline-block;">`;
      }
      const wrapped = d.link ? `<a href="${esc(d.link)}" target="_blank" rel="noopener">${media}</a>` : media;
      return wrap(d, `<div class="sbb-imagen" style="text-align:${esc(d.alinH||"center")};">${wrapped}${d.caption?`<div class="caption">${esc(d.caption)}</div>`:""}</div>`);
    }
  },
  cta: {
    cat:"Acción", nombre:"Botón CTA", icono:"", sub:"Botón con tamaño y hover",
    defaults: Object.assign({}, styleDefaults, { alinH:"center", padTop:"18", padBottom:"18", texto:"Botón", url:"", variante:"solido", colorFondo:"", colorTexto:"#ffffff", colorHover:"", anchoBoton:"auto", altoBoton:"auto", tamano:"14", padX:"28", padY:"13", radio:"0" }),
    campos: [
      {key:"texto",label:"Texto del botón",tipo:"text"},
      {key:"url",label:"URL de destino",tipo:"text"},
      {key:"variante",label:"Estilo del botón",tipo:"select",opciones:[["solido","Sólido (relleno)"],["outline","Outline (solo borde)"]]},
      {grupo:"Tamaño del botón"},
      {tipo:"row2", izq:{key:"anchoBoton",label:"Ancho",tipo:"text",placeholder:"auto"}, der:{key:"altoBoton",label:"Alto",tipo:"text",placeholder:"auto"}},
      {key:"tamano",label:"Tamaño de fuente (px)",tipo:"range",min:11,max:32,step:1},
      {tipo:"row2", izq:{key:"padX",label:"Padding X (px)",tipo:"range",min:6,max:80,step:2}, der:{key:"padY",label:"Padding Y (px)",tipo:"range",min:4,max:40,step:1}},
      {key:"radio",label:"Radio (px)",tipo:"range",min:0,max:40,step:1},
      {grupo:"Colores (vacío = tema)"},
      {tipo:"row2", izq:{key:"colorFondo",label:"Fondo",tipo:"color"}, der:{key:"colorTexto",label:"Texto",tipo:"color"}},
      {key:"colorHover",label:"Fondo al hover",tipo:"color"},
      ...styleFields()
    ],
    render: (d) => {
      const acento = d.colorFondo || getTema().ctaColor || getTema().primary;
      const outline = d.variante === "outline";
      const bg = outline ? "transparent" : acento;
      const col = outline ? acento : (d.colorTexto || "#ffffff");
      const hoverBg = outline ? acento : (d.colorHover || acento);
      const hoverCol = outline ? (d.colorTexto || "#ffffff") : col;
      const w = d.anchoBoton && d.anchoBoton !== "auto" ? `width:${esc(d.anchoBoton)};` : "";
      const h = d.altoBoton && d.altoBoton !== "auto" ? `min-height:${esc(d.altoBoton)};display:inline-flex;align-items:center;justify-content:center;` : "";
      return wrap(d, `<div class="sbb-cta" style="text-align:${esc(d.alinH||"center")};"><a href="${esc(d.url||"#")}" target="_blank" rel="noopener" data-edit="texto" data-linea="1" data-edit-link="url" title="Doble clic para editar el enlace" style="${w}${h}background:${esc(bg)};color:${esc(col)};border:2px solid ${esc(acento)};font-size:${esc(d.tamano)}px;padding:${esc(d.padY)}px ${esc(d.padX)}px;border-radius:${esc(d.radio)}px;transition:background .15s ease,color .15s ease;" onmouseover="this.style.background='${escAttr(hoverBg)}';this.style.color='${escAttr(hoverCol)}'" onmouseout="this.style.background='${escAttr(bg)}';this.style.color='${escAttr(col)}'">${esc(d.texto)}</a></div>`);
    }
  },
  imgtext: {
    cat:"Contenido", nombre:"Imagen + Texto", icono:"", sub:"Dos columnas",
    defaults: Object.assign({}, styleDefaults, { imagenUrl:"https://placehold.co/300x300/e5e7ea/9ca3af?text=Imagen", lado:"left", titulo:"Título", texto:"Texto", linkTexto:"", linkUrl:"", proporcionImg:"40", gapCol:"18", altoImg:"auto", radioImg:"0", aspectoImg:"", focoImg:"center", zoomImg:"100", alineacionTexto:"left", alineacionVertCol:"center", tamTitulo:"18", colorTitulo:"", tamTexto:"14", colorTexto:"" }),
    campos: [
      {key:"imagenUrl",label:"URL de la imagen",tipo:"text"},
      {tipo:"row2", izq:{key:"lado",label:"Posición imagen",tipo:"select",opciones:[["left","Izquierda"],["right","Derecha"]]}, der:{key:"proporcionImg",label:"Ancho col img (%)",tipo:"range",min:20,max:60,step:5}},
      {tipo:"row2", izq:{key:"altoImg",label:"Alto imagen",tipo:"text",placeholder:"auto"}, der:{key:"gapCol",label:"Espacio (px)",tipo:"range",min:0,max:60,step:2}},
      {key:"radioImg",label:"Radio de la imagen (px)",tipo:"range",min:0,max:40,step:1},
      ...camposProporcion(),
      {grupo:"Contenido"},
      {key:"titulo",label:"Título",tipo:"text"},
      {tipo:"row2", izq:{key:"tamTitulo",label:"Tamaño título (px)",tipo:"range",min:12,max:40,step:1}, der:{key:"colorTitulo",label:"Color título (vacío=tema)",tipo:"color"}},
      {key:"texto",label:"Texto (bajada)",tipo:"textarea"},
      {tipo:"row2", izq:{key:"tamTexto",label:"Tamaño texto (px)",tipo:"range",min:10,max:24,step:1}, der:{key:"colorTexto",label:"Color texto (vacío=tema)",tipo:"color"}},
      {tipo:"row2", izq:{key:"alineacionTexto",label:"Alineación texto",tipo:"alignH"}, der:{key:"alineacionVertCol",label:"Alineación vert",tipo:"alignV"}},
      {grupo:"Enlace (opcional)"},
      {key:"linkTexto",label:"Texto enlace",tipo:"text"},
      {key:"linkUrl",label:"URL",tipo:"text"},
      ...styleFields()
    ],
    render: (d) => {
      const gap = d.gapCol ? `gap:${esc(d.gapCol)}px;` : "";
      const stT = `font-size:${esc(d.tamTitulo||18)}px;${d.colorTitulo?`color:${esc(d.colorTitulo)};`:""}`;
      const stP = `font-size:${esc(d.tamTexto||14)}px;${d.colorTexto?`color:${esc(d.colorTexto)};`:""}`;
      const media = imgProporcion({ url:d.imagenUrl, alt:"", ancho:"100", aspecto:d.aspectoImg, zoom:d.zoomImg, foco:d.focoImg, radio:d.radioImg, alto:(d.altoImg&&d.altoImg!=="auto"?d.altoImg:""), editKey:"imagenUrl" });
      return wrap(d, `<div class="sbb-img-text${d.lado==="right"?" right":""}" style="align-items:${justifyV(d.alineacionVertCol||d.alinV)};${gap}"><div class="col-img" style="flex:0 0 ${esc(d.proporcionImg)}%;">${media}</div><div class="col-text" style="text-align:${esc(d.alineacionTexto||"left")};">${d.titulo?`<h3 data-edit="titulo" data-linea="1" style="${stT}">${esc(d.titulo)}</h3>`:""}${d.texto?`<p data-edit="texto" style="${stP}">${escMultiline(d.texto)}</p>`:""}${d.linkTexto && d.linkUrl?`<a href="${esc(d.linkUrl)}" target="_blank" rel="noopener" data-edit="linkTexto" data-linea="1" data-edit-link="linkUrl" title="Doble clic para editar el enlace">${esc(d.linkTexto)}</a>`:""}</div></div>`);
    }
  },
  divisor: {
    cat:"Estructura", nombre:"Divisor", icono:"", sub:"Línea horizontal",
    defaults: Object.assign({}, styleDefaults, { padTop:"12", padBottom:"12", color:"#e5e7ea", grosor:"1", estilo:"solid", anchoLinea:"100" }),
    campos: [
      {tipo:"row2", izq:{key:"color",label:"Color",tipo:"color"}, der:{key:"grosor",label:"Grosor (px)",tipo:"range",min:1,max:10,step:1}},
      {key:"estilo",label:"Estilo",tipo:"select",opciones:[["solid","Sólido"],["dashed","Discontinuo"],["dotted","Punteado"]]},
      {key:"anchoLinea",label:"Ancho de la línea (% · menos de 100 queda centrada)",tipo:"range",min:20,max:100,step:5},
      ...styleFields({h:false,v:false})
    ],
    render: (d) => { const wl = (d.anchoLinea && /^\d+$/.test(String(d.anchoLinea)) && parseInt(d.anchoLinea)<100) ? `width:${parseInt(d.anchoLinea)}%;margin-left:auto;margin-right:auto;` : "";
      return wrap(d, `<div class="sbb-divisor"><hr style="${wl}border-top-color:${esc(d.color)};border-top-width:${esc(d.grosor)}px;border-top-style:${esc(d.estilo)};"></div>`); }
  },
  espaciador: {
    cat:"Estructura", nombre:"Espaciador", icono:"", sub:"Espacio en blanco",
    defaults: Object.assign({}, styleDefaults, { padTop:"0", padBottom:"0", padLeft:"0", padRight:"0", altoEsp:"40" }),
    campos: [
      {key:"altoEsp",label:"Alto del espacio (px)",tipo:"range",min:0,max:200,step:4},
      ...styleFields({h:false,v:false})
    ],
    render: (d) => wrap(d, `<div class="sbb-spacer" style="height:${esc(d.altoEsp)}px;"></div>`)
  },

  diadivisor: {
    cat:"Agenda", nombre:"Día divisor", icono:"", sub:"Pill o card con fecha",
    defaults: Object.assign({}, styleDefaults, { alinH:"center", padTop:"10", padBottom:"10",
      modo:"texto", texto:"Lunes, 27 de abril",
      fechaIso:"", formatoFecha:"largo",
      colorFondo:"", colorTexto:"#ffffff", radio:"10", tamano:"15", padInternoX:"18", padInternoY:"10", anchoCompleto:false }),
    campos: [
      {key:"modo",label:"Modo",tipo:"select",opciones:[["texto","Texto manual"],["fecha","Desde fecha (auto-formato)"]]},
      {key:"texto",label:"Texto manual",tipo:"text"},
      {key:"fechaIso",label:"Fecha (si modo = fecha)",tipo:"date"},
      {key:"formatoFecha",label:"Formato",tipo:"select",opciones:[["completo","Lunes, 27 de abril de 2026"],["largo","Lunes, 27 de abril"],["corto","27 abr 2026"],["numerico","27/04/2026"]]},
      {grupo:"Estilo"},
      {tipo:"row2", izq:{key:"colorFondo",label:"Fondo (vacío = tema)",tipo:"color"}, der:{key:"colorTexto",label:"Texto",tipo:"color"}},
      {tipo:"row2", izq:{key:"tamano",label:"Tamaño fuente (px)",tipo:"range",min:11,max:24,step:1}, der:{key:"radio",label:"Radio (px)",tipo:"range",min:0,max:40,step:1}},
      {tipo:"row2", izq:{key:"padInternoX",label:"Padding X interno",tipo:"range",min:6,max:60,step:2}, der:{key:"padInternoY",label:"Padding Y interno",tipo:"range",min:4,max:40,step:2}},
      {key:"anchoCompleto",label:"Ancho completo (banda)",tipo:"check"},
      ...styleFields({v:false})
    ],
    render: (d) => {
      const fondo = d.colorFondo || getTema().primary;
      const txt = d.modo === "fecha" && d.fechaIso ? formatearFecha(d.fechaIso, d.formatoFecha) : (d.texto || "Día");
      const ancho = d.anchoCompleto ? "display:block;width:100%;" : "display:inline-flex;";
      const inner = `<div class="sbb-divisor-dia" style="${ancho}background:${esc(fondo)};color:${esc(d.colorTexto)};border-radius:${esc(d.radio)}px;padding:${esc(d.padInternoY)}px ${esc(d.padInternoX)}px;font-size:${esc(d.tamano)}px;${d.anchoCompleto?"text-align:center;justify-content:center;":""}">
        <span class="dot"></span><span>${esc(txt)}</span>
      </div>`;
      return wrap(d, inner);
    }
  },

  fechaCard: {
    cat:"Agenda", nombre:"Fecha destacada", icono:"", sub:"Calendar card",
    defaults: Object.assign({}, styleDefaults, { fechaIso:"", titulo:"" }),
    campos: [
      {key:"fechaIso",label:"Fecha",tipo:"date"},
      {key:"titulo",label:"Título arriba (opcional)",tipo:"text"},
      ...styleFields()
    ],
    render: (d) => {
      const iso = d.fechaIso;
      let mes="MES", dia="--", dow="Día", anio="";
      if(iso){
        const dt = new Date(iso + (iso.length===10?"T00:00":""));
        if(!isNaN(dt.getTime())){
          mes = MESES_ES[dt.getMonth()].toUpperCase();
          dia = String(dt.getDate());
          dow = DIAS_ES[dt.getDay()];
          dow = dow.charAt(0).toUpperCase() + dow.slice(1);
          anio = String(dt.getFullYear());
        }
      }
      const inner = `<div class="sbb-fecha-card">
        <div class="mes">${esc(d.titulo||mes)}</div>
        <div class="dia">${esc(dia)}</div>
        <div class="dia-semana">${esc(dow)}</div>
        ${anio?`<div class="anio">${esc(anio)}</div>`:""}
      </div>`;
      return wrap(d, inner);
    }
  },

  evento: {
    cat:"Agenda", nombre:"Evento (cita)", icono:"", sub:"Card con hora, título, acciones",
    defaults: Object.assign({}, styleDefaults, { padTop:"6", padBottom:"6", principal:false, mostrarHora:true, horaInicio:"00:00", horaFin:"", titulo:"Evento", mostrarTag:false, tag:"", mostrarParticipantes:false, participantes:"", mostrarDireccion:false, direccion:"", acciones:[], mostrarNota:false, notaTitulo:"Nota", nota:"" }),
    campos: [
      {key:"principal",label:"Destacado",tipo:"check"},
      {grupo:"Hora"},
      {key:"mostrarHora",label:"Mostrar columna de hora",tipo:"check"},
      {tipo:"row2", izq:{key:"horaInicio",label:"Hora inicio",tipo:"time"}, der:{key:"horaFin",label:"Hora fin (vacío = única)",tipo:"time"}},
      {grupo:"Contenido"},
      {key:"titulo",label:"Título del evento",tipo:"text"},
      {key:"mostrarTag",label:"Mostrar etiqueta de lugar",tipo:"check"},
      {key:"tag",label:"Etiqueta",tipo:"text"},
      {key:"mostrarParticipantes",label:"Mostrar participantes",tipo:"check"},
      {key:"participantes",label:"Participantes",tipo:"text"},
      {key:"mostrarDireccion",label:"Mostrar dirección",tipo:"check"},
      {key:"direccion",label:"Dirección",tipo:"text"},
      {grupo:"Acciones (botones)"},
      {key:"acciones",label:"Lista de acciones",tipo:"lista",itemTipos:[
        {valor:"mapa",label:"Mapa",camposItem:[{k:"label",l:"Texto"},{k:"url",l:"URL Maps"}]},
        {valor:"telefono",label:"Teléfono",camposItem:[{k:"label",l:"Texto"},{k:"url",l:"Número"}]},
        {valor:"whatsapp",label:"WhatsApp",camposItem:[{k:"label",l:"Texto"},{k:"url",l:"URL wa.me"}]},
        {valor:"email",label:"Email",camposItem:[{k:"label",l:"Texto"},{k:"url",l:"Dirección email"}]},
        {valor:"link",label:"Enlace",camposItem:[{k:"label",l:"Texto"},{k:"url",l:"URL"}]},
        {valor:"documento",label:"Documento",camposItem:[{k:"label",l:"Texto"},{k:"url",l:"URL del archivo"}]}
      ]},
      {grupo:"Nota"},
      {key:"mostrarNota",label:"Mostrar nota",tipo:"check"},
      {key:"notaTitulo",label:"Título nota",tipo:"text"},
      {key:"nota",label:"Texto",tipo:"textarea"},
      ...styleFields({v:false})
    ],
    render: (d) => {
      const horaTxt = d.horaFin ? `${esc(d.horaInicio)} – ${esc(d.horaFin)}` : esc(d.horaInicio);
      const ICOS = {mapa:"mapa",telefono:"telefono",whatsapp:"whatsapp",email:"email",link:"enlace",documento:"documento"};
      const acciones = (d.acciones||[]).map(a => {
        const url = a.tipo==="telefono"?`tel:${esc(a.url)}`:a.tipo==="email"?`mailto:${esc(a.url)}`:esc(a.url||"#");
        return `<a class="ev-action" href="${url}" target="_blank" rel="noopener"><span class="ev-ico">${svgIcon(ICOS[a.tipo]||"enlace",{size:"1em"})}</span>${esc(a.label||"")}</a>`;
      }).join("");
      const showHora = d.mostrarHora && d.horaInicio;
      return wrap(d, `<article class="sbb-evento${d.principal?" principal":""}"><div class="ev-row${showHora?"":" no-time"}">${showHora?`<div class="ev-time">${horaTxt}</div>`:""}<div class="ev-content"><div class="ev-header"><h3>${esc(d.titulo)}</h3>${d.mostrarTag&&d.tag?`<span class="ev-tag">${esc(d.tag)}</span>`:""}</div>${d.mostrarParticipantes&&d.participantes?`<div class="ev-meta">${esc(d.participantes)}</div>`:""}${d.mostrarDireccion&&d.direccion?`<div class="ev-address">${esc(d.direccion)}</div>`:""}${acciones?`<div class="ev-actions">${acciones}</div>`:""}${d.mostrarNota&&d.nota?`<div class="ev-note"><strong>${esc(d.notaTitulo||"Nota")}:</strong> ${esc(d.nota)}</div>`:""}</div></div></article>`);
    }
  },

  mapa: {
    cat:"Widgets", nombre:"Mapa", icono:"", sub:"OpenStreetMap interactivo",
    defaults: Object.assign({}, styleDefaults, { direccion:"", lat:"19.4326", lng:"-99.1332", zoom:"13", altoMapa:"260", mostrarLink:false, urlGoogleMaps:"" }),
    campos: [
      {key:"direccion",label:"Dirección visible",tipo:"text"},
      {grupo:"Coordenadas"},
      {tipo:"row2", izq:{key:"lat",label:"Latitud",tipo:"text"}, der:{key:"lng",label:"Longitud",tipo:"text"}},
      {tipo:"row2", izq:{key:"zoom",label:"Zoom",tipo:"range",min:3,max:18,step:1}, der:{key:"altoMapa",label:"Alto (px)",tipo:"range",min:120,max:600,step:10}},
      {key:"mostrarLink",label:"Mostrar 'Abrir en Google Maps'",tipo:"check"},
      {key:"urlGoogleMaps",label:"URL Google Maps",tipo:"text"},
      ...styleFields()
    ],
    render: (d) => {
      const lat = parseFloat(d.lat)||0, lng = parseFloat(d.lng)||0, zoom = parseInt(d.zoom)||13;
      const offset = 0.005 * Math.pow(2, 15-zoom);
      const bbox = `${lng-offset},${lat-offset},${lng+offset},${lat+offset}`;
      const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
      return wrap(d, `<div class="sbb-mapa"><div class="mapa-frame" style="height:${esc(d.altoMapa)}px;"><iframe src="${src}" loading="lazy" style="height:${esc(d.altoMapa)}px;"></iframe></div>${d.direccion?`<div class="direccion">${esc(d.direccion)}</div>`:""}${d.mostrarLink&&d.urlGoogleMaps?`<div style="text-align:center;"><a class="link-mapa" href="${esc(d.urlGoogleMaps)}" target="_blank" rel="noopener">${svgIcon("pin",{size:"13px"})} Abrir en Google Maps</a></div>`:""}</div>`);
    }
  },

  clima: {
    cat:"Widgets", nombre:"Clima", icono:"", sub:"Tarjeta tipo iOS Weather",
    defaults: Object.assign({}, styleDefaults, { ciudad:"Ciudad", temperatura:"22", unidad:"°C", descripcion:"Despejado", icono:"sol", tema:"dia", mostrarExtra:false, sensacion:"22", humedad:"60", viento:"8" }),
    campos: [
      {key:"ciudad",label:"Ciudad",tipo:"text"},
      {tipo:"row2", izq:{key:"temperatura",label:"Temperatura",tipo:"text"}, der:{key:"unidad",label:"Unidad",tipo:"select",opciones:[["°C","°C"],["°F","°F"],["°","°"]]}},
      {key:"descripcion",label:"Descripción",tipo:"text"},
      {key:"icono",label:"Ícono",tipo:"select",opciones:[["sol","Sol"],["climaico","Parcial"],["nube","Nublado"],["lluvia","Lluvia"],["nieve","Nieve"],["tormenta","Tormenta"]]},
      {key:"tema",label:"Tema",tipo:"select",opciones:[["dia","Día (azul cielo)"],["noche","Noche (azul oscuro)"],["atardecer","Atardecer (naranja-violeta)"],["lluvia","Lluvia (gris)"]]},
      {grupo:"Datos extra (opcional)"},
      {key:"mostrarExtra",label:"Mostrar fila inferior (sensación, humedad, viento)",tipo:"check"},
      {tipo:"row2", izq:{key:"sensacion",label:"Sensación",tipo:"text"}, der:{key:"humedad",label:"Humedad %",tipo:"text"}},
      {key:"viento",label:"Viento (km/h)",tipo:"text"},
      ...styleFields()
    ],
    render: (d) => {
      const temaCls = d.tema && d.tema !== "dia" ? ` ${esc(d.tema)}` : "";
      const extra = d.mostrarExtra ? `<div class="extra"><div><div class="lbl">Sensación</div><div class="val">${esc(d.sensacion)}${esc(d.unidad)}</div></div><div><div class="lbl">Humedad</div><div class="val">${esc(d.humedad)}%</div></div><div><div class="lbl">Viento</div><div class="val">${esc(d.viento)} km/h</div></div></div>` : "";
      return wrap(d, `<div class="sbb-clima${temaCls}"><div class="row1"><div><div class="ciudad">${esc(d.ciudad)}</div><div class="desc">${esc(d.descripcion)}</div></div><div class="icon">${svgIcon(d.icono||"sol",{size:"2.6em"})}</div></div><div class="temp">${esc(d.temperatura)}${esc(d.unidad)}</div>${extra}</div>`);
    }
  },

  reloj: {
    cat:"Widgets", nombre:"Reloj en vivo", icono:"", sub:"Hora actual (auto-actualiza)",
    defaults: Object.assign({}, styleDefaults, { label:"Hora actual", mostrarSegundos:true, mostrarFecha:true, formato24:true, zonaHoraria:"" }),
    campos: [
      {key:"label",label:"Etiqueta superior",tipo:"text"},
      {tipo:"row2", izq:{key:"mostrarSegundos",label:"Mostrar segundos",tipo:"check"}, der:{key:"formato24",label:"Formato 24h",tipo:"check"}},
      {key:"mostrarFecha",label:"Mostrar fecha debajo",tipo:"check"},
      {grupo:"Aviso"},
      ...styleFields()
    ],
    render: (d) => {
      const id = "rel-"+uid();
      return wrap(d, `<div class="sbb-reloj" data-reloj data-segundos="${d.mostrarSegundos?"1":"0"}" data-fecha="${d.mostrarFecha?"1":"0"}" data-h24="${d.formato24?"1":"0"}" id="${id}"><div class="label">${esc(d.label||"Hora actual")}</div><div class="hora">--<span class="sep">:</span>--</div>${d.mostrarFecha?`<div class="fecha">cargando...</div>`:""}</div>`);
    }
  },

  countdown: {
    cat:"Widgets", nombre:"Cuenta regresiva", icono:"", sub:"Faltan tantos días/horas",
    defaults: Object.assign({}, styleDefaults, { label:"Faltan", fechaIso: new Date(Date.now()+7*24*60*60*1000).toISOString().slice(0,16), mostrarSegundos:false, mostrarFechaObjetivo:true }),
    campos: [
      {key:"label",label:"Texto antes de la cuenta",tipo:"text"},
      {key:"fechaIso",label:"Fecha y hora objetivo",tipo:"datetime-local"},
      {tipo:"row2", izq:{key:"mostrarSegundos",label:"Mostrar segundos",tipo:"check"}, der:{key:"mostrarFechaObjetivo",label:"Mostrar fecha abajo",tipo:"check"}},
      ...styleFields()
    ],
    render: (d) => {
      let diff = Math.max(0, new Date(d.fechaIso).getTime() - Date.now());
      const dias = Math.floor(diff/86400000); diff -= dias*86400000;
      const hrs = Math.floor(diff/3600000); diff -= hrs*3600000;
      const mins = Math.floor(diff/60000); diff -= mins*60000;
      const segs = Math.floor(diff/1000);
      const segHtml = d.mostrarSegundos?`<div class="unit"><div class="num">${String(segs).padStart(2,"0")}</div><div class="uname">Seg</div></div>`:"";
      const fechaTxt = d.mostrarFechaObjetivo && d.fechaIso ? formatearFecha(d.fechaIso, "completo") : "";
      return wrap(d, `<div class="sbb-countdown" data-countdown data-target="${esc(d.fechaIso)}" data-segundos="${d.mostrarSegundos?"1":"0"}"><div class="label">${esc(d.label)}</div><div class="digits"><div class="unit"><div class="num">${String(dias).padStart(2,"0")}</div><div class="uname">Días</div></div><div class="unit"><div class="num">${String(hrs).padStart(2,"0")}</div><div class="uname">Hrs</div></div><div class="unit"><div class="num">${String(mins).padStart(2,"0")}</div><div class="uname">Min</div></div>${segHtml}</div>${fechaTxt?`<div class="target-date">${esc(fechaTxt)}</div>`:""}</div>`);
    }
  },

  formulario: {
    cat:"Widgets", nombre:"Formulario", icono:"", sub:"Embed o link a form",
    defaults: Object.assign({}, styleDefaults, { modo:"link", url:"", titulo:"Completa el formulario", descripcion:"Tu opinión nos ayuda a mejorar.", icono:"formularioico", textoBoton:"Abrir formulario", altoIframe:"500" }),
    campos: [
      {key:"modo",label:"Modo",tipo:"select",opciones:[["link","Card con enlace (funciona en email)"],["embed","Embeber con iframe (Typeform, Google Forms — solo web)"]]},
      {key:"url",label:"URL del formulario",tipo:"text"},
      {grupo:"Modo: Card con enlace"},
      {key:"icono",label:"Ícono",tipo:"icono-picker"},
      {key:"titulo",label:"Título",tipo:"text"},
      {key:"descripcion",label:"Descripción",tipo:"textarea"},
      {key:"textoBoton",label:"Texto del botón",tipo:"text"},
      {grupo:"Modo: Embed"},
      {key:"altoIframe",label:"Alto del iframe (px)",tipo:"range",min:200,max:1000,step:20},
      ...styleFields()
    ],
    render: (d) => {
      if(d.modo === "embed"){
        return wrap(d, `<div class="sbb-form-iframe"><iframe src="${esc(d.url||"about:blank")}" style="height:${esc(d.altoIframe)}px;" loading="lazy"></iframe></div>`);
      }
      return wrap(d, `<div class="sbb-form-card"><div class="ico">${svgIcon(d.icono||"formularioico",{size:"30px"})}</div><h3>${esc(d.titulo)}</h3>${d.descripcion?`<p>${escMultiline(d.descripcion)}</p>`:""}<a href="${esc(d.url||"#")}" target="_blank" rel="noopener">${esc(d.textoBoton)}</a></div>`);
    }
  },

  social: {
    cat:"Widgets", nombre:"Redes sociales", icono:"", sub:"Íconos line, sin fondo",
    defaults: Object.assign({}, styleDefaults, { redes:[
      {tipo:"instagram",url:""}, {tipo:"facebook",url:""}, {tipo:"linkedin",url:""}
    ], estilo:"outline", color:"", tamano:"24", grosor:"2", separacion:"14" }),
    campos: [
      {key:"redes",label:"Redes",tipo:"lista",itemTipos:[
        {valor:"instagram",label:"Instagram",camposItem:[{k:"url",l:"URL"}]},
        {valor:"facebook",label:"Facebook",camposItem:[{k:"url",l:"URL"}]},
        {valor:"linkedin",label:"LinkedIn",camposItem:[{k:"url",l:"URL"}]},
        {valor:"twitter",label:"X / Twitter",camposItem:[{k:"url",l:"URL"}]},
        {valor:"youtube",label:"YouTube",camposItem:[{k:"url",l:"URL"}]},
        {valor:"tiktok",label:"TikTok",camposItem:[{k:"url",l:"URL"}]},
        {valor:"spotify",label:"Spotify",camposItem:[{k:"url",l:"URL"}]},
        {valor:"globo",label:"Sitio web",camposItem:[{k:"url",l:"URL"}]},
        {valor:"email",label:"Email",camposItem:[{k:"url",l:"Dirección email"}]},
        {valor:"whatsapp",label:"WhatsApp",camposItem:[{k:"url",l:"URL wa.me"}]}
      ]},
      {grupo:"Estilo"},
      {key:"estilo",label:"Estilo",tipo:"select",opciones:[["outline","Solo línea (sin fondo)"],["filled","Círculo de color"],["square","Cuadrado de color"]]},
      {tipo:"row2", izq:{key:"color",label:"Color (vacío = tema)",tipo:"color"}, der:{key:"tamano",label:"Tamaño (px)",tipo:"range",min:14,max:60,step:2}},
      {tipo:"row2", izq:{key:"grosor",label:"Grosor línea",tipo:"range",min:1,max:3,step:0.5}, der:{key:"separacion",label:"Separación (px)",tipo:"range",min:0,max:40,step:2}},
      ...styleFields()
    ],
    render: (d) => {
      const color = d.color || getTema().primary;
      const items = (d.redes||[]).filter(r => r.url).map(r => {
        const url = r.tipo === "email" ? `mailto:${esc(r.url)}` : esc(r.url);
        return `<a href="${url}" target="_blank" rel="noopener" style="color:${esc(color)};font-size:${esc(d.tamano)}px;">${svgIcon(r.tipo, {grosor:d.grosor})}</a>`;
      }).join("");
      const estiloCls = d.estilo || "outline";
      return wrap(d, `<div class="sbb-social ${esc(estiloCls)}" style="gap:${esc(d.separacion)}px;">${items||'<span style="color:#aaa;font-size:12px;">Agrega redes en el panel derecho</span>'}</div>`);
    }
  },

  icono: {
    cat:"Decoración", nombre:"Ícono", icono:"", sub:"SVG line icon (30+)",
    defaults: Object.assign({}, styleDefaults, {
      icono:"estrella", tamano:"40", color:"", grosor:"2",
      estilo:"outline", textoLado:"", url:"", imagenUrl:""
    }),
    campos: [
      {key:"icono",label:"Elegir ícono del banco",tipo:"icono-picker"},
      {key:"imagenUrl",label:"O usar imagen propia (URL · PNG o SVG)",tipo:"text"},
      {tipo:"row2", izq:{key:"tamano",label:"Tamaño (px)",tipo:"range",min:12,max:200,step:2}, der:{key:"grosor",label:"Grosor línea",tipo:"range",min:1,max:3,step:0.5}},
      {key:"color",label:"Color (vacío = tema)",tipo:"color"},
      {key:"estilo",label:"Estilo",tipo:"select",opciones:[["outline","Solo línea (sin fondo)"],["filled","Círculo de color"],["square","Cuadrado de color"]]},
      {grupo:"Texto al lado (opcional)"},
      {key:"textoLado",label:"Texto",tipo:"text"},
      {key:"url",label:"Enlace (URL, opcional)",tipo:"text"},
      ...styleFields()
    ],
    render: (d) => {
      const color = d.color || getTema().primary;
      const tam = d.tamano || "40";
      const ico = d.imagenUrl ? `<img src="${esc(d.imagenUrl)}" alt="" style="width:${esc(tam)}px;height:${esc(tam)}px;object-fit:contain;">` : svgIcon(d.icono, {grosor:d.grosor, size:tam+"px"});
      const wrapStyle = `color:${esc(color)};font-size:${esc(tam)}px;`;
      const wrapClass = `ico-wrap ${esc(d.estilo||"outline")}`;
      const inner = `<${d.url?'a href="'+esc(d.url)+'" target="_blank" rel="noopener"':'span'} class="sbb-icono-bloque" style="${wrapStyle}">
        <span class="${wrapClass}">${ico}</span>
        ${d.textoLado?`<span class="ico-label">${esc(d.textoLado)}</span>`:""}
      </${d.url?"a":"span"}>`;
      return wrap(d, inner);
    }
  },

  seccionlibre: {
    cat:"Estructura", nombre:"Sección (libre)", icono:"", sub:"Contenedor: agrega texto, foto, botón, formas",
    defaults: Object.assign({}, styleDefaults, { padTop:"24", padBottom:"24", bgBloque:"", nombreSec:"Sección", alinElem:"center", elementos:[
      { tipo:"texto", texto:"Tu texto aquí", tam:"16", color:"" },
      { tipo:"cta", texto:"Botón", url:"", colorFondo:"", colorTexto:"#ffffff" }
    ] }),
    campos: [
      {key:"nombreSec",label:"Nombre / identificador de la sección",tipo:"text"},
      {key:"alinElem",label:"Alineación de los elementos",tipo:"alignH"},
      {key:"elementos",label:"Elementos dentro de la sección",tipo:"lista",itemTipos:[
        {valor:"texto", label:"Texto", camposItem:[{k:"texto",l:"Texto",tipo:"textarea"},{k:"tam",l:"Tamaño (px)"},{k:"color",l:"Color (vacío=tema)"}]},
        {valor:"imagen", label:"Imagen", camposItem:[{k:"url",l:"URL de la imagen"},{k:"ancho",l:"Ancho (ej. 100%, 320px)"}]},
        {valor:"cta", label:"Botón (CTA)", camposItem:[{k:"texto",l:"Texto del botón"},{k:"url",l:"URL"},{k:"colorFondo",l:"Color fondo (vacío=tema)"},{k:"colorTexto",l:"Color texto"}]},
        {valor:"divisor", label:"Forma / divisor", camposItem:[{k:"color",l:"Color (vacío=tema)"},{k:"grosor",l:"Grosor (px)"}]},
        {valor:"espacio", label:"Espacio", camposItem:[{k:"alto",l:"Alto (px)"}]}
      ]},
      ...styleFields()
    ],
    render: (d) => {
      const ta = textAlignDe(d.alinElem);
      const items = (d.elementos||[]).map(it => {
        if(it.tipo === "texto"){
          const col = it.color ? `color:${esc(it.color)};` : "";
          return `<div style="font-size:${esc(it.tam||"16")}px;${col}margin:8px 0;">${escMultiline(it.texto||"")}</div>`;
        }
        if(it.tipo === "imagen"){
          const w = it.ancho ? `width:${esc(it.ancho)};` : "max-width:100%;";
          return `<div style="margin:8px 0;"><img src="${esc(it.url||"https://placehold.co/600x300/e5e7ea/9ca3af?text=Imagen")}" alt="" style="${w}max-width:100%;border-radius:8px;display:inline-block;"></div>`;
        }
        if(it.tipo === "cta"){
          const bg = it.colorFondo || (getTema().primary || "#1c73cb");
          const cl = it.colorTexto || "#ffffff";
          return `<div style="margin:12px 0;"><a href="${esc(it.url||"#")}" target="_blank" rel="noopener" style="display:inline-block;background:${esc(bg)};color:${esc(cl)};padding:12px 26px;border-radius:8px;font-weight:600;text-decoration:none;">${esc(it.texto||"Botón")}</a></div>`;
        }
        if(it.tipo === "divisor"){
          const col = it.color || "#e5e7ea";
          return `<hr style="border:none;border-top:${esc(it.grosor||"1")}px solid ${esc(col)};margin:14px 0;">`;
        }
        if(it.tipo === "espacio"){
          return `<div style="height:${esc(it.alto||"20")}px;"></div>`;
        }
        return "";
      }).join("");
      return wrap(d, `<div class="sbb-seccion" style="text-align:${ta};">${items || '<div style="color:#aaa;font-size:12px;">Agrega elementos en el panel de la derecha.</div>'}</div>`);
    }
  },

  codigo: {
    cat:"Avanzado", nombre:"Código HTML/CSS/JS", icono:"", sub:"Pega todo el código junto (HTML, CSS y JS)",
    defaults: Object.assign({}, styleDefaults, { codigo:"", padTop:"0", padBottom:"0", padLeft:"0", padRight:"0" }),
    campos: [
      {key:"codigo",label:"Pega aquí tu código (HTML con su <style> y <script>)",tipo:"codigo-textarea"},
      {key:"alto",label:"Alto del bloque (opcional · ej. 400px — útil para embeds/iframes)",tipo:"text",placeholder:"auto / 400px / 60vh"},
      ...styleFields()
    ],
    render: (d) => {
      // Un solo campo: se pega todo junto (HTML + <style> + <script>) y se lee tal cual.
      // Se conservan los campos antiguos (codigoHtml/Css/Js) por si una pieza los tuviera.
      const partes = [(d.codigo||""), (d.codigoCss?`<style>${d.codigoCss}</style>`:""), (d.codigoHtml||""), (d.codigoJs?`<script>${d.codigoJs}<\/script>`:"")];
      const cuerpo = partes.join("").trim();
      if(!cuerpo){
        return wrap(d, `<div class="sbb-codigo-vacio">${svgIcon("codigoico",{size:"15px"})} Bloque de código vacío. Pega tu HTML (con su CSS y JS) en el panel.</div>`);
      }
      return wrap(d, `<div class="sbb-codigo">${cuerpo}</div>`);
    }
  },

  tabla: {
    cat:"Datos", nombre:"Tabla", icono:"", sub:"Filas + columnas (pricing, datos)",
    defaults: Object.assign({}, styleDefaults, {
      padTop:"6", padBottom:"6",
      filasTexto:"Plan | Precio | Acción\nBásico | $9 | Empezar\nPro | $19 | Empezar\nPremium | $49 | Empezar",
      primeraFilaHeader:true, bordes:true, rayasAlternas:false,
      colorBorde:"#e5e7ea", colorHeaderFondo:"", colorHeaderTexto:"#ffffff",
      colorFondo:"#ffffff", colorTexto:"", radio:"0"
    }),
    campos: [
      {key:"filasTexto",label:"Filas (una por línea, celdas separadas por |)",tipo:"codigo-textarea"},
      {tipo:"row2", izq:{key:"primeraFilaHeader",label:"Primera fila como header",tipo:"check"}, der:{key:"bordes",label:"Mostrar bordes",tipo:"check"}},
      {key:"rayasAlternas",label:"Rayas alternas en filas",tipo:"check"},
      {grupo:"Colores"},
      {tipo:"row2", izq:{key:"colorFondo",label:"Fondo tabla",tipo:"color"}, der:{key:"colorTexto",label:"Texto (vacío = tema)",tipo:"color"}},
      {tipo:"row2", izq:{key:"colorHeaderFondo",label:"Fondo header (vacío = tema)",tipo:"color"}, der:{key:"colorHeaderTexto",label:"Texto header",tipo:"color"}},
      {tipo:"row2", izq:{key:"colorBorde",label:"Color borde",tipo:"color"}, der:{key:"radio",label:"Radio (px)",tipo:"range",min:0,max:24,step:1}},
      ...styleFields()
    ],
    render: (d) => {
      const filas = (d.filasTexto||"").split("\n").map(l => l.split("|").map(c => c.trim())).filter(r => r.length && r.some(c => c));
      const headerFondo = d.colorHeaderFondo || getTema().primary;
      const txtColor = d.colorTexto || "inherit";
      const cls = `sbb-tabla${d.bordes?" bordes":""}${d.rayasAlternas?" rayas":""}`;
      let head = "", body = "";
      filas.forEach((f, i) => {
        const cells = f.map(c => esc(c)).join("__SEP__");
        if (i === 0 && d.primeraFilaHeader) {
          head = `<thead><tr>${f.map(c => `<th style="background:${esc(headerFondo)};color:${esc(d.colorHeaderTexto)};border-color:${esc(d.colorBorde)};">${esc(c)}</th>`).join("")}</tr></thead>`;
        } else {
          body += `<tr>${f.map(c => `<td style="border-color:${esc(d.colorBorde)};">${esc(c)}</td>`).join("")}</tr>`;
        }
      });
      return wrap(d, `<div style="overflow:hidden;border-radius:${esc(d.radio)}px;background:${esc(d.colorFondo)};color:${esc(txtColor)};border:1px solid ${esc(d.colorBorde)};"><table class="${cls}">${head}<tbody>${body}</tbody></table></div>`);
    }
  },

  grid: {
    cat:"Estructura", nombre:"Grid (columnas y mosaicos)", icono:"", sub:"1-4 columnas · 1×2 · 1×3 · 2×2 · 3×3",
    defaults: Object.assign({}, styleDefaults, {
      padTop:"6", padBottom:"6",
      disposicion:"cols", columnas:"3", propGrid:"60", gap:"16", apilarMobile:true, alinearVert:"top",
      celdas:[]   // arranca vacío: el usuario elige qué bloque va en cada columna
    }),
    campos: [
      {key:"disposicion",label:"Disposición",tipo:"select",opciones:[["cols","Columnas (1-4 iguales)"],["1x2","1 grande + 2 al lado"],["1x3","1 grande + 3 al lado"],["2x2","Mosaico 2 × 2"],["3x3","Mosaico 3 × 3"]]},
      {tipo:"row2", izq:{key:"columnas",label:"Columnas (modo Columnas)",tipo:"select",opciones:[["1","1 columna"],["2","2 columnas"],["3","3 columnas"],["4","4 columnas"]]}, der:{key:"gap",label:"Gap (px)",tipo:"range",min:0,max:60,step:2}},
      {key:"propGrid",label:"Ancho de la parte grande / 1ª columna (%)",tipo:"range",min:30,max:80,step:5},
      {tipo:"row2", izq:{key:"alinearVert",label:"Alineación vertical",tipo:"select",opciones:[["top","Arriba"],["center","Centro"],["bottom","Abajo"]]}, der:{key:"apilarMobile",label:"Apilar en móvil",tipo:"check"}},
      {tipo:"gridCeldas"},
      ...styleFields()
    ],
    render: (d) => {
      const gap = parseInt(d.gap) || 16;
      const arr = d.celdas || [];
      const align = d.alinearVert==="center"?"center":d.alinearVert==="bottom"?"end":"start";
      const spec = gridSpec(d);
      // Muestra las celdas de la disposición; si hay MÁS con contenido, deja crecer.
      let ultLlena = -1; for(let i=0;i<arr.length;i++){ if(arr[i] && arr[i].tipo) ultLlena = i; }
      const n = Math.max(spec.cells, ultLlena+1);
      let html = "";
      for (let i = 0; i < n; i++) {
        const span = (spec.spans && spec.spans[i]) || "";
        html += `<div class="sbb-grid-cell" style="display:flex;flex-direction:column;justify-content:${align};${span}">${renderCeldaContenido(arr[i])}</div>`;
      }
      const stackCls = d.apilarMobile ? "stack-mobile" : "";
      return wrap(d, `<div class="sbb-grid ${stackCls}" style="${spec.tpl}gap:${gap}px;">${html}</div>`);
    }
  },

  kpi: {
    cat:"Datos", nombre:"Tarjeta KPI", icono:"", sub:"Número grande + tendencia",
    defaults: Object.assign({}, styleDefaults, { icono:"", numero:"1,258", label:"Total clicks", mostrarTrend:true, trendValor:"+12.5%", trendDireccion:"up", color:"#1a1a1a", colorFondo:"#ffffff", radio:"0" }),
    campos: [
      {key:"icono",label:"Ícono superior (opcional)",tipo:"icono-picker"},
      {key:"numero",label:"Número grande",tipo:"text"},
      {key:"label",label:"Etiqueta",tipo:"text"},
      {key:"mostrarTrend",label:"Mostrar tendencia",tipo:"check"},
      {tipo:"row2", izq:{key:"trendValor",label:"Texto tendencia",tipo:"text"}, der:{key:"trendDireccion",label:"Dirección",tipo:"select",opciones:[["up","Subiendo"],["down","Bajando"],["flat","Estable"]]}},
      {grupo:"Estilo"},
      {tipo:"row2", izq:{key:"colorFondo",label:"Fondo",tipo:"color"}, der:{key:"color",label:"Texto",tipo:"color"}},
      {key:"radio",label:"Radio (px)",tipo:"range",min:0,max:30,step:1},
      ...styleFields()
    ],
    render: (d) => {
      const tCls = d.trendDireccion || "up";
      const ar = svgIcon(tCls==="up"?"chevup":tCls==="down"?"chevdown":"flechader",{size:"0.85em"});
      return wrap(d, `<div class="sbb-kpi" style="background:${esc(d.colorFondo)};color:${esc(d.color)};border-radius:${esc(d.radio)}px;">${d.icono?`<span class="icon">${svgIcon(d.icono,{size:"22px"})}</span>`:""}<div class="num">${esc(d.numero)}</div><div class="lbl">${esc(d.label)}</div>${d.mostrarTrend?`<span class="trend ${tCls}">${ar} ${esc(d.trendValor)}</span>`:""}</div>`);
    }
  },

  ring: {
    cat:"Datos", nombre:"Anillo de progreso", icono:"", sub:"Gauge circular con %",
    defaults: Object.assign({}, styleDefaults, { valor:"65", label:"Performance", color:"", colorPista:"#f0f0f4", grosor:"12", tamano:"160" }),
    campos: [
      {key:"valor",label:"Valor (0-100)",tipo:"range",min:0,max:100,step:1},
      {key:"label",label:"Etiqueta",tipo:"text"},
      {tipo:"row2", izq:{key:"tamano",label:"Tamaño (px)",tipo:"range",min:80,max:300,step:10}, der:{key:"grosor",label:"Grosor línea",tipo:"range",min:4,max:30,step:1}},
      {tipo:"row2", izq:{key:"color",label:"Color (vacío = tema)",tipo:"color"}, der:{key:"colorPista",label:"Pista",tipo:"color"}},
      ...styleFields()
    ],
    render: (d) => {
      const v = Math.max(0, Math.min(100, parseInt(d.valor)||0));
      const tam = parseInt(d.tamano)||160;
      const gr = parseInt(d.grosor)||12;
      const r = Math.max(1, (tam/2) - gr);
      const circ = 2 * Math.PI * r;
      const offset = circ - (v/100)*circ;
      const color = d.color || getTema().primary;
      return wrap(d, `<div class="sbb-ring"><div class="ring-wrap" style="width:${tam}px;height:${tam}px;font-size:${tam*0.18}px;"><svg width="${tam}" height="${tam}"><circle cx="${tam/2}" cy="${tam/2}" r="${r}" fill="none" stroke="${esc(d.colorPista)}" stroke-width="${gr}"/><circle cx="${tam/2}" cy="${tam/2}" r="${r}" fill="none" stroke="${esc(color)}" stroke-width="${gr}" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"/></svg><span class="pct">${v}%</span></div>${d.label?`<div class="lbl">${esc(d.label)}</div>`:""}</div>`);
    }
  },

  statGrid: {
    cat:"Datos", nombre:"Grilla de stats", icono:"", sub:"Múltiples métricas en grid",
    defaults: Object.assign({}, styleDefaults, { columnas:"3", items:[ {num:"560",lbl:"Steps"}, {num:"120",lbl:"BPM"}, {num:"89",lbl:"Score"} ] }),
    campos: [
      {key:"columnas",label:"Columnas",tipo:"select",opciones:[["2","2 columnas"],["3","3 columnas"],["4","4 columnas"]]},
      {key:"items",label:"Stats",tipo:"lista",itemTipos:[{valor:"stat",label:"Stat",camposItem:[{k:"num",l:"Número"},{k:"lbl",l:"Etiqueta"}]}]},
      ...styleFields()
    ],
    render: (d) => {
      const cols = parseInt(d.columnas)||3;
      const items = (d.items||[]).map(it => `<div class="stat"><div class="num">${esc(it.num||"")}</div><div class="lbl">${esc(it.lbl||"")}</div></div>`).join("");
      return wrap(d, `<div class="sbb-stat-grid" style="grid-template-columns:repeat(${cols},1fr);">${items}</div>`);
    }
  },

  spark: {
    cat:"Datos", nombre:"Métrica con sparkline", icono:"", sub:"Número + mini gráfico",
    defaults: Object.assign({}, styleDefaults, { numero:"9956", label:"Total Progress", trendValor:"+38.69%", trendDireccion:"up", datos:"4,8,6,12,9,15,11,18,14,22,19,28,24,30", color:"" }),
    campos: [
      {key:"numero",label:"Número",tipo:"text"},
      {key:"label",label:"Etiqueta",tipo:"text"},
      {tipo:"row2", izq:{key:"trendValor",label:"Texto tendencia",tipo:"text"}, der:{key:"trendDireccion",label:"Dirección",tipo:"select",opciones:[["up","Subiendo"],["down","Bajando"]]}},
      {key:"datos",label:"Datos (números separados por coma)",tipo:"text"},
      {key:"color",label:"Color línea (vacío = tema)",tipo:"color"},
      ...styleFields()
    ],
    render: (d) => {
      const nums = (d.datos||"").split(",").map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
      const w = 200, h = 50;
      let path = "";
      if(nums.length > 1){
        const max = Math.max(...nums), min = Math.min(...nums), range = max-min || 1;
        path = nums.map((n,i) => {
          const x = (i / (nums.length-1)) * w;
          const y = h - ((n - min) / range) * h;
          return (i===0?"M":"L") + x.toFixed(1) + " " + y.toFixed(1);
        }).join(" ");
      }
      const color = d.color || getTema().primary;
      const tCls = d.trendDireccion || "up";
      const ar = svgIcon(tCls==="up"?"chevup":"chevdown",{size:"0.85em"});
      return wrap(d, `<div class="sbb-spark"><div class="top"><span class="num">${esc(d.numero)}</span><span class="trend ${tCls}">${ar} ${esc(d.trendValor)}</span></div><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="height:50px;"><path d="${path}" fill="none" stroke="${esc(color)}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="lbl">${esc(d.label)}</div></div>`);
    }
  },

  rating: {
    cat:"Datos", nombre:"Rating de estrellas", icono:"", sub:"5 estrellas + score",
    defaults: Object.assign({}, styleDefaults, { valor:"4.5", max:"5", reviews:"234 reviews" }),
    campos: [
      {tipo:"row2", izq:{key:"valor",label:"Valor",tipo:"text"}, der:{key:"max",label:"Máximo",tipo:"text"}},
      {key:"reviews",label:"Texto reviews",tipo:"text"},
      ...styleFields()
    ],
    render: (d) => {
      const v = parseFloat(d.valor)||0;
      const max = parseInt(d.max)||5;
      let stars = "";
      const estLlena = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
      const estVacia = svgIcon("estrella",{size:"1em"});
      for(let i=1; i<=max; i++) stars += (i-0.5<=v) ? `<span>${estLlena}</span>` : `<span class="empty">${estVacia}</span>`;
      return wrap(d, `<div class="sbb-rating"><div class="stars">${stars}</div><span class="num">${esc(d.valor)}</span>${d.reviews?`<span class="reviews">${esc(d.reviews)}</span>`:""}</div>`);
    }
  },

  product: {
    cat:"Cards", nombre:"Tarjeta de producto", icono:"", sub:"Imagen + nombre + precio + CTA",
    defaults: Object.assign({}, styleDefaults, {
      padTop:"6", padBottom:"6",
      imagenUrl:"https://placehold.co/600x400/e5e7ea/9ca3af?text=Producto", radioImg:"0", aspectoImg:"", focoImg:"center", zoomImg:"100",
      nombre:"Producto", descripcion:"Descripción corta", precio:"$0.00",
      ctaTexto:"Comprar", ctaUrl:"",
      alineacionTexto:"left", tamanoNombre:"15", tamanoPrecio:"15",
      colorFondo:"#ffffff", colorTexto:"", colorPrecio:""
    }),
    campos: [
      {key:"imagenUrl",label:"URL de la imagen",tipo:"text"},
      {key:"nombre",label:"Nombre",tipo:"text"},
      {key:"descripcion",label:"Descripción",tipo:"text"},
      {key:"precio",label:"Precio",tipo:"text"},
      {tipo:"row2", izq:{key:"ctaTexto",label:"Texto CTA",tipo:"text"}, der:{key:"ctaUrl",label:"URL CTA",tipo:"text"}},
      {grupo:"Estilo"},
      {key:"alineacionTexto",label:"Alineación texto",tipo:"alignH"},
      {tipo:"row2", izq:{key:"tamanoNombre",label:"Tamaño nombre (px)",tipo:"range",min:12,max:24,step:1}, der:{key:"tamanoPrecio",label:"Tamaño precio (px)",tipo:"range",min:12,max:30,step:1}},
      {key:"radioImg",label:"Radio de la imagen (px)",tipo:"range",min:0,max:40,step:1},
      ...camposProporcion(),
      {tipo:"row2", izq:{key:"colorFondo",label:"Fondo",tipo:"color"}, der:{key:"colorTexto",label:"Texto",tipo:"color"}},
      {key:"colorPrecio",label:"Color del precio (vacío=tema)",tipo:"color"},
      ...styleFields()
    ],
    render: (d) => {
      const colorPrecio = d.colorPrecio || getTema().primary;
      return wrap(d, `<div class="sbb-product" style="background:${esc(d.colorFondo)};color:${esc(d.colorTexto||"inherit")};text-align:${esc(d.alineacionTexto)};">${imgProporcion({url:d.imagenUrl,ancho:"100",aspecto:d.aspectoImg,zoom:d.zoomImg,foco:d.focoImg,radio:d.radioImg,editKey:"imagenUrl"})}<div class="body"><div class="head" style="justify-content:${d.alineacionTexto==="center"?"center":d.alineacionTexto==="right"?"flex-end":"space-between"};"><div class="name" style="font-size:${esc(d.tamanoNombre)}px;">${esc(d.nombre)}</div><div class="price" style="font-size:${esc(d.tamanoPrecio)}px;color:${esc(colorPrecio)};">${esc(d.precio)}</div></div>${d.descripcion?`<div class="desc">${esc(d.descripcion)}</div>`:""}${d.ctaTexto&&d.ctaUrl?`<a class="cta" href="${esc(d.ctaUrl)}" target="_blank" rel="noopener">${esc(d.ctaTexto)}</a>`:""}</div></div>`);
    }
  },

  profileCard: {
    cat:"Cards", nombre:"Tarjeta de perfil", icono:"", sub:"Avatar + nombre + stats + CTA",
    defaults: Object.assign({}, styleDefaults, { padTop:"6", padBottom:"6", avatarUrl:"https://placehold.co/96x96/e5e7ea/9ca3af?text=A", nombre:"Nombre", sub:"@usuario", mostrarCta:true, ctaTexto:"Seguir", ctaUrl:"", mostrarStats:true, stats:[ {num:"198",lbl:"Comentarios"}, {num:"389",lbl:"Personas"} ] }),
    campos: [
      {key:"avatarUrl",label:"URL del avatar",tipo:"text"},
      {key:"nombre",label:"Nombre",tipo:"text"},
      {key:"sub",label:"Subtítulo",tipo:"text"},
      {key:"mostrarCta",label:"Mostrar botón",tipo:"check"},
      {tipo:"row2", izq:{key:"ctaTexto",label:"Texto CTA",tipo:"text"}, der:{key:"ctaUrl",label:"URL CTA",tipo:"text"}},
      {key:"mostrarStats",label:"Mostrar stats al pie",tipo:"check"},
      {key:"stats",label:"Stats",tipo:"lista",itemTipos:[{valor:"stat",label:"Stat",camposItem:[{k:"num",l:"Número"},{k:"lbl",l:"Etiqueta"}]}]},
      ...styleFields()
    ],
    render: (d) => {
      const stats = d.mostrarStats && d.stats && d.stats.length ? `<div class="stats">${d.stats.map(s => `<div class="stat"><div class="num">${esc(s.num||"")}</div><div class="lbl">${esc(s.lbl||"")}</div></div>`).join("")}</div>` : "";
      return wrap(d, `<div class="sbb-profile"><div class="head"><img class="avatar" src="${esc(d.avatarUrl)}" alt=""><div class="who"><div class="name">${esc(d.nombre)}</div><div class="sub">${esc(d.sub)}</div></div>${d.mostrarCta?`<a class="cta" href="${esc(d.ctaUrl||"#")}" target="_blank" rel="noopener">${esc(d.ctaTexto)}</a>`:""}</div>${stats}</div>`);
    }
  },

  testimonial: {
    cat:"Cards", nombre:"Testimonio", icono:"", sub:"Cita + autor",
    defaults: Object.assign({}, styleDefaults, {
      padTop:"6", padBottom:"6",
      cita:"Escribe aquí la cita o testimonio del cliente.",
      avatarUrl:"https://placehold.co/72x72/e5e7ea/9ca3af?text=A",
      autor:"Nombre Apellido", cargo:"Cargo · Empresa",
      alineacionTexto:"left", tamanoCita:"14.5",
      colorFondo:"#ffffff", colorTexto:"", colorAcento:""
    }),
    campos: [
      {key:"cita",label:"Cita / testimonio",tipo:"textarea"},
      {key:"avatarUrl",label:"URL avatar",tipo:"text"},
      {tipo:"row2", izq:{key:"autor",label:"Nombre",tipo:"text"}, der:{key:"cargo",label:"Cargo · empresa",tipo:"text"}},
      {grupo:"Estilo"},
      {tipo:"row2", izq:{key:"alineacionTexto",label:"Alineación",tipo:"alignH"}, der:{key:"tamanoCita",label:"Tamaño cita (px)",tipo:"range",min:12,max:24,step:1}},
      {tipo:"row2", izq:{key:"colorFondo",label:"Fondo card",tipo:"color"}, der:{key:"colorTexto",label:"Texto (vacío=tema)",tipo:"color"}},
      {key:"colorAcento",label:"Acento (comilla, vacío=tema)",tipo:"color"},
      ...styleFields()
    ],
    render: (d) => {
      const colorAc = d.colorAcento || getTema().primary;
      return wrap(d, `<div class="sbb-testi" style="background:${esc(d.colorFondo)};color:${esc(d.colorTexto||"inherit")};text-align:${esc(d.alineacionTexto)};">
        <div class="quote" style="font-size:${esc(d.tamanoCita)}px;"><span style="color:${esc(colorAc)};">"</span>${escMultiline(d.cita)}</div>
        <div class="author" style="justify-content:${d.alineacionTexto==="center"?"center":d.alineacionTexto==="right"?"flex-end":"flex-start"};"><img class="avatar" src="${esc(d.avatarUrl)}" alt=""><div><div class="n">${esc(d.autor)}</div><div class="r">${esc(d.cargo)}</div></div></div>
      </div>`);
    }
  },

  article: {
    cat:"Cards", nombre:"Artículo / Post", icono:"", sub:"Imagen + título + lead + link",
    defaults: Object.assign({}, styleDefaults, {
      padTop:"6", padBottom:"6",
      imagenUrl:"https://placehold.co/600x320/e5e7ea/9ca3af?text=Imagen", radioImg:"0", aspectoImg:"", focoImg:"center", zoomImg:"100",
      categoria:"Categoría", titulo:"Título del artículo",
      lead:"Lead del artículo en una o dos líneas para generar interés.",
      linkTexto:"Leer más", linkUrl:"",
      alineacionTexto:"left", tamanoTitulo:"18", tamanoLead:"13",
      colorFondo:"#ffffff", colorTexto:"", colorCategoria:"", colorEnlace:""
    }),
    campos: [
      {key:"imagenUrl",label:"URL de la imagen",tipo:"text"},
      {key:"categoria",label:"Categoría / kicker",tipo:"text"},
      {key:"titulo",label:"Título",tipo:"text"},
      {key:"lead",label:"Lead",tipo:"textarea"},
      {tipo:"row2", izq:{key:"linkTexto",label:"Texto enlace",tipo:"text"}, der:{key:"linkUrl",label:"URL",tipo:"text"}},
      {grupo:"Estilo"},
      {key:"alineacionTexto",label:"Alineación",tipo:"alignH"},
      {tipo:"row2", izq:{key:"tamanoTitulo",label:"Tamaño título (px)",tipo:"range",min:14,max:36,step:1}, der:{key:"tamanoLead",label:"Tamaño lead (px)",tipo:"range",min:11,max:18,step:1}},
      {key:"radioImg",label:"Radio de la imagen (px)",tipo:"range",min:0,max:40,step:1},
      ...camposProporcion(),
      {tipo:"row2", izq:{key:"colorFondo",label:"Fondo",tipo:"color"}, der:{key:"colorTexto",label:"Texto",tipo:"color"}},
      {tipo:"row2", izq:{key:"colorCategoria",label:"Categoría (vacío=tema)",tipo:"color"}, der:{key:"colorEnlace",label:"Enlace (vacío=tema)",tipo:"color"}},
      ...styleFields()
    ],
    render: (d) => {
      const colorCat = d.colorCategoria || getTema().primary;
      const colorLink = d.colorEnlace || getTema().primary;
      return wrap(d, `<div class="sbb-article" style="background:${esc(d.colorFondo)};color:${esc(d.colorTexto||"inherit")};text-align:${esc(d.alineacionTexto)};">${imgProporcion({url:d.imagenUrl,ancho:"100",aspecto:d.aspectoImg,zoom:d.zoomImg,foco:d.focoImg,radio:d.radioImg,editKey:"imagenUrl"})}<div class="body">${d.categoria?`<div class="cat" style="color:${esc(colorCat)};">${esc(d.categoria)}</div>`:""}<h3 class="title" style="font-size:${esc(d.tamanoTitulo)}px;">${esc(d.titulo)}</h3>${d.lead?`<div class="lead" style="font-size:${esc(d.tamanoLead)}px;">${escMultiline(d.lead)}</div>`:""}${d.linkTexto&&d.linkUrl?`<a class="more" href="${esc(d.linkUrl)}" target="_blank" rel="noopener" style="color:${esc(colorLink)};">${esc(d.linkTexto)}</a>`:""}</div></div>`);
    }
  },

  pricing: {
    cat:"Cards", nombre:"Plan de precios", icono:"", sub:"Tier + precio + features + CTA",
    defaults: Object.assign({}, styleDefaults, {
      padTop:"6", padBottom:"6", destacado:false,
      tier:"PRO", precio:"$49", periodo:"/mes",
      features:[ {tipo:"feat",texto:"Todo lo del plan básico"}, {tipo:"feat",texto:"Soporte prioritario"}, {tipo:"feat",texto:"Sin límite de usuarios"} ],
      ctaTexto:"Empezar", ctaUrl:"",
      alineacionTexto:"center",
      tamanoTier:"11", tamanoPrecio:"38", tamanoFeatures:"13",
      colorFondo:"", colorTexto:"", colorTier:"", colorAcento:""
    }),
    campos: [
      {key:"destacado",label:"Plan destacado (fondo color)",tipo:"check"},
      {grupo:"Contenido"},
      {key:"tier",label:"Nombre del plan (kicker)",tipo:"text"},
      {tipo:"row2", izq:{key:"precio",label:"Precio",tipo:"text"}, der:{key:"periodo",label:"Periodo (/mes, /año)",tipo:"text"}},
      {key:"features",label:"Features",tipo:"lista",itemTipos:[{valor:"feat",label:"Feature",camposItem:[{k:"texto",l:"Texto"}]}]},
      {tipo:"row2", izq:{key:"ctaTexto",label:"Texto CTA",tipo:"text"}, der:{key:"ctaUrl",label:"URL CTA",tipo:"text"}},
      {grupo:"Tipografía"},
      {key:"alineacionTexto",label:"Alineación de los textos",tipo:"alignH"},
      {tipo:"row2", izq:{key:"tamanoTier",label:"Tamaño tier (px)",tipo:"range",min:9,max:18,step:1}, der:{key:"tamanoPrecio",label:"Tamaño precio (px)",tipo:"range",min:24,max:72,step:1}},
      {key:"tamanoFeatures",label:"Tamaño features (px)",tipo:"range",min:11,max:18,step:1},
      {grupo:"Colores (vacío = tema)"},
      {tipo:"row2", izq:{key:"colorFondo",label:"Fondo card",tipo:"color"}, der:{key:"colorTexto",label:"Texto",tipo:"color"}},
      {tipo:"row2", izq:{key:"colorTier",label:"Color del tier",tipo:"color"}, der:{key:"colorAcento",label:"Acento (precio/CTA)",tipo:"color"}},
      ...styleFields()
    ],
    render: (d) => {
      const feats = (d.features||[]).map(f => `<li style="font-size:${esc(d.tamanoFeatures)}px;">${esc(f.texto||"")}</li>`).join("");
      const ta = d.alineacionTexto || "center";
      const tema = getTema();
      const fondo = d.colorFondo || (d.destacado ? tema.primary : "#ffffff");
      const colorTexto = d.colorTexto || (d.destacado ? "#ffffff" : "inherit");
      const colorTier = d.colorTier || (d.destacado ? "#fce865" : tema.primary);
      const colorAcento = d.colorAcento || (d.destacado ? "#fce865" : tema.primary);
      const ctaBg = d.destacado ? "#fce865" : tema.primary;
      const ctaColor = d.destacado ? "#040764" : "#ffffff";
      return wrap(d, `<div class="sbb-pricing${d.destacado?" destacado":""}" style="background:${esc(fondo)};color:${esc(colorTexto)};text-align:${esc(ta)};">
        <div class="tier" style="font-size:${esc(d.tamanoTier)}px;color:${esc(colorTier)};">${esc(d.tier)}</div>
        <div class="price-row" style="justify-content:${ta==="left"?"flex-start":ta==="right"?"flex-end":"center"};">
          <span class="price" style="font-size:${esc(d.tamanoPrecio)}px;color:${esc(colorAcento)};">${esc(d.precio)}</span>
          <span class="period" style="color:${d.destacado?"rgba(255,255,255,.7)":"#888"};">${esc(d.periodo)}</span>
        </div>
        <ul class="features" style="text-align:${esc(ta)};">${feats}</ul>
        ${d.ctaTexto?`<a class="cta" href="${esc(d.ctaUrl||"#")}" target="_blank" rel="noopener" style="background:${esc(ctaBg)};color:${esc(ctaColor)};">${esc(d.ctaTexto)}</a>`:""}
      </div>`);
    }
  },

  hero: {
    cat:"Estructura", nombre:"Hero con overlay", icono:"", sub:"Imagen full + texto encima",
    defaults: Object.assign({}, styleDefaults, { padTop:"0", padBottom:"0", imagenUrl:"https://placehold.co/1200x500/040764/9ca3af?text=Hero", titulo:"Título del hero", sub:"Subtítulo que acompaña al título", ctaTexto:"Saber más", ctaUrl:"", alturaHero:"320", oscurecer:"50", radioImg:"0", colorVeil:"#000000", posImg:"center", colorTitulo:"#ffffff", colorSub:"#ffffff", fuente:"", tamTitulo:"28", tamSub:"14" }),
    campos: [
      {key:"imagenUrl",label:"URL imagen de fondo",tipo:"imgurl"},
      {key:"titulo",label:"Título",tipo:"text"},
      {key:"sub",label:"Subtítulo",tipo:"textarea"},
      {tipo:"row2", izq:{key:"ctaTexto",label:"Texto CTA",tipo:"text"}, der:{key:"ctaUrl",label:"URL CTA",tipo:"text"}},
      {grupo:"Tipografía"},
      {key:"fuente",label:"Tipografía",tipo:"select",opciones:FUENTES},
      {tipo:"row2", izq:{key:"tamTitulo",label:"Tamaño título (px)",tipo:"range",min:14,max:72,step:1}, der:{key:"tamSub",label:"Tamaño subtítulo (px)",tipo:"range",min:10,max:32,step:1}},
      {grupo:"Imagen"},
      {tipo:"row2", izq:{key:"alturaHero",label:"Alto (px)",tipo:"range",min:140,max:600,step:10}, der:{key:"oscurecer",label:"Oscurecer (%)",tipo:"range",min:0,max:80,step:5}},
      {key:"radioImg",label:"Radio (px)",tipo:"range",min:0,max:40,step:1},
      {tipo:"row2", izq:{key:"colorVeil",label:"Color de la capa",tipo:"color"}, der:{key:"posImg",label:"Posición imagen",tipo:"select",opciones:[["center","Centro"],["top","Arriba"],["bottom","Abajo"],["left","Izquierda"],["right","Derecha"]]}},
      {tipo:"row2", izq:{key:"colorTitulo",label:"Color título",tipo:"color"}, der:{key:"colorSub",label:"Color subtítulo",tipo:"color"}},
      ...styleFields()
    ],
    render: (d) => {
      const veil = `background:${hexRgba(d.colorVeil||"#000000",(parseInt(d.oscurecer)||0)/100)};`;
      const et = parseFloat(d.escalaTexto) || 1;   // escala del texto encima (adaptación por tamaño)
      const tH = Math.round((parseFloat(d.tamTitulo)||28)*et), tP = Math.round((parseFloat(d.tamSub)||14)*et), padV = Math.round(42*et), padH = Math.round(32*et);
      const cssH = `font-size:${tH}px;${d.colorTitulo?`color:${esc(d.colorTitulo)};`:""}`;
      const cssP = `font-size:${tP}px;${d.colorSub?`color:${esc(d.colorSub)};`:""}`;
      const ta = textAlignDe(d.alinH);   // alineación del texto (incluye justificado)
      const fam = fontFamilyCSS(d.fuente);
      const cta = d.ctaTexto ? `<a href="${esc(d.ctaUrl||'#')}" target="_blank" rel="noopener">${esc(d.ctaTexto)}</a>` : "";
      return wrap(d, `<div class="sbb-hero" style="height:${esc(d.alturaHero)}px;border-radius:${esc(d.radioImg)}px;overflow:hidden;${fam}"><img class="bg" src="${esc(d.imagenUrl)}" alt="" style="object-position:${esc(d.posImg||'center')};"><div class="veil" style="${veil}"></div><div class="content" style="height:${esc(d.alturaHero)}px;padding:${padV}px ${padH}px;text-align:${ta};"><h2 style="${cssH}">${esc(d.titulo)}</h2>${d.sub?`<p style="${cssP}">${escMultiline(d.sub)}</p>`:""}${cta}</div></div>`);
    }
  },

  alert: {
    cat:"Estructura", nombre:"Banner / Alerta", icono:"", sub:"Aviso info / warning / éxito / error",
    defaults: Object.assign({}, styleDefaults, { padTop:"6", padBottom:"6", tipo:"info", icono:"", titulo:"Información importante", mensaje:"Mensaje que el destinatario debe leer." }),
    campos: [
      {key:"tipo",label:"Tipo",tipo:"select",opciones:[["info","Info (azul)"],["warning","Warning (amarillo)"],["success","Éxito (verde)"],["error","Error (rojo)"]]},
      {key:"titulo",label:"Título",tipo:"text"},
      {key:"mensaje",label:"Mensaje",tipo:"textarea"},
      ...styleFields()
    ],
    render: (d) => wrap(d, `<div class="sbb-alert ${esc(d.tipo)}"><span class="ico">${svgIcon({info:"info",warning:"alerta",success:"check",error:"equis"}[d.tipo]||"info",{size:"20px"})}</span><div class="body">${d.titulo?`<div class="title">${esc(d.titulo)}</div>`:""}${d.mensaje?`<div class="msg">${escMultiline(d.mensaje)}</div>`:""}</div></div>`)
  },

  features: {
    cat:"Contenido", nombre:"Lista de features", icono:"", sub:"Items con ícono + título + sub",
    defaults: Object.assign({}, styleDefaults, { padTop:"6", padBottom:"6", titulo:"", colorIcono:"", disposicion:"lista", porFila:"3", orientacion:"horizontal", alinItems:"", fuente:"", tamTitulo:"16", tamItemTitulo:"13.5", tamItemSub:"12", gapItems:"10", items:[ {ico:"trending",t:"Velocidad",s:"Carga instantánea en cualquier dispositivo."}, {ico:"candado",t:"Seguridad",s:"Cifrado de extremo a extremo."}, {ico:"estrella",t:"Calidad",s:"Diseño premium en cada detalle."} ] }),
    campos: [
      {key:"titulo",label:"Título superior (opcional)",tipo:"text"},
      {key:"colorIcono",label:"Color de íconos (vacío = tema)",tipo:"color"},
      {grupo:"Disposición y tipografía"},
      {tipo:"row2", izq:{key:"disposicion",label:"Disposición",tipo:"select",opciones:[["lista","En lista (uno bajo otro)"],["fila","En fila (lado a lado)"]]}, der:{key:"porFila",label:"Cuántos por fila",tipo:"select",opciones:[["2","2"],["3","3"],["4","4"]]}},
      {key:"orientacion",label:"Ícono y texto",tipo:"select",opciones:[["horizontal","Ícono al lado del texto"],["vertical","Ícono arriba del texto"]]},
      {key:"alinItems",label:"Alineación del texto de los ítems",tipo:"select",opciones:[["","Automático (sigue al ícono)"],["left","Izquierda"],["center","Centro"],["right","Derecha"]]},
      {key:"fuente",label:"Tipografía",tipo:"select",opciones:FUENTES},
      {tipo:"row2", izq:{key:"tamTitulo",label:"Tamaño título superior (px)",tipo:"range",min:11,max:36,step:1}, der:{key:"gapItems",label:"Distancia entre ítems (px)",tipo:"range",min:0,max:48,step:1}},
      {tipo:"row2", izq:{key:"tamItemTitulo",label:"Tamaño título de ítem (px)",tipo:"range",min:11,max:28,step:1}, der:{key:"tamItemSub",label:"Tamaño subtítulo de ítem (px)",tipo:"range",min:9,max:22,step:1}},
      {key:"items",label:"Features",tipo:"lista",itemTipos:[{valor:"feat",label:"Feature",camposItem:[{k:"ico",l:"Ícono",tipo:"icono"},{k:"t",l:"Título"},{k:"s",l:"Subtítulo"}]}]},
      ...styleFields()
    ],
    render: (d) => {
      const vert = d.orientacion === "vertical";
      const g = (parseFloat(d.gapItems)!=null && d.gapItems!=="") ? parseFloat(d.gapItems) : 10;
      const ta = textAlignDe(d.alinH);
      // Alineacion del texto de cada item. MANDA lo que elija el usuario
      // (alinItems); vacio = "automatico", que alinea el texto CON su icono:
      // icono al lado -> texto a la izquierda contra un eje comun (centrarlo hace
      // que cada linea empiece en un punto distinto segun su largo); icono arriba
      // -> texto centrado igual que el. Es solo el valor por defecto, no una regla.
      const taItem = ["left","center","right"].includes(d.alinItems) ? d.alinItems : (vert ? ta : "left");
      const stT = `font-size:${esc(d.tamItemTitulo||"13.5")}px;`;
      const stS = `font-size:${esc(d.tamItemSub||"12")}px;`;
      const items = (d.items||[]).map((it, idx) => `<li style="padding:${g/2}px 0;"><div class="ico"${d.colorIcono?` style="color:${esc(d.colorIcono)}"`:""}>${it.ico?svgIcon(it.ico,{size:"22px"}):""}</div><div class="txt" style="text-align:${taItem};"><div class="t" data-edit="items.${idx}.t" data-linea="1" style="${stT}">${esc(it.t||"")}</div><div class="s" data-edit="items.${idx}.s" style="${stS}">${esc(it.s||"")}</div></div></li>`).join("");
      const fam = fontFamilyCSS(d.fuente);
      // Disposición: en fila (grilla de N columnas, lado a lado) o en lista (apilados).
      const enFila = d.disposicion === "fila";
      const cols = Math.max(2, Math.min(4, parseInt(d.porFila)||3));
      const ulStyle = enFila
        ? `display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${g}px;`
        : "";
      const filaCls = enFila ? " en-fila" : "";
      return wrap(d, `<div class="sbb-features${vert?" vertical":""}${filaCls}" style="${fam}text-align:${ta};">${d.titulo?`<h3 style="font-size:${esc(d.tamTitulo||"16")}px;">${esc(d.titulo)}</h3>`:""}<ul style="${ulStyle}">${items}</ul></div>`);
    }
  },

  audio: {
    cat:"Multimedia", nombre:"Audio / Podcast", icono:"", sub:"Cover + título + play",
    defaults: Object.assign({}, styleDefaults, { padTop:"6", padBottom:"6", coverUrl:"https://placehold.co/120x120/0f172a/fce865?text=Audio", titulo:"Título del audio", artista:"Artista o autor", url:"" }),
    campos: [
      {key:"coverUrl",label:"URL del cover",tipo:"text"},
      {key:"titulo",label:"Título",tipo:"text"},
      {key:"artista",label:"Artista / autor",tipo:"text"},
      {key:"url",label:"URL del audio (Spotify, etc.)",tipo:"text"},
      ...styleFields()
    ],
    render: (d) => wrap(d, `<a class="sbb-audio" href="${esc(d.url||"#")}" target="_blank" rel="noopener" style="text-decoration:none;"><img class="cover" src="${esc(d.coverUrl)}" alt=""><div class="info"><div class="title">${esc(d.titulo)}</div><div class="artist">${esc(d.artista)}</div></div><span class="play"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" stroke="none"><polygon points="6 3 20 12 6 21 6 3"/></svg></span></a>`)
  },

  footer: {
    cat:"Estructura", nombre:"Footer", icono:"", sub:"Pie de pieza",
    defaults: Object.assign({}, styleDefaults, { padTop:"24", padBottom:"32", logoUrl:"", logoAncho:"120", empresa:"Empresa", direccion:"", copyright:"", mostrarUnsub:false, unsubTexto:"Darme de baja", unsubUrl:"" }),
    campos: [
      {key:"logoUrl",label:"Logo / imagen (vacío = sin logo)",tipo:"imgurl"},
      {key:"logoAncho",label:"Ancho del logo (px)",tipo:"range",min:40,max:300,step:10},
      {key:"empresa",label:"Empresa",tipo:"text"},
      {key:"direccion",label:"Dirección",tipo:"text"},
      {key:"copyright",label:"Copyright",tipo:"text"},
      {grupo:"Baja"},
      {key:"mostrarUnsub",label:"Mostrar enlace de baja",tipo:"check"},
      {key:"unsubTexto",label:"Texto",tipo:"text"},
      {key:"unsubUrl",label:"URL",tipo:"text"},
      ...styleFields()
    ],
    render: (d) => wrap(d, `<footer class="sbb-footer">${d.logoUrl?`<img src="${esc(d.logoUrl)}" alt="logo" style="width:${esc(d.logoAncho||120)}px;max-width:100%;display:block;margin:0 auto 12px;">`:""}${d.empresa?`<div class="empresa">${esc(d.empresa)}</div>`:""}${d.direccion?`<div>${esc(d.direccion)}</div>`:""}${d.copyright?`<div style="margin-top:6px;">${esc(d.copyright)}</div>`:""}${d.mostrarUnsub?`<div style="margin-top:10px;"><a href="${esc(d.unsubUrl)}">${esc(d.unsubTexto)}</a></div>`:""}</footer>`)
  },
  // Sección con fondo: banda full-width (eyebrow + título + texto + botón). El primitivo
  // clave para emails "editoriales" de secciones de color alternadas.
  seccion: {
    cat:"Estructura", nombre:"Sección con fondo", icono:"", sub:"Banda full-width: eyebrow + título + texto + botón",
    defaults: Object.assign({}, styleDefaults, { padTop:"0", padBottom:"0", padLeft:"0", padRight:"0", radioBloque:"0", alinH:"center",
      bg:"#040764", colorTexto:"#ffffff", colorEyebrow:"", eyebrow:"ETIQUETA", titulo:"Título de la sección", subtitulo:"Texto de apoyo breve para acompañar el título de esta sección.",
      fuenteTitulo:"", tamTitulo:"30", tamSub:"15", padV:"44", padH:"32",
      botonTexto:"Saber más", botonUrl:"", botonVariante:"solido", botonColor:"", radioBoton:"6" }),
    campos: [
      {key:"eyebrow",label:"Eyebrow (etiqueta superior · vacío = sin)",tipo:"text"},
      {key:"titulo",label:"Título",tipo:"text"},
      {key:"subtitulo",label:"Texto de apoyo",tipo:"textarea"},
      {grupo:"Botón (opcional · vacío = sin botón)"},
      {tipo:"row2", izq:{key:"botonTexto",label:"Texto del botón",tipo:"text"}, der:{key:"botonUrl",label:"URL",tipo:"text"}},
      {tipo:"row2", izq:{key:"botonVariante",label:"Estilo",tipo:"select",opciones:[["solido","Sólido"],["outline","Outline"]]}, der:{key:"botonColor",label:"Color (vacío = tema)",tipo:"color"}},
      {grupo:"Estilo de la banda"},
      {tipo:"row2", izq:{key:"bg",label:"Fondo de la sección",tipo:"color"}, der:{key:"colorTexto",label:"Color del texto",tipo:"color"}},
      {key:"colorEyebrow",label:"Color del eyebrow (vacío = acento/texto)",tipo:"color"},
      {key:"fuenteTitulo",label:"Tipografía del título",tipo:"select",opciones:FUENTES},
      {tipo:"row2", izq:{key:"tamTitulo",label:"Tamaño título (px)",tipo:"range",min:16,max:64,step:1}, der:{key:"tamSub",label:"Tamaño texto (px)",tipo:"range",min:11,max:24,step:1}},
      {tipo:"row2", izq:{key:"padV",label:"Padding vertical (px)",tipo:"range",min:0,max:120,step:2}, der:{key:"padH",label:"Padding lateral (px)",tipo:"range",min:0,max:80,step:2}},
      {key:"alinH",label:"Alineación",tipo:"alignH"},
      ...styleFields({h:false,v:false})
    ],
    render: (d) => {
      const ta = textAlignDe(d.alinH);
      const fam = fontFamilyCSS(d.fuenteTitulo);
      const cTxt = d.colorTexto || "#ffffff";
      const acc = d.botonColor || getTema().ctaColor || getTema().primary;
      const ey = d.eyebrow ? `<div data-edit="eyebrow" data-linea="1" style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${esc(d.colorEyebrow||acc)};margin-bottom:10px;">${esc(d.eyebrow)}</div>` : "";
      const tit = d.titulo ? `<div data-edit="titulo" data-linea="1" style="margin:0 0 10px;font-size:${esc(d.tamTitulo||30)}px;line-height:1.15;font-weight:700;color:${esc(cTxt)};${fam}">${esc(d.titulo)}</div>` : "";
      const cen = (ta==="center") ? "margin-left:auto;margin-right:auto;" : "";
      const sub = d.subtitulo ? `<div data-edit="subtitulo" style="font-size:${esc(d.tamSub||15)}px;line-height:1.6;color:${esc(cTxt)};opacity:.92;max-width:520px;${cen}">${escMultiline(d.subtitulo)}</div>` : "";
      let boton = "";
      if(d.botonTexto){
        const out = d.botonVariante==="outline";
        boton = `<div style="margin-top:20px;"><a href="${esc(d.botonUrl||'#')}" target="_blank" rel="noopener" data-edit="botonTexto" data-linea="1" data-edit-link="botonUrl" title="Doble clic para editar el enlace" style="display:inline-block;background:${out?'transparent':esc(acc)};color:${out?esc(acc):'#ffffff'};border:2px solid ${esc(acc)};padding:12px 26px;border-radius:${esc(d.radioBoton||'6')}px;font-size:14px;font-weight:600;text-decoration:none;">${esc(d.botonTexto)}</a></div>`;
      }
      const inner = `<div style="background:${esc(d.bg||'#040764')};padding:${esc(d.padV||44)}px ${esc(d.padH||32)}px;text-align:${ta};box-sizing:border-box;">${ey}${tit}${sub}${boton}</div>`;
      return wrap(d, inner);
    }
  },
  // Header de marca: banda full-width con logo (email). Dos estilos: sólido (logo claro) o blanco (logo a color).
  bandaHeader: {
    cat:"Estructura", nombre:"Header de marca · azul", icono:"", sub:"Banda sólida con logo (email)",
    defaults: Object.assign({}, styleDefaults, { padTop:"0", padBottom:"0", padLeft:"0", padRight:"0", radioBloque:"0", estilo:"solido", bg:"#1C73CB", logoClaro:"", logoColor:"", alto:"30", alinH:"left" }),
    campos: [
      {key:"estilo",label:"Estilo de banda",tipo:"select",opciones:[["solido","Sólido (logo claro)"],["blanco","Blanco (logo a color)"]]},
      {key:"bg",label:"Color de la banda (estilo sólido)",tipo:"color"},
      {key:"alto",label:"Alto del logo (px)",tipo:"range",min:16,max:60,step:1},
      {key:"alinH",label:"Alineación del logo",tipo:"select",opciones:[["left","Izquierda"],["center","Centro"],["right","Derecha"]]},
      {key:"logoClaro",label:"Logo del header (sube o pega; ideal claro para fondo de color)",tipo:"imgurl"},
      {key:"logoColor",label:"Logo a color (para estilo blanco)",tipo:"imgurl"},
      ...styleFields({h:false, v:false})
    ],
    render: (d) => {
      const solido = (d.estilo||"solido")!=="blanco";
      const band = solido ? (d.bg||"#1C73CB") : "#ffffff";
      const borde = solido ? "none" : "1px solid #e3e6ec";
      const logo = solido ? (d.logoClaro||d.logoColor||"") : (d.logoColor||d.logoClaro||"");
      const ta = d.alinH || "left";
      const logoField = solido ? "logoClaro" : "logoColor";
      const inner = `<div style="background:${esc(band)};border:${borde};text-align:${ta};padding:22px 28px;box-sizing:border-box;">${logo?`<img src="${esc(logo)}" alt="logo" data-edit-img="${logoField}" title="Clic para cambiar el logo" style="height:${esc(d.alto||30)}px;width:auto;display:inline-block;vertical-align:middle;">`:`<span style="color:#bbb;font-size:12px;">Logo de la marca</span>`}</div>`;
      return wrap(d, inner);
    }
  },
  // Footer de marca: banda con logo + "Síguenos" + íconos de redes, más línea legal (email).
  bandaFooter: {
    cat:"Estructura", nombre:"Footer de marca · azul", icono:"", sub:"Banda sólida + Síguenos (email)",
    defaults: Object.assign({}, styleDefaults, { padTop:"0", padBottom:"0", padLeft:"0", padRight:"0", radioBloque:"0", estilo:"solido", bg:"#1C73CB", logoClaro:"", logoColor:"", alto:"28", textoSeguir:"Síguenos",
      redes:[{tipo:"facebook",url:""},{tipo:"instagram",url:""},{tipo:"linkedin",url:""},{tipo:"youtube",url:""}],
      copyright:"", direccion:"", mostrarUnsub:false, unsubTexto:"Darme de baja", unsubUrl:"", disclaimer:"", web:"" }),
    campos: [
      {key:"estilo",label:"Estilo de banda",tipo:"select",opciones:[["solido","Sólido (logo claro)"],["blanco","Blanco (logo a color)"]]},
      {key:"bg",label:"Color de la banda (estilo sólido)",tipo:"color"},
      {key:"alto",label:"Alto del logo (px)",tipo:"range",min:16,max:50,step:1},
      {key:"textoSeguir",label:"Texto antes de las redes",tipo:"text"},
      {key:"redes",label:"Redes",tipo:"lista",itemTipos:[
        {valor:"facebook",label:"Facebook",camposItem:[{k:"url",l:"URL"}]},
        {valor:"instagram",label:"Instagram",camposItem:[{k:"url",l:"URL"}]},
        {valor:"linkedin",label:"LinkedIn",camposItem:[{k:"url",l:"URL"}]},
        {valor:"youtube",label:"YouTube",camposItem:[{k:"url",l:"URL"}]},
        {valor:"twitter",label:"X / Twitter",camposItem:[{k:"url",l:"URL"}]},
        {valor:"tiktok",label:"TikTok",camposItem:[{k:"url",l:"URL"}]},
        {valor:"spotify",label:"Spotify",camposItem:[{k:"url",l:"URL"}]},
        {valor:"globo",label:"Sitio web",camposItem:[{k:"url",l:"URL"}]}
      ]},
      {grupo:"Legal"},
      {key:"copyright",label:"Copyright",tipo:"text"},
      {key:"direccion",label:"Dirección",tipo:"text"},
      {key:"mostrarUnsub",label:"Mostrar enlace de baja",tipo:"check"},
      {key:"unsubTexto",label:"Texto de baja",tipo:"text"},
      {key:"unsubUrl",label:"URL de baja",tipo:"text"},
      {key:"disclaimer",label:"Disclaimer legal",tipo:"textarea"},
      {key:"web",label:"Sitio web (link del logo)",tipo:"text"},
      {key:"logoClaro",label:"Logo del footer (sube o pega; ideal claro para fondo de color)",tipo:"imgurl"},
      {key:"logoColor",label:"Logo a color (para estilo blanco)",tipo:"imgurl"},
      ...styleFields({h:false, v:false})
    ],
    render: (d) => {
      const solido = (d.estilo||"solido")!=="blanco";
      const band = solido ? (d.bg||"#1C73CB") : "#ffffff";
      const borde = solido ? "none" : "1px solid #e3e6ec";
      const fg = solido ? "#ffffff" : (d.bg||"#1C73CB");
      const logo = solido ? (d.logoClaro||d.logoColor||"") : (d.logoColor||d.logoClaro||"");
      const iconos = (d.redes||[]).filter(r=>r.url).map(r=>`<a href="${esc(r.url)}" target="_blank" rel="noopener" style="color:${fg};display:inline-flex;text-decoration:none;">${svgIcon(r.tipo,{size:"20px"})}</a>`).join("");
      const seguir = iconos ? `<span style="display:inline-flex;align-items:center;gap:14px;">${d.textoSeguir?`<span style="color:${fg};font-size:14px;">${esc(d.textoSeguir)}</span>`:""}${iconos}</span>` : "";
      const imgLogo = logo ? `<img src="${esc(logo)}" alt="logo" style="height:${esc(d.alto||28)}px;width:auto;display:block;">` : `<span style="color:${fg};font-weight:700;font-size:13px;">Logo</span>`;
      // El logo del footer también lleva link (a la web de la marca, si hay).
      const logoEl = d.web ? `<a href="${esc(d.web)}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-block;">${imgLogo}</a>` : imgLogo;
      const banda = `<div style="background:${esc(band)};border:${borde};display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;padding:18px 28px;box-sizing:border-box;">${logoEl}${seguir}</div>`;
      const legalParts = [];
      if(d.copyright) legalParts.push(esc(d.copyright));
      if(d.direccion) legalParts.push(esc(d.direccion));
      let legal = legalParts.length ? `<div style="text-align:center;font-size:11px;color:#8a8f9c;margin-top:12px;">${legalParts.join(" · ")}</div>` : "";
      if(d.disclaimer) legal += `<div style="text-align:center;font-size:10.5px;color:#a2a6b2;margin-top:6px;line-height:1.5;">${escMultiline(d.disclaimer)}</div>`;
      if(d.mostrarUnsub && d.unsubTexto) legal += `<div style="text-align:center;font-size:11px;margin-top:8px;"><a href="${esc(d.unsubUrl||"#")}" style="color:#8a8f9c;">${esc(d.unsubTexto)}</a></div>`;
      return wrap(d, banda+legal);
    }
  }
};
// Segunda variante del footer de marca: banda BLANCA (logo e íconos a color).
// Reutiliza render y campos del footer azul; solo cambia el estilo por defecto.
BLOQUES.bandaFooterBlanco = {
  cat:"Estructura", nombre:"Footer de marca · blanco", icono:"", sub:"Banda blanca + Síguenos (email)",
  defaults: Object.assign({}, BLOQUES.bandaFooter.defaults, { estilo:"blanco" }),
  campos: BLOQUES.bandaFooter.campos,
  render: BLOQUES.bandaFooter.render
};
// Segunda variante del header de marca: banda BLANCA (logo a color).
BLOQUES.bandaHeaderBlanco = {
  cat:"Estructura", nombre:"Header de marca · blanco", icono:"", sub:"Banda blanca con logo (email)",
  defaults: Object.assign({}, BLOQUES.bandaHeader.defaults, { estilo:"blanco" }),
  campos: BLOQUES.bandaHeader.campos,
  render: BLOQUES.bandaHeader.render
};
