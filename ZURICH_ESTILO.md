# Marco teórico · Estilo Zurich para creatividades digitales

> Fuente: carpeta Drive del usuario (jul-2026) — Brandbook Zurich 2024 (oficial), logos digitales
> 2022, campañas reales de Display/Search/Email (Ads Transparency + piezas propias) y fotos
> corporativas. Este documento es el "aprendizaje" persistente: lo que la app aplica está
> grabado en la marca Zurich (campo Directrices), en el compositor y en los motores de IA.
> **Decisión del usuario: tipografía ARIAL** (alternativa oficial del manual cuando no está
> Zurich Sans — pág. 6 del Brandbook).

## 1 · Paleta oficial (Brandbook 2024)

| Rol | Nombre | HEX |
|---|---|---|
| Héroe (uso constante) | **Azul Zurich** | `#2167AE` |
| Marca | Azul Oscuro | `#23366F` |
| Marca | Azul Medio | `#5495CF` |
| Marca | Azul Claro | `#91BFE3` |
| Marca | Celeste | `#1FB1E6` |
| Neutro | Piedra arenisca | `#DAD2BD` |
| Neutro | Paloma | `#DDE4E3` |
| Neutro | Blanco de Zurich | `#ECEEEF` |
| Acento | Celeste 2 | `#4870C6` |
| Acento | Musgo | `#77A984` |
| Acento | Cerceta | `#19BAB6` |
| Acento | Menta | `#A6E9AB` |
| Acento | **Lima** (la oferta) | `#FFF773` |
| Acento | Durazno | `#FF7569` |
| Acento | Caramelo | `#E18EBA` |
| Acento | Rosa empolvado | `#FFC5EA` |
| Acento | Lila | `#6D6BCF` |

Reglas del manual: los acentos **no** se usan como fondo completo (sí como fondo del círculo
grande con texto o pictograma); con imagen, el fondo es color de marca. En la app: `primary`
#2167AE · `secondary` #23366F (fondo de banners) · `accent1` #FFF773 (círculo de oferta) ·
`accent2` #91BFE3 (burbujas decorativas) · fondo de página #ECEEEF.

## 2 · Tipografía

- Oficial: Zurich Sans (5 pesos) + Ogg (caligráfica, solo 1–3 palabras de un titular, nunca sola,
  nunca en bajadas, nunca la palabra "Zurich").
- **Arial es la alternativa oficial** cuando Zurich Sans no está disponible → ES NUESTRO CASO.
  Toda pieza de la app usa Arial (títulos y cuerpo). El énfasis estilo Ogg se aproxima con
  *cursiva* en 1–3 palabras del titular (nunca todo el titular).

## 3 · Lenguaje de formas (las burbujas)

Del manual: composiciones de círculos/semicírculos **conectadas a los bordes** ("a tierra",
nunca flotando ni "colgando"), **3+ formas** de escalas distintas, nunca dos colores iguales
juntos, nunca superpuestas, siempre paleta de marca. En la app: `deco` (burbujas decorativas
ancladas a los bordes) + `burbuja` de oferta (círculo Lima con el número grande — patrón de
sus campañas reales: "2 Cuotas Gratis", "60% dcto.").

## 4 · Fotografía

Principio central del manual: **"¿podría ser una foto del carrete de tu teléfono?"** — natural,
no posada, personas reales "en un momento de compromiso", luz natural, blancos equilibrados,
espacio negativo hacia el sujeto. PROHIBIDO: look de banco de imágenes, grupos posados, poses
irreales, imágenes corporativas viejas, destellos/filtros/sobreestilización, superposiciones
gráficas. Objetos: perfiles gráficos y simples. (Las "Fotos-Propias" del Drive — recortes de
papel, fondos de color plano, objetos gráficos — calzan con la línea de ilustración/objetos.)

## 5 · Anatomía del banner display (sistema de sus campañas + manual)

1. Fondo plano Azul Oscuro `#23366F` o Azul Zurich (o foto con velo).
2. Logo blanco arriba-izquierda (regla de co-branding: siempre esquina superior izquierda).
3. Etiqueta chica del tipo de producto ("Seguro") sobre el nombre del producto.
4. **La oferta en un círculo Lima con el número gigante** — el elemento firma.
5. Burbujas decorativas azul claro asomando por los bordes.
6. CTA sobrio; legal en letra chica.
Sin degradados, sin sombras, sin bordes redondeados en contenido.

## 6 · Diagnóstico: por qué sus gráficas actuales están "mal planteadas para digital"

- **Display**: exceso de texto legal dentro del banner (ilegible en 300×250); jerarquía plana
  (producto, oferta y sorteo compiten); versiones que rompen su propio manual (formas
  flotando, colores repetidos juntos); el mismo arte apretado en todos los tamaños en vez de
  recomponer por formato. → La app recompone por tamaño (overrides por artboard) y limita
  cada banner a UNA oferta + UN producto + UN CTA.
- **Search (los "malísimos" — confirmado con OCR de las piezas reales)**: copy que habla del
  anuncio y no del cliente (*"esta campaña fue creada para convertir"* — textual), keyword
  stuffing (*"seguro auto online"* repetido), relleno sin contenido (*"rápido, fácil y online"*),
  descripciones que mezclan productos sin relación (*"Seguro SOAP 2026. Seguro de Salud"* en
  un anuncio de auto). → Grabado como PROHIBICIONES en el motor de Search de la app.
- **Email**: estructura correcta (banda de marca, un CTA, legal al pie) pero copy plano y
  jerarquía débil. El estándar de la app (hero → oferta → beneficios → un CTA) ya lo supera.

## 7 · Dónde quedó grabado el aprendizaje (no rehacer)

- **Marca Zurich (D1 + plantilla)**: paleta oficial, Arial/Arial, eslogan real ("Tu mejor
  compañía para el futuro"), campo **Directrices** con las reglas de diagramación/foto/copy →
  `voorMarca()` las inyecta en TODOS los prompts (email, banner, search, textos, concepto).
- **Compositor**: burbuja de oferta, etiqueta de producto y burbujas decorativas (ya existían);
  ahora con los colores oficiales vía acentos de la marca.
- **Motor Search**: anti-reglas universales (no meta-copy, no keyword stuffing, no relleno,
  una cosa concreta por descripción).
- **Recursos**: logos digitales 2022 (Logo-Digital/Large: azul, blanco y negro, horizontal y
  vertical) y ~50 fotos corporativas → los sube el usuario a la app (Marcas → logos ·
  Biblioteca → fotos); los nombres de archivo del Drive ya son descriptivos (la IA elige por
  descripción). Los .EPS y .ZIP de respaldo no se usan.
