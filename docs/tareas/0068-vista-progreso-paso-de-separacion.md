# 0068 — Vista de progreso: paso de separación (cola, fases, tiempo, cancelar, pendiente, errores y oferta de Rápido)
- Estado: Hecha
- Paso del pipeline: 2
- Depende de: 0045 (Hecha), 0057 (módulo `aviso-rapido` y API), 0059, 0067. Se desarrolla con la API falsa; la integración real llega con 0065/0066
- ADRs: 0004, 0006
- Spec UX: docs/ux/04-progreso-pipeline.md §1: subpaso "Separar voz e instrumental", wireframe "Error de separación con oferta del modelo Rápido", microcopy y criterios 1–8c, 13, 14, 18 y 20. Textos definitivos tras `preguntas/0019` §3 y `0020`. Diálogo `aviso-rapido` de docs/ux/01-primer-arranque.md
- Cuándo: en paralelo con 0065 y 0066

## Objetivo
Completar en `vistas/progreso/` el subpaso que 0045 dejó como "○ provisional Fase 3". El estado "Terminado" con la escucha es la tarea 0069.

## Criterios de aceptación
- [ ] **En cola**: ⏸ con `prog.cola` y el título de la canción que se está separando ("2.ª en la cola" si hay más de una delante), más `prog.eta.previa` (0067). "Cancelar separación" la retira de la cola sin diálogo.
- [ ] **En curso**, según la fase (0059):
  - `descargando_modelo` → `prog.fase.modelo` (o `prog.fase.modelo.rapido` si el trabajo usa Rápido), con barra determinada y "X MB de Y MB" (criterio 18);
  - `preparando` y `cargando_modelo` → `prog.fase.cargando`, con barra indeterminada y la estimación previa;
  - `separando` → `prog.fase.separando` con %, barra que nunca retrocede y `prog.eta` (`prog.eta.calculando` los primeros 15 s);
  - `guardando` → `prog.fase.guardando`, con barra indeterminada;
  - `reintentando` → `prog.reintento.memoria` (`motivo: 'memoria'`) o su variante "Reintentando con el procesador… Tardará más." (`'memoria_cpu'`), con barra indeterminada y sin banner de error (criterio 7).
- [ ] **Modelo · ⓘ** (criterio 13): "Modelo Calidad" / "Modelo Rápido" (`prog.modo.*`), según `TrabajoIpc.modo` (el modelo realmente usado). Sin trabajo vivo: el de `pistas.modelo` o el vigente.
  - El popover se abre con clic, Intro o Espacio; Esc lo cierra y devuelve el foco.
  - Con Calidad: `prog.modo.ayuda.calidad`, con `{dispositivo}` = "tu tarjeta gráfica NVIDIA" o "el procesador" (`TrabajoIpc.dispositivo`), sin enlace.
  - Con Rápido: `prog.modo.ayuda.rapido`, con el enlace "Ir a Ajustes".
  - Ningún texto dice que se puede elegir el modelo.
- [ ] **Cancelar separación**: disponible también durante `descargando_modelo` y `reintentando`. En curso, abre el diálogo `prog.dialogo.cancelar` con el foco en "Seguir separando" y llama a `trabajos.cancelar`. El componente del diálogo se exporta, junto al de la descarga de 0045, para reutilizarlo desde el panel de actividad (0071) y el menú de la tarjeta (0070).
- [ ] **Pendiente** (tras cancelar, o sin trabajo vivo con la fuente completada): `prog.pendiente` + "Separar ahora" (→ `separacion.separar(id)`) + estimación previa. El foco va a "Separar ahora".
- [ ] **Error** (paso `separacion` en `error`): ✕ y banner `error` con el texto de la tabla de microcopy.
  - `MEMORIA_INSUFICIENTE`: `prog.error.MEMORIA_INSUFICIENTE` si se separaba con Calidad, o `prog.error.MEMORIA_INSUFICIENTE.rapido` si se separaba con Rápido.
  - `MODELO_NO_DISPONIBLE`: el texto nuevo, con el botón "Reintentar" (no "Descargar y reintentar").
  - Los códigos desconocidos van con `prog.error.generico` y "Copiar detalles".
  - "Reintentar" (primario, con el foco) llama a `separacion.separar(id)`.
