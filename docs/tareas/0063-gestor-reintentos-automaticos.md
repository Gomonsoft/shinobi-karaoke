# 0063 — Gestor de trabajos: reintentos automáticos según `reintentable`, fase `reintentando` y muerte del proceso por el sistema
- Estado: Hecha
- Paso del pipeline: 1 y 2 (infraestructura)
- Depende de: 0059; 0014, 0049 (Hechas)
- ADRs: 0004 (Revisiones 2026-11-05, punto 4), 0009 §7
- Spec UX: docs/ux/04-progreso-pipeline.md (Estados → Error; `prog.reintento.red`; criterios 7, 19 y 20), docs/ux/02-biblioteca.md (`bib.paso.reintento.red`, criterio 18). Textos definitivos tras `preguntas/0020` §4–§5
- Cuándo: en paralelo con 0060 y 0064 (0064 toca `progreso.ts`; esta, `gestor.ts`)

## Objetivo
Saldar la deuda de 0014 ("sin reintentos automáticos según `reintentable`"): el gestor relanza un trabajo fallido según una **política** del llamador, sin pasar el paso a `error` mientras queden intentos, y lo anuncia como fase `reintentando`.

## Criterios de aceptación
- [x] `encolar(...)` admite `politicaReintento?: (error, intento, args) => { args, esperaMs, motivo } | null`.
  - `null` → error definitivo (comportamiento actual).
  - Si devuelve un plan, el trabajo **sigue vivo** con el mismo `id` y en la misma cola, sin volver al final: el paso sigue `en_curso` y `cancion.json` no cambia salvo `progreso`.
  - Se emite `trabajo:progreso` con fase `reintentando`, `detalle { motivo, espera_s }` e `intento` + 1. Tras `esperaMs` se relanza con los `args` nuevos.
  - El mismo `id` permite que la interfaz no pierda el trabajo.
- [x] Antes de cada reintento se llama a `alDescartar` (borra parciales). Cancelar durante la espera cancela el trabajo (sin proceso vivo) → `pendiente`. Cerrar la app durante la espera → `interrumpido`.
- [x] `intento` (1, 2, 3…) en `TrabajoIpc` y en los eventos de progreso (0059). `alResultado` recibe también el `intento` y los `args` finales (0065 los necesita para saber el dispositivo y el modelo usados).
- [x] **Muerte por el sistema**: si el proceso hijo termina por una señal (`SIGKILL`/`SIGTERM`) o con un código de salida sin línea de `error`, y **no** lo canceló el gestor, el error es `PROCESO_TERMINADO` con `reintentable: true` y la señal o el código en `mensaje`.
  - `PROCESO_TERMINADO` es un código **nuevo** del catálogo (`shared/errores.ts`), interno. Fuera de la separación, la interfaz lo muestra con `prog.error.generico`.
  - La política de cada comando decide qué hacer con él. En `separar`, 0066 lo trata **exactamente** como `MEMORIA_INSUFICIENTE` (`ux/04` criterio 20: mismos reintentos, mismos textos y misma oferta, sin texto propio). Por eso el usuario nunca ve `PROCESO_TERMINADO` en una separación.
  - Test con el separador falso `morir_con_sigkill` (POSIX) y con `os._exit(137)` (Windows).
- [x] **Política de las descargas de YouTube** (deuda de `arquitectura.md` §6 "descargas de red → reintento con espera exponencial"), en `main/fuente/youtube.ts`:
  - `SIN_CONEXION` y `SERVICIO_NO_DISPONIBLE` → hasta 3 reintentos a los 5, 15 y 45 s, con `motivo: 'red'`;
  - `YOUTUBE_BLOQUEADO` sigue con su flujo de 0050 (no se duplica);
  - el resto, sin reintento.
  - Durante la espera (`ux/04` criterio 19, `ux/02` criterio 18), sin barra y sin banner de error, con cuenta atrás cada segundo:
    - la vista de progreso de la fuente (0045) muestra `prog.reintento.red` ("Reintentando en {n} s…") en "Descargar de YouTube";
    - la tarjeta muestra `bib.paso.reintento.red`, y el panel de actividad (0071) el mismo texto.
  - "Cancelar descarga" durante la espera abre **el mismo diálogo** que con la descarga en curso (`prog.dialogo.cancelar.descarga`): el trabajo sigue vivo.
