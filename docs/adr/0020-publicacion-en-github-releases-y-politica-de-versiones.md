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
- 2026-11-21: **revisión para 0.2.0 — fase 10** (al final de este ADR): disparador nocturno y canal de compilaciones de desarrollo en `shinobi-karaoke-builds`, número de compilación y canal dentro de la app, notas en dos partes con «Qué cambió» y README con enlaces a la etiqueta como sexto sitio de la versión. §1–§4 siguen vigentes salvo lo que esa sección cambia. Responde a `preguntas/0142`. Tareas 0248–0255.
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

## Revisión para 0.2.0 — fase 10 (detalles de release)

Fecha: 2026-11-21. Origen: [plan, fase 10](../versiones/0.2.0/plan-2.md#fase-10--detalles-de-release), aprobada por el usuario a partir de la [propuesta 017](../propuestas/017-estructura-de-releases.md). Specs: [08 · Fase 10](../ux/08-ajustes-y-acerca.md#fase-10-de-020--número-de-compilación) (AC1–AC8) y [09](../ux/09-descarga-e-instalacion.md) (§1.1b, §1.4, §1.5, §2, §3, §3b y §4). Responde a [0142](../preguntas/0142-numero-de-compilacion-canal-de-desarrollo-y-notas.md). Tareas 0248–0255.

Se mantiene lo de §1–§4: etiqueta → borrador → recursos → publicar, `SHA256SUMS.txt`, *pre-release* con sufijo, instaladores **sin versión en el nombre** (0040) y `publicar` como único trabajo con `contents: write` sobre este repositorio. Siguen fuera la autoactualización (0037) y la firma de código.

### Comprobaciones hechas (2026-11-21)
| Qué | Resultado | Fuente |
|---|---|---|
| `schedule` | Solo se ejecuta en la rama por defecto (`main`) y con su último commit (`GITHUB_SHA`). Puede retrasarse en horas de mucha carga, sobre todo al principio de cada hora. En un repositorio público se desactiva tras 60 días sin actividad | Documentación de eventos de GitHub Actions |
| `workflow_dispatch` | El archivo tiene que estar en la rama por defecto. Después se puede lanzar contra cualquier rama con `gh workflow run --ref`. No está documentado si las `inputs` se leen del archivo de esa rama, así que **no se añaden entradas** | Ídem; manual de `gh workflow run` |
| Secretos en condiciones | «Secrets cannot be directly referenced in `if:` conditionals»; un secreto que no existe vale cadena vacía | Documentación de secretos |
| Estado del repositorio | Rama por defecto `main`, público. Sin variables ni secretos de Actions, sin etiquetas y sin *Releases*. `Gomonsoft/shinobi-karaoke-builds` no existe (404). En `main`, `empaquetado.yml` sigue siendo «Empaquetado (manual)» | `gh repo view`, `gh variable list`, `gh secret list`, `gh api`, `git ls-remote` |
| Notas generadas | `POST /repos/{o}/{r}/releases/generate-notes` devuelve `name` y `body` sin guardar nada, y admite `previous_tag_name`. Requiere **Contents: write**. El texto sale en inglés (`## What's Changed`, `## New Contributors`, `**Full Changelog**`). Con `generate_release_notes` al crear, el cuerpo propio va **delante** de lo generado. La documentación no dice qué pasa sin una *Release* anterior | API REST de *Releases*; permisos de los tokens *fine-grained*; documentación de notas generadas |
| Crear *Releases* en otro repositorio | Un token *fine-grained* necesita **Contents: write** en ese repositorio. «Workflows» solo se exige si el commit de destino toca `.github/workflows/`, y el repositorio de compilaciones no tiene workflows | Permisos de los tokens *fine-grained* |
| Tokens *fine-grained* de una organización | La organización puede bloquearlos o exigir aprobación; mientras no se aprueban, solo leen recursos públicos. Se pueden limitar a repositorios concretos. Si no se fija caducidad, duran 30 días, y la organización puede imponer un máximo. GitHub recomienda una GitHub App para automatizar una organización | Documentación de tokens personales |
| `gh release list` | `--exclude-drafts`, `--json tagName,isPrerelease,isDraft,publishedAt,isLatest,…`, `-R` | Manual de `gh` |

### Alternativas consideradas

**Dónde viven las compilaciones de desarrollo**
| Opción | Pros | Contras |
|---|---|---|
| **Repositorio aparte `shinobi-karaoke-builds`** (decisión del usuario) | La lista de *Releases* del principal queda limpia y `latest` sigue significando «última versión» | Un secreto con escritura en otro repositorio. Los archivos *Source code* de esas *Releases* son los del repositorio de compilaciones (ver GPL) |
| *Pre-releases* `build-…` en el repositorio principal | Sin secreto | Llenan la lista de versiones y las etiquetas del principal |
| Artefactos de Actions | Ya existen | Caducan a los 14 días, exigen sesión en GitHub y Chrome bloqueó el zip en alpha.1 |

**Cómo se dispara**
| Opción | Pros | Contras |
|---|---|---|
| **`schedule` nocturno en `empaquetado.yml`, que compila la cabeza de `develop` solo si ese commit no tiene ya su compilación** | Como mucho una compilación al día. Usa los mismos `construir` y `probar-instalador`. Se ensaya con `workflow_dispatch` sin archivo nuevo | El archivo de `main` compila el código de `develop`, así que la interfaz de los scripts debe seguir siendo compatible (riesgos) |
| `push` a `develop` | Inmediato | Una compilación de 3 SO con pruebas de instalación por cada fusión. El usuario eligió la nocturna |
| Workflow nuevo `compilaciones.yml` | Separado | No se puede lanzar ni programar hasta que esté en `main`, y duplica trabajos o necesita `workflow_call` |

**Credencial para escribir en el otro repositorio**
| Opción | Pros | Contras |
|---|---|---|
| **Token *fine-grained* limitado a `shinobi-karaoke-builds`, con Contents: write** | Se crea en un minuto y tiene el alcance mínimo | Caduca y hay que renovarlo. Puede necesitar la aprobación de la organización |
| GitHub App instalada solo en ese repositorio | Recomendada por GitHub para organizaciones; tokens de una hora | Hay que crear la app y custodiar su clave privada, y añadir una acción que pida el token (otra dependencia que fijar). Se puede migrar más adelante sin tocar el resto del diseño |
| Clave de despliegue SSH | No caduca | Sube etiquetas, pero no crea *Releases* ni sube recursos. Descartada |
| Token clásico con `repo` | Simple | Escritura en todos los repositorios de quien lo crea. Descartada |

**Cómo llega el número de compilación a la app**
| Opción | Pros | Contras |
|---|---|---|
| **Constante del build** (`define` de electron-vite, como `__SHINOBI_YOUTUBE__`) a partir de variables que pone el workflow | Queda fija en el código empaquetado, sin archivo nuevo ni lectura al arrancar. La calcula una sola vez el trabajo que también da el título a la *Release* | En `dev` y en las pruebas la constante no existe: hace falta el valor por defecto `local` |
| `extraMetadata` de electron-builder en el `package.json` del asar | No toca el build de electron-vite | Cambiar `version` alteraría `app.getVersion()` y el `.deb`; un campo propio obliga a leer `package.json` al arrancar |
| Llamar a `git` al arrancar | Nada que inyectar | La app instalada no tiene repositorio ni `git`. Descartada |

**«Qué cambió» en las notas**
| Opción | Pros | Contras |
|---|---|---|
| **API `generate-notes` en `publicar`, con sustituciones literales** | Encabezados en español (spec 09 §3) y control del orden: notas a mano, «Qué cambió», «Todos los cambios» y «Compilación» | Si GitHub cambia sus encabezados, la sustitución no encuentra nada y quedan en inglés: se degrada sin romper |
| `gh release create --generate-notes` con `--notes-file` | Una sola opción | El bloque sale en inglés y la línea de compilación quedaría **encima** de lo generado |
| Lista propia a partir de `git log` en `preparar-publicacion` | No necesita escritura | Sin PR ni autores, y reimplementa lo que ya da GitHub |

### Decisión

#### 1. Disparadores y commit objetivo
```yaml
on:
  workflow_dispatch:            # ensayo; contra develop, además, compilación de desarrollo
  push:
    tags: ['v*']                # publicación de una versión
  schedule:
    - cron: '23 4 * * *'        # nocturna (UTC), lejos del principio de la hora
```
`comprobar-version` resuelve primero **qué commit se construye** (salida `sha`, completo) y **qué se hace con él**, antes de cualquier `checkout`:

| Evento | `sha` | Canal en la app | `desarrollo` | `construir` |
|---|---|---|---|---|
| Etiqueta `v*` | `GITHUB_SHA` | `publicada` | `omitir` | `true` |
| `workflow_dispatch` contra `develop` | `GITHUB_SHA` | `desarrollo` | `publicar` si el canal está configurado y `build-<sha>` no existe; si no, `ensayo` | `true` |
| `workflow_dispatch` contra otra rama | `GITHUB_SHA` | `desarrollo` | `ensayo` | `true` |
| `schedule` | cabeza de `develop` (`gh api repos/{repo}/branches/develop --jq .commit.sha`) | `desarrollo` | `publicar` si el canal está configurado y `build-<sha>` no existe; si no, `omitir` | `true` solo si `desarrollo` = `publicar` |

- **Canal configurado**: la variable `COMPILACIONES_REPO` no está vacía, el secreto `COMPILACIONES_TOKEN` existe y `gh api repos/$COMPILACIONES_REPO` responde 200 con el `GITHUB_TOKEN`, que puede leer repositorios públicos. Para saber si el secreto existe, el paso recibe solo `${{ secrets.COMPILACIONES_TOKEN != '' }}` (`true`/`false`), nunca su valor.
- **Ya compilado**: `gh api repos/$COMPILACIONES_REPO/releases/tags/build-<sha>` responde 200. Un 404 significa que no existe; cualquier otro error hace fallar el trabajo.
- Una nocturna sin cambios o sin configurar **termina en verde**. Solo se ejecuta `comprobar-version`, que escribe en el resumen por qué no se construye («Canal de desarrollo sin configurar: falta …» o «Sin cambios: `build-<sha>` ya existe»). Una configuración incompleta nunca rompe una publicación ni un ensayo: en esos casos solo sirve para elegir entre `publicar` y `ensayo`.
- Todos los trabajos que hacen `checkout` lo hacen de `ref: <sha>`. Los nombres de artefacto usan ese `sha` y no `GITHUB_SHA`, que en `schedule` es el de `main`.
- Salidas nuevas de `comprobar-version`: `sha`, `numero`, `compilacion` (`<versión>-<N>`), `canal_app`, `desarrollo` y `construir`. `construir`, `probar-instalador` y los trabajos de preparación dependen de `construir == 'true'`, y `preparar-publicacion` no se ejecuta en `schedule`.

#### 2. Número de compilación y canal dentro de la app (0142, puntos 1 y 2)
- **N** = `git rev-list --count <sha>`, los commits alcanzables desde el commit construido. Lo calcula `comprobar-version` con `fetch-depth: 0` mediante `app/scripts/compilacion.mjs`. El script **falla** si el clon es superficial (`git rev-parse --is-shallow-repository`), porque N valdría 1. `construir` no necesita el historial: recibe N.
- **Commit**: la app guarda el SHA completo y la interfaz muestra 7 caracteres (spec 08). Como dos ramas pueden dar el mismo N, el hash acompaña siempre al número en lo que se copia.
- **Canal**: `publicada` si sale de una etiqueta `v*`; `desarrollo` en cualquier otra compilación del CI (nocturna o ensayo); `local` fuera del CI. Una compilación local **no lleva número** aunque haya `git`, porque puede tener cambios sin confirmar; si `git` responde, sí lleva el commit. Una compilación empaquetada sin estos datos se trata como `local`.
- **Inyección**: `construir` pasa a `npm run build` las variables `SHINOBI_COMPILACION_CANAL`, `SHINOBI_COMPILACION_NUMERO` y `SHINOBI_COMPILACION_COMMIT`. `electron.vite.config.ts` las valida con `compilacion.mjs` y las fija como la constante `__SHINOBI_COMPILACION__` de main. Si el canal es `publicada` o `desarrollo` y falta un dato o no es válido, **el build falla**. Estas variables solo se leen **al compilar**: la app empaquetada no lee ninguna `SHINOBI_COMPILACION_*` al arrancar (ADR 0008).
- **Contrato**: `InfoSistema` (`sistema.info()`) añade `compilacion: { canal: 'publicada' | 'desarrollo' | 'local', numero: number | null, commit: string | null }`. `version` no cambia: sigue siendo `app.getVersion()`, que usan LRCLIB y el runtime. Un módulo puro, `shared/compilacion.ts`, da el número visible (`<versión>-<N>`, o la versión sola en `local`), el identificador (`aj.compilacion.id`) y la línea `Versión: {identificador}` (`aj.detalles.version`). Main y renderer usan esas mismas funciones, así que los sitios que copian detalles no pueden divergir.
- Main escribe el identificador en `app.log` al arrancar. En macOS, el panel nativo «Acerca de» del menú de la app muestra el número de compilación (`app.setAboutPanelOptions`).
- **Versión de `develop` tras publicar** (0142, punto 2): **confirmado**. Justo después de publicar `vX.Y.Z-pre.N`, `develop` sube a la siguiente previa (`-pre.N+1`) con `version:subir`, en un PR propio. Así ninguna compilación de desarrollo lleva el número de una versión ya publicada. Es un paso del procedimiento (`docs/workflow.md`), no del workflow. Si la siguiente acaba siendo otra (por ejemplo `-beta.1`), `version:subir` admite saltar hacia arriba.

#### 3. Notas de la *Release* en dos partes (0142, punto 4)
Orden (spec 09 §3): aviso de previa → cabecera → **notas escritas a mano** → `---` → **«Qué cambió»** → **«Todos los cambios»** → **«Compilación»**. Los textos son de la spec.
- `preparar-publicacion` (sin escritura) compone, como ahora, la parte 1 en `notas.md`, y además, con los valores ya resueltos, `pie.md` («Compilación»: número, hash, SHA completo y `$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID`, que es la misma ejecución que publica). También copia al artefacto `que-cambio.json`, construido a partir de un archivo nuevo en `.github/publicacion/`. Contiene el encabezado «Qué cambió», la sustitución de `## New Contributors`, las líneas que se quitan (`## What's Changed` y `**Full Changelog**…`), la plantilla de «Todos los cambios» y las frases «sin PR» y «primera versión publicada».
- Las notas a mano pasan a ser **obligatorias para publicar**. Con etiqueta, `preparar-publicacion` falla si no existe `docs/versiones/<X.Y.Z>/notas/<versión>.md` o si conserva una línea que empieza por `> Borrador`. En el ensayo solo lo avisa en el resumen. Desaparece la rama «sin notas → solo `--generate-notes`» de §4.
- `publicar`, que no ejecuta código del repositorio, busca la ***Release* publicada anterior**, preliminar o estable: `gh release list --exclude-drafts --json tagName,publishedAt`, la más reciente cuya etiqueta no es la actual.
  - Si existe, pide `gh api -X POST repos/$GH_REPO/releases/generate-notes -f tag_name=<etiqueta> -f previous_tag_name=<anterior> --jq .body`, aplica las sustituciones literales de `que-cambio.json` con `jq` y añade «Todos los cambios» con el enlace `compare/<anterior>...<etiqueta>`. Si la lista queda vacía, usa la frase «sin PR».
  - Si no existe (será el caso de `v0.2.0-alpha.2`, la primera), pone la frase de la primera versión publicada en lugar de la lista y de «Todos los cambios».
  - Une `notas.md`, la parte 2 y `pie.md`. Falla si queda algún `{…}` sin sustituir, y crea la *Release* con `--notes-file` del resultado, **sin** `--generate-notes`.
- En el ensayo, el resumen muestra la parte 1 y «Compilación», con la nota «“Qué cambió” se genera al publicar».

#### 4. Canal de compilaciones de desarrollo (0142, punto 5)
Dos trabajos nuevos al final de `empaquetado.yml`:

| Trabajo | Necesita | Permisos | Cuándo | Qué hace |
|---|---|---|---|---|
| `preparar-desarrollo` (`ubuntu-24.04`) | `comprobar-version`, `construir`, `probar-instalador` | `contents: read` | `desarrollo` ≠ `omitir` | `checkout` de `sha`. Descarga los artefactos, renombra los instaladores, genera `SHA256SUMS.txt` y compone `notas.md` (cuerpo de §3b) con `app/scripts/preparar-publicacion.mjs --canal desarrollo`. Si el canal está configurado, lee con el `GITHUB_TOKEN` la última *Release* del repositorio de compilaciones para «Cambios desde…». Sube el artefacto `compilacion-<versión>-<N>` y escribe el resumen |
| `publicar-desarrollo` (`ubuntu-24.04`) | `comprobar-version`, `preparar-desarrollo` | `contents: read` (no usa el `GITHUB_TOKEN`) | `desarrollo` = `publicar` | **Sin `checkout` ni `npm`.** `GH_TOKEN` = `secrets.COMPILACIONES_TOKEN` y `GH_REPO` = `vars.COMPILACIONES_REPO`, solo en este trabajo. Si `build-<sha>` ya existe, avisa y termina en verde (otra ejecución se adelantó). Si no: `gh release create build-<sha> --draft --title "<versión>-<N>" --notes-file notas.md` con los 4 instaladores y `SHA256SUMS.txt`; comprueba nombres y tamaños de lo subido y publica con `gh release edit build-<sha> --draft=false --latest` |

- **Etiqueta `build-<sha>` con el SHA completo de 40 caracteres**, como RPCS3, y no los 7 que proponía la spec 09 §3b: es única para siempre y es la clave que se consulta para saber si un commit ya tiene compilación. El título y la app usan el número y el hash corto, así que lo que se ve no cambia. La etiqueta se crea en la rama por defecto del repositorio de compilaciones (`gh release create` sin `--verify-tag`), así que ese repositorio necesita al menos un commit.
- **Título exacto `<versión>-<N>`**, **no** *pre-release* y **sí** *latest* en su repositorio (confirmado), para que `…/shinobi-karaoke-builds/releases/latest` abra siempre la última compilación. El aviso va en el cuerpo.
- **Nombres** (confirmados, spec 09 §3b): `Shinobi-Karaoke-desarrollo-<versión>-<N>-Windows-x64.exe`, `…-Mac-chip-Apple.dmg`, `…-Linux-x64.AppImage` y `shinobi-karaoke-desarrollo-<versión>-<N>-linux-x64.deb`, más `SHA256SUMS.txt`. Se **renombran** en `preparar-desarrollo`, sin cambiar `artifactName`. Ni NSIS, ni el DMG, ni el AppImage, ni el `.deb` dependen del nombre del archivo, y los instaladores son exactamente los que pasaron `probar-instalador`.
- **`.deb`**: conserva la versión del paquete de `package.json` (con `develop` ya subida, `0.2.0~alpha.3`). dpkg acepta instalarlo encima de la versión publicada, porque es mayor. Para volver a la publicada hay que bajar de versión (`sudo apt install --allow-downgrades ./archivo.deb`); el diseñador decide si el cuerpo lo menciona. No se inventa otra versión de paquete, porque cambiaría también `app.getVersion()`.
- **Misma app y misma carpeta de datos que la versión publicada** (mismo `appId`, AppUserModelId, carpeta de instalación y datos): es lo técnicamente más simple. Una app aparte obligaría a descargar otra vez el motor de audio (varios GB) y a duplicar accesos directos, protocolos y avisos del sistema. Riesgo: una compilación de desarrollo puede migrar la biblioteca a un esquema que la versión publicada no lee; el cuerpo de §3b pide copiar `biblioteca` antes. **Es una decisión de producto**: provisional «misma app», a confirmar por el usuario en [0143](../preguntas/0143-canal-de-desarrollo-configuracion-y-carpeta-de-datos.md).
- **Cuerpo**: lo compone `preparar-desarrollo`, sin el token, con los valores de la spec 09 §3b y §4 (`{FECHA}` en UTC, tamaños en MB decimales y SHA-256 de cada archivo, «Cambios desde…» con `compare/<sha anterior>...<sha>` o la frase de la primera compilación, enlace al commit, al árbol de fuentes y a la ejecución). Falla si queda algún `{…}`.
- **GPL-3.0** (0142, punto 5): basta con enlazar el commit. Las compilaciones son código objeto, y la GPL-3.0 §6(d) permite que la fuente correspondiente esté en otro servidor si junto al código objeto hay instrucciones claras de dónde encontrarla, mientras haga falta. El cuerpo enlaza el árbol del commit exacto en el repositorio principal, que es público, y el README del repositorio de compilaciones lo explica (spec 09 §3b). Para que esos commits no desaparezcan, se recomienda proteger `develop` contra *force push* y borrado (ajuste del usuario).

#### 5. README con enlaces a la etiqueta: sexto sitio de la versión (0142, punto 3)
Confirmado. Mientras solo haya versiones preliminares (E½, spec 09 §1.1b), el README enlaza la descarga directa de cada instalador a la etiqueta concreta (`…/releases/download/v<versión>/<archivo>`) y las novedades a `…/releases/tag/v<versión>`. `version.mjs` trata esos enlaces como **sexto sitio**:
- `subir` reescribe en `README.md` todas las apariciones de `github.com/Gomonsoft/shinobi-karaoke/releases/(download|tag)/v<semver>` y el texto visible de la versión que §1.1b muestra («Última versión…»), si la spec lo delimita. Si `INSTALAR.md` llevara enlaces con versión, también los reescribe.
- `comprobar` falla si alguna aparición no coincide con la versión. Si no hay ninguna (README en E0, o en E1 con `/releases/latest/…`), no comprueba nada, así que no hace falta guardar el estado.
- Así el commit etiquetado enlaza a su propia etiqueta. Los enlaces dan 404 solo entre la fusión en `main` y la publicación, o mientras la *Release* siga en borrador (`PUBLICACION_BORRADOR`).

#### 6. Lo que tiene que hacer el usuario (no lo hace ningún agente)
Hasta que existan, la nocturna se omite en verde y el resto del workflow funciona igual. Los pasos quedan en `docs/workflow.md` (tarea 0253) y en [0143](../preguntas/0143-canal-de-desarrollo-configuracion-y-carpeta-de-datos.md).
1. Crear el repositorio **público** `Gomonsoft/shinobi-karaoke-builds` **con un commit inicial**: el README de la spec 09 §3b. Opcional: activar *immutable releases* en él.
2. Crear un **token *fine-grained***: propietario `Gomonsoft`, acceso **solo** a `shinobi-karaoke-builds`, permiso de repositorio **Contents: Read and write** (Metadata: Read se añade solo) y una caducidad de un año como máximo. Si la organización exige aprobación, aprobarlo.
3. En `Gomonsoft/shinobi-karaoke` → Settings → Secrets and variables → Actions: crear el secreto **`COMPILACIONES_TOKEN`** con el token y la variable **`COMPILACIONES_REPO`** = `Gomonsoft/shinobi-karaoke-builds`.
4. El disparador nocturno funciona cuando `empaquetado.yml` llega a `main`, con la fusión de `0.2.0-alpha.2`. Hasta entonces, una compilación de desarrollo se lanza a mano con `gh workflow run empaquetado.yml --ref develop`, que ya funciona porque el archivo existe en `main`.
5. Recomendado: proteger `develop` contra *force push* y borrado. Renovar el token antes de que caduque: un token caducado o sin permiso hace **fallar** `publicar-desarrollo`, para que se vea (está configurado pero roto); no se omite.

### Consecuencias
- Positivas: la descarga sale de *Releases* y no de Actions. Cada compilación se identifica con número, commit y canal, en la app y en todo lo que se copia. Las compilaciones de `develop` llegan como mucho un día después, con sumas verificables, y el repositorio principal no gana etiquetas ni *Releases* de desarrollo. Ningún trabajo con permiso de escritura ejecuta código del repositorio, y no se añade ninguna acción.
- Negativas / riesgos:
  - **Desfase entre workflow y scripts**: la nocturna usa el `empaquetado.yml` de `main` con los scripts de `develop`. Un cambio en la interfaz de `compilacion.mjs` o `preparar-publicacion.mjs` tiene que seguir aceptando las llamadas del workflow de `main` hasta la siguiente fusión en `main`.
  - Una nocturna con cambios consume una ejecución completa, con macOS y las pruebas de instalación. En un repositorio público no se cobra. Si el tiempo molesta, se puede quitar de la nocturna `macos-15` o la entrada informativa.
  - En un repositorio público, `schedule` se desactiva tras 60 días sin actividad; se reactiva a mano en la pestaña Actions.
  - El token caduca y es un secreto que custodiar, con alcance limitado a un repositorio de binarios. En el peor caso, quien lo robe publica binarios falsos en el canal de desarrollo, nunca en el principal. Mitigación: alcance mínimo, caducidad corta y, si hace falta, migrar a una GitHub App.
  - Las *Releases* del repositorio de compilaciones se acumulan (unos 0,5 GB por compilación). GitHub no publica un límite total para los recursos de *Release*; si hace falta, una tarea futura borrará las antiguas.
  - Si GitHub cambia los encabezados de las notas generadas, el texto sale en inglés debajo de «Qué cambió».
  - Chrome y SmartScreen siguen avisando: los instaladores no están firmados.
- Legales: ver GPL en §4. Las compilaciones de desarrollo tienen la misma licencia y los mismos `THIRD_PARTY_NOTICES.md` que las versiones.
- Impacto en UX: specs 08 (Fase 10) y 09 (§1.1b, §1.4, §1.5, §2, §3, §3b y §4). Única corrección para la spec 09: la etiqueta del canal de desarrollo lleva el SHA completo.

### Fuentes (consultadas el 2026-11-21)
- GitHub, eventos que disparan workflows (`schedule`, `workflow_dispatch`): https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- GitHub, uso de secretos (no en `if:`, vacío si no existe): https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
- GitHub, API de *Releases* (crear, `generate_release_notes`, `generate-notes`): https://docs.github.com/en/rest/releases/releases
- GitHub, permisos de los tokens *fine-grained*: https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens
- GitHub, tokens personales (propietario, aprobación, caducidad, GitHub Apps): https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- GitHub, notas generadas y `.github/release.yml`: https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes
- `gh release create`, `gh release list`, `gh workflow run`: https://cli.github.com/manual/gh_release_create , https://cli.github.com/manual/gh_release_list , https://cli.github.com/manual/gh_workflow_run
- GPL-3.0, §6(d): https://www.gnu.org/licenses/gpl-3.0.html#section6
- Referentes de la propuesta 017: RPCS3 (`rpcs3-binaries-*`, etiquetas `build-<hash>`, título `<versión>-<N>`) y DroidDeck (notas en dos partes)
