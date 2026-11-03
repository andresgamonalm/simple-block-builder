/* ══════════════════════════════════════════════════════════════════
   CAMPAÑA COMPLETA  ·  funciones/campana-completa/crear.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: La tarjeta «Campaña completa»: crea Display y Facebook en blanco en el mismo proyecto y abre el asistente para Search.
   QUIÉN LO USA: Usa las otras funciones; no tiene motor propio.
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// La tarjeta «Campaña completa» del Home (la llama crearConIA en comun/dashboard.js).
function crearCampanaCompleta(){
  // La campaña completa: las gráficas nacen en blanco en ESTE proyecto y
  // después se abre el asistente para la parte de Search.
  if(!crearBannerEnBlanco("banner", true)) return;
  if(puedePlat("facebook")) crearBannerEnBlanco("facebook", true);
  if(puedePlat("ads")){ iaSetFormato("ads"); abrirIA(true); }
}
