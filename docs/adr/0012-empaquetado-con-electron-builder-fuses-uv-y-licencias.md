# 0012 — Empaquetado: electron-builder, *fuses*, firma *ad hoc*, `uv` verificado y licencias

- Estado: Aceptado
- Fecha: 2026-11-06
- Paso del pipeline: 0 (distribución)

## Contexto
Los ADR 0001 y 0008 ya deciden **qué** se distribuye: Windows 10/11 x64 con NSIS por usuario, macOS ≥ 14 solo arm64 en DMG con firma *ad hoc*, Linux x64 con AppImage y `.deb`, sin firma comercial, asar y *fuses*. La tarea 0025 lo concretaba con datos de 2026-11-04. Falta fijar versiones comprobadas y resolver lo que el código y las herramientas actuales obligan a precisar.

### Comprobaciones hechas (2026-11-06)
Con el código de `fase-7-empaquetado` (839ff89) y dos pruebas de concepto **fuera del repositorio**, con el `out/` real de la app:

| Qué | Dónde | Resultado |
|---|---|---|
| electron-builder 26.18.0, Electron 45.2.2 (Node 24.22.2, Chromium 156) | WSL2 con Node 24; Windows 11 con Node 22 | Genera AppImage (136,2 MB), `.deb` (116,6 MB) y NSIS (134,9 MB). **Objetivo de 100–150 MB cumplido.** Sin el icono definitivo |
| `electronFuses` nativo | Linux y Windows | `@electron/fuses read` confirma los 6 valores del ADR 0008; también `WasmTrapHandlers` activo y los otros 2 desactivados |
| Integridad del asar | Windows, sin instalar | electron-builder añade el recurso `ElectronAsar`. Con la cabecera alterada, la app termina con `FATAL … Integrity check failed for asar archive entry '<header>'` |
| `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS`, `--inspect` | Linux | Los tres se ignoran con los *fuses* aplicados |
| AppImage con `toolsets.appimage: "1.0.3"` | WSL2 solo con `libfuse3` | Arranca sin `libfuse2`, montada con FUSE y con `--appimage-extract-and-run`. Sin `--no-sandbox` donde `unshare -Ur true` funciona |
| Plantillas de electron-builder 26.18.0 | Lectura del paquete | Comportamientos de AppArmor, `--no-sandbox` y NSIS descritos abajo |
| `LSMinimumSystemVersion` de Electron 45.2.2 | `Info.plist` del zip oficial `darwin-arm64` | **13.0**. B6b solo se ve en macOS 13. Un Mac con chip Apple y macOS 12 o anterior no llega a abrir la app (`preguntas/0041`) |

**Sin probar**: nada de macOS se ha podido ejecutar aquí. Lo que este ADR dice de macOS viene del código de electron-builder 26.18.0 y queda sujeto a las tareas 0136, 0137 y 0139.

**Trampa de la documentación**: `electron.build/docs` describe ya la v27 (`mac.sign.identity`, `mac.asarIntegrityDigest`). En la 26.18.0 instalada la opción es `mac.identity` y `asarIntegrityDigest` no existe (comprobado en `out/options/macOptions.d.ts`). Las versiones se contrastan con los tipos del paquete instalado.

