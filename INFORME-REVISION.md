# Revisión integral — Simple Block Builder (jul-2026)

Revisión de principio a fin: backend (`functions/api`), capa de estado/datos del
frontend, renders y exportadores, consistencia visual, y una batería E2E que
ejercitó todos los elementos vivos. **Este documento es un diagnóstico — no se
aplicaron arreglos de fondo** (salvo el color de los botones por tipo, que se
pidió en el camino). Cada hallazgo fue verificado leyendo el código.

Resumen de estado: la app funciona y es sólida en lo esencial (los 41 bloques,
las 10 plantillas, los 11 tamaños de composición, la consola de ads, papelera y
deshacer pasan el recorrido E2E sin reventar y sin XSS en los campos de texto de
bloques y marcas). Lo que sigue son los puntos a mejorar, ordenados por riesgo.

---

## 🔴 Seguridad — lo que conviene arreglar primero

Todos comparten la misma raíz: contenido controlable por un usuario que termina
ejecutándose **en el propio dominio de la app** (misma sesión, mismas cookies).

1. **Vista previa sin aislamiento + bloque "código".** El iframe de vista previa
   (`pv-frame`) no tiene atributo `sandbox`, y el bloque `codigo` se inserta tal
   cual (con `<script>`). Como el admin puede previsualizar piezas de usuarios
   limitados (`previewAjeno`), un usuario limitado puede guardar un bloque código
   con JavaScript malicioso y, al abrirlo el admin, ese script corre con la sesión
   del admin (puede leer todos los espacios vía `?todos=1`). **Es el más grave.**
   Arreglo: `sandbox` en el iframe de preview + sanear el bloque código en piezas
   ajenas.

2. **`ejecutarScriptsCodigo()` corre el `<script>` del bloque código en el editor
   principal** (no solo en la vista previa). Refuerza el punto 1.

3. **`/api/img` es un proxy abierto sin login.** Acepta cualquier URL y la sirve
   desde tu dominio; acepta `image/svg+xml`, así que un SVG con script se ejecuta
   en tu origen (XSS) y además permite usar tu servidor para pedir URLs arbitrarias
   (SSRF), sin límite de tamaño. Arreglo: exigir sesión, lista blanca de hosts,
   rechazar SVG, tope de bytes.

4. **`/api/upload` acepta SVG.** Un SVG con `<script>` subido queda servido desde
   tu dominio y es ejecutable. Arreglo: quitar SVG de los tipos permitidos (o
   servirlo con `Content-Disposition: attachment` y `Content-Type` neutro).

5. **XSS almacenado contra el admin en "Espacios de otros usuarios".** En
   `renderEspaciosOtros` los `id` de proyecto/pieza de otros usuarios se meten en
   un `onclick` sin escapar; un id con comillas ejecuta JS en la sesión del admin.
   Arreglo: usar el helper `jsAttr` (ya existe en el código).

6. **`escAttr` usado dentro de `onclick` en `renderImagenes`** (mismo patrón que 5):
   `escAttr` no sirve para strings de JavaScript; debe usarse `jsAttr`.

7. **Enlaces `javascript:` no filtrados.** `esc()` escapa HTML pero deja pasar
   `javascript:` en los `href` (CTA, imagen, sección, social…). Combinado con
   `previewAjeno` es un vector con clic. Arreglo: validar el esquema de URL.

8. **Inyección de fórmulas en los CSV de ads.** Un titular/keyword que empiece con
   `=`, `+`, `-` o `@` se interpreta como fórmula al abrir el CSV en Excel/Sheets.
   Arreglo: anteponer apóstrofo a esas celdas en `_csvCelda`.

Menores de backend: la lista de imágenes (`?list=1`) muestra el bucket completo a
cualquier usuario (un limitado ve las de otros); el modo IA `concepto` no exige
permiso de servicio; login con posible enumeración de usuarios por timing; el
endpoint `GET /api/ia` de diagnóstico responde sin sesión y filtra la longitud de
la API key.

---

## 🟠 Datos — riesgo de perder trabajo del usuario

9. **La sincronización inicial puede pisar ediciones locales.** `sincronizarConNube`
   compara contra el timestamp de localStorage **al cargar**, no contra el estado
   actual; si el usuario escribe en los primeros segundos (mientras baja la nube),
   esas ediciones se descartan en silencio. Arreglo: comparar contra `workspace._ts`
   vivo y/o fusionar en vez de reemplazar.

10. **El guardado no compara `_ts` en el servidor.** El "last-write-wins" solo vive
    en el cliente; una pestaña vieja puede sobrescribir en D1 una versión más nueva.
    Arreglo: que el POST de `/api/proyectos` rechace un `_ts` menor al almacenado.

11. **`crearComposicion` secuestra la campaña Search activa.** Como una campaña ads
    tiene `canvas:[]`, si es la pieza activa y se pulsa "Banner Display", la campaña
    se convierte en colección Display y el `adsData` queda inaccesible. Arreglo:
    añadir `!actual.adsData` (y coincidencia de sección) a la condición.

