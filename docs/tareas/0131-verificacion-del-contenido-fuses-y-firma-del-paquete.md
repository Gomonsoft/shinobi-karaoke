# 0131 — Verificación del contenido, *fuses* y firma del paquete
- Estado: Hecha
- Paso del pipeline: 0 (distribución)
- Depende de: 0127 (la lógica); 0130 (para ejecutarla contra un paquete real)
- ADRs: 0012 §3, §4; 0008 §9; 0009 §2
- ¿Red?: no.

## Objetivo
Un script que falle si el paquete desempaquetado no contiene exactamente lo debido. Lo usa el workflow y se puede ejecutar en local.

## Archivos
- `app/scripts/verificar-paquete.mjs`: `node scripts/verificar-paquete.mjs <dir o .app> [--json <salida>]`;
- `app/scripts/verificar-paquete.test.ts`, con árboles falsos en un temporal;
- script `paquete:verificar` en `app/package.json`.

## Contratos
**Debe existir** en `resources/`:
- `app.asar`, `runtime-manifest.json`, `LICENSE`, `THIRD_PARTY_NOTICES.md`;
- `worker/shinobi_worker/__main__.py`, `worker/pyproject.toml`, `worker/uv.lock`;
- `worker/requisitos/*.txt`: cada ruta citada por el manifiesto, con `sha256` igual a su `sha256_requisitos`;
- `fonts/<familia>/OFL.txt` para cada familia, y sus `.woff2`;
- `bin/uv` o `bin/uv.exe`, ejecutable, que responde con la versión de `uv-binarios.json`.

**En `app.asar`** (`@electron/asar`): `package.json`, `out/main`, `out/preload`, `out/renderer`, y en `node_modules/` **solo** `zod`, `yaml` y sus dependencias de producción.

**No debe aparecer** en `resources/` ni en el asar: `spikes`, `tests`, `e2e`, `e2e-paquete`, `.datos-dev`, `docs`, `src`, `.venv`, `__pycache__`, `test_*.py`, `conftest.py`, `*.test.*`, `*.map`, `.ts` (salvo `.d.ts` de paquetes permitidos), `semilla`, `scripts`, `lucide-react`, `react`, `electron-builder`. Es una lista cerrada en una constante probada.

**Fuses** (`@electron/fuses` 2.1.3): lee el mapa y lo compara con el esperado:

| *Fuse* | Valor |
|---|---|
| `RunAsNode` | desactivado |
| `EnableCookieEncryption` | desactivado |
| `EnableNodeOptionsEnvironmentVariable` | desactivado |
| `EnableNodeCliInspectArguments` | desactivado |
| `EnableEmbeddedAsarIntegrityValidation` | activado |
| `OnlyLoadAppFromAsar` | activado |
| `LoadBrowserProcessSpecificV8Snapshot` | desactivado |
| `GrantFileProtocolExtraPrivileges` | desactivado |
| `WasmTrapHandlers` | activado |

Un *fuse* que no esté en la tabla hace fallar la verificación.

**Solo en macOS**:
- `codesign --verify --deep --strict` correcto;
- `codesign -dv` de la app y de `Contents/Resources/bin/uv` con `flags=0x2(adhoc)`;
- `Info.plist`: `ElectronAsarIntegrity` presente, `LSMinimumSystemVersion` igual a 13.0 (el de Electron 45.2.2) o, si sube Electron, menor que 14: B6b debe poder mostrarse (`preguntas/0015`);
- ejecutable con arquitectura `arm64` únicamente (`lipo -archs`).

**Solo en Windows**: el ejecutable `Shinobi Karaoke.exe` existe.

**Solo en Linux**: `resources/apparmor-profile` presente.

`--json` escribe `{ plataforma, tamano_desempaquetado, fuses, comprobaciones[] }`.

## Criterios de aceptación
- [ ] Tests sin red ni paquete real: árbol correcto pasa; falta `uv`; requisito con hash distinto; `spikes/`, un test o `.datos-dev` presentes; asar con `react`; *fuse* con otro valor; *fuse* desconocido. Las lecturas de *fuses* y asar son funciones inyectadas.
- [ ] Mensajes de error con la ruta o el *fuse* concreto.
- [ ] Contra un paquete real generado con 0130, en el SO del programador: pasa.

## Verificación
```bash
cd app
npx vitest run verificar-paquete                      # sin red
node scripts/verificar-paquete.mjs release/linux-unpacked   # requiere 0130
```

## Notas de implementación
Se creó `scripts/verificar-paquete.mjs` con CLI `node scripts/verificar-paquete.mjs <dir o .app> [--json <salida>]`. Comprueba recursos requeridos, SHA-256 de todos los archivos de requisitos citados por el manifiesto, fuentes OFL/WOFF2, ejecutable y versión de `uv`, entradas prohibidas, archivos requeridos del asar, dependencias de ejecución permitidas, los nueve fuses y, en macOS, sello ad hoc, integridad de asar, `LSMinimumSystemVersion` y arquitectura arm64. La lista de entradas prohibidas es una constante exportada. Las lecturas del asar y los fuses se inyectan en pruebas; el CLI incluye el tamaño desempaquetado y admite informe JSON.

Archivos: `app/scripts/verificar-paquete.mjs`, `app/scripts/verificar-paquete.d.mts`, `app/scripts/verificar-paquete.test.ts`, `app/package.json`.

Verificación sin red: `npx vitest run verificar-paquete` (18/18), incluyendo árbol válido, falta `uv`, hash incorrecto, carpetas/archivos prohibidos, React, dependencias no permitidas y fuse incorrecto/desconocido. Contra el paquete real macOS arm64 de 0130, `npm run paquete:verificar -- release/mac-arm64 --json /tmp/verificacion-mac.json` pasó: 304 514 051 bytes, 595 entradas en asar, los nueve fuses y firma/integridad/arquitectura correctas. El informe JSON se escribió correctamente.

Deuda: la comprobación del nombre del ejecutable Windows, el perfil AppArmor y la estructura Linux se ejecutará en los runners respectivos (0136–0137), al no ser posible construir esas plataformas en este Mac.
