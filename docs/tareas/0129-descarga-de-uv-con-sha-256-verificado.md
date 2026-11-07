# 0129 — Descarga de `uv` por plataforma con SHA-256 verificado
- Estado: En curso (corrección de extracción en Windows)
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
Se añadió `uv-binarios.json` con uv 0.13.7 y los tres hashes fijados por ADR 0012 §6. `descargar-uv.mjs` selecciona solo Windows x64, macOS arm64 o Linux x64; descarga a una carpeta temporal, calcula SHA-256 antes de extraer con `tar` del sistema, verifica `uv --version`, y copia únicamente `uv`/`uv.exe` a `resources/bin/`. El ejecutable recibe permiso de ejecución en macOS/Linux. Si la versión correcta ya está instalada, no descarga de nuevo; hash o versión inválidos fallan con diagnóstico y limpian temporales/binario destino. Se añadió `descargar-uv.d.mts` para tipar el módulo MJS usado por la prueba TypeScript, sin dependencia nueva.

La prueba `descargar-uv.test.ts` cubre hash correcto e incorrecto (sin extracción), versión incorrecta, plataforma no admitida, idempotencia, los tres destinos/hash y sincronía con `UV_VERSION` de ambos workflows.

Verificación sin red: siete pruebas de `descargar-uv` pasan. Vitest completo pasa serializado (`npm test -- --maxWorkers=1`): 132 suites aprobadas, 1 omitida; 1820 pruebas aprobadas, 12 omitidas. La ejecución serial evitó varias carreras esporádicas del renderer que aparecieron en ejecuciones paralelas. También pasan lint, typecheck, format:check y build.

Verificación real solicitada: `npm run uv:descargar` descargó el artefacto oficial para `darwin-arm64`; el SHA-256 coincidió y `./resources/bin/uv --version` devolvió `uv 0.13.7 (316c827e0 2026-11-03 aarch64-apple-darwin)`. `git status` no muestra `resources/bin/uv`; el binario está ignorado.

**Corrección de Windows (2026-11-06).** Ante el fallo de `tar` descrito en el run 42286381986 (`Cannot connect to C: resolve failed`), se ejecuta `tar` con el temporal como `cwd` y el nombre relativo del archivo, evitando que el prefijo de unidad se interprete como host. Los nombres de miembros usan `/` en todos los sistemas. La prueba sin red extrae un ZIP mínimo con `tar` real y comprueba argumentos y contenido; incluye el caso de plataforma Windows también cuando se ejecuta en otro SO. No se añadieron dependencias.

Verificación de la corrección: 8 pruebas de `descargar-uv` aprobadas en macOS; lint, typecheck y format:check aprobados. La suite completa no se pudo completar: las pruebas de YouTube que lanzan el worker fallan al no poder escribir en `~/.cache/uv` dentro del sandbox; con una caché temporal vacía y sin red falta `hatchling`. Queda pendiente repetir la suite con la caché preparada y validar la descarga en Windows mediante el workflow. No se pudo consultar el log del run desde este entorno por falta de conexión a la API de GitHub.

**Corrección adicional del run 42288163254.** El job Windows ejecutó Git Bash y `tar` rechazó el ZIP (`This does not look like a tar archive`). Se invoca explícitamente `System32/tar.exe` usando `SystemRoot`, con el nombre relativo del ZIP y el directorio temporal como `cwd`. La prueba con doble comprueba la ruta y los argumentos en todos los SO; la extracción real del ZIP se ejecuta exclusivamente en Windows con esa misma herramienta. Una prueba adicional comprueba que un SHA-256 incorrecto impide invocar `tar`. La prueba en Linux ya no depende de que GNU tar pueda extraer ZIP. Nueve pruebas específicas pasan en macOS; queda pendiente confirmar la extracción real en Windows en el próximo workflow.

**Corrección del run 42289084072.** El ZIP oficial de Windows contiene `uv.exe`, `uvw.exe` y `uvx.exe` en la raíz; se solicita a `tar` únicamente `uv.exe`, sin interpolar una carpeta basada en el nombre del ZIP. El ZIP de prueba reproduce esa estructura y la prueba comprueba el argumento de extracción. Se conserva la verificación SHA-256 previa y la extracción real sigue condicionada a Windows. Nueve pruebas específicas pasan en macOS; falta validar el resultado en el workflow de Windows.
