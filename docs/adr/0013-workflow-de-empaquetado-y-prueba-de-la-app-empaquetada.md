# 0013 — Workflow manual de empaquetado y prueba de humo de la app empaquetada

- Estado: Aceptado
- Fecha: 2026-11-06
- Paso del pipeline: 0 (distribución)

## Contexto
Hay que construir los instaladores en los 3 SO y demostrar que **el artefacto real** arranca, con los *fuses* del ADR 0008, sin red para probar y sin modelos.

Tres hechos condicionan la solución:

1. **Playwright `_electron` no sirve para la app final.** La documentación de Playwright pide no desactivar `EnableNodeCliInspectArguments`. Comprobado el 2026-11-06 con la app empaquetada real: `_electron.launch({ executablePath })` agota el tiempo de espera (25 s).
2. **Las variables `SHINOBI_*` de pruebas se ignoran empaquetada.** La única excepción es `SHINOBI_DATOS`, mantenida a propósito por el ADR 0008. Una vía nueva para pruebas sería una puerta trasera en producción.
3. **`workflow_dispatch` exige el archivo en la rama por defecto** (documentación de GitHub). Hoy `main` y `develop` están en 839ff89, sin el workflow nuevo. Una vez que exista allí, se puede lanzar contra cualquier rama con `gh workflow run --ref`. Afecta a cuándo se puede probar: `preguntas/0038`.

### Prueba de concepto (2026-11-06, fuera del repositorio)
Con el paquete real y todos los *fuses* aplicados, en Linux bajo xvfb y, parcialmente, en Windows 11 sin instalar:

| Comprobación | Linux | Windows |
|---|---|---|
| `--remote-debugging-port=0`, leer `DevTools listening on ws://…` de stderr y `chromium.connectOverCDP` | Sí | Sí |
| B1 con el manifiesto real y origen `shinobi-app://app/index.html` | Sí | Sí |
| `SHINOBI_RUNTIME_FALSO`, `SHINOBI_UV`, `SHINOBI_LANZADOR`, `SHINOBI_DIALOGO_PRUEBAS`, `ELECTRON_RENDERER_URL` sin efecto | Sí | Sin probar |
| Biblioteca con 20 canciones usando un runtime falso **en disco**, sin PyTorch ni modelos | Sí | Sin probar |
| `fetch('shinobi-media://…/pistas/instrumental.flac')` responde 200 | Sí | Sin probar |
| `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` y `--inspect` sin efecto | Sí | Sin probar |
| Asar con la cabecera alterada: la app no arranca | No aplica | Sí |
| `uv` del paquete + `python -m shinobi_worker demo` con el código de `resources/worker` | Sí | Sin probar |

Playwright se usa solo para conectarse: no descarga navegadores.

## Alternativas consideradas
| Tema | Opción | Pros | Contras |
|---|---|---|---|
| Cómo manejar la app | **CDP con `--remote-debugging-port`** | Es el artefacto real, sin ninguna línea nueva en producción; probado | Solo llega al renderer, no al proceso principal |
| | `_electron` con el *fuse* de inspección activo en un build de pruebas | API cómoda | No prueba lo que se distribuye |
| | Variable o argumento propio que active un modo de prueba | Control total | **Puerta trasera en producción. Descartada** |
| | Solo comprobar que el proceso sigue vivo y el contenido | Trivial | No detecta una pantalla en blanco ni fallos de protocolo |
| Qué instalación simular | **Runtime falso en disco**: intérprete vacío, marcador real y modelo disperso del tamaño exacto | Sin cambiar código: la comprobación barata (ADR 0009 §6) solo mira existencia, marcador y tamaño; llega a la Biblioteca | No ejecuta separación |
| | Instalar el runtime real | Prueba completa | 1,3 GB y modelos. Excluida: `runtime-real.yml` y la prueba manual cubren esa parte |
| Disparador | **Solo `workflow_dispatch`** | Sin coste por rama; control sobre minutos de macOS (×10) | Hay que lanzarlo a mano |
| | Etiqueta `v*` | Natural para publicar | Implica un flujo de versión todavía sin decidir (`preguntas/0035`, `0036`). Se añade cuando se decida |
| | `push`/`pull_request` | Automático | Prohibido: amplía el CI automático |

## Decisión

