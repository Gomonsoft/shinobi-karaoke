# 0136 — Workflow `empaquetado.yml`: construir, verificar y probar desempaquetado
- Estado: En curso
- Paso del pipeline: 0 (distribución)
- Depende de: 0129, 0130, 0131, 0132, 0135 (y 0128 para que el paquete sea el definitivo)
- ADRs: 0013 §1, §3, §4; 0012
- Pregunta: 0038 (cuándo se puede lanzar por primera vez)
- ¿Red?: **sí** en `npm ci`, `uv:descargar`, electron-builder y `humo-worker`. Sin modelos. Nunca se ejecuta en push ni en PR.

## Objetivo
Generar los instaladores de los 3 SO y guardarlos como artefactos del workflow.

## Archivos
`.github/workflows/empaquetado.yml`. **`ci.yml` y `runtime-real.yml` no se tocan.**

## Contratos
- `on: workflow_dispatch`, sin más disparadores. `permissions: contents: read`. `timeout-minutes: 45` por trabajo.
- Acciones fijadas por SHA, tal como aparecen en el ADR 0013 §1.
- Trabajo `construir`, matriz `fail-fast: false`:

| `os` | Destinos | Carpeta desempaquetada |
|---|---|---|
| `windows-2025` | NSIS | `release/win-unpacked` |
| `macos-26` | DMG arm64 | `release/mac-arm64/Shinobi Karaoke.app` |
| `ubuntu-24.04` | AppImage y `.deb` | `release/linux-unpacked` |

- Pasos, en este orden:
  1. checkout; `setup-node` con `node-version-file: app/.nvmrc`; en macOS, `uname -m` = `arm64` o falla;
  2. `npm ci` (red);
  3. `npm run licencias:comprobar`;
  4. `npm run build`;
  5. `npm run uv:descargar` (red);
  6. `npm run empaquetar` (red);
  7. `node scripts/verificar-paquete.mjs <carpeta> --json <resultado>`;
  8. solo Linux: `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0`;
  9. `SHINOBI_PAQUETE_BIN=<ejecutable> npm run test:paquete` (xvfb en Linux);
  10. `node scripts/humo-worker.mjs` (red);
  11. calcular `SHA256SUMS-<so>.txt` de los instaladores;
  12. añadir a `GITHUB_STEP_SUMMARY`: archivo, tamaño en MB, SHA-256, nivel "desempaquetada probada";
  13. `upload-artifact`, `retention-days: 14`, `if-no-files-found: error`, nombre `shinobi-karaoke-<versión>-<sha corto>-<so>`, con **solo** los instaladores, `SHA256SUMS-*.txt` y el JSON.
- Sin `.blockmap`, `latest*.yml` ni `builder-debug.yml` en el artefacto.
- Sin secretos: ninguna variable `CSC_*`, `APPLE_*` ni `GH_TOKEN` para electron-builder. `--publish never`.
- El workflow **no crea** ninguna *Release*.

## Criterios de aceptación
- [ ] `grep` de `on:` en `ci.yml`: sin cambios frente a `develop`.
- [ ] Test sin red (`app/scripts/workflow-empaquetado.test.ts`, con `yaml`): el único disparador es `workflow_dispatch`; ninguna acción sin SHA de 40 caracteres; ninguna acción de publicación ni `contents: write`; `retention-days` presente.
- [ ] Primera ejecución en GitHub, cuando `preguntas/0038` lo permita: 3 trabajos en verde y 4 instaladores.
- [ ] **Tamaño de cada instalador anotado** aquí y en el backlog, frente al objetivo de 100–150 MB. De referencia, en la prueba de concepto sin icono: NSIS 134,9 MB, AppImage 136,2 MB, `.deb` 116,6 MB.
- [ ] Hasta esa ejecución la tarea queda en `En curso`, como 0058 y 0062 en la Fase 3.

## Verificación
```bash
cd app && npx vitest run workflow-empaquetado      # sin red
gh workflow run empaquetado.yml --ref <rama>       # CON RED; requiere el archivo en main
gh run watch
```

## Notas de implementación
El trabajo `construir` usa la matriz de tres sistemas, valida el paquete, ejecuta el humo de la app y del worker y genera un inventario de SHA-256. La subida admite exclusivamente los instaladores esperados, el inventario y el JSON de verificación. Las comprobaciones estáticas del disparador, permisos, acciones fijadas por SHA y retención pasan.

Quedan la ejecución en GitHub (0038), la verificación de los cuatro instaladores y sus tamaños. Referencia local de 0140: DMG macOS arm64 con icono, 135,9 MB.