12. **Deep-link con localStorage vacío puede subir un workspace casi vacío a D1**
    antes de adoptar el remoto (ventana de pérdida si se cierra la pestaña). Ligado
    a 9/10.

---

## 🟡 Correctness / comportamiento

13. **Render sin guarda de tipo desconocido.** Si una pieza trae un tipo de bloque
    retirado (datos viejos), `BLOQUES[tipo].render` lanza error y **rompe todo el
    lienzo y la exportación** de esa pieza, no solo ese bloque. Arreglo: saltar
    tipos desconocidos (el import y las celdas de grid ya lo hacen; el canvas no).

14. **`eliminarBloque` usa `p.canvas` en vez de `getCanvas()`** → en sets legacy la
    tecla Supr y el botón ✕ no borran. Divergencia de código duplicado.

15. **Back/Forward del navegador no cambia la vista del dashboard** (la URL cambia,
    la pantalla no) y al volver del editor pisa la URL a la que ibas.

16. **Deshacer:** no restaura el modo de la barra tras convertir a colección; ignora
    `adsData`, así que Ctrl+Z es un no-op en campañas Search.

17. **Fuga de intervalos:** cada tecleo en el formulario suma `setInterval` nuevos
    (bloques reloj/countdown/clima) y re-ejecuta los scripts del bloque código,
    hasta el próximo `renderCanvas`.

18. **Carrera de permisos en deep-links:** un usuario limitado que entra directo a
    `/ads-ia` pasa la guarda si `whoami` aún no resolvió (el servidor sí bloquea la
    IA, pero no la creación de la pieza).

19. **`_mod`/`_ts` se estampan con solo ABRIR una pieza** (sin editarla): la reordena
    en el Home como "editada hace un momento" y puede ganar un LWW indebido.

---

## 🎨 Consistencia visual (tus dos quejas, confirmadas)

**Color — "todo azul".** Ya corregí los botones "¿Qué vas a crear aquí?" con
tintes de paleta por tipo (azul/turquesa/navy/magenta, contraste AA verificado).
Quedan por alinear:
- Verdes/rojos/naranjos fuera de paleta en estados: sync "guardado" (#2e7d32),
  "pendiente" (#b26a00), alertas del login, "restablecer tamaño" (#c0392b),
  etiquetas "· ajustado" (#b8860b) y "activo" (#1a8a4a) del tablero, botón quitar
  foto (#e23). Hay **tres verdes distintos** para "éxito" entre login y editor.
- Botones "Elegir de la biblioteca"/"Editar contenido" aún con borde navy oscuro
  sobre fondo claro (rompe la regla que sí corregimos en la fila de tipos).

**Jerarquía — más de un primario navy por vista.** En Imágenes hay un botón navy
por cada tarjeta + el de la cabecera; el Home tiene el navy de la barra + el de la
tarjeta de IA; "Sugerir textos con IA" es navy cuando debería ser magenta (código
de color de IA). "Vaciar papelera" está en el header en vez de terciario al pie.

**Tamaños — "estandarizar, ser ordenado".** Confirmado: radios del chrome
dispersos entre 3 y 14 px (censo: 6px×21, 7px×21, 8px×33, 9px×11, 10px×22, más
11/12/14 sueltos) y tres alturas de botón conviviendo en la misma barra del editor
(26 / 30 / 34 px). El botón "+" de la barra móvil es amarillo sobre fondo blanco
(el amarillo es solo CTA sobre navy), con sombra y radio 14. Propuesta: una escala
única (controles 8px, tarjetas/menús/modales 10px, píldoras 999px; una sola altura
de botón por barra) usando el token `--r` que ya existe pero casi no se usa.

**Tipografía:** hay `font-weight:700/800` e itálicas en varios paneles del editor
(la regla es Roboto 300–600, sin 700 ni cursiva en la UI). Corrección mecánica.

---

## ✅ Lo que está bien (verificado)

- SQL siempre parametrizado; JWT bien verificado; cookie HttpOnly/Secure/SameSite;
  permisos de admin y de servicio correctos; secretos no se filtran a `whoami`.
- Los 41 bloques renderizan con datos completos y vacíos; las 10 plantillas cargan
  y exportan; los 11 tamaños de composición exportan; ads respeta 30/90/15.
- Escapado correcto en la mayoría de renders de bloque, en la composición por zonas
  y en la consola de ads; XSS con canario en campos de bloque y marca: escapado.
- Migraciones idempotentes, papelera con guards consistentes, atajos de teclado bien
  acotados, dedupe e tope del historial, sin listeners duplicados al re-render.
- CSV con BOM/CRLF y re-recorte de límites; export HTML coherente con el editor.

---

## Orden recomendado de arreglo

1. **Seguridad 1–5** (sandbox del preview, bloque código, `/api/img`, `/api/upload`,
   ids sin escapar) — cierran ejecución de código en tu dominio y escalada al admin.
2. **Datos 9–11** — evitan perder trabajo del usuario.
3. **Correctness 13–14** — evitan que una pieza rompa el lienzo y que Supr falle.
4. **Visual** — color/jerarquía/tamaños en una pasada de tokens (bajo riesgo, alto
   impacto en cómo se ve).
5. El resto (menores) como limpieza.
