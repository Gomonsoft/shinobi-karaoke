# 0253 — Workflow: canal de compilaciones de desarrollo (`shinobi-karaoke-builds`)
- Estado: Hecha (implementación; el ensayo en GitHub lo hace la sesión principal)
- Paso del pipeline: 0 (distribución)
- Depende de: 0251, 0252 (mismo archivo y mismo `preparar-publicacion.mjs`)
- ADRs: [0020](../adr/0020-publicacion-en-github-releases-y-politica-de-versiones.md), «Revisión para 0.2.0 — fase 10», §4 y §6
- Spec UX: [09 §3b](../ux/09-descarga-e-instalacion.md) (título, nombres de archivo, cuerpo y README del repositorio de compilaciones), §4 y criterios de la fase 10. Corrección del ADR: la etiqueta es `build-<SHA de 40>`
- Versión: 0.2.0-alpha.2 · Fase 10, punto 2
- Pregunta: [0143](../preguntas/0143-canal-de-desarrollo-configuracion-y-carpeta-de-datos.md) (usuario; no bloquea)

## Objetivo
Publicar cada compilación de `develop` como una *Release* en `Gomonsoft/shinobi-karaoke-builds`, sin que la falta de repositorio o de secreto rompa nada y sin ejecutar código del repositorio con el token de escritura.

## Contrato
- **`app/scripts/preparar-publicacion.mjs --canal desarrollo`** (sigue valiendo la llamada de siempre sin `--canal`):
  - Comprueba los 4 instaladores y sus sumas como en el canal de versiones.
  - Los copia **renombrados**: `Shinobi-Karaoke-desarrollo-<versión>-<N>-Windows-x64.exe`, `…-Mac-chip-Apple.dmg`, `…-Linux-x64.AppImage` y `shinobi-karaoke-desarrollo-<versión>-<N>-linux-x64.deb`. La función de renombrado es pura y tiene test.
  - Genera `SHA256SUMS.txt` con los nombres nuevos.
  - Compone `notas.md` con el cuerpo de §3b: `{FECHA}` larga en español en UTC; tamaños en MB decimales con una cifra y coma; SHA-256; enlace al commit y al árbol de fuentes; ejecución de CI; «Cambios desde…» con `compare/<sha anterior>...<sha>`, o la frase de la primera compilación si no hay anterior. Falla si queda algún `{…}`.
  - Escribe `datos.json` (`etiqueta: build-<sha>`, `titulo: <versión>-<N>`) y el resumen.
  - Recibe `--anterior <sha|''>`.
- **Trabajo `preparar-desarrollo`**: `needs` de `comprobar-version`, `construir` y `probar-instalador`; `if: needs.comprobar-version.outputs.desarrollo != 'omitir'`; `contents: read`.
  - `checkout` de `sha` y descarga de artefactos por el patrón con `sha`.
  - Si el canal está configurado, obtiene `--anterior` leyendo con el `GITHUB_TOKEN` la última *Release* de `vars.COMPILACIONES_REPO` (`gh release view -R … --json tagName`, quitando `build-`).
  - Sube el artefacto `compilacion-<versión>-<N>` con `retention-days: 14`.
- **Trabajo `publicar-desarrollo`**: `needs` de `comprobar-version` y `preparar-desarrollo`; `if: needs.comprobar-version.outputs.desarrollo == 'publicar'`; `permissions: contents: read`.
  - Variables **solo en este trabajo**: `GH_TOKEN: ${{ secrets.COMPILACIONES_TOKEN }}` y `GH_REPO: ${{ vars.COMPILACIONES_REPO }}`. **Sin `checkout`, sin `npm` y sin `node` del repositorio.**
  - Pasos:
    1. Descarga el artefacto.
    2. Si `build-<sha>` ya existe, `::notice::` y sale con 0.
    3. `gh release create "build-<sha>" --draft --title "<versión>-<N>" --notes-file notas.md <4 instaladores> SHA256SUMS.txt`.
    4. Compara nombres y tamaños subidos con `gh release view --json assets`, como en `publicar`.
    5. Publica con `gh release edit "build-<sha>" --draft=false --latest`.
    6. Escribe el enlace en el resumen.
  - Un error de autenticación o de permisos **falla** el trabajo (configurado pero roto).
- **README del repositorio de compilaciones**: copia literal del texto de §3b en `docs/versiones/0.2.0/compilaciones-README.md`, para que el usuario lo use como commit inicial (0143).
- **`docs/workflow.md`**:
  - Apartado «Canal de compilaciones de desarrollo»: qué es, cuándo se publica, cómo lanzarla a mano (`gh workflow run empaquetado.yml --ref develop`) y los pasos del usuario (ADR §6, 0143).
  - En «Publicar una versión», un paso final: subir `develop` a la siguiente previa en un PR propio (ADR §2).
  - En «Ajustes del repositorio», la variable `COMPILACIONES_REPO`, el secreto `COMPILACIONES_TOKEN` y la protección de `develop`.
- `workflow-empaquetado.test.ts` comprueba:
  - que `COMPILACIONES_TOKEN` solo aparece completo en `publicar-desarrollo` (y como `!= ''` en `comprobar-version`);
  - que `publicar-desarrollo` no tiene `checkout` ni `run` con `node`/`npm`;
  - que es el único trabajo nuevo con el token;
  - que los permisos de la raíz siguen siendo `contents: read`.

