# 0183 — Estado de la sesión en la principal, bloqueo de edición e indicador

- Estado: Pendiente
- Paso del pipeline: 4 y 6
- Depende de: [0177](0177-contratos-compartidos-de-sesion-cola-y-roles.md). Para integrarse en Electron necesita [0181](0181-servicio-de-sesion-e-ipc-en-main.md).
- ADRs: [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §9 y §11 (eventos), [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--fase-4)
- Spec UX: [Editor · Fase 4](../ux/06-editor.md#fase-4-de-020--ventana-secundaria-y-cola) (E1–E8), [Biblioteca · Fase 4](../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola) («Indicador de sesión», S14, y la regla «El reproductor local no se puede abrir»), [mapa de vistas](../ux/00-mapa-de-vistas.md), [Sistema visual · Fase 4](../ux/sistema-visual.md#020--ventana-secundaria-y-cola-fase-4) (indicador y candado)

## Objetivo

Crear la base de la sesión en el renderer principal: el estado compartido, los textos, el bloqueo de edición en todos los puntos de entrada y el indicador de la barra superior. Las vistas de la fase (0184–0189) consumen esta base.

## Contrato

- **`renderer/src/sesion/`**:
  - `useSesion()` y `ProveedorSesion` en `App.tsx`. Lee `sesion.estado()` al montar y se suscribe a `alCambiarSesion` (**descarta las revisiones menores o iguales a la vigente**), a `alPosicionSesion` y a `alCambiarPantallas`;
  - expone `estado`, `haySesion`, `edicionBloqueada`, `posicion`, `pantallas`, `panelAbierto` y `abrirPanel()` (en memoria durante la vida de la app) y acciones finas sobre `window.shinobi.sesion` y `cola`;
  - `textos.ts` con **todas** las claves `ses.*`, `cola.*`, `bib.cola.*`, `edi.bloqueo.*` y `paso.motivo.sesion` de las specs 02 y 06;
  - `DialogoBloqueo.tsx` (`edi.bloqueo`), con «Entendido» y «Cerrar el reproductor…», que llama a `solicitarCierre`. El foco vuelve al elemento de origen;
  - el hook `useAccionBloqueable()`, que pinta el candado y `aria-disabled`, añade `edi.bloqueo.aria` y abre el diálogo.
- **Puntos bloqueados** (tabla de la spec 06):
  - «Editar» y «Continuar» hacia Letra o Editor, y la portada de ese borrador, en la Biblioteca;
  - «Buscar la letra mientras tanto» y los pasos 3–4 del stepper en Progreso;
  - los pasos 3–4 en Añadir canción;
  - «Abrir editor» del toast;
  - el panel de actividad;
  - la escucha de Voz e Instrumental de Progreso (`edi.bloqueo.escucha`).
  
  La navegación a `cancion` con `paso` letra o editor también se rechaza en `navegacion/estado.ts`, como defensa.
- **Reproductor local**: `useReproductor().abrir` no abre la capa si hay sesión. Lo mismo para la acción [▶ Reproducir] del toast `bib.toast.lista`.
- **Indicador de sesión** en `Marco.tsx`, a la izquierda del indicador de actividad:
  - visible con sesión o con la cola no vacía;
  - textos `ses.ind.*`, con «Siguiente en {n} s» a partir de `restanteMs`, y «Requiere atención» con fallo o incidencia;
  - el clic lleva a la Biblioteca con la salida normal de la vista, abre el panel y pone el foco en su primer control. Si el panel no existe aún, pone el foco en el botón «Cola».

## Archivos

`app/src/renderer/src/sesion/**` (nuevo), `App.tsx`, `navegacion/{Marco.tsx,reproductor.tsx,estado.ts,useAvisosTrabajos.ts}`, `vistas/progreso/**` (escucha y stepper), `vistas/anadir/**` (stepper), el componente del stepper si es compartido y el panel de actividad. **No toca** `vistas/biblioteca/TarjetaCancion.tsx` ni los menús de tarjeta ([0187](0187-tarjetas-y-menus-de-la-biblioteca-durante-la-sesion.md)): exporta `useAccionBloqueable` para que 0187 lo use en «Editar» y «Continuar».

## Criterios de aceptación

- [ ] E1, E2 (con estados dobles por fase), E3, E4, E6 y E7 de la spec 06 en Vitest. E1 se cubre en Progreso, Añadir, el toast y el panel de actividad; la parte de la tarjeta la cubre 0187.
- [ ] Una revisión vieja que llega después de una nueva no cambia el estado.
- [ ] S14 de la spec 02: el indicador muestra el texto de cada fase y lleva a la Biblioteca desde Ajustes y desde Progreso.
- [ ] Con sesión, `useReproductor().abrir(id)` no monta la capa y el toast de lista no ofrece [▶ Reproducir].
- [ ] Al terminar la sesión, la misma acción abre el editor sin recargar (E3).

## Notas de implementación