### 1. Workflow `.github/workflows/empaquetado.yml`
- **Disparador**: solo `workflow_dispatch`. `ci.yml` no se toca. Sin `publish`, sin *Releases*, `permissions: contents: read`.
- **Acciones fijadas por SHA**, comprobado con `gh api repos/<acción>/git/ref/tags/<etiqueta>`, con la etiqueta en un comentario:
  ```yaml
  actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1          # v7.0.1
  actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1        # v7.1.0
  actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9   # v7.0.2
  actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2
  ```
  No hace falta `setup-uv`: `uv` lo aporta `descargar-uv.mjs`, y el paso que necesita Python lo pide a ese `uv`.
- **Runners con etiqueta fija**, sin `-latest`: `windows-2025`, `macos-26`, `ubuntu-24.04`. `macos-26` es arm64 (README de `actions/runner-images`, 2026-11-06). El trabajo comprueba `uname -m` = `arm64` y falla si no.
- **Artefactos**: `upload-artifact` con `retention-days: 14`, `if-no-files-found: error` y nombre `shinobi-karaoke-<versión>-<sha corto>-<so>`. Incluye el instalador, `SHA256SUMS-<so>.txt` y el JSON de resultado.
- **Resumen**: cada trabajo añade a `GITHUB_STEP_SUMMARY` tamaño, SHA-256 y **nivel de prueba** (§3).
- **Dos fases**:
  1. `construir` (matriz de 3 SO): licencias → build → `uv` → electron-builder → verificación → humo desempaquetado → subir artefactos.
  2. `probar-instalador` (necesita `construir`): descarga el artefacto en otro runner limpio, instala y repite el humo.

### 2. Prueba de humo: `app/e2e-paquete/`
Configuración propia (`playwright.paquete.config.ts`), así que `npx playwright test` no la ejecuta. La ruta del ejecutable llega por `SHINOBI_PAQUETE_BIN`, leída **solo por la prueba**, nunca por la app.

Casos:
1. **B1 con entorno envenenado.** Todos los `SHINOBI_*` de prueba con valores válidos (también un escenario válido de `SHINOBI_RUNTIME_FALSO`) y `ELECTRON_RENDERER_URL`. Debe mostrar B1 con cifras del manifiesto real, origen `shinobi-app://app`, sin `llamadas.jsonl` y sin nada en `modelos/`.
2. **Textos legales.** `window.shinobi.sistema.textoLegal('gpl')` y `('terceros')` devuelven `LICENSE` y `THIRD_PARTY_NOTICES.md`.
3. **Biblioteca con runtime falso en disco.** Semilla, intérprete vacío, marcador con el `sha256_requisitos` real y modelo Calidad disperso. Deben verse las tarjetas, `shinobi-media://` debe responder 200 y `document.fonts` debe contener la fuente de interfaz. Con `ultima_comprobacion_ytdlp` a la fecha actual para que no intente actualizar yt-dlp.
4. **Negativos.** `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` y `--inspect` no tienen efecto.
5. **Instancia única.** Un segundo arranque con los mismos datos sale y la primera sigue viva.

Fuera de la matriz de humo, en la verificación del paquete: lectura de los 9 *fuses*, contenido, firma y `uv --version`.

**`--remote-debugging-port` en producción**: no es una vía añadida, es un argumento de Chromium que ya existe en cualquier app Electron y no lo controla ningún *fuse*. Exige poder lanzar la app con argumentos en la cuenta del usuario, el mismo límite de confianza que el ADR 0008 acepta para `SHINOBI_DATOS`. El renderer no tiene Node y la IPC sigue validada. **No se añade código de producción para la prueba.**

### 3. Qué puede probar cada runner
Tres niveles, siempre indicados en el resumen. **Instalación probada**: se instala el artefacto como lo haría un usuario y la app arranca. **Desempaquetada probada**: arranca el paquete sin instalador. **Solo construida**.

