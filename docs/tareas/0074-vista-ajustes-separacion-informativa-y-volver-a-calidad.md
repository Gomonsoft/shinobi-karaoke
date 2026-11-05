# 0074 — Vista Ajustes: separación informativa, "Volver a Calidad" y Acerca de
- Estado: Hecha
- Paso del pipeline: transversal
- Depende de: 0057 (`volverACalidad`, estado `volverACalidad`, `rapidoPendiente`), 0067 (estimación con `origen`); 0038 y 0054 (Hechas: Acerca de e información para soporte)
- ADRs: 0004 (Revisiones 2026-11-05: Rápido no elegible en Ajustes), 0006 (`separacion.modo`, `rapido_aceptado`)
- Spec UX: docs/ux/08-ajustes-y-acerca.md (completa; criterios 1–9), tras `preguntas/0019` §4 y `0021` §2 y §4
- Cuándo: en paralelo con 0068–0073 en cuanto estén 0057 y 0067

## Objetivo
La vista `{ tipo: 'ajustes' }` (hoy un marcador) con la sección "Separación de voz" **solo informativa**, la acción "Volver a Calidad…" cuando se usa Rápido y el bloque "Acerca de" (reutiliza los componentes de `vistas/acerca/`).

## Criterios de aceptación
- [ ] `vistas/ajustes/`: se abre con ⚙ o Ctrl/Cmd+, y Esc vuelve a la Biblioteca.
- [ ] **Separación de voz** (criterios 1 y 2), sin grupo de radio ni ningún control para elegir el modelo:
  - `aj.sep.equipo`, a partir de `estado().equipo` del runtime (`preguntas/0021` §4):
    - NVIDIA usable con VRAM conocida: "tarjeta gráfica NVIDIA ({n} GB)"; sin VRAM: "tarjeta gráfica NVIDIA";
    - Apple Silicon: "Mac con chip Apple";
    - sin GPU: "sin tarjeta gráfica compatible (se usa el procesador)";
    - NVIDIA rebajada por el diagnóstico (`perfilPrevisto === 'cuda'` y `perfil === 'cpu'`): "tarjeta gráfica NVIDIA (no se puede usar: se usa el procesador)".
  - `aj.sep.modelo` con el **modelo efectivo** (modo vigente de 0056: un `automatico` guardado se muestra como Calidad), la descripción (`aj.sep.desc.*`) y `aj.sep.tiempo`, o `aj.sep.tiempo.aprox` si la estimación de 0067 trae `origen: 'estimado'`, para 4 min.
  - Con Calidad en uso no hay acciones ni menciones a Rápido.
- [ ] **Con Rápido en uso** (criterio 3):
  - banner `aviso` con `aj.sep.rapido.aviso`: fecha de `rapido_aceptado` en formato largo local y enlace "Créditos y licencias", que abre el diálogo de créditos de 0038;
  - `aj.sep.calidad.info` (+ `aj.sep.descarga` si Calidad no está verificado) y el botón "Volver a Calidad…" (`aj.sep.boton.calidad`), con `aj.sep.nota`.
- [ ] **Volver a Calidad** (criterio 4):
  - siempre con el diálogo `aj.sep.dialogo`, también si Calidad ya está descargado. La frase de la descarga solo aparece si falta. Foco inicial en "Volver a Calidad" y Esc = Cancelar.
  - Al confirmar → `runtime.volverACalidad()`:
    - mientras descarga, la barra en línea (`aj.sep.descargando` + [Cancelar] + `aj.sep.mientras`) sustituye al botón. [Cancelar] llama a `runtime.cancelarVolverACalidad()` y vuelve el botón, sin mensaje;
    - éxito → variante Calidad, toast `aj.sep.toast.calidad` y anuncio a lectores de pantalla;
    - error → banner `error` en línea con el texto del código (los mismos de B4, `ux/01`) + `aj.sep.error.sigue` + [Reintentar], que repite sin diálogo. El modelo no cambia.
  - **Reenganche**: al salir y volver a Ajustes, la vista lee `estado().volverACalidad` y muestra el progreso o el error en curso (`preguntas/0021` §2).
- [ ] El cambio no altera las canciones ya separadas ni la separación en curso (criterio 5). Las que están en cola usan el modelo vigente al empezar (0065).
- [ ] **Acerca de** (criterios 6–8): mismo bloque que el diálogo de 0038, con `aj.acerca.creditos` actualizado (MelBand RoFormer de Kimberley Jensen; UVR solo para Rápido). Comprobar que el diálogo del primer arranque usa el mismo texto.
- [ ] **Copiar información para soporte** (criterio 9; ajusta lo hecho en 0054): sustituye "modo de separación" por **modelo en uso** (`calidad` o `rapido (aceptado el AAAA-MM-DD)`) y **dispositivo** (`cuda`/`cpu`). Sin motor instalado, `sin instalar`. Mismo cambio en el diálogo Acerca de del primer arranque.
- [ ] Tests de componente con la API falsa:
  - cada descripción del equipo;
  - Calidad sin acciones;
  - Rápido con aviso y fecha;
  - el diálogo con y sin la frase de descarga;
  - descarga con progreso, cancelar, error y Reintentar, éxito con toast;
  - reenganche con una descarga en curso;
  - `.aprox` según el origen;
  - copiar información con Calidad y con Rápido.

## Notas de implementación
- Vista `vistas/ajustes/` (`Ajustes.tsx`, `SeparacionAjustes.tsx`, `modelo.ts`, `textos.ts`, CSS, tests) y `App.tsx` (`case 'ajustes'`). Sección de separación solo informativa; Rápido: aviso con fecha, "Volver a Calidad…" con diálogo, barra en línea, cancelar, error + Reintentar, reenganche leyendo `estado().volverACalidad`, toast al terminar.
- `AcercaDe`: créditos actualizados (MelBand RoFormer; UVR solo Rápido) e `infoSoporte` con "Modelo de separación" (`calidad` / `rapido (aceptado el AAAA-MM-DD)`) y "Dispositivo" (`sin instalar` sin motor); lo comparte el diálogo del primer arranque.
- Cambios de contrato mínimos: `runtime.estimarSeparacion(duracionMs, modelo?)` (Ajustes necesita la estimación de Calidad estando en Rápido) y `requisitos` con `bytesCalidad` y `calidadDescargado`.
- Equipo: no se añadió `estado().equipo`; la VRAM sale de `config.instalacion.hardware.vram_mb` y la rebaja de `perfilPrevisto`/`perfil` del estado.
- Probar: `npx vitest run src/renderer/src/vistas/ajustes`. Deuda: sin e2e propio (0076).
