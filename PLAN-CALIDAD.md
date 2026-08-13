# Plan para subir la calidad de los entregables

Fecha: 13 de agosto de 2026. Rama: `sbb-draft-mejoras`.

Este documento separa **lo verificado** de **lo opinado**, para que las
decisiones se tomen sabiendo cuál es cuál.

- **[VERIFICADO]** = leído en el código y reproducido con una prueba.
- **[CRITERIO]** = juicio profesional, fundado pero no demostrable de antemano.

---

## Resumen en una línea

El techo de calidad no lo pone la IA: lo pone el motor de composición. Mientras
un banner solo pueda ser *logo arriba / texto al medio / CTA abajo*, ningún
modelo va a producir una pieza de nivel Zurich.

---

## A. Lo que hace que las gráficas se vean mediocres

### A1. Layouts de banner reales — **lo más importante**

**[VERIFICADO]** El motor solo sabe hacer una composición. `renderComposicion()`
pinta una columna flex de tres filas (logo, texto, CTA) en ese orden, siempre.
Las cuatro "recetas de variedad" cambian la alineación (izquierda o centro), la
posición de la burbuja, el velo y las proporciones — que son 25/50/25 contra
22/53/25: tres puntos porcentuales, invisibles.

**Lo que se necesita:** que la composición sea una propiedad elegible, con seis
a ocho estructuras realmente distintas:

| Layout | Estructura |
|---|---|
| Foto a sangre | foto completa + bloque de texto en un tercio |
| Split | mitad foto / mitad color plano, texto sobre el color |
| Banda inferior | foto arriba, franja sólida abajo con texto y CTA |
| Forma | fondo plano + forma geométrica de marca, texto encima |
| Producto | fondo plano + foto recortada, texto al lado |
| Franja | logo · texto · CTA en fila (ya existe, para 728×90 y similares) |

**Implica:** cirugía sobre `renderComposicion` y sobre el editor de zonas.
Hay que preservar las piezas ya creadas (migración perezosa, como
`asegurarComposicionNueva` ya hace hoy).

**Tamaño:** grande. Es el trabajo mayor de la lista.
**Riesgo:** medio. Se mitiga entregando de a tres layouts y validando.

### A2. Escala tipográfica por familia de formato

**[VERIFICADO]** `escF = ancho/300`, multiplicación pura y sin tope. Un
1200×1200 es un 300×250 ampliado cuatro veces: título de 26px a 104px, logo de
48 a 192. Es un zoom, no un diseño.

**Se necesita:** que cada familia (cuadrado, vertical, franja) tenga su propia
jerarquía y decida qué elementos sobreviven. En un 320×50 no cabe el cuerpo de
texto: hay que suprimirlo, no encogerlo.

**Tamaño:** mediano.

### A3. Copy por formato

**[VERIFICADO]** La IA escribe un titular y se reparte a los once tamaños.

**Se necesita:** que devuelva versión larga, media y corta, y que cada formato
tome la que le corresponde.

**Tamaño:** pequeño. Es cambio de prompt y de reparto.

---

## B. Que la IA vea y juzgue lo que hace

### B1. Que vea las fotos de verdad

**[VERIFICADO]** En banner la IA "ve" **3 imágenes de 224 píxeles**; el resto de
la biblioteca lo conoce solo por el nombre del archivo. En email **no ve
ninguna**: elige por nombre. Con 50 fotos de Drive llamadas "Foto-Propia-23",
acertar es azar.

**Se necesita:** describir cada foto **una sola vez** cuando entra a la
biblioteca, guardar esa descripción junto a la imagen, y darle a la IA las
descripciones completas. Se paga una vez por foto.

**Tamaño:** pequeño-mediano. **Impacto:** alto e inmediato.

### B2. Bucle de revisión visual — lo que la convierte en diseñador

**[VERIFICADO]** Hoy el motor genera y entrega. Nunca mira el resultado.

**Se necesita:** generar → rasterizar → devolverle la imagen al modelo →
que la critique contra las reglas de marca → corregir → repetir una vez.
El rasterizador ya existe (`rasterizarComposicion`, SVG → canvas → PNG).

**[CRITERIO]** Es lo que más acerca el sistema a "actuar como diseñador":
hacer, mirar, ajustar.

**Costo real, dicho de frente:** duplica o triplica las llamadas por pieza.
Más lento y más caro. Conviene activarlo solo en el máster, no en los once
tamaños.

**Tamaño:** mediano.

### B3. Reglas verificables por código, no por prompt

**[VERIFICADO]** Hoy las reglas de marca son texto dentro del prompt. Se piden
amablemente y no se comprueban. Un banner con falta de ortografía ya demostró
que pedir no basta (por eso se agregó el corrector).

**Se necesita:** comprobar sobre el resultado — contraste mínimo texto/fondo,
desborde de texto fuera del banner, tamaño mínimo de titular por formato, área
segura de la foto. Lo que falla se corrige o se avisa.