| Forma | Runner | Nivel previsto | Cómo | Limitaciones |
|---|---|---|---|---|
| NSIS | `windows-2025` | **Instalación probada** | `Start-Process -Wait` con `/S`, sin interacción. Instala en `%LOCALAPPDATA%\Programs\`; `RUN_AFTER_FINISH` no se aplica en modo silencioso (plantilla 26.18.0). Después, desinstalación con `/S` | Windows Server, no Windows 10/11. **No hay SmartScreen ni Control inteligente de aplicaciones**, y el archivo no lleva marca de descarga. La pantalla del instalador no se ve. El desinstalador se copia a un temporal y puede volver antes de terminar: se espera a que desaparezca el ejecutable |
| DMG | `macos-26`, `macos-15` | **Instalación parcial**: montar y copiar | `hdiutil attach -nobrowse -noautoopen`, `ditto` a una carpeta temporal, ejecutar `Contents/MacOS/Shinobi Karaoke`, `hdiutil detach` | **macOS 14 no existe en GitHub desde el 2026-11-02**: el mínimo soportado no se puede probar aquí. Sin cuarentena real ni Gatekeeper: `spctl` queda como dato informativo, no como criterio. No se arrastra en el Finder ni se ve la ventana del DMG |
| `.deb` | `ubuntu-24.04` | **Instalación probada** | `sudo apt-get install -y ./*.deb` (ejecuta `postinst`, instala el perfil de AppArmor) y xvfb, **sin** cambiar la restricción del sistema. Debe arrancar sin `--no-sandbox`. `apt-get remove` conserva los datos | Pantalla virtual, sin escritorio real, sin doble clic y sin audio |
| `.deb` | `ubuntu-26.04` | Instalación probada, **informativa** (`continue-on-error`) | Igual | No bloquea hasta tener resultados |
| AppImage | `ubuntu-24.04` | **Ejecución directa si hay FUSE**; si no, extraída | Dos pasadas: restricción de AppArmor activa (se espera que `AppRun` añada `--no-sandbox`) y `kernel.apparmor_restrict_unprivileged_userns=0` (se espera sin él). Si el montaje falla por FUSE, usa `APPIMAGE_EXTRACT_AND_RUN=1` y **lo declara** | No se ha comprobado `/dev/fuse` en ese runner. Sin doble clic ni permisos desde el gestor de archivos |
| Desempaquetado | Los 3 SO en `construir` | **Desempaquetada probada** | `win-unpacked`, `mac-arm64`, `linux-unpacked` | En Linux, con `sysctl` a 0, como `ci.yml` |
| Primer arranque real | Ninguno | **Sin probar en CI** | Requiere modelos reales: prueba manual 0139 | `runtime-real.yml` prueba el gestor, no la app empaquetada |
| Mac Intel, Windows ARM | Ninguno | **No aplican** | No se publican | — |

**Sin confirmar hasta la primera ejecución**: que Windows y macOS abran la ventana en los runners, que `/dev/fuse` exista y que `macos-15` sea arm64. Si un punto falla, se documenta y baja de nivel. No se debilita la prueba para que pase.

### 4. Red y modelos
| Paso | ¿Red? | ¿Modelos? |
|---|---|---|
| Tests normales (Vitest, `playwright test`) | No | No |
| `licencias:comprobar` | No, tras `npm ci` | No |
| `npm ci`, `descargar-uv`, electron-builder (Electron y utilidades) | **Sí** | No |
| Verificación del paquete | No | No |
| Humo del paquete | No: al instalar `.deb`, solo `apt` | No: modelo disperso sin contenido |
| `uv` + `demo` | **Sí**, la descarga de Python, y solo en el workflow | No |
| Licencias Python (`licencias_requisitos.py`) | **Sí**, solo al regenerar | No |

## Consecuencias
- Positivas: se prueba lo que se entrega; producción no cambia; niveles de prueba visibles; sin coste por rama.
- Negativas / riesgos: una ejecución completa consume varios minutos de macOS, que cuentan ×10 en un repositorio privado (documentación de GitHub; la organización está en plan `free`). El primer arranque real, Gatekeeper y SmartScreen solo se prueban a mano. La primera ejecución necesita el archivo en `main`.
- Impacto en UX: ninguno en la app.

## Revisiones
- 2026-11-06: creado en el desglose de la Fase 7. Precisa el AGENTS.md: "las variables `SHINOBI_*` se ignoran" tiene la excepción `SHINOBI_DATOS` del ADR 0008.

## Fuentes
Consultadas el 2026-11-06.
- Playwright, clase Electron y *fuse* `nodeCliInspect`: https://playwright.dev/docs/api/class-electron (leído en la copia https://playwright.nodejs.cn/docs/api/class-electron) ; incidencia relacionada: https://github.com/microsoft/playwright/issues/39008
- Electron, *fuses*: https://www.electronjs.org/docs/latest/tutorial/fuses
- GitHub, `workflow_dispatch`: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- GitHub, consumo de minutos: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- Runners y retirada de macOS 14: https://github.com/actions/runner-images
- Versiones y SHA de acciones: `gh api repos/actions/{checkout,setup-node,upload-artifact,download-artifact}/releases/latest` y `git/ref/tags/<etiqueta>`
- electron-builder 26.18.0, plantillas leídas en local: `templates/nsis/installSection.nsh`, `templates/nsis/uninstaller.nsh`, `out/targets/appimage/appImageUtil.js`
- ADR 0008, punto "Se mantienen"; ADR 0009 §6 y §8.
