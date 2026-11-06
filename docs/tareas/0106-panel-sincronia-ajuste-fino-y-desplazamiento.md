# 0106 — Editor: panel Sincronía (ajuste fino, campos de tiempo, fin automático, escucha de comprobación) y desplazamiento global
- Estado: Pendiente
- Paso del pipeline: 4
- Depende de: 0105 (y 0100 para el tooltip de 2 s)
- ADRs: 0010 (§1 "Tiempo de letra"), 0006 (`moverInicioLinea`), 0005 (`finEfectivo`)
- Spec UX: docs/ux/06-editor.md (wireframe C; "Fin automático", "Ajuste fino (panel C)", "Desplazamiento de toda la letra", nota Bluetooth; criterios 20–26)
- Archivos: `app/src/renderer/src/vistas/editor/PanelSincronia.tsx` (+ test), `CampoTiempo.tsx` (+ test), `escuchaComprobacion.ts` (+ test) y `editor.module.css`; en `Editor.tsx`, solo para pasar los *callbacks* de los atajos de ajuste. **No toca archivos compartidos.**
- Paralelizable con: 0108 (Estilo). **Antes de 0107** (ambas tocan `Editor.tsx` y el modo usa el panel inactivo).

## Contexto para quien implementa
- Acciones del *reducer* (0093): `ajustar_inicio`, `ajustar_fin`, `fijar_inicio`, `fijar_fin`, `fin_automatico`, `borrar_tiempos`, `desplazar` y `fijar_desplazamiento`.
- El *reducer* emite `aviso` de tipo `limite` (con `vecino` línea/pausa) o `consecuencias` (palabras descartadas y fines que pasan a automáticos).
- Tiempos: lo que se muestra es `tiempoMostrado(inicio, offset)`, y lo que se fija en la posición `t` del audio es `tiempoGuardado(t, offset)` (`shared/letras/tiempos.ts`). Posición actual: `motor.posicionMs()`.

## Criterios de aceptación
- [ ] **Panel C** con la línea seleccionada:
  - "Línea n de total" y el texto entre comillas (◆ "por palabra" si tiene palabras);
  - **Inicio**: campo `CampoTiempo` (`mm:ss.cc`, con el tiempo mostrado), [−0,1][−0,01][+0,01][+0,1] y "Fijar inicio aquí (I)";
  - **Fin**: campo, "(automático)" en `texto-2` o fijado en `texto-1` con "Usar fin automático", los ± y "Fijar fin aquí (O)";
  - "Escuchar desde esta línea (L)", "Borrar tiempos de esta línea (Supr)" y la casilla "Escuchar al ajustar" (activada por defecto; dura la visita);
  - línea sin inicio: ± de inicio inactivos y sección Fin inactiva con `edi.fin.sininicio`;
  - sin selección: `edi.sinseleccion`.
- [ ] **`CampoTiempo`**:
  - Intro o perder el foco aplica con `interpretarTiempo`, convirtiendo el tiempo mostrado a guardado (`ms − offset`);
  - un formato inválido muestra `edi.tiempo.formato` y no aplica; Esc restaura el valor.
- [ ] **Atajos** (por *callbacks* de `useAtajosEditor`):
  - Alt(+Mayús)+←/→ y Ctrl/Cmd(+Mayús)+←/→;
  - I, O, L;
  - Supr y Retroceso fuera del modo;
  - `,` y `.` (desplazamiento ±100 ms).
- [ ] **Límites**: con un `aviso` de tipo `limite`, tooltip de 2 s junto al campo afectado con `edi.limite.anterior`, `edi.limite.siguiente`, `edi.limite.fin.inicio` o `edi.limite.fin.siguiente` (con "pausa" en lugar de "línea" si `vecino` es pausa).
- [ ] **Consecuencias**: un `aviso` de tipo `consecuencias` muestra el toast `edi.toast.palabras` y/o `edi.toast.finauto` con el número de línea (`numeroDeLinea`) y [Deshacer], que despacha `deshacer`.
- [ ] **Escucha de comprobación** (`escuchaComprobacion.ts`, con temporizador inyectable):
  - solo en pausa, con la casilla activada;
  - tras un ajuste de inicio suena de −1 s a +2 s del tiempo mostrado nuevo, y tras uno de fin de −2 s a +1 s;
  - los ajustes seguidos con menos de 400 ms entre ellos reinician una sola escucha;
  - al terminar vuelve a la posición previa, en pausa (`motor.reproducir({ desdeMs, hastaMs })` + `buscar`).
- [ ] **L** y doble clic: desde 2 s antes del tiempo mostrado; si la línea no tiene inicio, desde el elemento anterior con tiempo, o desde 0.
- [ ] **Desplazamiento**:
  - −0,1 s / +0,1 s, un campo con signo y coma (`interpretarDesplazamiento`, valores fuera de ±30 s acotados con `edi.offset.rango`) y "Restablecer" (inactivo en 0);
  - ayuda `edi.offset.ayuda`;
  - se aplica al instante a la lista, los ticks y la vista previa.
- [ ] **Nota Bluetooth**: al salir del modo sincronizar por **primera vez en la sesión de la app**, nota `info` `edi.ayuda.bluetooth` bajo el desplazamiento, cerrable. Un indicador a nivel de módulo (como `navegacion/progresoVisto.ts`) evita que vuelva a salir en la sesión. 0107 llama a `mostrarAyudaBluetooth()`, que se exporta aquí.
- [ ] Todo inactivo durante el modo sincronizar (criterio 18).
- [ ] Tests:
  - ajustes con botones y atajos;
  - límite con una pausa (texto "pausa");
  - campo inválido;
  - toast de palabras descartadas con Deshacer;
  - escucha de comprobación (tramos y agrupación de 400 ms);
  - desplazamiento acotado;
  - `I` con desplazamiento +250 guarda `t − 250`.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/renderer/src/vistas/editor
```

## Notas de implementación
(las rellena el programador al terminar)
