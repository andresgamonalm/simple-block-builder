// Genera CONTRATO-CAMPANA.md desde nucleo/modelo.js y nucleo/ads-editor.js.
// El contrato NO se edita a mano: se regenera con
//     node nucleo/generar-contrato.js
// y la prueba pruebas/nucleo-contrato.js falla si quedó desactualizado.
const fs = require('fs'), path = require('path');
const M = require('./modelo.js');
const AE = require('./ads-editor.js');
const R = require('./reglas.js');

function contrato() {
  const L = [];
  L.push('# Contrato de campaña · Mi Publicidad (`' + M.VERSION_ESQUEMA + '`)');
  L.push('');
  L.push('> **Documento generado** desde `nucleo/modelo.js` y `nucleo/ads-editor.js`. No se edita a mano:');
  L.push('> `node nucleo/generar-contrato.js`. Es la referencia para personas **y para la IA**.');
  L.push('');
  L.push('## 1. Qué es');
  L.push('La campaña se guarda con la misma forma que Google Ads Editor. Exportar es escribir filas, no traducir.');
  L.push('Montos siempre en **' + M.MONEDA + '** (pesos chilenos, enteros).');
  L.push('');
  L.push('```');
  L.push('Iniciativa ─ campañas[] ─ grupos[] ─ keywords[] · negativas[] · anuncios[]');
  L.push('                        └ ubicaciones · edades excluidas · negativas de campaña');
  L.push('                          sitelinks · destacados · fragmentos');
  L.push('```');
  L.push('');
  L.push('**Identificadores:** cada elemento tiene un `id` estable. Las correcciones por partes');
  L.push('("cambia solo los títulos del grupo X") apuntan a ese `id`; nunca se regenera la campaña entera.');
  L.push('');
  L.push('## 2. El archivo para Ads Editor');
  L.push('- Un solo archivo CSV, **UTF-8 con BOM**, separado por **comas**, líneas **CRLF**.');
  L.push('- **' + AE.COLUMNAS.length + ' columnas**, siempre en este orden:');
  L.push('');
  L.push('  `' + AE.COLUMNAS.join('` · `') + '`');
  L.push('');
  L.push('- **Orden de las filas:** 1) campañas, cada una seguida de sus ubicaciones y edades excluidas ·');
  L.push('  2) grupos, cada uno seguido de sus anuncios · 3) keywords · 4) negativas (de grupo y luego de campaña) ·');
  L.push('  5) sitelinks, destacados y fragmentos, por campaña.');
  L.push('- **Garantía:** importar el archivo y volver a exportarlo da el mismo archivo, byte a byte');
  L.push('  (prueba `pruebas/nucleo.js`). Lo que el modelo no entiende se conserva y se devuelve tal cual.');
  L.push('');
  L.push('- **Columnas opcionales** (se agregan al final solo si se usan): `' + AE.COLUMNAS_OPCIONALES.join('` · `') + '`.');
  L.push('- **Nombre del archivo:** `<base>-ads-editor-<aaaa-mm-dd>.csv`, en minúsculas y con guion. `base` = el nombre de la campaña si es');
  L.push('  una; el prefijo común de los nombres si son varias (`chl-producto-auto-digital-ads-editor-2026-09-26.csv`); si no, la iniciativa.');
  L.push('');
  L.push('### Cómo reconoce Ads Editor cada fila');
  L.push('| Fila | Columnas que la identifican |');
  L.push('|---|---|');
  L.push('| Campaña | `Campaign type` lleno |');
  L.push('| Ubicación | `Location` + `Location ID` |');
  L.push('| Edad excluida | `Type` = `Campaign negative` + `Age` |');
  L.push('| Grupo | `Ad Group` + `Ad Group Status` |');
  L.push('| Anuncio adaptable (RSA) | `Headline 1…15` (+ `Headline N position` si va fijado) y `Description 1…4` |');
  L.push('| Keyword | `Keyword` + `Type` = `Exact` / `Phrase` |');
  L.push('| Negativa de campaña | `Type` = `Campaign negative` + `Keyword` |');
  L.push('| Sitelink | `Sitelink text` (+ `Description 1/2`, `Final URL`) |');
  L.push('| Destacado | `Callout text` |');
  L.push('| Fragmento estructurado | `Header` + `Snippet Values` (valores separados por `;`) |');
  L.push('| UTM | `Tracking template` o `Final URL suffix` en la fila de la campaña; `Final URL suffix` también en la del anuncio |');
  L.push('');
  L.push('## 3. Entidades y campos');
  for (const e of M.ESQUEMA) {
    L.push('');
    L.push('### ' + e.titulo + ' (`' + e.entidad + '`)');
    if (e.descripcion) L.push(e.descripcion);
    L.push('');
    L.push('| Campo | Tipo | Oblig. | Límite | Columna Ads Editor | Qué es |');
    L.push('|---|---|---|---|---|---|');
    for (const c of e.campos) {
      const desc = [c.descripcion || '', c.valores ? 'Valores: ' + c.valores.map(v => '`' + v + '`').join(', ') + '.' : ''].filter(Boolean).join(' ');
      L.push(`| \`${c.campo}\` | ${c.tipo} | ${c.obligatorio ? 'sí' : ''} | ${c.limite || ''} | ${c.columna ? '`' + c.columna + '`' : '—'} | ${desc.replace(/\|/g, '\\|')} |`);
    }
  }
  L.push('');
  L.push('## 4. Límites de Google (Search)');
  L.push('| Elemento | Límite |');
  L.push('|---|---|');
  const Lm = M.LIMITES;
  [['Título de anuncio', Lm.titulo + ' caracteres · entre ' + Lm.titulosMin + ' y ' + Lm.titulosMax],
   ['Descripción de anuncio', Lm.descripcion + ' caracteres · entre ' + Lm.descripcionesMin + ' y ' + Lm.descripcionesMax],
   ['Ruta (Path 1/2)', Lm.ruta + ' caracteres'],
   ['Sitelink', 'texto ' + Lm.sitelinkTexto + ' · cada línea ' + Lm.sitelinkLinea],
   ['Texto destacado', Lm.destacado + ' caracteres'],
   ['Fragmento estructurado', 'valores de ' + Lm.fragmentoValor + ' caracteres · entre ' + Lm.fragmentoValoresMin + ' y ' + Lm.fragmentoValoresMax],
   ['Keyword', Lm.keywordCaracteres + ' caracteres · ' + Lm.keywordPalabras + ' palabras']
  ].forEach(([a, b]) => L.push('| ' + a + ' | ' + b + ' |'));
  L.push('');
  L.push('## 5. Protocolo de la casa: nombres y UTM');
  L.push('Lámina "Reglas y requisitos ADS". Todo nombre va en **minúsculas, sin tildes, sin símbolos y con guion medio**.');
  L.push('');
  L.push('| Nivel | Estructura | Ejemplos |');
  L.push('|---|---|---|');
  L.push('| Campaña | `<sigla país>-producto-<nombre del producto>-<tipo de campaña>` | `chl-producto-auto-digital-always-on` · `chl-producto-auto-digital-promociones` |');
  L.push('| Grupo de anuncios | `<abreviatura del tipo>-<naturaleza>` (' + Object.entries(M.PROTOCOLO.abreviaturaTipo).map(([k, v]) => k + ' → ' + v).join(', ') + ') | `ao-coberturas` · `promo-cuotas` |');
  L.push('| Anuncio | `ads-<característica>` | `ads-anual` · `ads-bienal` · `ads-3-cuotas-gratis` |');
  L.push('');
  L.push('**Títulos:** ' + M.PROTOCOLO.fijadosPosicion1 + ' fijados en la posición 1 (con la marca o la oferta/precio) y ' + M.PROTOCOLO.titulosRotativos + ' que rotan.');
  L.push('**Recursos:** al menos ' + M.PROTOCOLO.sitelinksMin + ' sitelinks, cada uno a una página distinta de la URL principal; ' + M.PROTOCOLO.destacadosMin + ' o más textos destacados.');
  L.push('');
  L.push('**UTM** — `utm_source=' + M.PROTOCOLO.utmSource + '` · `utm_medium=clics` (pujas por clic) o `conversion` (pujas por conversión) ·');
  L.push('`utm_campaign=<nombre exacto de la campaña>` · `utm_content=<nombre del anuncio>`. Van en minúsculas y con guion.');
  L.push('- **Por defecto van en el sufijo de URL final** (`Final URL suffix`): es lo que recomienda Google y permite `utm_content` por');
  L.push('  anuncio. El sufijo del anuncio **reemplaza** al de la campaña, por eso lleva las UTM completas + `utm_content`.');
  L.push('- **Alternativa:** plantilla de seguimiento (`Tracking template`) `{lpurl}?utm_source=…`. No se mezcla con sufijos: si el anuncio');
  L.push('  agregara el suyo, la URL quedaría con dos `?`.');
  L.push('- Google no tiene campo "nombre" para el anuncio adaptable de búsqueda: el nombre `ads-…` viaja en `utm_content`.');
  L.push('');
  L.push('## 6. Reglas que toda campaña debe cumplir');
  L.push('Las aplica `nucleo/reglas.js` en la IA (antes y después de generar), en la pantalla y antes de exportar.');
  L.push('**error** = bloquea la exportación · **aviso** = hay que revisarlo · **sugerencia** = mejora opcional.');
  L.push('');
  L.push('| Código | Nivel | Tipo | Qué revisa |');
  L.push('|---|---|---|---|');
  R.REGLAS.forEach(r => L.push('| ' + r.codigo + ' | ' + r.nivel + ' | ' + r.categoria + ' | ' + r.que.replace(/\|/g, '\\|') + ' |'));
  L.push('');
  L.push('Cada hallazgo apunta al `id` del elemento: una corrección puede tocar solo esa parte.');
  L.push('');
  L.push('## 7. Pendiente de confirmar en la primera importación real');
  L.push('El archivo de referencia del usuario solo trae negativas amplias de campaña. Estas notaciones siguen la');
  L.push('convención de Ads Editor, pero todavía no se han visto importadas:');
  L.push('- Negativa de **frase** escrita como `"texto"` y de **exacta** como `[texto]` en la columna `Keyword`.');
  L.push('- Negativa **de grupo**: `Type` = `Negative` con `Ad Group` lleno.');
  L.push('- El **método de ubicación** ("presencia") no tiene columna en el contrato de 60: hoy se fija en Ads Editor (regla K05).');
  L.push('- Nombres de columna `Tracking template` y `Final URL suffix` (a nivel de campaña y de anuncio).');
  L.push('- **Extensión de precio:** está modelada y validada (regla G14), pero NO se exporta hasta confirmar sus columnas.');
  L.push('- **Display y Performance Max** aún no forman parte del contrato.');
  L.push('');
  return L.join('\n');
}

if (require.main === module) {
  const destino = path.join(__dirname, '..', 'CONTRATO-CAMPANA.md');
  fs.writeFileSync(destino, contrato());
  console.log('Escrito', destino);
}
module.exports = { contrato };