**Tamaño:** mediano.

---

## C. Banco de referencias por marca

**[VERIFICADO]** Rastrear Google Ads Transparency automáticamente no es viable:
la página se dibuja con JavaScript (una descarga simple trae un cascarón
vacío), los anuncios son imágenes y no hay API pública.

**Se necesita:** que se puedan subir capturas de referencia por marca y que
entren al prompt como imágenes. El motor ya es multimodal.

**[CRITERIO]** Es mejor que raspar, porque la curaduría la haces tú. Y ya
funcionó una vez: de tus capturas de los anuncios reales de Zurich salieron la
burbuja de oferta, las burbujas decorativas y la etiqueta de producto.

**Tamaño:** pequeño-mediano.

---

## D. Modelo de IA

**[VERIFICADO]** El motor llama a Gemini por HTTP. Cambiar de proveedor es
trabajo acotado, no una reescritura. Ya quedó parametrizado por variable
(`GEMINI_MODEL_COPY`) y subido a la gama que razona, con el pensamiento
encendido (estaba apagado en todas las llamadas).

**[VERIFICADO]** Figma no resuelve esto: "write to canvas" existe pero, en
palabras de la documentación, no está en la REST API y por MCP solo para
clientes IDE aprobados — un backend como el tuyo no puede usarlo.

**[CRITERIO]** Cambiar de modelo da una mejora, no un salto de categoría.
La prueba: los emails mejoraron hoy sin cambiar de IA.

**Opcional:** dejar el motor agnóstico de proveedor para poder comparar Gemini,
Claude y GPT con el mismo brief. **Tamaño:** pequeño.

---

## E. Defectos ya reproducidos (no son de diseño, pero muerden)

Ocho fallos comprobados en vivo. Los tres que pueden costarte trabajo:

1. **[VERIFICADO]** Crear un banner Display estando en una campaña de Search la
   convierte y la campaña queda inaccesible.
2. **[VERIFICADO]** Un bloque de tipo desconocido rompe el lienzo **y la
   exportación completa** de esa pieza.
3. **[VERIFICADO]** La sincronización inicial puede pisar lo que escribiste en
   los primeros segundos.

Los otros cinco: Ctrl+Z no funciona en campañas Search; el botón Atrás no cambia
la vista; abrir una pieza la marca como editada; fuga de temporizadores al
teclear; el email exportado arrastra CSS que Outlook ignora.

**Tamaño:** los tres primeros, pequeño cada uno.

---

## F. Seguridad

**[VERIFICADO en vivo]** Un usuario limitado puede guardar un bloque de código
con JavaScript; cuando el administrador abre la vista previa de ese espacio, el
script corre con la sesión del administrador y puede leer los espacios de todos.
El iframe de vista previa no tiene aislamiento.

No afecta lo que se ve, pero es real.

**Tamaño:** pequeño.

---

## Orden recomendado

**[CRITERIO]** Ordenado por cuánto cambia lo que se ve:

| # | Trabajo | Tamaño | Por qué ahí |
|---|---|---|---|
| 1 | **A1** Layouts de banner | grande | Es la crítica principal. Nada más mueve tanto la aguja. |
| 2 | **B1** Que la IA vea las fotos | pequeño | Barato, inmediato, y una foto mal elegida se nota siempre. |
| 3 | **A2** Escala por formato | mediano | Sin esto, los tamaños grandes siguen siendo un zoom. |
| 4 | **B2** Bucle de revisión visual | mediano | Convierte el sistema en algo que se autocorrige. |
| 5 | **A3** Copy por formato | pequeño | Remata el trabajo de layouts. |
| 6 | **C** Banco de referencias | pequeño | Sube el piso de todas las marcas. |
| 7 | **E** Los tres defectos que pierden trabajo | pequeño | Bajo riesgo, evita disgustos. |
| 8 | **F** Seguridad | pequeño | No se ve, pero hay que cerrarlo. |
| 9 | **A?** Email a prueba de Outlook | grande | El más caro; solo si el correo es canal prioritario. |

---

## Lo que NO puedo garantizar

Para que quede escrito:

- **No puedo garantizar que la dirección apruebe el resultado.** Puedo
  garantizar que el sistema deje de tener una sola composición, que la IA vea lo
  que produce y que las reglas de marca se comprueben. El juicio final es de
  quien mira.
- **No puedo dar horas exactas.** "Grande" es varias sesiones de trabajo;
  "mediano", una; "pequeño", parte de una.
- **El punto 4 (bucle visual) encarece cada generación.** Es una decisión de
  costo que hay que tomar con los números a la vista.

---

## Bloqueo actual

Para poder probar cualquiera de estos cambios en la URL de preview hacen falta
los secretos del entorno **Preview** en Cloudflare (ver `BORRADOR.md`). Sin
`GEMINI_API_KEY` en Preview, la IA no responde en el borrador.
