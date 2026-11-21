# 0187 — Tarjetas y menús de la Biblioteca durante la sesión

- Estado: Hecha
- Paso del pipeline: 6
- Depende de: [0183](0183-estado-de-sesion-en-la-principal-bloqueo-de-edicion-e-indicador.md) y [0184](0184-dialogo-abrir-el-reproductor-en-otra-pantalla.md) (para «Reproducir en otra pantalla…»)
- ADRs: [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §5 (eliminada y borrador), §6 (`cola.agregar`) y §9
- Spec UX: [Biblioteca · Fase 4](../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola) («Tarjetas y menú durante la sesión», S4 en la parte de la tarjeta y el toast, S10, S11 y E1 de la spec 06 para la tarjeta)

## Objetivo

Adaptar las tarjetas, los menús y los diálogos de la Biblioteca a la cola y a la sesión.

## Contrato

- **Acción principal de una Lista** (botón, portada e Intro): sin sesión, «▶ Reproducir» (local, como hoy); con sesión, «A la cola» (`bib.cola.boton`) → `cola.agregar({ donde: 'final' })`.
- **⋯ de una Lista**:
  - sin sesión: Reproducir · Reproducir en otra pantalla… · Reproducir a continuación · Agregar al final · …;
  - con sesión: sin «Reproducir» ni «Reproducir en otra pantalla…».
  
  Borradores y Dañadas no ofrecen las opciones de cola.
- **Toasts**:
  - `cola.toast.final` y `cola.toast.siguiente` con [Deshacer] (`cola.quitar` de la `entradaId` devuelta);
  - en espera sin candidata, [▶ Iniciar ahora] (`sesion.empezar`);
  - `COLA_LLENA` → `cola.llena`;
  - la primera entrada de una cola vacía abre el panel.
- **Línea de la cola en la tarjeta**: `bib.cola.sonando` o `bib.cola.enCola`.
- **Bloqueos**:
  - «Editar» y «Continuar» hacia Letra o Editor, y la portada de esos borradores, usan `useAccionBloqueable` ([0183](0183-estado-de-sesion-en-la-principal-bloqueo-de-edicion-e-indicador.md));
  - «Eliminar…» y «Volver a borrador» de la canción activa quedan `aria-disabled` con `bib.cola.activaBloqueada`;
  - para una pendiente, sus diálogos añaden `bib.cola.dialogo.eliminar` o `bib.cola.dialogo.borrador`.
- La selección múltiple ya no excluye canciones por la sesión: se retira la nota de «Canciones no editables» en ese caso.

## Archivos

`app/src/renderer/src/vistas/biblioteca/{TarjetaCancion.tsx,tarjeta.ts,DialogosCancion.tsx,BarraSeleccion.tsx}` y sus pruebas, y las líneas del menú de la tarjeta. No toca `vistas/biblioteca/cola/**` ([0185](0185-panel-de-cola-sesion-controles-recuperacion-y-cierre.md) y [0186](0186-panel-de-cola-lista-de-pendientes.md)) ni `sesion/` ([0183](0183-estado-de-sesion-en-la-principal-bloqueo-de-edicion-e-indicador.md)).

## Criterios de aceptación

- [ ] S10 y S11 de la spec 02 y E1 en la tarjeta, en Vitest.
- [ ] Añadir la misma canción dos veces da dos entradas, y [Deshacer] quita solo la suya.
- [ ] Sin sesión y con la cola preparada, «Reproducir» abre el reproductor local, como hoy, y la tarjeta muestra `bib.cola.enCola`.
- [ ] Con `CANCION_NO_DISPONIBLE` en `cola.agregar`, por ejemplo porque la canción pasó a borrador entre medias, se muestra el toast de error y no hay entrada.

## Notas de implementación

**Qué se hizo.**
- `TarjetaCancion.tsx`: con sesión, la acción principal, la portada, Intro/Espacio y el botón redondo de una Lista son «A la cola» (`cola.agregar` al final); el ⋯ sigue la tabla de la spec (sin sesión: Reproducir · Reproducir en otra pantalla… · a continuación · al final; con sesión, sin las dos primeras). Línea `bib.cola.sonando` / `bib.cola.enCola` (`lineaDeCola` en `tarjeta.ts`, incluida en el nombre accesible). «Editar» y «Continuar» (y la portada y el botón del borrador) usan `useAccionBloqueable`. «Eliminar…» y «Volver a borrador» de la activa quedan `aria-disabled` con `bib.cola.activaBloqueada` (Supr muestra ese texto en un toast).
- `useAgregarACola.ts`: `cola.agregar` con toasts `cola.toast.final|siguiente|cuenta`, [Deshacer] (`cola.quitar` de su `entradaId`), [Iniciar ahora] en espera sin candidata, [Detener cuenta] en la cuenta del fin de cola, `COLA_LLENA` → `cola.llena`, `CANCION_NO_DISPONIBLE` → `ses.error.noDisponible`, y apertura del panel con la primera entrada de una cola vacía.
- `Biblioteca.tsx`: cablea las acciones nuevas; `continuar` decide con el destino real y abre `edi.bloqueo` si es Letra o Editor; los diálogos de eliminar y volver a borrador de una pendiente añaden `bib.cola.dialogo.*`.
- `MenuContextual.tsx` (aditivo): `ItemMenu.bloqueado` y `ariaEtiqueta` (aria-disabled con candado de 14 px, enfocable y que ejecuta la acción).
- Prueba nueva `Biblioteca.cola.test.tsx` (S10, S11, E1, S4, errores) y ajuste de `Biblioteca.acciones.test.tsx` (nuevas opciones del ⋯).

**Decisiones.**
- El borrador solo muestra candado en «Continuar» cuando el destino es seguro (fuente y pistas completas); en los demás casos el bloqueo se decide al pulsar, con el destino real.
- Selección múltiple: el código no excluía canciones por la sesión (la nota era solo de la spec), así que `BarraSeleccion.tsx` no cambia.
- Panel al añadir: se abre si no había pendientes ni activa.

**Cómo probarlo.** `npm run test -- src/renderer/src/vistas/biblioteca`.
