#!/bin/bash
# Uso: medir.sh etiqueta modelo entrada [flags de separar.py...]   (PATH sin ffmpeg)
source "$(dirname "$0")/env.sh"; cd "$(dirname "$0")"
et=$1; mod=$2; ent=$3; shift 3
rm -rf salida/pistas/$et
env -i HOME=$HOME PATH=/usr/bin:/bin .venv/bin/python separar.py --modelo $mod --entrada $ent \
  --salida salida/pistas/$et --modelos-dir salida/modelos --etiqueta $et "$@" 2> salida/logs/$et.err | tee salida/logs/$et.out | grep RESULTADO
