/* ══════════════════════════════════════════════════════════════════
   GOOGLE DISPLAY  ·  funciones/display/config.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Los 11 tamaños de la colección Display (máster 300×250) y su atajo de creación.
   QUIÉN LO USA: Display usa el motor compartido de comun/banners. Para una versión propia de Display: copiar comun/banners/ aquí y cargar esa copia solo en Display.
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   SET DE BANNERS ADAPTABLES (Google Display) — Fase 1
   Un "set" es una creatividad (esSet:true) cuyo lienzo es el MÁSTER
   (300×250). Todos los tamaños comparten ese contenido y se adaptan por
   proporción: anchos→fila, el resto→columna; un auto-ajuste (scale) evita
   que nada se desborde. Se exporta uno o todos.
   ═══════════════════════════════════════════════════════════════ */
const SET_DISPLAY_DESKTOP = ["display-300x250","display-336x280","display-728x90","display-970x90","display-300x600","display-160x600","display-250x250","display-200x200","display-468x60","display-1200x628","display-1200x1200"];
function crearSetDesktop(){ crearComposicion("display-desktop"); }
