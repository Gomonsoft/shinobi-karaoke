# 0020 — Publicación en GitHub Releases por etiqueta y política de versiones

- Estado: Aceptado
- Fecha: 2026-11-20
- Paso del pipeline: 0 (distribución)

## Contexto
El usuario pide (2026-11-20) que, **a partir de 0.2.0, cada versión tenga su *Release*** en GitHub, generada por un workflow. Hasta ahora:

- `empaquetado.yml` (ADR 0013) construye y prueba los instaladores de los 3 SO, **solo con `workflow_dispatch`**, con `permissions: contents: read` y sin publicar. El propio ADR 0013 preveía añadir el disparador por etiqueta "cuando se decida" el flujo de versión.
- El repositorio ya es público (`preguntas/0035`), así que el código fuente de cada etiqueta queda disponible: la obligación de la GPL se cumple con los archivos de código que GitHub adjunta a cada *Release*.
- No hay ninguna etiqueta ni *Release* (`git tag`, `gh release list`: vacíos, 2026-11-20). `app/package.json`, `package-lock.json`, `worker/pyproject.toml`, `worker/shinobi_worker/__init__.py` y la entrada `shinobi-worker` de `worker/uv.lock` dicen **0.1.0**.
- `preguntas/0036` (número y política de versiones) sigue **abierta**. El usuario pidió no detener el trabajo: se adopta una política provisional (§2) y se deja anotada en 0036.
- El plan de 0.2.0 cierra la versión con la etiqueta `v0.2.0-alpha` tras fusionar en `main` (`docs/workflow.md`).

### Comprobaciones hechas (2026-11-20)
| Qué | Resultado | Fuente |
|---|---|---|
| Acciones fijadas en el ADR 0013 | Siguen siendo la última versión publicada y los SHA coinciden: `checkout` v7.0.1 `3d3c42e…`, `setup-node` v7.1.0 `949feb2…`, `upload-artifact` v7.0.2 `cf430e0…`, `download-artifact` v8.0.2 `9000827…` | `gh api repos/actions/<acción>/releases/latest` y `git/ref/tags/<etiqueta>` |
| `download-artifact` v8.0.2 | Admite `pattern` y `merge-multiple`; desde v8 un *digest* distinto falla por defecto | `action.yml` en v8.0.2; notas de v8.0.0 |
| *Release* "latest" | "The latest release is the most recent **non-prerelease, non-draft** release". "Drafts and prereleases cannot be set as latest" | Documentación REST de *Releases* |
| *Immutable releases* | Bloquean la etiqueta y los recursos al publicar; GitHub recomienda **crear en borrador, adjuntar todo y publicar**. Generan una atestación de la *Release* | Documentación de GitHub |
| `.deb` con versión previa | electron-builder 26.18.0 convierte `-` en `~` para `deb` (`LinuxTargetHelper.getSanitizedVersion`): `0.2.0-alpha.1` → `0.2.0~alpha.1`, que dpkg ordena **antes** de `0.2.0`. Los nombres de archivo no cambian (no llevan versión, `preguntas/0040`) | `app/node_modules/app-builder-lib/out/targets/LinuxTargetHelper.js` |
| NSIS con versión previa | `getVersionInWeirdWindowsForm` toma `parseInt` de cada parte: `0.2.0-alpha.1` → `0.2.0.0`. No falla | `app-builder-lib/out/appInfo.js` |
| `BUILD_NUMBER` | electron-builder no lee `GITHUB_RUN_NUMBER`: la versión del paquete no cambia entre ejecuciones | `appInfo.js` |
| `gh` en los runners | `gh release create` admite `--draft`, `--prerelease`, `--latest`, `--verify-tag`, `--notes-file`, `--generate-notes`; `gh release edit --draft=false` publica | `gh release create --help` (2.103.1) |

## Alternativas consideradas

