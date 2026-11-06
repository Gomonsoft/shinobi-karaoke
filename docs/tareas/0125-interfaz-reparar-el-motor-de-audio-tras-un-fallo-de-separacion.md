# 0125 — Interfaz: error `RUNTIME_NO_DISPONIBLE` con "Reparar el motor de audio", confirmación con trabajos activos, variante "ya reparado" y tarjeta con [Ver] (+ E2E)
- Estado: Pendiente
- Paso del pipeline: 3 (deuda que se salda en la Fase 6)
- Depende de: 0124 (código `RUNTIME_NO_DISPONIBLE` del worker, `marcarDanada`, separador falso con ese código)
- ADRs: 0009 (Revisión 2026-11-06)
- Spec UX:
  - docs/ux/04-progreso-pipeline.md: componente "Reparar el motor de audio"; microcopy `prog.error.RUNTIME_NO_DISPONIBLE`, `.reparado` y `prog.dialogo.reparar`; criterios 8b, 21–23;
  - docs/ux/01-primer-arranque.md: estado "Instalación dañada a mitad de sesión", criterio 12b;
  - docs/ux/02-biblioteca.md: línea de paso con error → [Ver] para este código;
  - docs/ux/00-mapa-de-vistas.md §7.
- Pregunta: 0032 (respondida por el diseñador UX el 2026-11-06)
- Archivos:
  - `app/src/renderer/src/vistas/biblioteca/textosError.ts`;
  - `app/src/renderer/src/vistas/biblioteca/tarjeta.ts` (+ `tarjeta.test.ts`);
  - `app/src/renderer/src/vistas/progreso/Progreso.tsx`, `textos.ts` y `Progreso.test.tsx`;
  - crea `app/src/renderer/src/vistas/progreso/DialogoReparar.tsx` (+ test);
  - si hace falta, `app/src/renderer/src/vistas/primer-arranque/PrimerArranque.tsx` (abrirla a mitad de sesión);
  - crea `app/e2e/separacion-motor-incompleto.spec.ts`.
  Sin archivos compartidos con el resto de la Fase 6.
- Paralelizable con: 0112–0123.

## Contexto para quien implementa
- **Qué hace 0124**:
  - cuando una separación falla porque al motor le falta un paquete, el trabajo termina en error `RUNTIME_NO_DISPONIBLE`;
  - el main pone `config.instalacion.estado = 'dañada'` (`runtime.estado()` → `estado: 'dañada'`) y marca los componentes para reinstalarlos;
  - con la instalación `dañada`, el cliente del worker se niega a lanzar **cualquier** proceso (también las descargas de YouTube): devuelve `RUNTIME_NO_DISPONIBLE` al momento.
- **Textos**:
  - los títulos de error salen de `tituloDeError(codigo)` en `textosError.ts` (toasts, línea de la tarjeta);
  - el banner de error de la separación está en `Progreso.tsx`, con los textos `prog.error.*` de `vistas/progreso/textos.ts` (`textoDeErrorSeparacion`). Un código desconocido usa hoy `prog.error.generico`.
- **Tarjeta**: decide entre [Reintentar] y [Ver] con `esReintentable(r)` en `tarjeta.ts`. Hoy, para el paso de separación, devuelve siempre `true`.
- **Reparar**:
  - la vista Primer arranque (`{ tipo: 'primer-arranque' }`) muestra B5 "Hay que reparar el motor de audio" cuando `runtime.estado()` es `dañada` (`vistas/primer-arranque/modelo.ts`);
  - mientras está abierta, el menú y los atajos no dejan salir (la instalación no está `completa`);
  - al terminar, B3 → "Empezar" lleva a la Biblioteca.
- **Trabajos**:
  - `window.shinobi.trabajos.listar()` da los trabajos en curso y en cola, y `trabajos.cancelar(id)` cancela uno (el paso queda `pendiente`, como al cancelar a mano);
  - `navegacion/DialogoCierre.tsx` ya construye una lista «título de la canción + paso» de los trabajos pendientes: reutiliza esa forma de nombrarlos.
- **Copiar detalles**: busca el patrón que ya usa el banner de error genérico de `Progreso.tsx` y reutilízalo.

## Decisión del arquitecto: la reparación cancela los demás trabajos (se mantiene `prog.dialogo.reparar`)
- Reparar reinstala con `uv pip install --reinstall` el mismo entorno de Python que usan todos los procesos del worker, separaciones y descargas de YouTube. Un proceso vivo durante la reinstalación puede fallar a medias, y uno nuevo puede arrancar con paquetes a medio escribir.
- Además, con la instalación `dañada` el main ya no lanza ningún worker: los trabajos en cola fallarían igualmente en cuanto les tocara.
- Por tanto no pueden convivir. Antes de abrir B5 se cancelan, con la confirmación de la spec.

## Objetivo
Que el usuario entienda que hay que reparar el motor, llegue a la reparación con un clic sin perder trabajos sin saberlo, y después pueda volver a separar.