- [x] Tests del gestor: plan → mismo id, paso sigue `en_curso`, `intento` sube, espera respetada (relojes falsos); política `null` → `error`; cancelar durante la espera; cierre durante la espera → `interrumpido`; `alDescartar` entre intentos; máximo de intentos respetado.

## Notas de implementación
- **Gestor** (`app/src/main/trabajos/gestor.ts`): `PeticionTrabajo.politicaReintento?: (error, intento, args) => PlanReintento | null` (`PlanReintento = { args, esperaMs, motivo }`). `correr()` es ahora un bucle: si el worker falla y la política devuelve plan, `esperarReintento` llama a `alDescartar`, sube `intento`, sustituye `args`, reinicia estimador/umbral (conservando `ritmoEsperado` de 0064), emite `trabajo:progreso` con fase `reintentando` (`detalle { motivo, espera_s }`, `intento`) y un `trabajo:cambio`, y espera `esperaMs` sin proceso vivo. El trabajo conserva `id`, puesto en la cola y paso `en_curso`; `cancion.json` no se toca. Cancelar durante la espera -> `pendiente`; cerrar la app -> `interrumpido`. El flujo de `YOUTUBE_BLOQUEADO` (0050) se mantiene y se integra en el mismo bucle. El gestor no limita los intentos: los limita la política.
- `alResultado(datos, { intento, args })` recibe el intento y los args finales (para 0065).
- `intento` en `TrabajoIpc` y en los eventos de progreso solo se informa si el trabajo tiene política y `intento <= 3` (el esquema compartido `intentoSchema` es 1–3, pensado para la separación); en los demás es `null`/ausente. Deuda: la descarga de YouTube puede llegar a un 4.º intento interno que no se expone.
- **Muerte por el sistema** (`worker.ts`): si el proceso termina por señal o con código != 0 sin línea de `error` y no lo canceló el gestor, rechaza con `PROCESO_TERMINADO` (`reintentable: true`, señal o código en `mensaje`). Sustituye al antiguo `ERROR_INTERNO` "sin informar del error". Tests con un worker Node que se mata con SIGKILL (POSIX) o `exit(137)` (Windows). Los tests con el separador falso `morir_con_sigkill` (Python) dependen de 0060/0066 y quedan para esas tareas. `PROCESO_TERMINADO` ya estaba en `shared/errores.ts` (0059).
- **YouTube** (`main/fuente/youtube.ts`): `politicaReintentoDescarga` (exportada): `SIN_CONEXION` y `SERVICIO_NO_DISPONIBLE` -> reintentos a los 5, 15 y 45 s con `motivo: 'red'`; el resto, null (`YOUTUBE_BLOQUEADO` sigue por 0050).
- **Interfaz**: `renderer/src/trabajos/useCuentaAtras.ts` (cuenta atrás cada segundo a partir de `espera_s`; `textoReintentoRed`). La vista de progreso (`progreso/modelo.ts`, `Progreso.tsx`) muestra `prog.reintento.red` en "Descargar de YouTube" y la tarjeta (`biblioteca/tarjeta.ts`, `TarjetaCancion.tsx`) `bib.paso.reintento.red`, sin barra ni banner; "Cancelar descarga" sigue siendo el de la descarga en curso (el trabajo está `en_curso`, mismo diálogo).
- Pendiente de otras tareas: el panel de actividad (0071) debe usar `esperaDeReintentoRed`/`useCuentaAtras`/`textoReintentoRed`; la política de `separar` (0066) y los textos `memoria`/`memoria_cpu` de la tarjeta y la vista son de 0066.
- Tests: `gestor.test.ts` (describe "reintentos automáticos"), `worker.test.ts`, `fuente/youtubePolitica.test.ts`, `trabajos/useCuentaAtras.test.tsx`, `progreso/modelo.test.ts`, `biblioteca/tarjeta.test.tsx`. Verificado: lint, typecheck, format:check, vitest completo (1159 OK) y build + playwright (39 OK, 1 omitido).