### Dónde vive la publicación
| Opción | Pros | Contras |
|---|---|---|
| **Ampliar `empaquetado.yml`**: disparador `push: tags: ['v*']` y trabajos `comprobar-version`, `preparar-publicacion` y `publicar` | Cero duplicación: los mismos trabajos `construir` y `probar-instalador`. El archivo **ya está en `main`**, así que el ensayo con `workflow_dispatch` se puede lanzar ya contra `alpha-2` (`gh workflow run empaquetado.yml --ref alpha-2`) | Un archivo con dos usos. El nombre deja de decir "(manual)" |
| `publicacion.yml` nuevo que llama a `empaquetado.yml` con `workflow_call` | Separa disparadores y permisos por archivo | `workflow_dispatch` exige el archivo en la rama por defecto (ADR 0013): **no se podría ensayar** hasta fusionar en `main` un archivo nuevo, una excepción a "fusionar por fase" que ya costó la `preguntas/0038`. Más piezas (entradas, salidas y permisos entre llamante y llamado) |
| Copiar los trabajos en un workflow aparte | Independiente | Duplica la construcción y el humo: dos sitios que mantener. Descartada |

### Cómo se crea la *Release*
| Opción | Licencia | Pros | Contras |
|---|---|---|---|
| **`gh release` (CLI preinstalada en los runners)** | MIT | Sin acción de terceros que fijar ni auditar; flujo borrador → recursos → publicar explícito | Unas líneas de shell |
| `softprops/action-gh-release` | MIT | Popular, una sola acción | Acción de terceros con `contents: write`: más superficie de cadena de suministro; habría que fijarla por SHA y vigilarla |
| `actions/create-release` | MIT | Oficial en su día | Archivada y sin mantenimiento. Descartada |

### Notas de la *Release*
| Opción | Pros | Contras |
|---|---|---|
| **Cabecera fija (spec `ux/09` §3) + notas escritas a mano si existen; si no, notas generadas por GitHub** | Cumple §3; permite notas cuidadas sin bloquear una publicación | Dos fuentes que unir |
| Solo `--generate-notes` | Automático | Lista PR y commits internos, sin la cabecera de §3 ni lo no probado |
| Un `CHANGELOG.md` obligatorio | Historia en el repositorio | Paso manual más que puede romper la publicación |

### Política de versiones (provisional, `preguntas/0036`)
| Opción | Pros | Contras |
|---|---|---|
| **SemVer con un solo número para app y worker; previas numeradas `X.Y.Z-alpha.N`, `-beta.N`, `-rc.N`** | Una etiqueta por publicación sin reutilizar números; ordena bien en npm, dpkg (`~`) y PEP 440 | Hay que traducir el sufijo a PEP 440 en el worker |
| `v0.2.0-alpha` sin número (lo que dice el plan) | Literal del plan | Solo permite una alfa; una corrección obligaría a mover una etiqueta publicada, cosa que las *immutable releases* impiden |
| Números independientes para app y worker | Flexibilidad | Nadie la necesita: el worker se distribuye dentro de la app; la compatibilidad del motor la marca el manifiesto, no este número |

### Firma de código
| Opción | Pros | Contras |
|---|---|---|
| **Sin firma comercial (se mantiene `preguntas/0001` y ADR 0012)**: NSIS sin firmar, DMG con firma *ad hoc* | Gratis; sin cuentas ni secretos en el workflow | SmartScreen y Gatekeeper avisan; el Control inteligente de aplicaciones bloquea (`preguntas/0044`) |
| SignPath para software libre (Windows) | Gratuito si aceptan el proyecto | Solicitud y secretos; cambia una decisión del usuario. Fuera de esta decisión (`preguntas/0044`, opción C) |
| Apple Developer ID + notarización | Sin aviso en macOS | 99 USD/año. Descartada por el criterio de gratuidad |

## Decisión

### 1. Disparadores y trabajos de `empaquetado.yml`
El archivo conserva su nombre (está en `main`) y pasa a llamarse **"Empaquetado y publicación"**.

```yaml
on:
  workflow_dispatch:          # ensayo completo sin publicar
  push:
    tags: ['v*']              # publicación
permissions:
  contents: read              # por defecto, todo el workflow
concurrency:
  group: empaquetado-${{ github.ref }}
  cancel-in-progress: false   # nunca cortar una publicación a medias
```