## Criterios de aceptación
- [ ] **Título** (`tituloDeError('RUNTIME_NO_DISPONIBLE')`): «Hay que reparar el motor de audio». Lo usan el toast de error y la línea de la tarjeta.
- [ ] **Tarjeta**: `esReintentable` devuelve `false` si el paso con problema (fuente **o separación**) está en `error` con código `RUNTIME_NO_DISPONIBLE`. La tarjeta muestra el título del error y [Ver], que abre la vista de progreso de la canción. Nunca [Reintentar] ni una acción de reparar. Test en `tarjeta.test.ts`, y los demás códigos siguen igual.
- [ ] **Banner con el motor dañado** (`runtime.estado().estado !== 'completa'`): `prog.error.RUNTIME_NO_DISPONIBLE`, con el texto literal de `ux/04`:
  > **Hay que reparar el motor de audio.** Falta una parte del motor que separa la voz de la música. Al repararlo se descarga de nuevo lo que falta; después, vuelve a separar esta canción.
  - Acciones: [Reparar el motor de audio] (primaria, con el foco) y [Copiar detalles] (secundaria; copia `codigo: mensaje` del error guardado, como el banner genérico).
  - Sin [Reintentar] y sin la oferta de Rápido (criterio 8b).
- [ ] **Banner con el motor ya reparado** (`estado === 'completa'` y el paso sigue en error con este código): `prog.error.RUNTIME_NO_DISPONIBLE.reparado`:
  > **El motor de audio ya está reparado.** Vuelve a separar esta canción.
  - Con [Reintentar] (primaria, con el foco), que relanza la separación como el Reintentar normal (`separacion.separar(id)`).
  - El banner cambia en vivo si el estado del runtime cambia mientras se ve la vista (suscripción a `runtime.alCambiar`).
- [ ] **[Reparar el motor de audio]**:
  1. Lee `trabajos.listar()` y se queda con los que siguen en curso o en cola (el que falló ya no está).
  2. Sin trabajos, navega al momento a `{ tipo: 'primer-arranque' }`.
  3. Con trabajos, abre `DialogoReparar` (componente `Dialogo` del sistema, texto literal de `prog.dialogo.reparar`):
     > **¿Reparar el motor de audio ahora?** Hay {n} trabajo(s) sin terminar ({lista}). Si reparas ahora, se cancelarán y tendrás que repetirlos. Tu letra y tu estilo están guardados.

     - singular y plural según `n`;
     - `{lista}` con «título — paso» separados por comas, como en el diálogo de cierre;
     - [Seguir trabajando] (con el foco; no cambia nada) y [Reparar ahora].
  4. "Reparar ahora" llama a `trabajos.cancelar(id)` en todos, espera a que terminen las promesas (con un tope de 5 s; si alguno no responde, se sigue igual) y navega a Primer arranque.
- [ ] **Primer arranque a mitad de sesión** (`ux/01` 12b):
  - muestra B5 con `pa.reparar.titulo`/`pa.reparar.cuerpo`, sin acceso a otras vistas hasta terminar;
  - al terminar, "Empezar" abre la Biblioteca con las canciones existentes, y el panel de actividad y la Biblioteca se actualizan sin reiniciar.
  Comprueba que la vista funciona montada a mitad de sesión (no solo al arrancar). Si hay que ajustar algo (p. ej. estado en caché del primer `runtime.estado()`), hazlo en la propia vista y anótalo.
- [ ] **Tests de componente** de `Progreso` con la API falsa:
  - banner dañado (foco y dos acciones);
  - banner `.reparado` (Reintentar llama a `separar`);
  - cambio en vivo de dañado a reparado;
  - Reparar sin trabajos navega;
  - con 2 trabajos abre el diálogo con «2 trabajos»;
  - "Seguir trabajando" no cancela nada;
  - "Reparar ahora" cancela los dos y navega.
- [ ] **E2E** (`e2e/separacion-motor-incompleto.spec.ts`; separador falso con un escenario de error `RUNTIME_NO_DISPONIBLE` y runtime falso; mismo arranque que `e2e/separacion-errores.spec.ts`):
  1. Separar una canción: el banner con [Reparar el motor de audio] y [Copiar detalles], y en la Biblioteca la tarjeta con «Hay que reparar el motor de audio» y [Ver] (sin [Reintentar]).
  2. [Reparar el motor de audio] → B5 «Hay que reparar el motor de audio».
  3. Con la app reiniciada sobre los mismos datos, arranca directamente en B5 (`config.instalacion.estado === 'dañada'`).
  4. Variante `.reparado`: escribe en `config.json` `instalacion.estado = 'completa'` antes de lanzar, con el paso en error `RUNTIME_NO_DISPONIBLE` → la vista de progreso muestra «El motor de audio ya está reparado.» con [Reintentar].
  No hace falta completar la reparación. El diálogo con trabajos se cubre con los tests de componente; en E2E solo si el separador falso permite tener otro trabajo vivo de forma estable.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check && npm test
npm run build && export SHINOBI_UV="$(which uv)" && npx playwright test e2e/separacion-motor-incompleto.spec.ts e2e/separacion-errores.spec.ts
```

## Notas de implementación
(las rellena el programador al terminar)