## Alternativas consideradas
| Tema | Opción | Licencia | Pros | Contras |
|---|---|---|---|---|
| Empaquetador | **electron-builder 26.18.0** | MIT | Ya en ADR 0001; NSIS, DMG, AppImage y deb; integridad en Windows y macOS; probado | Muchos paquetes de desarrollo |
| | electron-builder 27 (alfa) | MIT | Documentación actual | Es alfa |
| | Electron Forge | MIT | Herramienta oficial | Sustituye un stack aceptado; AppImage no es un destino oficial |
| *Fuses* | **`electronFuses` nativo** | MIT | Sin código propio; se aplican tras empaquetar y antes de firmar; la firma *ad hoc* se rehace | Usa internamente `@electron/fuses` 1.8.0, que solo conoce 8 *fuses* |
| | `afterPack` con `context.packager.addElectronFuses` | MIT | Lo que decía la 0025; acepta `strictlyRequireAllFuses` | Un *hook* más para el mismo resultado y el mismo orden |
| | `afterPack` con `flipFuses` de `@electron/fuses` 2.x | MIT | Versión más reciente | Hay que gestionar la firma a mano; riesgo de orden |
| Firma macOS | **`mac.identity: "-"`, `hardenedRuntime: false`** | — | Sella todo el paquete; el ADR 0001 ya exige *ad hoc* | Gatekeeper avisa (decisión 0001) |
| | `identity: null` | — | Sin pasos | No sella: tras cambiar binarios la firma queda inválida y hay informes de "está dañada" sin salida |
| AppImage | **`toolsets.appimage: "1.0.3"`** (runtime estático) | MIT | No necesita `libfuse2`; no fuerza `--no-sandbox` en el `.desktop` | electron-builder lo etiqueta "beta" |
| | Conjunto heredado `0.0.0` | MIT | No es beta | Necesita `libfuse2`, ausente por defecto en Ubuntu actual; `.desktop` siempre con `--no-sandbox` |
| Licencias JS | **`license-checker-rseidelsohn` 5.0.1 + mapas de fuentes del build** | BSD-3-Clause | Cubre lo que de verdad se distribuye | Un script pequeño |
| | Solo `--production` | BSD-3-Clause | Trivial | Comprobado: **no cubre `react-dom` ni `scheduler`**, que van en el *bundle*, y añade `@types/react` y `csstype`, que no se distribuyen |
| | `license-checker` original | BSD-3-Clause | Conocido | Sin publicar desde 2022 |
| `uv` en el paquete | **Descarga en el build con SHA-256 fijado** | Apache-2.0 / MIT | Lo pide la 0025; binarios fuera de git | Requiere red al construir |
| | Binarios en git | — | Sin red | 3 binarios de 30–40 MB en el historial |

## Decisión

### 1. Versiones
| Herramienta | Versión | Notas |
|---|---|---|
| `electron-builder` | **26.18.0** exacta | `latest` en npm. Existe `26.18.1` con la etiqueta `v26`, sin probar: subir exige repetir las pruebas |
| `@electron/fuses` | **2.1.3** exacta (dev) | Solo para **leer** los 9 *fuses* en la verificación; pide Node ≥ 22.12 |
| `@electron/asar` | **4.3.1** exacta (dev) | Solo para listar el asar en la verificación; pide Node ≥ 22.12 |
| `license-checker-rseidelsohn` | **5.0.1** exacta (dev) | Pide Node ≥ 24 y npm ≥ 11: cumplido por `app/.nvmrc` |
| `uv` | **0.13.7** | La de `ci.yml`, también la última publicada el 2026-11-06 |

Electron se queda en la versión de `package-lock.json`. Subir de Electron exige repetir la lectura de *fuses*: un *fuse* nuevo hace fallar la verificación (§3).