| Trabajo | Necesita | Permisos | `workflow_dispatch` | Etiqueta `v*` |
|---|---|---|---|---|
| `comprobar-version` (`ubuntu-24.04`) | — | `contents: read` | Comprueba que todos los archivos dicen la misma versión y la toma como `v<versión>` | Además: la etiqueta coincide con esa versión, tiene el formato de §2 y su commit está contenido en `origin/main` |
| `construir` (matriz, sin cambios) | `comprobar-version` | `contents: read` | Sí | Sí |
| `probar-instalador` (matriz, sin cambios) | `construir` | `contents: read` | Sí | Sí |
| `preparar-publicacion` (`ubuntu-24.04`) | `comprobar-version`, `construir`, `probar-instalador` | `contents: read` | **Sí: es el ensayo** | Sí |
| `publicar` (`ubuntu-24.04`) | `preparar-publicacion` | **`contents: write`, solo aquí** | **No se ejecuta** (`if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')`) | Sí |

- `comprobar-version` va primero para no gastar minutos de macOS en una etiqueta equivocada. Expone como salidas `version`, `etiqueta`, `previa` (`true`/`false`) y `version_pep440`.
- `construir` y `probar-instalador` **no cambian**: siguen subiendo `shinobi-karaoke-<versión>-<sha corto>-<so>` con `retention-days: 14`.
- La entrada informativa de `probar-instalador` (`ubuntu-26.04`, `continue-on-error`) **no bloquea** la publicación; cualquier otra entrada fallida sí. Cómo refleja GitHub el resultado de una matriz con `continue-on-error` en `needs` se comprueba en el ensayo (tarea 0193); si no se distingue, `preparar-publicacion` lee el resultado de cada entrada con la API de la ejecución.
- **Acciones**: las mismas cuatro del ADR 0013, por los mismos SHA (comprobados de nuevo el 2026-11-20). No se añade ninguna acción: la *Release* se crea con `gh`, preinstalada en los runners de GitHub.

### 2. Política de versiones (provisional hasta responder `preguntas/0036`)
- **Un solo número** para app y worker, en SemVer: `MAYOR.MENOR.CORRECCIÓN[-previa.N]`.
- Sufijos admitidos: `alpha.N`, `beta.N`, `rc.N`, con `N ≥ 1`. Expresión de la etiqueta: `^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-(alpha|beta|rc)\.([1-9]\d*))?$`. Cualquier otra `v*` hace fallar `comprobar-version` sin construir.
- **Esta alfa**: `0.2.0-alpha.N`, empezando por `0.2.0-alpha.1`. La etiqueta `v0.2.0-alpha` del plan pasa a ser **la última `v0.2.0-alpha.N`** al cerrar la versión. `0.2.0` sin sufijo solo si el usuario lo decide.
- **Dónde vive el número** (5 sitios, todos los comprueba §3):

  | Archivo | Forma | Ejemplo |
  |---|---|---|
  | `app/package.json` y las dos entradas raíz de `app/package-lock.json` | SemVer | `0.2.0-alpha.1` |
  | `worker/pyproject.toml` (`[project] version`) | PEP 440 normalizada | `0.2.0a1` |
  | `worker/shinobi_worker/__init__.py` (`__version__`) | PEP 440 normalizada | `0.2.0a1` |
  | `worker/uv.lock` (paquete `shinobi-worker`) | PEP 440 normalizada | `0.2.0a1` |

  Traducción: `-alpha.N` → `aN`, `-beta.N` → `bN`, `-rc.N` → `rcN`. En el worker se guarda la forma **normalizada** para que `uv` no reescriba el `uv.lock` ni haya dos grafías del mismo número.
- **Previa ⇔ sufijo**: con sufijo, la *Release* se marca como *pre-release* y `--latest=false`; sin sufijo, `--latest`. Consecuencia que hay que tener en cuenta: mientras solo existan *pre-releases*, **`/releases/latest/download/…` no resuelve** (§5).
- Cambiar el número **no** cambia el motor de audio: la compatibilidad del runtime depende del número del manifiesto y del `sha256_requisitos` de `worker/requisitos/`, que no incluyen este número (ADR 0009 §6). La tarea 0191 lo comprueba.

### 3. Subir y comprobar la versión: `app/scripts/version.mjs`
Script Node sin dependencias nuevas, con dos órdenes:

```text
npm run version:subir -- 0.2.0-alpha.1      # escribe los 5 sitios de §2
npm run version:comprobar                    # todos iguales; sale ≠ 0 si no
npm run version:comprobar -- --etiqueta v0.2.0-alpha.1   # además, la etiqueta coincide
```

