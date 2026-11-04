# worker

Worker Python de Shinobi Karaoke. Un proceso por trabajo:

```
uv run python -m shinobi_worker <comando> --args '<json>'
```

Habla JSON Lines por stdout (`docs/arquitectura.md` seccion 6); stderr es para registros y trazas. Codigos de salida: 0 ok, 1 error, 2 argumentos no validos.

Comandos: `version`, `demo` (`{"segundos": n, "fallar_en": 0..1|null, "indeterminado_s": n, "ruta_parcial": "ruta"}`).

Desarrollo: `uv sync`, `uv run pytest`, `uv run ruff check`, `uv run ruff format --check`.

Convencion: el worker no crea procesos hijos; si un comando futuro los necesita, debe terminarlos al recibir SIGTERM (el gestor mata el arbol: SIGTERM, SIGKILL a los 3 s; `taskkill /T /F` en Windows).