### 2. Configuración: `app/electron-builder.yml`
```yaml
appId: com.shinobikaraoke.app        # igual que ID_APP_WINDOWS (shared/titulo.ts); lo comprueba un test
productName: Shinobi Karaoke
directories: { output: release, buildResources: build }
files: ["out/**", "package.json", "!**/*.map"]
asar: true
npmRebuild: false                    # no hay módulos nativos
publish: null                        # esta fase no publica nada
forceCodeSigning: false
toolsets: { appimage: "1.0.3" }
electronFuses: { ... }               # §3
extraResources:
  - { from: ../worker/shinobi_worker, to: worker/shinobi_worker, filter: ["**/*.py"] }
  - { from: ../worker/requisitos, to: worker/requisitos }
  - { from: ../worker/pyproject.toml, to: worker/pyproject.toml }
  - { from: ../worker/uv.lock, to: worker/uv.lock }
  - { from: resources/runtime-manifest.json, to: runtime-manifest.json }
  - { from: ../LICENSE, to: LICENSE }
  - { from: ../THIRD_PARTY_NOTICES.md, to: THIRD_PARTY_NOTICES.md }
  - { from: resources/fonts, to: fonts, filter: ["**/*.woff2", "**/OFL.txt"] }
  - { from: resources/bin, to: bin, filter: ["uv", "uv.exe"] }
win:
  target: [{ target: nsis, arch: [x64] }]
  artifactName: Shinobi-Karaoke-Windows-x64.${ext}
  signtoolOptions: null              # firma preparada y desactivada (preguntas/0001)
  azureSignOptions: null
nsis:
  oneClick: true
  perMachine: false
  deleteAppDataOnUninstall: false
  differentialPackage: false         # sin autoactualización (preguntas/0037)
mac:
  target: [{ target: dmg, arch: [arm64] }]
  artifactName: Shinobi-Karaoke-Mac-chip-Apple.${ext}
  category: public.app-category.music
  identity: "-"
  hardenedRuntime: false
  gatekeeperAssess: false
  notarize: false
  # minimumSystemVersion: NO se fija (preguntas/0015): B6b necesita que la app abra en macOS < 14
dmg: { sign: false }
linux:
  target: [{ target: AppImage, arch: [x64] }, { target: deb, arch: [x64] }]
  executableName: shinobi-karaoke
  category: AudioVideo
  artifactName: Shinobi-Karaoke-Linux-x64.${ext}
deb:
  artifactName: shinobi-karaoke-linux-x64.${ext}
```
- Los nombres de los artefactos son los de la respuesta a `preguntas/0040`.
- `package.json` añade `author`, `homepage`, `repository` (el `.deb` falla sin el autor con correo) y `desktopName: shinobi-karaoke.desktop` (asocia la ventana al `.desktop`).
- `lucide-react` pasa a `devDependencies`, como React: va en el *bundle* y son 49 MB que el asar no necesita. En producción quedan `zod` y `yaml`, los únicos que `out/main/index.js` carga con `require`.
- `appId` se conserva: es la identidad que el código ya usa y cambiarlo después rompería notificaciones y accesos directos.

### 3. *Fuses* (ADR 0008 §9, sin cambios en los valores)
Los 8 que entiende la `electronFuses` de la 26.18.0, declarados **todos**:
```yaml
electronFuses:
  runAsNode: false
  enableCookieEncryption: false
  enableNodeOptionsEnvironmentVariable: false
  enableNodeCliInspectArguments: false
  enableEmbeddedAsarIntegrityValidation: true
  onlyLoadAppFromAsar: true
  loadBrowserProcessSpecificV8Snapshot: false
  grantFileProtocolExtraPrivileges: false
```
- **`WasmTrapHandlers`** (noveno *fuse* de Electron 45) queda en su valor por defecto, activo. Es lo que recomienda la documentación salvo que el entorno restrinja señales.
- **`enableCookieEncryption`** queda desactivado: la app no usa cookies y su activación es irreversible.
- **Sustituye a la 0025** ("en `afterPack`"): `electronFuses` hace lo mismo y en el mismo punto, después de empaquetar y antes de firmar. Si hiciera falta `strictlyRequireAllFuses`, se pasa a `afterPack` con `addElectronFuses`.
- **Como la opción nativa no es estricta**, la verificación del paquete lee los 9 *fuses* con `@electron/fuses` 2.1.3 y falla ante cualquier diferencia o *fuse* desconocido (tarea 0131).

**Integridad del asar**: macOS (`ElectronAsarIntegrity` en `Info.plist`) y Windows (recurso `ElectronAsar`), escrita por electron-builder. Linux no la tiene: la documentación de Electron solo la declara para macOS y Windows. Se acepta: `OnlyLoadAppFromAsar` sigue aplicándose y el `.deb` se instala como root.

### 4. Firma en macOS arm64
1. Orden en 26.18.0: empaquetar → integridad en `Info.plist` → *fuses* → firma de todo el paquete con identidad `-`.
2. `hardenedRuntime: false`: el propio electron-builder avisa de que *ad hoc* con *hardened runtime* puede impedir el arranque por la validación de bibliotecas.
3. El binario `Contents/Resources/bin/uv` debe quedar firmado. Lo comprueba la verificación en macOS: `codesign --verify --deep --strict` sobre la app y `codesign -dv` con `flags=0x2(adhoc)` sobre la app y sobre `uv`.
4. **No se ejecuta nada que escriba dentro del paquete**: una escritura en `Contents/` rompería el sello. Por eso el worker en producción lleva `PYTHONDONTWRITEBYTECODE=1` (§5).

