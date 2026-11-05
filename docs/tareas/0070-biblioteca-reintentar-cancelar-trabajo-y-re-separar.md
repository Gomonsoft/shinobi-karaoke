# 0070 — Biblioteca: "Reintentar" que relanza el paso, "Cancelar trabajo" y "Re-separar pistas" en el menú ⋯
- Estado: Hecha
- Paso del pipeline: 1 y 2
- Depende de: 0059, 0068 (diálogos de cancelar). Integración real con 0065; se puede empezar con la API falsa
- ADRs: 0006 (canción dañada por pistas)
- Spec UX: docs/ux/02-biblioteca.md (acciones de tarjeta, menú ⋯, `bib.menu`, estados de la línea de paso); docs/ux/04-progreso-pipeline.md ("El mismo diálogo se usa desde [✕] del panel y «Cancelar trabajo»"), criterio 18; `preguntas/0020` §3: re-separar canciones hechas con Rápido queda **fuera del MVP**
- Cuándo: en paralelo con 0069, 0071 y 0072

## Objetivo
Saldar la deuda de 0019/0020: el botón "Reintentar" de la tarjeta hoy navega como "Continuar". Además faltan dos entradas del menú ⋯.

## Criterios de aceptación
- [x] **Reintentar** (tarjeta con un paso en `error` o `interrumpido`) relanza **sin salir de la Biblioteca**:
  - fuente de YouTube → `fuente.reintentar(id)` (0049);
  - separación → `separacion.separar(id)` (0065).
  - Error no reintentable → "Ver" (abre la vista de progreso), como hoy.
  - La tarjeta pasa a "En cola"/"En curso" con el evento del gestor. Si la llamada falla → toast de error con el texto del código.
- [x] **Cancelar trabajo** (menú ⋯ de un borrador con un trabajo vivo de fuente o separación):
  - en cola → se retira sin diálogo;
  - en curso → el diálogo correspondiente de 0045/0068 (`prog.dialogo.cancelar.descarga` o `prog.dialogo.cancelar`) → `trabajos.cancelar(id)`.
  - Sin trabajo vivo, la entrada no aparece.
- [x] **Re-separar pistas** (menú ⋯ de una canción **dañada porque faltan las pistas** y con `fuente/mezcla.flac`) → `separacion.separar(id)`. La tarjeta pasa a "En cola para separar". Si falta también la mezcla, la entrada no aparece. Al terminar, la canción deja de estar dañada (0065).
  - **Solo** canciones Dañadas sin pistas: no se ofrece para canciones separadas con el modelo Rápido (`ux/02` criterio 18, `preguntas/0020` §3).
- [x] **Línea de paso de la tarjeta** (`ux/02` criterio 18), sin mostrarse nunca como error:
  - `descargando_modelo` → `bib.paso.modelo` ("Descargando el modelo {n} %"), con barra determinada y sin tiempo restante;
  - `reintentando` con `motivo` `memoria` o `memoria_cpu` → `bib.paso.reintento.memoria`;
  - `reintentando` con `motivo: 'red'` → `bib.paso.reintento.red`, con la cuenta atrás.
- [x] El orden de las entradas sigue `bib.menu`. Teclado: tecla Menú / Mayús+F10, como el resto del menú (0026).
- [x] Tests (`Biblioteca.acciones.test.tsx`, `tarjeta.test.tsx`): línea de paso en `descargando_modelo` y en cada reintento; Reintentar de fuente y de separación sin navegar, no reintentable → Ver, Cancelar trabajo en cola y en curso (con el diálogo correcto según el paso), Re-separar en dañada por pistas, sin Re-separar en dañada por JSON, sin mezcla ni en una canción completa separada con Rápido.

## Notas de implementación
- **Reintentar** (`Biblioteca.tsx`, `reintentarPaso`): `fuente.reintentar(id)` o `separacion.separar(id)` según el primer paso en error/interrumpido (`pasoConProblema` en `tarjeta.ts`), sin navegar; si falla, toast con el título del código + "Copiar detalles". Error de fuente no reintentable (`textoDeError(...).reintentable === false`) -> botón "Ver" (acción `ver`, navega como Continuar). Los errores de separación son siempre reintentables.
- **Cancelar trabajo** (menú ⋯ si hay trabajo vivo, también en dañadas): en cola, `trabajos.cancelar` sin diálogo; en curso, `DialogoCancelarDescarga`/`DialogoCancelarSeparacion` de 0068.
- **Re-separar pistas**: solo dañadas con `motivo === 'pistas'` y mezcla presente. Para saberlo se añadió el campo opcional `sinMezcla` a `ResumenCancion`/`resumenCancionSchema` (calculado en `ServicioBiblioteca` al escanear/cargar; `guardar` lo conserva). Una dañada con trabajo vivo muestra la línea del trabajo ("En cola para separar", etc.) con insignia Dañada. No se ofrece en canciones separadas con Rápido (preguntas/0020 §3).
- **Línea de paso** (`tarjeta.ts`, encargo añadido desde 0071): `descargando_modelo` -> `bib.paso.modelo` con barra determinada y sin ETA; `reintentando` por `memoria`/`memoria_cpu` -> `bib.paso.reintento.memoria`; la de red ya existía. No se reutilizó `faseDeTrabajo`.
- Tests: `Biblioteca.acciones.test.tsx`, `tarjeta.test.tsx`, `main/biblioteca/servicio.test.ts`.
- Deuda: Reintentar de fuente asume YouTube (si no lo fuera, `fuente.reintentar` falla y sale el toast).
- Mantenimiento: el E2E `importar-youtube.spec.ts` ("cerrar la app durante la descarga: queda interrumpida y Reintentar la completa") esperaba "La descarga se interrumpió" tras Reintentar; ahora Reintentar relanza sin salir de la Biblioteca. Ajustado solo el test: tras "Reintentar «…»" comprueba que sigue en la Biblioteca y espera (poll sobre `cancion.json`) a que el paso `fuente` pase a `completado`, y mantiene las comprobaciones de "Interrumpido" al reabrir y de `mezcla.flac`.
