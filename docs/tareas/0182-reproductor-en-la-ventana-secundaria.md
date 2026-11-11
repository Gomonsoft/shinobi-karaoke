# 0182 — Reproductor en la ventana secundaria

- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: [0177](0177-contratos-compartidos-de-sesion-cola-y-roles.md), [0179](0179-roles-de-ventana-remitente-por-rol-y-documento-secundario.md) (entrada del documento). Para integrarse en Electron necesita [0181](0181-servicio-de-sesion-e-ipc-en-main.md); hasta entonces avanza con la `ApiReproductor` falsa de 0177.
- ADRs: [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §7, §8 y §10, [0011](../adr/0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md#revisión-para-020--fase-4) §3–§4
- Spec UX: [Reproductor · Fase 4](../ux/07-reproductor.md#fase-4-de-020--ventana-secundaria-y-cola) (S1–S4, diferencias con el reproductor local, atajos, cuenta, reanudación, cierre y accesibilidad, P1–P16), [Sistema visual · Fase 4](../ux/sistema-visual.md#020--ventana-secundaria-y-cola-fase-4) (contador, tarjeta y espera sin candidata)

## Objetivo

Sustituir el documento provisional de la secundaria por el reproductor de la sesión. Hay **un solo `MotorReproductor`** guiado por los comandos de main, y los estados S1–S4 y el diálogo de cierre se pintan en la propia secundaria. El reproductor local (Biblioteca y «Probar» del editor) no cambia.

## Contrato

- **`renderer/src/secundaria/AppSecundaria.tsx`**:
  - al cargar llama a `sesion.inicial()`;
  - con `alComando` traduce `cargar`, `pausar`, `reanudar` y `reiniciar` al motor, y descarta los comandos de otra sesión o entrada;
  - informa `lista`, `reproduciendo`, `pausada`, `posicion` (≤ 2 por segundo y en cada pausa o búsqueda), `fin` y `error`;
  - pinta S1, S2, S3 y S4 a partir de `EstadoSecundariaIpc`.
- **`Reproductor.tsx`** con `origen: 'sesion'`:
  - ocupa todo el documento, sin `inert` ni `aria-modal`, sin `CuentaFinal`, sin pantalla final, sin toasts y sin `rep.incompleta`;
  - franja superior con «Cerrar reproductor» y franja inferior con [⏭] y ⏮ = Reiniciar;
  - `cargar` con `pausada` y `anuncio: 'reanudacion'` empieza en el segundo, sin título ni silencio previo, y muestra el indicador `rep.cola.reanudada`.
- **Componentes nuevos** en `vistas/reproductor/sesion/`:
  - `CuentaTransicion`: número, disco y anillo a partir de `restanteMs` y `performance.now()` local, que se queda quieto si la cuenta está congelada. Con movimiento reducido no hay anillo ni escala;
  - `TarjetaSiguiente`, con el fondo del estilo de la candidata;
  - `PantallaEspera`, con candidata y sin ella;
  - `PantallaFinCola`, con «Otra vez» (`sesion.repetir`);
  - `PantallaFallo`, con «Pasar a la siguiente canción» (`sesion.siguiente`) o, sin pendientes, sin ese botón y con `rep.cola.fallo.fin`;
  - en S1 y S2, «Empezar ya» e «Iniciar» llaman a `sesion.empezar` y «Detener cuenta» a `sesion.detenerTransicion`.
- **Teclado** (spec 07):
  - Espacio o K: reproducir o pausar, «Empezar ya» en S1 e «Iniciar» en S2;
  - Mayús + N: siguiente;
  - Ctrl/Cmd + W: `sesion.solicitarCierre()`;
  - Esc: en pantalla completa pasa a ventana y en ventana no hace nada. **Nunca cierra**;
  - F: alterna la pantalla completa.
  
  Los atajos nuevos se añaden al diálogo de atajos, solo en la secundaria.
- **Diálogo de cierre en la secundaria**: cuando `cierrePendiente.origen === 'secundaria'`, se muestra `ses.cierre` (textos de la spec 02) con `confirmarCierre` o `cancelarCierre`, y `CONFIRMACION_OBSOLETA` → `ses.cierre.obsoleto`. Si el origen es la principal, no se muestra nada al público.
- **Volumen y voz guía**: `sesion.preferencias()` y `guardarPreferencias`, como mucho cada 500 ms. Se reutiliza la lógica de `useVolumenCompartido` sin `config.*`.
- **Anuncios** `aria-live` solo en los hitos de la spec: inicio, inicio de la cuenta, cambio de candidata, espera, fin y reanudación. Los fallos van con `role="alert"`.

## Archivos

`app/src/renderer/src/secundaria/**`, `app/src/renderer/src/vistas/reproductor/**` (incluidos `textos.ts`, que gana las claves `rep.cola.*`, `atajos.ts` y `modelo.ts`) y sus pruebas. Los textos `ses.cierre*` se importan de `renderer/src/sesion/textos.ts` ([0183](0183-estado-de-sesion-en-la-principal-bloqueo-de-edicion-e-indicador.md)). Si 0183 aún no está, se duplican de forma provisional y se anota.

## Criterios de aceptación

- [ ] P3, P4, P5 (la parte de pintura), P7 y P11, P12 y P15 de la spec 07, en Vitest con la API falsa y temporizadores simulados.
- [ ] Un comando `pausar` de otra entrada no pausa. Un `cargar` repetido con la misma entrada no reinicia el audio.
- [ ] Al llegar al final del buffer se informa `fin` una sola vez, aunque el motor emita varios estados con `finalizado: true`.
- [ ] Con `cierrePendiente` la cuenta pintada no cambia en 5 s simulados. Al quitarlo sigue desde el mismo número.
- [ ] En modo sesión no se crea ninguna `CuentaFinal`, ni la ventana se cierra sola al terminar la cola.
- [ ] El reproductor local (`Reproductor.test.tsx`, `Reproductor.estados.test.tsx` y `e2e/reproductor.spec.ts`) sigue en verde.

## Notas de implementación