- `subir` valida el formato, rechaza bajar de versión respecto a la actual y escribe los archivos con ediciones de texto acotadas (sin reformatear `package.json` ni `uv.lock`). No crea commits ni etiquetas.
- `comprobar` imprime la versión SemVer, la PEP 440 y si es previa, y con `--salida-github` las escribe en `GITHUB_OUTPUT`. Es lo que ejecuta `comprobar-version`.
- La lógica pura (validar, traducir a PEP 440, comparar) vive en funciones exportadas con tests de Vitest.

### 4. Preparar y publicar
**`preparar-publicacion`** (también en el ensayo):
1. Descarga los artefactos de los 3 SO con `pattern: shinobi-karaoke-<versión>-<sha corto>-*` y `merge-multiple: true`.
2. Comprueba que están **exactamente** los 4 instaladores de `preguntas/0040` y verifica cada `SHA256SUMS-<so>.txt` con `sha256sum -c`.
3. Une las sumas en **`SHA256SUMS.txt`** (formato de `sha256sum`, ordenado por nombre), el archivo que cita `ux/09` §3.
4. Compone `notas.md`:
   1. Si es previa: `.github/publicacion/aviso-previa.md` (texto: `preguntas/0141`). Va primero porque GitHub rotula «Pre-release» en inglés (respuesta a 0141).
   2. Cabecera: `.github/publicacion/cabecera.md`, con el texto de `ux/09` §3 **sin marcadores** ⟦…⟧ (texto definitivo: `preguntas/0141`).
   3. Notas de la versión: `docs/versiones/<X.Y.Z>/notas/<versión>.md` si existe. Si no, se marca para que `publicar` añada las notas generadas por GitHub (`--generate-notes`, que parten de la *Release* anterior). En el ensayo se avisa en el resumen.
   4. La composición falla si queda algún marcador `⟦` o `{ENLACE_` en el resultado.
5. Sube un artefacto `publicacion-<versión>` (instaladores, `SHA256SUMS.txt`, `notas.md`, `datos.json` con versión, etiqueta, previa y si faltan notas), con `retention-days: 14`, y escribe en `GITHUB_STEP_SUMMARY` la lista de recursos, sus tamaños y SHA-256, el tipo (previa o estable) y la cabecera de las notas. **En `workflow_dispatch` termina aquí**: es el ensayo.

**`publicar`** (solo con etiqueta; `permissions: contents: write`):
1. Descarga `publicacion-<versión>`. No hace `checkout` ni `npm ci`: no ejecuta código del repositorio con permiso de escritura. `gh` usa `GH_TOKEN` y `GH_REPO` del contexto.
2. Falla si ya existe una *Release* para la etiqueta (`gh release view`): nunca sobrescribe.
3. `gh release create <etiqueta> --verify-tag --draft --title "Shinobi Karaoke <versión>" --notes-file notas.md [--prerelease --latest=false | --latest] [--generate-notes]` y adjunta los 4 instaladores y `SHA256SUMS.txt`.
4. Publica con `gh release edit <etiqueta> --draft=false`, **salvo** que la variable del repositorio `PUBLICACION_BORRADOR` valga `true`: entonces se queda en borrador para que el usuario la revise y la publique a mano (`preguntas/0035`, punto 3, y `preguntas/0140`).
5. Escribe en el resumen el enlace a la *Release*.

Borrador → recursos → publicar es lo que exige el modo *immutable releases* y evita que alguien vea una *Release* a medio subir. Una *Release* mal hecha no se corrige reemplazando archivos: se publica la siguiente `N`.

