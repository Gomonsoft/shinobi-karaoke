# 0178 — Modelo puro de la cola y máquina de la sesión

- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: [0177](0177-contratos-compartidos-de-sesion-cola-y-roles.md)
- ADRs: [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §5–§8 y §13 (pruebas unitarias), respuestas [0059](../preguntas/0059-conductas-de-la-sesion-en-vivo-ante-incidencias.md) (3B) y [0058](../preguntas/0058-interfaz-de-la-sesion-en-vivo-y-la-cola.md)
- Spec UX: [Reproductor · Fase 4](../ux/07-reproductor.md#fase-4-de-020--ventana-secundaria-y-cola) (estados S1–S4, cuenta, reanudación y cierre), [Biblioteca · Fase 4](../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola) (operaciones del panel)

## Objetivo

Implementar en `app/src/main/sesion/` la lógica de la cola y de la sesión como **funciones puras**, sin Electron, sin disco y sin temporizadores reales. [0181](0181-servicio-de-sesion-e-ipc-en-main.md) las ejecuta y ejecuta sus efectos.

## Contrato

- **`cola.ts`**: estado `{ activa, pendientes, contexto }` y operaciones por id:
  - `agregar` (`siguiente`, `final`, y `{ antesDe, siRevision }` para deshacer);
  - `mover({ entradaId, antesDe })`;
  - `quitar` (devuelve la entrada que la seguía);
  - `vaciar({ contexto })`;
  - `candidata()`;
  - `marcarDisponibilidad(cancionId, motivo | 'ok')`, `quitarCancion(cancionId)` (eliminada) y `actualizarTitulos`.
  
  Errores: `ENTRADA_NO_ENCONTRADA` y `COLA_LLENA` (500). Los id de entrada los genera una función inyectada.
- **`maquina.ts`**: `reducir(estado, evento, ahoraMs) → { estado, efectos[] }`.
  - **Eventos**:
    - `abrir` (con `inicio`), `aceptadaApertura` y `documentoListo`;
    - `informe` (con `sesionId`, `entradaId` y `tipo`);
    - `revalidada` (resultado asíncrono con `entradaId` y `motivo | ok`);
    - `vencida` (`transicionId`);
    - las operaciones de cola, `siguiente`, `empezar`, `detenerTransicion`, `repetir` y `transporte`;
    - `solicitarCierre` (rol), `confirmarCierre` (opción y revisión), `cancelarCierre`, `cerrada` (causa: `confirmada`, `forzada`, `caida` o `salida`);
    - `pantalla` (perdida, reconectada o movida) y `responde` (sí o no).
  - **Efectos**: `comando` a la secundaria (§7), `programar`/`cancelar` (`transicionId`, `ms`), `revalidar(entradaId, cancionId)`, `difundir`, `bloquearEdicion`/`liberarEdicion`, `cerrarVentana` y `guardarPreferenciaPantalla`.
  - Reglas del ADR §7 y §8:
    - se ignoran los informes de otra sesión o entrada y los `fin` duplicados;
    - cuenta con duración fija al empezar; se reinicia solo si cambia el id de la candidata, con la misma duración;
    - comprobación por índice al empezar la cuenta y revalidación completa al consumir;
    - **en `fin_de_cola`, añadir arranca la cuenta (0059-3B)**; en `espera`, añadir no arranca;
    - `empezar` consume sin cuenta;
    - `siguiente` interrumpe o descarta y empieza la cuenta, de forma idempotente con `desdeEntradaId`;
    - `quitar` de la activa fallida pasa a `espera`;
    - `repetir` solo en `fin_de_cola` con el contexto terminado;
    - abrir con una canción descarta la última reproducida;
    - cierre con o sin pendientes: congelar y reanudar con el restante, `CONFIRMACION_OBSOLETA` si cambia la revisión, y si la canción termina con el diálogo abierto se marca terminada sin cuenta;
    - conservar con posición extrapolada (`ahoraMs` menos el instante del último informe) y `pausada`;
    - reanudar en el segundo, o desde el principio si la posición es anterior a la primera línea;
    - la caída y el cierre forzado conservan la cola sin preguntar.
  - La revisión sube con cada cambio observable y no con las operaciones nulas, como mover a la misma posición.
- **Proyecciones**: `aIpcPrincipal(estado, ahoraMs)` y `aIpcSecundaria(estado, ahoraMs)`. Calculan `restanteMs` de la cuenta, que queda congelada si `cierrePendiente`.

## Archivos

`app/src/main/sesion/cola.ts`, `maquina.ts`, `proyeccion.ts`, `index.ts` y sus pruebas (`*.test.ts`). No toca otros directorios.

## Criterios de aceptación

Cada punto es al menos una prueba de Vitest con reloj simulado:

- [ ] Toda la lista «Unitarias · `cola.ts`» y «`maquina.ts`» del ADR 0017 §13.
- [ ] **Eventos duplicados y tardíos**:
  - dos `fin` de la misma entrada producen una sola cuenta;
  - un `fin` de la entrada anterior tras consumir la siguiente no hace nada;
  - un `vencida` con un `transicionId` obsoleto no consume.
- [ ] **Fin de cola**:
  - sin pendientes pasa a `fin_de_cola`;
  - añadir pasa a `transicion` con `transicion_s`, o a `error` si la candidata ya se sabe no disponible;
  - quitar la única candidata durante la cuenta vuelve a `fin_de_cola`.
- [ ] Mover las pendientes posteriores durante la cuenta conserva la fecha límite. Mover otra al frente reinicia la cuenta con la duración original, aunque la configuración haya cambiado.
- [ ] Al pedir el cierre con 3 pendientes y la cuenta en 2,4 s, `restanteMs` no cambia en 5 s simulados y `cancelarCierre` sigue desde 2,4 s. `confirmarCierre` con una revisión vieja responde `CONFIRMACION_OBSOLETA`.
- [ ] Conservar en 133 000 ms sonando, con el último informe en 132 600 ms y 400 ms simulados después, da un contexto de 133 000 ± 50 ms con `pausada: false`. Con la misma canción dos veces en la cola, solo esa entrada queda reanudable.
- [ ] Cobertura de líneas de `main/sesion/{cola,maquina,proyeccion}.ts` ≥ 95 %.

## Notas de implementación