Lo que Gatekeeper muestre de verdad a quien descarga el DMG **no se puede automatizar**: `preguntas/0041` y tarea 0139.

### 5. Worker sin bytecode en producción
Hoy `resolverLanzador` (modo `produccion`) y `diagnosticadorReal` no definen `PYTHONDONTWRITEBYTECODE`. Python crearía `__pycache__` en `resources/worker`: rompería el sello en macOS y ensuciaría la instalación en Windows. Ambos lanzadores lo añaden (tarea 0128). Coste: unas décimas de segundo al importar. La prueba de concepto ejecutó `demo` desde una copia del paquete con esta variable y no creó `__pycache__`.

### 6. Binario `uv`
`app/scripts/uv-binarios.json` fija versión y hashes; `app/scripts/descargar-uv.mjs` descarga el de la plataforma actual, comprueba el SHA-256 **antes** de extraer y deja solo el ejecutable en `resources/bin/`. Un hash distinto borra la descarga y sale con error.

| Plataforma | Recurso de `astral-sh/uv` 0.13.7 | SHA-256 (API de GitHub, `digest`) |
|---|---|---|
| `win32-x64` | `uv-x86_64-pc-windows-msvc.zip` | `0cdc5b38fe5a8168ed6a25814f5ba43c21d313dd3187314fccb37b7cec46e021` |
| `darwin-arm64` | `uv-aarch64-apple-darwin.tar.gz` | `81b811b57e4624df7ed3aac148e0359100d9962f3d9dce00aec533dc2e086731` |
| `linux-x64` | `uv-x86_64-unknown-linux-gnu.tar.gz` | `c5221ff41b7892bfc223543883600125f6a47fe845093e0f5bdff4f359196d83` |

Comprobados con `sha256sum` sobre la descarga real los de Linux y Windows. Se usa la variante `gnu` en Linux porque es la que ya prueba la CI, y su glibc mínima (2.17) es menor que la del resto.

### 7. Licencias
Dos archivos distintos para dos obligaciones:
- **Se distribuye con el instalador** (hay que incluir el texto de la licencia): paquetes JS del *bundle* y del asar, Electron (su `LICENSE.electron.txt` y `LICENSES.chromium.html` ya van en el paquete), `uv` (Apache-2.0 o MIT) y las fuentes OFL.
- **No se distribuye**, se instala desde PyPI en el equipo del usuario: dependencias Python. Se listan con su licencia, como promete `THIRD_PARTY_NOTICES.md` desde la Fase 2.

**JS** (`app/scripts/licencias-js.mjs`, tarea 0132):
1. `electron-vite build --sourcemap --outDir <temporal>` y extraer los paquetes de `node_modules/` que citan los mapas. Hoy: `lucide-react`, `react`, `react-dom`, `scheduler`, `zod`.
2. Unir el árbol de `npm ls --omit=dev --all`: hoy `yaml` y `zod`.
3. Pedir licencia y texto a `license-checker-rseidelsohn`, sin red. Se excluye el propio proyecto, que la herramienta marca `UNLICENSED` por `private: true`.
4. Regenerar el bloque entre marcadores de `THIRD_PARTY_NOTICES.md` y comparar en modo `--comprobar`.
5. Falla ante una licencia fuera de la lista permitida (MIT, ISC, BSD-2/3-Clause, Apache-2.0, 0BSD, BlueOak-1.0.0) o sin texto.

**Python** (`worker/scripts/licencias_requisitos.py`, tarea 0133): sin dependencias nuevas, con la API JSON de PyPI, igual que `medir_descarga.py`. Lee los 5 archivos de requisitos y falla si una licencia queda sin clasificar. Los paquetes `nvidia-*` se listan con su licencia propia (no se redistribuyen). **Necesita red**: no entra en los tests normales.

