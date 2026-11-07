# 0130 — Configuración de electron-builder, *fuses* y firma
- Estado: Hecha
- Paso del pipeline: 0 (distribución)
- Depende de: 0127, 0129
- ADRs: 0012 §2, §3, §4; 0008 §9; 0001
- Preguntas: 0015, 0016, 0037, 0040, 0043
- ¿Red?: **el empaquetado, sí** (Electron y utilidades, la primera vez). El test de configuración, no.

## Objetivo
Crear `app/electron-builder.yml` tal como lo define el ADR 0012 §2 y §3, y poder generar el paquete desempaquetado en local.

## Archivos
- `app/electron-builder.yml`;
- `app/scripts/electron-builder.test.ts`;
- scripts `empaquetar` (`electron-builder --publish never`) y `empaquetar:dir` (`electron-builder --dir --publish never`) en `app/package.json`.

## Contratos
- Copiar la configuración del ADR. Las opciones son las de **electron-builder 26.18.0** (`mac.identity`, no `mac.sign.identity`).
- Nombres (`preguntas/0040`): `Shinobi-Karaoke-Windows-x64.exe`, `Shinobi-Karaoke-Mac-chip-Apple.dmg`, `Shinobi-Karaoke-Linux-x64.AppImage`, `shinobi-karaoke-linux-x64.deb`. Paquete Debian: `shinobi-karaoke`.
- Sin `build/icon.*` todavía: se admite el icono de Electron hasta la tarea 0140.
- `resources/worker` contiene `shinobi_worker/**/*.py`, `requisitos/`, `pyproject.toml` y `uv.lock`. `resources/runtime-manifest.json`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, `fonts/`, `bin/uv[.exe]` en las rutas que ya espera el código (`rutasRecursosRuntime`, `resolverUv`, `leerTextoLegal`).

## Criterios de aceptación
- [ ] Test sin red, leyendo el YAML con `yaml`:
  - [ ] `appId === ID_APP_WINDOWS` (`shared/titulo.ts`) y `productName === TITULO_APP`;
  - [ ] destinos: NSIS x64 (`oneClick: true`, `perMachine: false`, `deleteAppDataOnUninstall: false`), **solo** DMG arm64, AppImage y `.deb` x64;
  - [ ] `mac.identity === '-'`, `hardenedRuntime === false`, sin `minimumSystemVersion`;
  - [ ] campos de firma presentes y desactivados: `signtoolOptions`, `azureSignOptions`, `notarize`, `forceCodeSigning`;
  - [ ] `publish === null`;
  - [ ] los 8 `electronFuses` con los valores del ADR 0012 §3;
  - [ ] `toolsets.appimage === '1.0.3'`.
- [ ] `npm run empaquetar:dir` genera el paquete en el SO del programador.
- [ ] `npx @electron/fuses read --app <ejecutable>` muestra los valores del ADR.
- [ ] Si el programador trabaja en Linux: AppImage y `.deb` se generan con `npm run empaquetar`.
- [ ] Los nombres de los 4 artefactos coinciden exactamente; un nombre distinto es un error, no un ajuste: se abre pregunta.

## Verificación
```bash
cd app
npx vitest run electron-builder      # sin red
npm run build && npm run uv:descargar && npm run empaquetar:dir   # CON RED
```

## Notas de implementación
Se añadió `app/electron-builder.yml` con los destinos NSIS x64, DMG arm64, AppImage y `.deb` x64, recursos externos, `publish: null`, firma desactivada y los ocho fuses del ADR 0012. Se excluye `**/src/**` del asar: el primer paquete real mostró que `zod` incluye sus fuentes TypeScript, que la tarea 0131 prohíbe distribuir. Se añadieron los comandos `empaquetar` y `empaquetar:dir` y seis tests de contrato que leen el YAML con `yaml` y comparan `appId` y `productName` con los contratos compartidos.

Archivos: `app/electron-builder.yml`, `app/scripts/electron-builder.test.ts`, `app/package.json`.

Verificación: Node 24; `npx vitest run electron-builder` (6/6), lint, typecheck, format:check, build y `npm run empaquetar:dir` correctos. Se generó `release/mac-arm64/Shinobi Karaoke.app`; `npx @electron/fuses read --app` mostró los ocho fuses esperados y `npm run paquete:verificar -- release/mac-arm64` pasó, incluida firma ad hoc, integridad del asar, mínimo 13.0 y arquitectura arm64. El empaquetado requiere acceso a GitHub para descargar Electron.

Deuda: la máquina disponible es macOS arm64; la generación de NSIS, AppImage y `.deb` se verifica en sus runners de workflow (0136–0137). El icono de Electron se mantiene hasta 0140.
