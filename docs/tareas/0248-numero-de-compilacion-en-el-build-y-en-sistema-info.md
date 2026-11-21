# 0248 — Número de compilación: datos del build, `shared/compilacion.ts` y `sistema.info()`
- Estado: Hecha
- Paso del pipeline: 0 (distribución)
- Depende de: —
- ADRs: [0020](../adr/0020-publicacion-en-github-releases-y-politica-de-versiones.md), «Revisión para 0.2.0 — fase 10», §2; [0008](../adr/0008-seguridad-de-electron-y-protocolos-propios.md) (variables solo al compilar)
- Spec UX: [08 · Fase 10](../ux/08-ajustes-y-acerca.md#fase-10-de-020--número-de-compilación) (Conceptos, `aj.compilacion.id`, `aj.detalles.version`, AC3, AC6 y AC7)
- Versión: 0.2.0-alpha.2 · Fase 10, punto 3

## Objetivo
Dar a la app su número de compilación (`<versión>-<N>`), su commit y su canal (`publicada`, `desarrollo` o `local`), y un único módulo que forme las cadenas de la spec. Esta tarea es la base de 0249–0251.

## Contrato
1. **`app/scripts/compilacion.mjs`** (Node, sin dependencias, con `.d.mts` como los demás scripts):
   - `contar({ cwd })`: devuelve `{ numero, commit }` con `git rev-list --count HEAD` y `git rev-parse HEAD`. **Lanza un error** si `git rev-parse --is-shallow-repository` dice `true`.
   - `datosCompilacion({ env, git })`: lee `SHINOBI_COMPILACION_CANAL`, `SHINOBI_COMPILACION_NUMERO` y `SHINOBI_COMPILACION_COMMIT`.
     - Si el canal es `publicada` o `desarrollo`, exige un número entero ≥ 1 y un commit de 40 caracteres hexadecimales; si falta algo, lanza.
     - Sin canal: `{ canal: 'local', numero: null, commit }`, con el commit de `git rev-parse HEAD` si responde o `null`.
     - Cualquier otro canal lanza.
   - Orden de línea de comandos `contar --salida-github`: escribe `numero=` y `commit=` en `GITHUB_OUTPUT`. La usa 0251.
2. **`app/electron.vite.config.ts`**: en `main.define`, `__SHINOBI_COMPILACION__: JSON.stringify(datosCompilacion({ env: process.env }))`, junto a `__SHINOBI_YOUTUBE__`. Un error de validación hace fallar el build.
3. **`app/src/shared/compilacion.ts`** (puro):
   - tipo `Compilacion = { canal: 'publicada' | 'desarrollo' | 'local'; numero: number | null; commit: string | null }`, más su esquema zod;
   - `numeroVisible(version, c)`: `0.2.0-alpha.2-1234`, o solo la versión en `local` o sin número;
   - `hashCorto(c)`: 7 caracteres o `null`;
   - `identificador(version, c)`: los 4 casos de `aj.compilacion.id`;
   - `lineaVersion(version, c)`: `Versión: {identificador}` (`aj.detalles.version`).
   - Nunca produce `undefined`, `null`, `NaN` ni `0.2.0-alpha.3-` (AC3).
4. **`app/src/main/compilacion.ts`**: `declare const __SHINOBI_COMPILACION__` con el valor por defecto `{ canal: 'local', numero: null, commit: null }` si no está definida (Vitest), como hace `youtube.ts:26-30` con `__SHINOBI_YOUTUBE__`. Valida con el esquema; si el valor no es válido, se trata como `local`.
5. **IPC**: `infoSistemaSchema` (`app/src/shared/ipc.ts`, en torno a la línea 623) añade `compilacion` (obligatoria). El manejador `infoSistema` de `app/src/main/index.ts:826-845` (comprobado: `version: app.getVersion()` en la 833) la rellena. `version` no cambia. Actualizar los dobles y fixtures que construyen `InfoSistema` (p. ej. `AcercaDe.test.tsx`, `PrimerArranque.test.tsx` y la API falsa del renderer, si la hay).
6. **Main**:
   - al arrancar, una línea `info` en `app.log` (`arranque: Shinobi Karaoke {identificador}`);
   - en macOS, `app.setAboutPanelOptions({ applicationVersion: numeroVisible(...), version: hashCorto ?? '' })` para el panel del menú `role: 'about'` (`app/src/main/menu.ts:37`).
7. **Ninguna** lectura de `SHINOBI_COMPILACION_*` en `src/`: solo en la configuración del build.

## Criterios de aceptación
- [ ] `datosCompilacion` cubre: `publicada` y `desarrollo` válidos, un dato que falta, un commit no válido, `local` con git y `local` sin git.
- [ ] `contar` falla en un clon superficial (test con un repositorio temporal creado con `git clone --depth 1`, u omitido con motivo si no hay `git`).
- [ ] `identificador` y `lineaVersion` dan exactamente los 4 textos de `aj.compilacion.id` y `aj.detalles.version` de la spec 08 (AC6).
- [ ] `npm run build` sin variables da una compilación `local`. Con `SHINOBI_COMPILACION_CANAL=desarrollo` y sin número, el build falla.
- [ ] `sistema.info()` devuelve `compilacion` y el log de arranque tiene la línea.

## Pruebas de feedback
- Unitarias: `app/scripts/compilacion.test.ts`, `app/src/shared/compilacion.test.ts` y el test del manejador de `info`, si existe.
- E2E: ninguna (la cubren 0249 y los críticos).
- Críticos: sí (`shared/`, `main/`, IPC).
- Manual: AC7 en la guía de la versión: con la app de la *Release*, `git rev-list --count <hash>` da N.

## Notas de implementación

- Hecho: `app/scripts/compilacion.mjs` (+ `.d.mts`): `contar` (falla en clon superficial), `datosCompilacion` (publicada/desarrollo exigen número ≥ 1 y commit de 40 hex; sin canal es `local` con el commit de git si responde; otro canal lanza) y la orden `contar --salida-github`. `electron.vite.config.ts` lo inyecta en `main.define` como `__SHINOBI_COMPILACION__` (un dato mal en el CI hace fallar el build). `src/shared/compilacion.ts` (esquema zod, `numeroVisible`, `hashCorto`, `identificador`, `lineaVersion`) y `src/main/compilacion.ts` (constante validada; inválida o sin definir = `local`). `infoSistemaSchema` lleva `compilacion` (obligatoria) y el manejador de `index.ts` la rellena. Al arrancar se escribe `Shinobi Karaoke {identificador}` en `app.log` y, en macOS, `setAboutPanelOptions`. Ninguna lectura de `SHINOBI_COMPILACION_*` en `src/`.
- Pruebas: `scripts/compilacion.test.ts` (incluye un clon `--depth 1` real) y `src/shared/compilacion.test.ts`. Fixtures de `InfoSistema` actualizados (handlers, AcercaDe, Ajustes, PrimerArranque, Reproductor.estados).
- No ejecutado (a petición de la sesión principal): `npm run build`. Pendiente comprobar en un build: sin variables da `local`; con `SHINOBI_COMPILACION_CANAL=desarrollo` y sin número, falla.
- Deuda: no hay test del manejador `infoSistema` de `index.ts` (no hay test de `index.ts`); lo cubren los críticos.
