# 0059 — Contratos compartidos de la Fase 3: protocolo de `separar`, IPC de separación y eventos de reintento
- Estado: Hecha
- Paso del pipeline: 2
- Depende de: 0055, 0056 (antes de la Fase 3); 0029 (Hecha)
- ADRs: 0004 (Revisiones 2026-11-05 y 2026-11-05 bis), 0006, 0009 §8
- Spec UX: docs/ux/04-progreso-pipeline.md (fases y estados, criterios 18–20), docs/ux/02-biblioteca.md (menú ⋯, criterio 18)
- Cuándo: primera tarea de la Fase 3. En paralelo con 0057. Desbloquea a la vez el worker (0060), el gestor (0063, 0064) y la interfaz (0067, 0068), como hizo 0029 en la Fase 2

## Objetivo
Fijar en `app/src/shared/` y en el worker los contratos que usan todas las tareas de la Fase 3, para que worker, main e interfaz avancen en paralelo con dobles.

## Criterios de aceptación
- [x] **Argumentos de `separar`** (Zod en `shared/protocolo.ts`, validados también en el worker):
  `{ entrada, salida_dir, modelo: { id: 'calidad' | 'rapido', archivo, dir }, dispositivo: 'cpu' | 'cuda', bloques: 'normal' | 'pequenos' }`.
  - `entrada`: ruta absoluta a `fuente/mezcla.flac`; `salida_dir`: ruta absoluta a `biblioteca/<id>/pistas.tmp/` (el main la crea y la vacía).
  - `dir`: carpeta `modelos/` del directorio de datos (siempre explícita: `model_file_dir`, `preguntas/0009`).
- [x] **Fases de progreso** de la separación (constantes compartidas, con la del worker en un test de paridad):
  - del worker: `preparando` (indeterminada), `cargando_modelo` (indeterminada), `separando` (0–1, `detalle: { paso, total }`), `guardando` (indeterminada);
  - del main: `descargando_modelo` (0–1, `detalle: { bytes, total }`) y `reintentando` (indeterminada, `detalle: { motivo: 'memoria' | 'memoria_cpu' | 'red', espera_s? }`).
- [x] **Resultado de `separar`**: `{ voz: 'voz.flac', instrumental: 'instrumental.flac', modelo: { id, archivo, version_audio_separator }, dispositivo, segundos_separando, segundos_total }` (rutas relativas a `salida_dir`).
- [x] **Errores de `separar`** (sin códigos nuevos en el worker): `MEMORIA_INSUFICIENTE` (reintentable), `MODELO_NO_DISPONIBLE`, `SIN_ESPACIO`, `FORMATO_NO_SOPORTADO` (entrada que no es FLAC PCM 16 / 44,1 kHz / estéreo), `ARGUMENTOS_NO_VALIDOS`, `ERROR_INTERNO`. El catálogo (`shared/errores.ts`) añade `PROCESO_TERMINADO`, que solo genera el main (proceso muerto por el sistema sin línea de error, 0063); fuera de la separación, la interfaz lo muestra con `prog.error.generico`; en `separar` el main lo convierte en `MEMORIA_INSUFICIENTE` (0066, `ux/04` criterio 20).
- [x] **IPC** (`shared/canales.ts`, `shared/ipc.ts`, preload; handlers vacíos que responden `ERROR_INTERNO` hasta 0065):
  - `separacion.separar(cancionId)` → `void`: "Separar ahora", "Reintentar" y "Re-separar pistas" usan el mismo canal (las reglas de cuándo se acepta son de 0065).
  - `separacion.estimar(cancionId)` → `{ min, max, origen: 'medido_equipo' | 'referencia_medida' | 'estimado' } | null` en minutos (lo implementa 0067; `origen` según `preguntas/0021` §3).
  - `trabajos.alProgreso`: el evento admite las fases nuevas, `detalle` de cada una y `intento` (1, 2, 3).
  - `TrabajoIpc` añade `modo: 'calidad' | 'rapido' | null` y `dispositivo: 'cpu' | 'cuda' | null` (solo en separación; el modelo y el dispositivo **realmente usados**, para "Modelo Calidad · ⓘ" con `{dispositivo}`, `ux/04` criterio 13) e `intento`.
- [x] **Variable de entorno del doble**: `SHINOBI_SEPARADOR_FALSO=<ruta a escenario.json>` documentada en `shared/` y en el README del worker (misma regla que `SHINOBI_YTDLP_FALSO`: el main solo la pasa sin empaquetar). Esquema Zod del escenario (lo usa 0060):
  `{ segundos: number, pasos: number, fallos?: [{ cuando: { bloques?, dispositivo?, intento? }, codigo, reintentable }], morir_con_sigkill?: boolean }`.
  Junto a ella, el main pasa `SHINOBI_INTENTO=<n>` (solo con el doble) para que el escenario pueda fallar en un intento concreto.
- [x] Fixtures de ejemplo en `shared/__fixtures__/` (args válidos, resultado, eventos de cada fase) usados por los tests de ambos lados.
- [x] Tests de Zod (válidos e inválidos) y de paridad de fases entre TypeScript y Python.

## Notas de implementación
- **Contratos TS** (`app/src/shared/`):
  - `protocolo.ts`: `argsSepararSchema` (strict; rutas absolutas POSIX/Windows/UNC; `archivo` sin carpetas), `resultadoSepararSchema`, `FASES_SEPARACION_WORKER`/`FASES_SEPARACION_MAIN` (también añadidas a `FASES_PROGRESO`), esquemas de `detalle` (`separando`, `descargando_modelo`, `reintentando`), `ERRORES_SEPARAR`. Reutiliza `MODELOS_SEPARACION` de `manifiesto.ts`.
  - `separacion.ts` (nuevo): `ENV_SEPARADOR_FALSO`, `ENV_INTENTO` y `escenarioSeparadorSchema` (documentados; lo usa 0060).
  - `errores.ts`: `PROCESO_TERMINADO` y `CODIGOS_SOLO_MAIN` (el test de paridad con `errores.py` lo excluye).
  - `ipc.ts`/`canales.ts`/preload: `separacion.separar(cancionId)` y `separacion.estimar(cancionId)` (`estimacionCancionSchema`, con `origen`); `progresoTrabajoSchema` admite el `detalle` de cada fase e `intento`; `TrabajoIpc` añade `modo`, `dispositivo` e `intento` (nullable y opcionales: ausente equivale a `null`, para no romper a los constructores existentes).
  - `main/ipc/handlers.ts`: `deps.separacion?` opcional; sin él, ambos canales responden `ERROR_INTERNO` (hasta 0065). `index.ts` quita `SHINOBI_SEPARADOR_FALSO` del entorno si la app está empaquetada.
- **Worker**: `argumentos_separar.py` (`validar_args_separar`, mismas reglas) y `FASES_SEPARACION` en `protocolo.py`.
- **Fixtures**: `app/src/shared/__fixtures__/separacion.json` (args válidos/ inválidos, resultado, un evento por fase, escenario), leído por los tests de Vitest y de pytest.
- **Tests**: `shared/separacion.test.ts`, `protocolo.test.ts` (paridad de errores), `handlers.test.ts`, `worker/tests/test_argumentos_separar.py`.
- **Decisión**: `runtime.estimarSeparacion` conserva por ahora `aproximada`; 0067 lo reescribe con `origen` (el esquema nuevo ya existe como `estimacionCancionSchema`).
- Probar: `cd app && npx vitest run src/shared src/main/ipc`; `cd worker && uv run pytest tests/test_argumentos_separar.py`.
- Deuda: ninguna conocida.