## Criterios de aceptación
- [ ] Tests de renombrado, cuerpo (con anterior y sin anterior), tamaños y fecha, y fallo con marcador sin resolver.
- [ ] Ensayo `gh workflow run empaquetado.yml --ref alpha-2` (0255): `preparar-desarrollo` sube `compilacion-<versión>-<N>` con los nombres de §3b y un `notas.md` sin marcadores; `publicar-desarrollo` aparece omitido.
- [ ] Sin el canal configurado, una ejecución con `--ref develop` termina en verde con `desarrollo = ensayo`.
- [ ] Con el canal configurado (cuando el usuario lo haga, 0143): una ejecución con `--ref develop` crea `build-<sha>` con título `<versión>-<N>`, los 5 archivos y *Latest*; una segunda ejecución sobre el mismo commit no crea nada y termina en verde. Lo comprueba la sesión principal; si el usuario aún no ha configurado el canal, queda como caso de la guía.

## Pruebas de feedback
- Unitarias: `preparar-publicacion.test.ts` y `workflow-empaquetado.test.ts`.
- E2E: ninguna.
- Críticos: no.
- Manual (guía de la versión): descargar sin sesión un instalador de `…/shinobi-karaoke-builds/releases/latest`, comprobar su SHA-256 con el cuerpo e instalarlo encima de la versión publicada. «Acerca de» muestra el canal `desarrollo`.

## Notas de implementación

**Hecho.**
- `preparar-publicacion.mjs --canal desarrollo --entrada … --salida … --version … --compilacion <versión>-<N> --sha … --anterior <sha|''> --ejecucion …`: comprueba los 4 instaladores y sus sumas, los copia renombrados (`nombreDesarrollo`, pura), genera `SHA256SUMS.txt` con los nombres nuevos, compone `notas.md` desde `.github/publicacion/cuerpo-desarrollo.md` (texto de la spec 09 §3b: `{FECHA}` larga en UTC, MB decimales con coma, SHA-256, enlaces al commit y al árbol, ejecución, «Cambios desde…» con `compare/<anterior completo>...<sha completo>` o «Es la primera compilación de este canal.») y falla con cualquier `{…}` sin resolver; escribe `datos.json` (`etiqueta: build-<sha>`, `titulo`, `version`, `sha`, `archivos`) y el resumen. Valida que `--sha` y `--anterior` tengan 40 hexadecimales y que `--compilacion` sea `<versión>-<N>`.
- `empaquetado.yml`: `preparar-desarrollo` (`contents: read`; `if desarrollo != 'omitir' && construir`; checkout de `sha`; lee con el `GITHUB_TOKEN` la última *Release* del repositorio de compilaciones solo si `configurado`; sube `compilacion-<versión>-<N>`, 14 días) y `publicar-desarrollo` (`contents: read`; `if desarrollo == 'publicar'`; `GH_TOKEN` = `secrets.COMPILACIONES_TOKEN` y `GH_REPO` = `vars.COMPILACIONES_REPO` solo aquí; sin checkout, npm ni node; si `build-<sha>` ya existe avisa y sale en verde; `gh release create --draft`, compara nombres y tamaños, `gh release edit --draft=false --latest`, enlace en el resumen; cualquier error de `gh` distinto de «release not found» hace fallar el trabajo).
- `docs/versiones/0.2.0/compilaciones-README.md`: copia literal del README de §3b para el commit inicial.
- `docs/workflow.md`: apartado «Canal de compilaciones de desarrollo», paso 7 de «Publicar una versión» (subir `develop` a la siguiente previa en un PR propio) y los ajustes (`COMPILACIONES_REPO`, `COMPILACIONES_TOKEN`, protección de `develop`).
- Archivos: `app/scripts/preparar-publicacion.mjs` (+ `.d.mts`, `.test.ts`), `.github/publicacion/cuerpo-desarrollo.md`, `.github/workflows/empaquetado.yml`, `app/scripts/workflow-empaquetado.test.ts`, `docs/workflow.md`, `docs/versiones/0.2.0/compilaciones-README.md`.
- `workflow-empaquetado.test.ts` comprueba: `COMPILACIONES_TOKEN` completo solo en `publicar-desarrollo` y como `!= ''` en `comprobar-version` (2 apariciones en todo el archivo); sin checkout ni `node`/`npm` en `publicar-desarrollo`; único trabajo nuevo con el token; permisos de la raíz `contents: read`.

**Decisiones menores.** (a) «Última compilación» con `gh release list -R … --exclude-drafts --limit 1 --json tagName --jq '.[0].tagName // empty'` en vez de `gh release view`, porque una lista vacía no es un error. (b) Los nombres de los instaladores se leen de `datos.json` (`jq`) en `publicar-desarrollo`; la etiqueta, el título y el SHA llegan por `env` desde las salidas de `comprobar-version`, no del artefacto. (c) Un borrador `build-<sha>` huérfano de una ejecución anterior que falló a medias no lo ve `gh release view`, así que `create` haría otro borrador con la misma etiqueta: caso raro, sin tratar (se borra a mano).

**Sin verificar en local.** El ensayo `gh workflow run empaquetado.yml --ref alpha-2` (0255): `preparar-desarrollo` sube `compilacion-<versión>-<N>` con los cuatro nombres de §3b y un `notas.md` sin marcadores, y `publicar-desarrollo` aparece omitido. La publicación real (crear `build-<sha>`, *Latest*, segunda ejecución sin crear nada, token caducado que falla) requiere que el usuario configure el canal (0143): queda como caso de la guía. También: `gh release create` sin `--target` y con `GH_REPO` sin clon local, y que `gh release view` imprima «release not found» (el «no existe» depende de ese texto).

**Pasos manuales del usuario** (0143, también en `docs/workflow.md`): crear `Gomonsoft/shinobi-karaoke-builds` (público, commit inicial con `compilaciones-README.md`), token *fine-grained* con Contents: Read and write solo en ese repositorio, secreto `COMPILACIONES_TOKEN`, variable `COMPILACIONES_REPO` y protección de `develop`.
