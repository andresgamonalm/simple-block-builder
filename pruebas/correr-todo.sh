#!/usr/bin/env bash
# Batería completa del aplicativo. Levanta un servidor local con mocks de /api/*
# y corre todas las pruebas contra ese servidor, sin tocar producción ni D1.
#
#   bash pruebas/correr-todo.sh              # todo
#   bash pruebas/correr-todo.sh geom insp    # solo las que se nombren
#
# Variables opcionales:
#   SBB_CHROMIUM  ruta al Chromium a usar (si no, el que traiga playwright)
#   SBB_PUERTO    puerto del servidor de pruebas (8099 por defecto)
set -uo pipefail
cd "$(dirname "$0")/.."
RAIZ="$(pwd)"
PUERTO="${SBB_PUERTO:-8099}"
export NODE_PATH="$RAIZ/node_modules"
export SBB_URL="http://127.0.0.1:$PUERTO"
export SBB_RAIZ="$RAIZ"

if ! node -e "require('playwright')" 2>/dev/null; then
  echo "Falta playwright. Instálalo con:  npm install playwright --no-save"
  exit 1
fi

# ── Servidor local (se apaga al terminar) ───────────────────────────────
node pruebas/srv.js "$RAIZ" "$PUERTO" > /tmp/sbb-srv.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
listo=0
for _ in $(seq 1 60); do
  if curl -s -o /dev/null "$SBB_URL/editor.html"; then listo=1; break; fi
  sleep 0.25
done
if [ "$listo" != "1" ]; then echo "El servidor de pruebas no arrancó. Mira /tmp/sbb-srv.log"; exit 1; fi

# ── Qué se corre (orden: primero lo que no necesita navegador) ───────────
TODAS=(audita-estatica login geom medir insp panel alcance iaq asis xls fb tablet migra cierres regres recorrido)
descripcion() {
  case "$1" in
    audita-estatica) echo "controles muertos, íconos y rutas (sin navegador)";;
    login)     echo "entrar con el usuario Y con el correo (sin navegador)";;
    geom)      echo "geometría cerrada contra el spec, los 11 formatos";;
    medir)     echo "los 11 banners medidos sobre el render real";;
    insp)      echo "inspector: las 6 comprobaciones y sus avisos";;
    panel)     echo "editor de banners: cuantos controles y si lo escrito se ve";;
    alcance)   echo "las 3 plataformas del manual y las paginas del §05";;
    iaq)       echo "calidad de IA: límites, carpetas de fotos, avisos";;
    asis)      echo "asistente en una sola ventana";;
    xls)       echo "planilla XLSX de Google Ads";;
    fb)        echo "Facebook Ads: máster propio y textos del anuncio";;
    tablet)    echo "tablet y edición fluida del texto";;
    migra)     echo "piezas ya guardadas (formatos antiguos) siguen abriendo";;
    cierres)   echo "cada modal abre y cierra sin dejar capas";;
    regres)    echo "regresión: email, libre, los 43 bloques, Search, export";;
    recorrido) echo "recorrido completo: cada sección y cada botón";;
    *)         echo "";;
  esac
}

SOLO=("$@")
[ ${#SOLO[@]} -eq 0 ] && SOLO=("${TODAS[@]}")

fallos=0
faltan=""
for t in "${SOLO[@]}"; do
  if [ ! -f "pruebas/$t.js" ]; then faltan="$faltan $t"; continue; fi
  printf "\n\033[1m▸ %s\033[0m  %s\n" "$t" "$(descripcion "$t")"
  salida="$(node "pruebas/$t.js" 2>&1)"; codigo=$?
  echo "$salida" | tail -45
  if [ $codigo -ne 0 ]; then fallos=$((fallos+1)); printf "\033[31m   ↑ %s terminó con código %s\033[0m\n" "$t" "$codigo"; fi
done

printf "\n%s\n" "────────────────────────────────────────────"
[ -n "$faltan" ] && printf "No existen:%s\n" "$faltan"
if [ $fallos -eq 0 ]; then printf "\033[32mTODA LA BATERÍA EN VERDE\033[0m\n"; else printf "\033[31m%s prueba(s) con fallos\033[0m\n" "$fallos"; fi
exit $fallos