- [ ] **Oferta de Rápido** (criterios 8b y 8c): solo con `ofrecerRapido` (0066), es decir, separando con Calidad, con `MEMORIA_INSUFICIENTE` o con `MODELO_NO_DISPONIBLE` cuya causa no sea `SIN_CONEXION`.
  - El banner añade `rapido.oferta.separacion` y el botón secundario "Usar el modelo Rápido…", que abre el diálogo `aviso-rapido` de 0057 con el motivo `rapido.motivo.memoria` o `rapido.motivo.descarga`. Cancelar no cambia nada.
  - Al aceptar: `runtime.aceptarYUsarRapido('separacion')`. El subpaso vuelve a ⟳ con `prog.fase.modelo.rapido` (solo si falta Rápido) y después se llama a `separacion.separar(id)`. El indicador pasa a "Modelo Rápido".
  - Si esa descarga falla o se cancela, se muestra el error de la descarga **sin oferta** y el modelo no cambia. Con `rapidoPendiente`, "Reintentar" vuelve a llamar a `aceptarYUsarRapido('separacion')` sin diálogo y luego a `separar` (`preguntas/0021` §1).
  - Tras un reinicio con `rapidoPendiente`, el botón secundario es "Usar el modelo Rápido", sin "…" y sin diálogo.
- [ ] **Muerte del proceso por el sistema** (criterio 20): nada propio. El main ya la convierte en reintentos y en `MEMORIA_INSUFICIENTE` (0063/0066), y la vista no tiene ninguna rama para `PROCESO_TERMINADO` en la separación.
- [ ] **Interrumpido**: ⚠ + `prog.interrumpido` + "Reintentar".
- [ ] "Mientras tanto…", "Volver a la biblioteca" y Esc se comportan igual que en 0045, también con la separación en curso. El primario pasa a "Ir al editor" si ya hay letra (`ux/00` §3).
- [ ] **Anuncios** `aria-live`: inicio de cada fase visible, 25/50/75 % de `separando`, reintento y error. Los valores interpolados (0064) no generan anuncios extra. El banner con la oferta se anuncia completo una vez.
- [ ] Los textos "Calidad"/"Rápido" y la estimación usan las funciones compartidas (0067); la vista no hace cálculos.
- [ ] Los textos salen de `ux/04` y `ux/01` (`rapido.*`) **sin** marcas de provisional.
- [ ] Tests de componente (`Progreso.test.tsx`, `modelo.test.ts`) con trabajos falsos:
  - en cola con posición, cada fase, ETA a los 15 s;
  - reintento por memoria (las dos variantes), descarga del modelo (Calidad y Rápido);
  - cancelar en cola, en curso y durante la descarga del modelo;
  - pendiente → Separar ahora;
  - error de cada código, con Calidad y con Rápido;
  - oferta: aceptar, cancelar, fallo de la descarga y luego Reintentar sin diálogo; sin oferta con `SIN_CONEXION`;
  - interrumpido, y modelo y dispositivo realmente usados.

## Notas de implementación
- **Qué se hizo**: subpaso de separación completo en `vistas/progreso/`: cola (posición, título de la otra, estimación previa de 0067), fases (`descargando_modelo` Calidad/Rápido con MB, `preparando`/`cargando_modelo`, `separando` con barra sin retroceso y ETA, `guardando`, `reintentando` memoria/memoria_cpu), indicador "Modelo · ⓘ" con popover, cancelar (cola sin diálogo; en curso con `DialogoCancelarSeparacion`), pendiente + "Separar ahora", interrumpido, errores por código (Calidad/Rápido) y oferta de Rápido con `DialogoAvisoRapido` y `runtime.aceptarYUsarRapido('separacion')`. Anuncios por fase sin valores interpolados. Primario "Ir al editor" si hay letra.
- **Archivos**: `modelo.ts` (filaSeparar, bloques `pendienteSeparacion`/`interrumpidoSeparacion`/`errorSeparacion`), `textos.ts` (`SEP`, `textoDeErrorSeparacion`), `Progreso.tsx`, `IndicadorModelo.tsx`, `DialogosCancelar.tsx` (exporta `DialogoCancelarDescarga` y `DialogoCancelarSeparacion` para 0070/0071), tests `Progreso.test.tsx` y `modelo.test.ts`.
- **Decisiones**: la oferta se decide con `estado.ofrecerRapido` del runtime (0066 aplica ahí "Calidad y causa distinta de SIN_CONEXION"); con `rapidoPendiente` el botón es "Usar el modelo Rápido" sin diálogo y "Reintentar" repite `aceptarYUsarRapido`. El error de la descarga de Rápido es estado local de la vista (sin oferta). El modelo usado sin trabajo vivo: último visto, `pistas.modelo.perfil` o `runtime.modo`. `prog.eta.previa` no usa la variante `.aprox` (no existe texto). Con la fuente completada y la separación `pendiente` se muestra "Separar ahora" (puede verse un instante antes de que 0065 encole sola). `PROCESO_TERMINADO` no tiene rama propia (cae en `prog.error.generico`). El typecheck de `detalle` ya estaba acotado por fase.
- **Cómo probarlo**: `npx vitest run src/renderer/src/vistas/progreso`.
- **Deuda técnica**: integración real con 0065/0066; `Cancelar separación` no existe mientras se descarga Rápido tras aceptarlo (no hay trabajo que cancelar).