### 5. Lo que este ADR no cambia y lo que deja abierto
- **Sin firma de código** (`preguntas/0001`, ADR 0012 §4). SmartScreen muestra "Windows protegió su PC" y se continúa con "Más información → Ejecutar de todas formas"; con el Control inteligente de aplicaciones activo **no se puede instalar** (`preguntas/0044`, provisional A de `ux/09`). Gatekeeper avisa con el DMG *ad hoc* descargado (`preguntas/0041`). El AppImage puede arrancar sin el sandbox del sistema en Ubuntu ≥ 24.04 (`preguntas/0045`, provisional A). Todo ello lo explican `INSTALAR.md` y la cabecera de las notas; los textos son del diseñador.
- `SHA256SUMS.txt` **no va firmado**: detecta descargas corruptas, no una *Release* manipulada. Con *immutable releases* activadas, GitHub añade una atestación verificable con `gh release verify` (recomendado en `docs/workflow.md`; lo activa el usuario).
- **Sin autoactualización** (`preguntas/0037`, A): `publish: null` y `differentialPackage: false` se mantienen; no se suben `latest*.yml` ni `.blockmap`.
- **README y enlaces**: `ux/09` §1.2 usa `/releases/latest/download/<nombre>`, que **no apunta a *pre-releases***. Qué muestra el README mientras solo haya alfas es decisión del diseñador (`preguntas/0141`). La tarea 0142 sigue siendo la que pasa el README a E1.
- **La puerta de 0142** (0044, 0045, 0139…) no se ha cerrado. Que las alfas se publiquen como *pre-release* con lo no probado declarado en sus notas es decisión del usuario: `preguntas/0140`. El workflow funciona igual con cualquier respuesta (variable `PUBLICACION_BORRADOR`).
- **Protección de etiquetas**: se recomienda una regla del repositorio que limite crear, mover y borrar `v*` a administradores. Es un ajuste del repositorio que hace el usuario (`docs/workflow.md`).

## Consecuencias
- Positivas: una *Release* por versión con los 4 instaladores, `SHA256SUMS.txt` y notas, sin pasos a mano tras la etiqueta; los instaladores publicados son exactamente los que pasaron el humo y la instalación en los runners; el ensayo se puede lanzar ya en `alpha-2`; escritura solo en un trabajo que no ejecuta código del repositorio; ninguna acción nueva.
- Negativas / riesgos:
  - Una publicación consume una ejecución completa (macOS incluido). En un repositorio público los minutos de los runners estándar no se cobran (documentación de facturación de GitHub; revisar si cambia).
  - Un fallo de la entrada informativa o un runner inestable puede impedir publicar: se relanza la ejecución, no se debilita la prueba.
  - Con *immutable releases* activadas, una etiqueta publicada no se puede mover ni borrar: un error obliga a publicar `N+1`.
  - Legales: la descarga desde YouTube y las letras siguen bajo las mitigaciones del ADR 0003 y 0005 (uso personal, el usuario aporta el contenido). Publicar binarios GPL exige el código de la misma etiqueta: lo cubren los archivos de código de la *Release* y el repositorio público. `THIRD_PARTY_NOTICES.md` va dentro del instalador (ADR 0012 §7) y `licencias:comprobar` ya se ejecuta en `construir`.
- Impacto en UX: nuevo caso "solo hay versiones previas" en README y notas (`preguntas/0141`). La app no cambia, salvo el número que muestran Acerca de y "Copiar información para soporte".

## Revisiones
- 2026-11-20: creado. Amplía el ADR 0013 §1 (disparador y permisos) sin cambiar `construir` ni `probar-instalador`. Responde de forma provisional a `preguntas/0036` (§2) y concreta el flujo que la tarea 0142 dejaba "para una revisión del ADR 0013". Tareas 0191–0195.

## Fuentes
Consultadas el 2026-11-20.
- GitHub, API REST de *Releases* ("latest" excluye *pre-releases* y borradores; `make_latest`): https://docs.github.com/en/rest/releases/releases
- GitHub, *immutable releases*: https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases ; anuncio de disponibilidad general: https://github.com/orgs/community/discussions/178351
- GitHub, enlazar a versiones (`/releases/latest`): https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases
- GitHub, `workflow_dispatch` en la rama por defecto: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- `gh release create --help` y `gh release edit --help` (gh 2.103.1)
- Acciones: `gh api repos/actions/{checkout,setup-node,upload-artifact,download-artifact}/releases/latest` y `git/ref/tags/<etiqueta>`; `action.yml` de `download-artifact` v8.0.2; notas de `download-artifact` v8.0.0
- electron-builder 26.18.0, leído en local: `app-builder-lib/out/targets/LinuxTargetHelper.js` (`getSanitizedVersion`), `out/appInfo.js` (`getVersionInWeirdWindowsForm`, `buildNumber`), `out/macPackager.js`
- Debian, versiones previas con `~`: https://wiki.debian.org/Versioning
- PEP 440, normalización de versiones previas: https://peps.python.org/pep-0440/#pre-release-spelling
- SemVer 2.0.0: https://semver.org/lang/es/
