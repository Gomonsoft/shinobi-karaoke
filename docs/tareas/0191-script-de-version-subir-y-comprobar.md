# 0191 — Script de versión: subir y comprobar

- Estado: Pendiente
- Paso del pipeline: 0 (distribución)
- Depende de: —
- ADRs: 0020 (§2, §3), 0012
- Spec UX: no aplica
- ¿Red?: no

## Objetivo

Un único número de versión para app y worker, que se sube con una orden y que el workflow puede comprobar contra la etiqueta `v*`, según el ADR 0020 §2 y §3.

## Criterios de aceptación

- [ ] `app/scripts/version.mjs` (Node, sin dependencias nuevas; `yaml` ya está si hiciera falta, pero `package.json` se lee como JSON y el resto con expresiones acotadas) con dos órdenes:
  - `subir <semver>`: valida el formato de §2 (`X.Y.Z` o `X.Y.Z-(alpha|beta|rc).N`, `N ≥ 1`), rechaza una versión menor o igual que la actual (orden SemVer, con previas antes de la estable) y escribe los 5 sitios: `app/package.json`, las dos entradas raíz de `app/package-lock.json` (`version` y `packages[""].version`), `worker/pyproject.toml` (`[project] version`), `worker/shinobi_worker/__init__.py` (`__version__`) y la entrada `name = "shinobi-worker"` de `worker/uv.lock`. Los tres del worker, en PEP 440 normalizada (`-alpha.N` → `aN`, `-beta.N` → `bN`, `-rc.N` → `rcN`). Edita solo la línea de la versión: el resto de cada archivo queda idéntico byte a byte. No hace commits ni etiquetas.
  - `comprobar [--etiqueta vX.Y.Z[-…]] [--salida-github]`: lee los 5 sitios, falla (código ≠ 0 y mensaje que nombra el archivo discrepante) si no coinciden tras traducir a PEP 440; con `--etiqueta`, falla si la etiqueta no cumple la expresión de §2 o no es `v` + la versión SemVer; con `--salida-github`, escribe `version`, `etiqueta`, `previa` (`true`/`false`) y `version_pep440` en `GITHUB_OUTPUT`.
- [ ] Scripts en `app/package.json`: `version:subir` y `version:comprobar`.
- [ ] Funciones puras exportadas (validar, comparar, traducir a PEP 440, analizar etiqueta) con su `.d.mts` como el resto de `scripts/`.
- [ ] Con los archivos actuales, `npm run version:comprobar` pasa e imprime `0.1.0`.
- [ ] Subir la versión no altera el `sha256_requisitos` del manifiesto del runtime: los archivos de `worker/requisitos/` y `resources/runtime-manifest.json` no cambian (comprobado con `git diff --stat` tras un `subir` de prueba que luego se revierte).
- [ ] `uv lock --check` (en `worker/`) sigue aceptando el `uv.lock` editado. Si `uv` necesitara red para comprobarlo, se anota y se confía en el CI.

## Pruebas de feedback

- Unitarias (`app/scripts/version.test.ts`): formato válido e inválido (`0.2.0-alpha`, `0.2.0-alpha.0`, `v0.2.0`, `0.2`, `01.2.0`); traducción a PEP 440 de las tres previas y de la estable; orden (`0.2.0-alpha.1 < 0.2.0-alpha.2 < 0.2.0-beta.1 < 0.2.0-rc.1 < 0.2.0 < 0.2.1`); `subir` sobre copias en una carpeta temporal de los 5 archivos reales (fixtures) cambia solo la línea de versión; `comprobar` detecta cada uno de los 5 archivos desalineado y una etiqueta distinta.
- E2E: ninguna.
- Críticos: no.
- Manual: ninguno.

## Notas de implementación

(las rellena el programador al terminar)
