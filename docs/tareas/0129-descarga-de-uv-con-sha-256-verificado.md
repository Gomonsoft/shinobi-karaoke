# 0129 — Descarga de `uv` por plataforma con SHA-256 verificado
- Estado: Pendiente
- Paso del pipeline: 0 (distribución)
- Depende de: 0127
- ADRs: 0012 §6; 0009 §3
- ¿Red?: **el script, sí**. Sus tests, no: usan un `fetch` inyectado.

## Objetivo
Colocar en `app/resources/bin/` el binario `uv` de la plataforma actual. `resolverUv` ya lo espera en `process.resourcesPath/bin/uv[.exe]`.

## Archivos
- `app/scripts/uv-binarios.json`;
- `app/scripts/descargar-uv.mjs`;
- `app/scripts/descargar-uv.test.ts`;
- script `uv:descargar` en `app/package.json`.

## Contratos
`uv-binarios.json`, con los valores de la tabla del ADR 0012 §6:
```json
{
  "version": "0.13.7",
  "binarios": {
    "win32-x64": { "archivo": "uv-x86_64-pc-windows-msvc.zip", "sha256": "0cdc5b38fe5a8168ed6a25814f5ba43c21d313dd3187314fccb37b7cec46e021" },
    "darwin-arm64": { "archivo": "uv-aarch64-apple-darwin.tar.gz", "sha256": "81b811b57e4624df7ed3aac148e0359100d9962f3d9dce00aec533dc2e086731" },
    "linux-x64": { "archivo": "uv-x86_64-unknown-linux-gnu.tar.gz", "sha256": "c5221ff41b7892bfc223543883600125f6a47fe845093e0f5bdff4f359196d83" }
  }
}
```
- URL: `https://github.com/astral-sh/uv/releases/download/<version>/<archivo>`.
- Flujo: descargar a un temporal → **calcular SHA-256 antes de extraer** → comparar → extraer solo `uv` o `uv.exe` → permiso de ejecución fuera de Windows → ejecutar `uv --version` y comprobar la versión.
- Hash distinto, plataforma sin entrada o versión distinta: borra lo descargado y termina con código distinto de 0 y un mensaje claro.
- Extraer con herramientas sin dependencias nuevas: `tar` en macOS y Linux; en Windows, `tar.exe` (incluido en Windows 10/11 y en el runner) también abre `.zip`.
- Idempotente: si ya existe la versión correcta, no descarga.

## Criterios de aceptación
- [ ] Test sin red: hash correcto, hash incorrecto (no extrae y borra), plataforma sin entrada.
- [ ] Test sin red: `version` coincide con `UV_VERSION` de `.github/workflows/ci.yml` y `runtime-real.yml`.
- [ ] Test sin red: las 3 plataformas existen y cada `sha256` tiene 64 caracteres hexadecimales.
- [ ] Ejecutado de verdad en el SO del programador: `resources/bin/uv --version` imprime 0.13.7.
- [ ] `git status` no muestra el binario.

## Verificación
```bash
cd app
npx vitest run descargar-uv        # sin red
npm run uv:descargar               # CON RED
./resources/bin/uv --version
```

## Notas de implementación
(las rellena el programador al terminar)