### 8. Asuntos legales
- La GPL obliga a ofrecer el código fuente a quien recibe el binario. **Hoy el repositorio es privado** (`gh repo view`, 2026-11-06), así que cualquier publicación exige antes hacerlo público o dar otra vía: `preguntas/0035`.
- Los artefactos del workflow de un repositorio privado solo los ven quienes tienen acceso: no es una distribución pública.
- Modelo Rápido: sin cambios (`preguntas/0018`). No va en el instalador y la tarea 0134 comprueba que no se descarga sin consentimiento.

## Consecuencias
- Positivas: instaladores dentro del tamaño objetivo; sin `libfuse2`; `.deb` con sandbox en Ubuntu 24+ gracias al perfil de AppArmor que incluye electron-builder; licencias calculadas sobre lo que se distribuye.
- Negativas / riesgos:
  - **`toolsets.appimage` es "beta"**. Si fallara en un runner o en pruebas manuales, se vuelve a `0.0.0`, con `libfuse2` y `--no-sandbox` siempre.
  - **AppImage en Ubuntu 24.04+**: el `AppRun` de electron-builder añade `--no-sandbox` si `unshare -Ur true` falla, que es lo esperable con la restricción de AppArmor. Arrancaría **sin el sandbox de Chromium del SO**. Por eso se recomienda el `.deb` en Ubuntu, Debian y Mint (`preguntas/0042`). Es un límite frente al ADR 0008 **pendiente de la decisión del usuario** (`preguntas/0045`). El aislamiento de contexto y la ausencia de `nodeIntegration` se mantienen.
  - macOS sin probar hasta que corra el workflow.
  - electron-builder añade unos 400 paquetes de desarrollo; `npm audit --omit=dev` no se ve afectado.
- Impacto en UX: `ux/09` (respuestas a 0040–0043). Falta el icono: sin él, los instaladores usan el de Electron (`preguntas/0039`, tarea 0140).

## Revisiones
- 2026-11-06: sustituye al texto de la tarea 0025 en dos puntos: *fuses* con `electronFuses`, no en `afterPack`; `resources/fonts` copia solo `.woff2` y `OFL.txt`. Completa el ADR 0001 (Empaquetado) y el ADR 0008 §9, sin cambiar sus decisiones.

## Fuentes
Consultadas el 2026-11-06.
- Electron, *fuses*: https://www.electronjs.org/docs/latest/tutorial/fuses
- Electron, integridad del asar: https://www.electronjs.org/docs/latest/tutorial/asar-integrity
- electron-builder, *fuses* (v26): https://www.electron.build/v26/docs/tutorials/adding-electron-fuses ; `FuseOptionsV1`: https://www.electron.build/docs/api/app-builder-lib.interface.fuseoptionsv1/
- electron-builder, macOS, Linux y NSIS: https://www.electron.build/docs/mac , https://www.electron.build/docs/linux , https://www.electron.build/docs/nsis
- Paquete `app-builder-lib` 26.18.0 (leído en local): `out/mac/MacTargetHelper.js`, `out/options/macOptions.d.ts`, `out/targets/appimage/appImageUtil.js`, `out/targets/appimage/AppImageTarget.js`, `out/toolsets/linux.js`, `templates/linux/after-install.tpl`, `templates/linux/apparmor-profile.tpl`, `templates/nsis/uninstaller.nsh`
- npm (versiones y licencias): `npm view electron-builder`, `@electron/fuses`, `@electron/asar`, `license-checker-rseidelsohn`
- uv 0.13.7: `gh api repos/astral-sh/uv/releases/tags/0.13.7`
- `license-checker-rseidelsohn`: https://www.npmjs.com/package/license-checker-rseidelsohn
- Restricción de AppArmor en Ubuntu 24.04 (informes de usuarios, no documentación oficial): https://discourse.ubuntu.com/t/problem-runing-appimage-files-without-no-sandbox/78361 , https://forum.obsidian.md/t/obsidian-appimage-not-work-in-kubuntu-24-04/80969
- Firma inválida frente a *ad hoc* en Apple Silicon (informes de terceros, poca autoridad): https://github.com/electron-userland/electron-builder/issues/5850 , https://flaviocopes.com/macos-open-anyway.md
