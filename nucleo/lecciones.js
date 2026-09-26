/* ════════════════════════════════════════════════════════════════════════
   MI PUBLICIDAD · NÚCLEO · LECCIONES PARA LA IA
   ────────────────────────────────────────────────────────────────────────
   Conocimiento de negocio que Claude aprende con el usuario y TRASPASA a la
   IA del motor (Gemini, functions/api/ia.js). Una sola definición, de la que
   salen: el texto que lee la IA, las listas que usa el motor de reglas
   (nucleo/reglas.js) y la sección legible del contrato.

   Se SUMA por capas (acuerdo con el usuario): Google → protocolo de la casa →
   calidad → negocio. Una lección no reemplaza reglas anteriores; si precisa
   alguna, lo dice explícitamente en `precisa`.

   A la IA le llega la REGLA DE TRABAJO, no la ley: el respaldo legal vive en
   el motor de reglas y en el contrato, donde lo lee quien decide.
   Archivo UMD: navegador (window.MP_Lecciones), Node y funciones de Cloudflare.
   ════════════════════════════════════════════════════════════════════════ */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.MP_Lecciones = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Papel de cada título del anuncio: la IA lo declara y el motor revisa que el
     anuncio derribe las tres barreras. No se exporta a Ads Editor. */
  const ROLES_TITULO = {
    keyword: 'repite la búsqueda (la keyword del grupo, casi literal)',
    tramite: 'barrera del TRÁMITE: qué tan digital, cuánto tarda, qué no hay que hacer',
    precio: 'barrera del PRECIO: precio visible, oferta vigente, forma de pago',
    respaldo: 'barrera del RESPALDO: quién responde, cómo liquida, asistencia, prueba con fuente',
    cta: 'acción de compra concreta'
  };
  const BARRERAS = ['tramite', 'precio', 'respaldo'];

  /* Búsquedas informativas: no van en campañas de conversión. */
  const INFORMATIVAS = ['que es', 'que significa', 'significado', 'como funciona', 'como se calcula', 'como sacar', 'que cubre',
    'para que sirve', 'consejos', 'consejo', 'definicion', 'pdf', 'ejemplo', 'ejemplos', 'wikipedia', 'historia de'];
  /* Verbos que llevan a comprar vs. verbos que llevan a leer. */
  const VERBOS_COMPRA = ['contrata', 'contratar', 'contrátalo', 'compra', 'comprar', 'cotiza', 'cotizar', 'asegura', 'asegurar',
    'emite', 'emitir', 'activa', 'activar', 'paga', 'pagar', 'obtén', 'obten', 'protege hoy', 'renueva', 'suscribe'];
  const VERBOS_LECTURA = ['conoce', 'infórmate', 'informate', 'visita nuestro', 'visita el sitio', 'descubre', 'lee ', 'aprende', 'entérate', 'enterate'];
  /* Afirmaciones de superioridad: solo con un dato en las fuentes que las respalde. */
  const SUPERLATIVOS = ['mas barato', 'el mejor', 'la mejor', 'los mejores', 'las mejores', 'numero 1', 'nº 1', 'n°1', 'lider', 'insuperable',
    'el mas economico', 'el mas completo', 'unico en', 'mejor precio', 'precio mas bajo'];

  const CONVERSION = {
    id: 'conversion',
    titulo: 'Anuncios de conversión (BOFU) · eCommerce de seguros B2C',
    version: '2026-09-26b',
    aplica: 'Campañas cuyo objetivo es la venta directa online (objetivo.enfoque = "conversion"). Sirve para cualquier seguro: auto, hogar, mascota, viaje…',
    precisa: [
      'Calidad (capa 3): el veto a "rápido y fácil" sigue; la rapidez se dice con el HECHO concreto que traiga la fuente.',
      'Calidad (capa 3): "online" / "100% digital" deja de ser relleno solo cuando responde a la barrera del trámite (1 o 2 títulos, no todos).'
    ],
    texto: [
      'LECCIÓN · ANUNCIOS DE CONVERSIÓN (BOFU) PARA UN eCOMMERCE DE SEGUROS B2C',
      '1. A QUIÉN LE HABLAS: a alguien que YA decidió asegurar algo (su auto, su casa, su mascota, su viaje) y quiere terminar AHORA. No lo convences de que necesita un seguro: lo convences de comprarlo AQUÍ y en ESTE momento.',
      '2. LAS TRES BARRERAS. Cada anuncio las derriba las tres, con HECHOS sacados de las fuentes (la web, los materiales y el relato del usuario):',
      '   · TRÁMITE: qué tan digital es, cuánto tarda, qué NO hay que hacer (papeles, inspección, sucursal), cómo llega la póliza.',
      '   · PRECIO: precio visible, oferta vigente, forma de pago.',
      '   · RESPALDO: quién responde, cómo liquida los siniestros, qué asistencia da, qué prueba hay (años, clientes, calificaciones con su fuente).',
      '   Si una barrera no tiene evidencia en las fuentes, NO la inventes: déjala sin cubrir y avísalo.',
      '3. KEYWORDS: solo intención de compra, armadas con patrones (no con listas de un producto):',
      '   · verbo de compra + seguro + objeto (contratar, comprar, cotizar, asegurar);',
      '   · seguro + objeto + precio u oferta (precio, valor, barato, descuento, promoción);',
      '   · seguro + objeto + inmediatez (online, hoy, ahora, en el acto, urgente);',
      '   · seguro + detalle del objeto (marca y modelo del auto, raza de la mascota, destino del viaje, tipo de vivienda);',
      '   · MOMENTO DE NECESIDAD: la situación que obliga a comprar ya (auto recién comprado, necesito circular, viajo mañana, mascota nueva).',
      '   Fuera: las informativas ("qué es", "cómo funciona", "qué cubre", consejos, significado, pdf) y todo lo que el producto no es o está fuera de temporada según el encargo.',
      '3b. CONCORDANCIAS: la FRASE es la base (alcance con control). La EXACTA solo para los términos principales de cada grupo (además de su frase). Nunca toda la campaña en exacta: se pierde alcance. La amplia no se usa.',
      '4. GRUPOS por intención de compra: comprar/contratar · precio u oferta · inmediatez · detalle del objeto · momento de necesidad. La marca de la compañía va SOLO junto al producto («seguro auto <marca>»); la marca sola va como negativa exacta.',
      '4b. PATRÓN DE GRUPOS (sirve para cualquier ramo): contratar online · precio y cuotas · el MOMENTO DE NECESIDAD separado por situación (p. ej. en auto: auto nuevo / auto usado), cada situación con la ventaja real que traiga la fuente para ella · lo asegurado en detalle (p. ej. marca del auto, tipo de vivienda) · compra por cobertura · la marca junto al producto. Escribe la intención de cada grupo.',
      '5. TÍTULOS: cada uno es UN hecho y declara su PAPEL: "keyword", "tramite", "precio", "respaldo" o "cta". Entre los fijados y los que rotan tienen que estar las tres barreras (trámite, precio y respaldo) y la keyword.',
      '5b. Cuando un grupo lleva DOS ANUNCIOS (así se aprende cuál convierte), dales ángulos distintos: uno cargado al TRÁMITE y otro al RESPALDO. Los 5 fijados pueden ser los mismos; cambian los títulos que rotan y las descripciones.',
      '5c. El RESPALDO se prueba con hechos de la fuente (garantías, asistencias concretas, horario de atención, red de servicio), solo los que la fuente diga. Búscalos también en la página del ramo del mismo sitio, no solo en la del producto: ahí suelen estar.',
      '6. DESCRIPCIONES: cada una derriba una barrera y termina con un verbo de COMPRA (contrata, cotiza, emite, asegura, activa). Nunca verbos de LECTURA (conoce, infórmate, visita, descubre).',
      '7. DESTINO: los sitelinks llevan a pasos de compra (cotizar, contratar, medios de pago, detalle del plan), cada uno a una página distinta. El éxito es la PÓLIZA PAGADA online, no la cotización.',
      '7a. SITELINKS a páginas del MISMO dominio del anuncio y distintas de la URL final. Nada de PDF alojados en otro dominio: Google los desaprueba.',
      '7b. NEGATIVAS ordenadas por tema, cada una con su motivo: la marca sola (en exacta), otros ramos, clientes actuales y siniestros, competidores, empleo, informativas, trámites que no son seguro, compraventa del bien. Sin redundancias: si "soap" ya está en frase, sobra "comprar soap". Las que desvían búsquedas a una campaña de promoción dicen la fecha en que se quitan.',
      '7c. MAYÚSCULAS: español, no inglés. Mayúscula solo al inicio del texto y en nombres propios (la marca, el nombre del producto, lugares). Nunca una mayúscula en cada palabra: "Cotiza tu seguro hoy", no "Cotiza Tu Seguro Hoy".',
      '8. REGLA DE FUENTES: no escribas ninguna cifra, precio, descuento, plazo ni garantía que no esté en las fuentes. No afirmes ser "el más barato", "el mejor" o "líder" sin un dato en las fuentes que lo respalde. (Una keyword como "seguro más barato" sí se puede usar.)',
      '9. EJEMPLO DE TONO (solo ilustra; sus datos NO son reales para esta marca):',
      '   ❌ "Seguros para tu automóvil" · "Conoce la importancia de tener un auto asegurado. Visita nuestro sitio."  → informa, no vende.',
      '   ✅ "Seguro de auto 100% online" [tramite] · "Cotiza y contrata en 3 min" [tramite] · "20% dcto. primer año" [precio] · "Liquidamos en 48 horas" [respaldo] ·',
      '      "Asegura tu auto sin trámites físicos. Recibe tu póliza digital al instante."  → cada línea es un hecho y empuja a comprar.'
    ].join('\n')
  };

  /* Conceptos del rubro. Nace de un error real (26-sep): se escribió «Prima desde $35.376 al mes» con un
     precio referencial calculado para UN modelo de auto. La prima es anual; lo mensual es la cuota; y un
     precio calculado para un vehículo puntual no se publica. Sirve para cualquier seguro, no solo auto. */
  const SEGUROS = {
    id: 'seguros',
    titulo: 'Conceptos de seguros · para escribir sin errores de rubro',
    version: '2026-09-26',
    aplica: 'Todo texto de seguros (anuncios, investigación, correcciones). Cualquier ramo: auto, hogar, mascota, viaje…',
    precisa: [
      'Regla de fuentes (capa 3): además de que la cifra exista en la fuente, tiene que significar lo mismo en el anuncio (una cuota no es una prima; un precio de ejemplo no es un precio para todos).'
    ],
    texto: [
      'LECCIÓN · CONCEPTOS DE SEGUROS (el anuncio no puede tener errores de rubro)',
      '1. PRIMA: lo que cuesta el seguro por TODA su vigencia (normalmente un año). Nunca es un pago mensual: no existe la «prima mensual» en un anuncio.',
      '2. CUOTA: cada pago en que se divide la prima (p. ej. 12 cuotas en un plan de 1 año, 24 en uno de 2 años, según el producto). Lo que se paga al mes es la cuota.',
      '3. VIGENCIA: el período que cubre la póliza (1 año, 2 años). PÓLIZA: el contrato; tiene condiciones generales (depositadas en la CMF, código POL…) y particulares (las de cada cliente).',
      '4. COBERTURA ≠ ASISTENCIA. Cobertura es lo que la compañía paga (daños, robo, pérdida total, responsabilidad civil). Asistencia es un servicio (grúa, auto de reemplazo, asistencia legal).',
      '5. DEDUCIBLE: la parte del daño que paga el asegurado; la compañía paga lo que excede. SINIESTRO: el hecho (choque, robo). DENUNCIO: el aviso a la compañía. LIQUIDACIÓN: la evaluación del siniestro que hace el liquidador. INDEMNIZACIÓN: lo que paga la compañía.',
      '6. PÉRDIDA TOTAL: daño sobre el porcentaje que fija la póliza, o robo sin recuperar en el plazo que fija la póliza. RESPONSABILIDAD CIVIL: daños a terceros (daño emergente, lucro cesante, daño moral), con tope en UF.',
      '7. MONTOS: «UF 500» (la sigla antes del número); pesos con punto como separador de miles y sin decimales (nunca coma ni espacio).',
      '8. PRECIOS: el precio de un seguro depende de la persona y de lo asegurado. Un «desde $X» calculado para un caso puntual (un modelo y año de auto, una edad, una comuna) NO va en un anuncio: al resto le promete un precio que no va a tener. Solo va un precio que valga para todos, o una oferta con sus condiciones visibles en la web.',
      '9. POR PLAN: si un beneficio depende del plan (taller de marca, asistencia full, monto de responsabilidad civil), dilo con su plan o con «hasta»; nunca como si lo tuvieran todos.',
      '10. UN PRODUCTO POR ANUNCIO: si la página muestra varios productos de la compañía, usa solo los datos del producto que se vende.',
      '11. LA MARCA ACOMPAÑA AL PRODUCTO: «Seguro <Marca>…», «Asegura tu auto con <Marca>». No la pongas como sujeto de un atributo: «<Marca>: taller multimarca» dice que la compañía ES un taller. CORREDOR ≠ COMPAÑÍA: el corredor intermedia, la compañía asegura.',
      '12. SOAP: seguro obligatorio de accidentes personales; no es un seguro del vehículo ni lo reemplaza.'
    ].join('\n')
  };

  const LECCIONES = { conversion: CONVERSION, seguros: SEGUROS };
  const sinTildes = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const leccion = id => LECCIONES[id] || null;
  const leccionParaIA = id => { const l = leccion(id); return l ? '════ ' + l.titulo.toUpperCase() + ' ════\n' + l.texto + '\n══════════════════════════════════════' : ''; };
  /* Varias lecciones juntas (las que falten se omiten). */
  const leccionesParaIA = ids => ids.map(leccionParaIA).filter(Boolean).join('\n');
  const contiene = (texto, lista) => { const t = ' ' + sinTildes(texto).replace(/[^a-z0-9ñ%$ ]+/g, ' ').replace(/\s+/g, ' ') + ' '; return lista.find(x => t.includes(' ' + sinTildes(x).trim() + ' ') || (x.endsWith(' ') && t.includes(' ' + sinTildes(x)))) || null; };

  return { LECCIONES, ROLES_TITULO, BARRERAS, INFORMATIVAS, VERBOS_COMPRA, VERBOS_LECTURA, SUPERLATIVOS, leccion, leccionParaIA, leccionesParaIA, contiene, sinTildes };
});
