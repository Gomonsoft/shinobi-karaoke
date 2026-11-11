# 0185 — Panel de la cola: sesión, controles, recuperación y cierre

- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: [0183](0183-estado-de-sesion-en-la-principal-bloqueo-de-edicion-e-indicador.md), [0184](0184-dialogo-abrir-el-reproductor-en-otra-pantalla.md) (el diálogo y la cabecera). Para integrarse en Electron necesita [0181](0181-servicio-de-sesion-e-ipc-en-main.md).
- ADRs: [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §3, §6–§8 y §11
- Spec UX: [Biblioteca · Fase 4](../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola) («Vista con el panel de cola», P1–P6, «Componentes e interacciones del panel» salvo la lista, «Cerrar el reproductor», «Recuperación», «Estados nuevos», accesibilidad, S3, S7–S9, S12, S15 y S17), [Sistema visual · Fase 4](../ux/sistema-visual.md#020--ventana-secundaria-y-cola-fase-4)

## Objetivo

Crear el panel «Cola de reproducción» de la Biblioteca. Esta tarea cubre la estructura, el bloque de la activa con sus controles, los estados P1–P6, los banners de recuperación y el diálogo de cierre en la principal. La lista «A continuación» la hace [0186](0186-panel-de-cola-lista-de-pendientes.md) en el hueco que deja esta tarea.

## Contrato

- **`vistas/biblioteca/cola/PanelCola.tsx`**:
  - panel `complementary` a la derecha de la rejilla, de 360 o 320 px, con scroll propio;
  - se abre o se oculta con el botón «Cola {n}» de la cabecera (`aria-expanded`). Se abre solo al empezar una sesión, al añadir la primera entrada a una cola vacía y al volver con una cola conservada;
  - estado de la pantalla con `cola.pantalla` y `cola.modo`, o `cola.pantalla.desconocida` en Wayland;
  - botón [⛶] (`sesion.fijarPantallaCompleta`) y un ⋯ con «Mostrar» y «Cambiar de pantalla…» (en Wayland, `ses.wayland` como texto);
  - [✕ Cerrar reproductor].
- **`BloqueActiva.tsx`** para P1–P4:
  - progreso de solo lectura con `sesion:posicion`;
  - [Pausa]/[Reanudar] y [Reiniciar] con `sesion.transporte` y la `entradaId` de la activa;
  - [Siguiente] con `sesion.siguiente({ desdeEntradaId })`, `aria-disabled` si no hay pendientes;
  - P2 con «Empieza en {n} s», [Empezar ya] (`sesion.empezar`) y [Detener cuenta] (`detenerTransicion`);
  - P3 con la causa (`cola.causa.*` según `MotivoFallo`), [Pasar a la siguiente canción] o, sin pendientes, [Descartar] (`cola.quitar` de la activa fallida), y [Copiar detalles] con el `codigo`;
  - P4 con [Iniciar «{título}»] (`sesion.empezar`), `cola.espera.vacia` y el fin de la cola con [↻ Otra vez] (`sesion.repetir`);
  - el ⋯ de la activa con «Agregar otra vez al final».
- **P5 y P6** (sin sesión):
  - «Reproductor cerrado», [Abrir en otra pantalla…] (con `inicio: 'reanudar'` o `'cola'`) y [Eliminar cola…] (`cola.vaciar({ contexto: true })`, diálogo `cola.dialogo.eliminar`);
  - el bloque «Última reproducida» con `cola.ultima.interrumpida` o `cola.ultima.terminada`.
- **Banners de recuperación** (`ses.rec.*`):
  - pantalla perdida, con [Mover a…];
  - pantalla de vuelta, con [Llevar el reproductor allí];
  - caída, con [Volver a abrir];
  - sin respuesta, con [Esperar] (vuelve a mostrarse si sigue sin responder 10 s más) y [Cerrar y volver a abrir] (`sesion.forzarCierre` y después el diálogo de pantallas).
  
  Si el panel está oculto, se abre sin mover el foco y se anuncia.
- **Cierre**:
  - `DialogoCierreSesion.tsx` (`ses.cierre`) cuando `cierrePendiente.origen === 'principal'`, con `CONFIRMACION_OBSOLETA` → `ses.cierre.obsoleto` y confirmar de nuevo;
  - con origen `secundaria`, `ses.cierre.esperando` y los controles de sesión inactivos;
  - después de cerrar se aplican los focos y anuncios de la spec (P5 conservada, `ses.toast.eliminada` y P6).
- **Foco**: nunca se queda en `body` cuando cambia el bloque de la activa o se cierra el panel. Un fallo solo mueve el foco si este estaba en el panel.

## Archivos

`app/src/renderer/src/vistas/biblioteca/cola/**` (salvo `ListaPendientes.tsx` y sus pruebas, que son de 0186) y la colocación del panel en `Biblioteca.tsx` y `biblioteca.module.css` (pocas líneas, coordinadas con 0184 y 0187).

## Criterios de aceptación

- [ ] S3, S7, S8, S9 (la parte del bloque), S12 (la parte de la principal), S15 y S17 de la spec 02, en Vitest con los estados dobles de 0177.
- [ ] Un doble clic en [Siguiente] envía la misma `desdeEntradaId`. La prueba comprueba los argumentos.
- [ ] Con `cierrePendiente.origen = 'secundaria'`, todos los botones de la sesión están inactivos y se ve `ses.cierre.esperando`.
- [ ] A 1024 × 576, con el panel abierto, la rejilla queda en 2 columnas y no hay scroll horizontal. Se comprueba en E2E o en la captura de 0190.
- [ ] El panel se puede usar entero con el teclado, y ninguna acción de la sesión tiene un atajo de una sola tecla.

## Notas de implementación
