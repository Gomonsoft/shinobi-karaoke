# Uso: source spikes/separacion/env.sh  (todo queda dentro de spikes/separacion)
S="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
export UV_CACHE_DIR="$S/salida/uv-cache" UV_PYTHON_INSTALL_DIR="$S/salida/uv-python"
export UV_PYTHON_PREFERENCE=only-managed UV_NO_CONFIG=1
export UV="$S/salida/bin/uv" VENV="$S/.venv"
