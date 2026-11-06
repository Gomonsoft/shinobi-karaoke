# 0105 — Vista Editor: estructura, carga, lista de líneas, transporte, vista previa y atajos base
- Estado: Hecha
- Paso del pipeline: 4
- Depende de: 0090, 0093, 0094, 0098, 0099 (Deslizador), 0103, 0104
- ADRs: 0010 (todo), 0005, 0006
- Spec UX: docs/ux/06-editor.md (wireframes A y B; "Entrada y foco inicial", "Lista de líneas", "Transporte y audio", "Vista previa", "Atajos de teclado", "Estados", "Accesibilidad"; criterios 1–10, 33, 41, 43–45)
- Pregunta: `preguntas/0025` §1 ("Probar a pantalla completa" queda para la Fase 6: **no se muestra** ni responde la tecla F), §6 y §8
- Archivos:
  - crea `app/src/renderer/src/vistas/editor/Editor.tsx`, `editor.module.css`, `ListaLineas.tsx`, `Transporte.tsx`, `textos.ts` (todas las claves `edi.*` de la spec, aunque las usen tareas posteriores), `atajos.ts` (mapeo puro tecla → acción), `useAtajosEditor.ts`, `DialogoAtajos.tsx` y sus tests, y deja los componentes vacíos `PanelSincronia.tsx`, `PanelEstilo.tsx` y `BannerSincronizar.tsx`, que rellenan 0106–0108;
  - **compartido**: `app/src/renderer/src/App.tsx`, para pintar `<Editor key={id} id={id} />` en `{ tipo: 'cancion', paso: 'editor' }` en lugar del `Marcador`.
- Paralelizable con: 0102, 0109 (en parte). **0106, 0107 y 0108 van después** y tocan `Editor.tsx` solo para pasar *callbacks*.

## Contexto para quien implementa
Piezas que ya existen al empezar:
- `estado.ts` (*reducer*, 0093);
- `useMotorAudio` y `MotorAudio` (0094), con `posicionMs()`, `tiempoDeEvento()`, `usarPista()`, `fijarVelocidad()` y `reproducir({ desdeMs, hastaMs })`;
- `PantallaLetra` (0098);
- `useGuardadoEditor` (0104);
- `CabeceraCancion` con `guardado`, `incompleta`, `historial` y `menu` (0103);
- `tiempos.ts` (0092): `tiempoMostrado`, `indiceLineaActual`, `contador`, `formatearTiempo`, etc.

Datos:
- `window.shinobi.biblioteca.obtener(id)` devuelve la `Cancion` completa; `biblioteca.listar()` el resumen;
- `alCambiarCancion` trae resúmenes nuevos (pasos, estado). **Mientras el editor está abierto, la letra y el estilo locales son la verdad**: los eventos solo actualizan el resumen (separación, estado, `incompleta`), nunca la letra ni el estilo locales;
- los trabajos vivos llegan con `useTrabajosVivos()` (`trabajos/useTrabajos.ts`), para el % de la separación.

Audio: `urlPista`. Voz e Instrumental existen si `resumen.pasos.separacion.estado === 'completado'` y la canción no está dañada.

## Criterios de aceptación
- [x] **Carga**:
  - lee la canción y el resumen; `config.obtener()` da el volumen;
  - sin letra (0 líneas) → `edi.sinletra` con [Buscar la letra], que navega a Letra;
  - si la carga falla → `edi.error.audio`;
  - `cargar` en el *reducer*, con selección = primera sin inicio (o la primera línea) y la lista desplazada hasta ella;
  - audio en 0 y en pausa; pista Voz si existe y Original si no (criterio 4);
  - foco inicial: el botón "Sincronizar al ritmo" si no hay ninguna línea con inicio (más el banner `edi.banner.sinsync`); si no, la fila seleccionada de la lista.
- [x] **Disposición**:
  - wireframe A (≥ 1280 px): columnas de 320 px, flexible y 320 px; transporte fijo al pie;
  - wireframe B (< 1280 px): columna izquierda de 360 px con pestañas Sincronía/Estilo y la vista previa a la derecha;
  - nada cortado a 1024 × 640 con zoom de hasta el 150 % (criterio 1);
  - *landmarks* y enlace "Saltar al contenido" (a la lista).
- [x] **Lista de líneas** (`ListaLineas.tsx`):
  - `role="listbox"` con *roving tabindex*;
  - filas con el tiempo mostrado (`formatearTiempo(tiempoMostrado(...))`) o `--:--.--` con el icono "falta" (`CircleDashed` de lucide), ◆ con su tooltip si hay palabras, texto en 2 renglones como máximo;
  - pausas como `role="separator"` "♪ pausa", con su tiempo en `texto-3` y tooltip si lo traen;
  - fila actual con ▶ y `aria-current`; seleccionada con borde de 3 px `acento-texto`;
  - nombre accesible `edi.aria.linea`;
  - clic selecciona; doble clic escucha desde 2 s antes;
  - el contador `edi.contador` es un botón si falta alguna línea y selecciona la primera sin inicio;
  - seguimiento de la línea actual salvo desplazamiento manual en los últimos 5 s;
  - **virtualizada** a partir de 200 filas (sin dependencias: ventana de filas con alto fijo de fila de 2 renglones), para cumplir el criterio 45 con 1000 líneas;
  - pie "Corregir la letra", que navega a Letra (la guarda de 0104 vacía antes el guardado).
- [x] **Transporte** (`Transporte.tsx`):
  - ⏮, ▶/❚❚ y el tiempo "01:12.4 / 05:55";
  - barra de tiempo (`Deslizador`, `role="slider"`, ←/→ ±5 s, `aria-valuetext` "1 minuto 12 segundos de 5 minutos 55") con **ticks** en el tiempo mostrado de cada línea con inicio (criterio 10);
  - "Escuchar" con `ControlSegmentado` (Original/Voz/Instrumental):
    - Voz e Instrumental no disponibles mientras no haya separación, con tooltip `edi.no.disponible.pista` (con el % del trabajo vivo), `.cola` o `.separar` según el caso;
    - spinner en la opción de una pista que se está cargando (`cargandoPista`);
    - si la separación termina con el editor abierto, se activan en vivo sin cambiar lo que suena;
  - velocidad 0,5×/0,75×/1× con el tooltip `edi.velocidad.tooltip`, variante "A menor velocidad, el tono también baja…";
  - volumen con silenciar, que lee y **guarda** `config.reproductor.volumen` y `silenciado` (`config.actualizar`, como mucho una escritura cada 500 ms);
  - "Cargando audio…" y barra indeterminada pasados 3 s;
  - la tercera fila lleva "Sincronizar al ritmo (S)" (0107 lo conecta) y el primario "Marcar como lista"/"Hecho" (0109 lo conecta).
- [x] **Vista previa**: `PantallaLetra` en 16:9, `reproduciendo = estado.sonando`, `obtenerTiempoAudio = () => motor.posicionMs()`, `idEstatico = seleccion`, región `edi.previa` con `aria-label` `edi.previa.aria`. **Sin** botón "Probar a pantalla completa" (Fase 6).
- [x] **Atajos** (`atajos.ts`, puro y probado): `accionDeTecla(evento, { enCampoTexto, sync, focoEn: 'lista' | 'barra' | 'volumen' | 'dial' | 'segmentado' | 'otro' }) → AccionAtajo | null` con la tabla completa de `ux/06` "Atajos de teclado":
  - Espacio, Inicio, S, Intro, Retroceso, Supr, Esc, ↑/↓;
  - Alt(+Mayús)+←/→ (inicio) y **Ctrl/Cmd**(+Mayús)+←/→ (fin);
  - I, O, L, `,`/`.` (desplazamiento), 1/2/3;
  - Ctrl/Cmd+Z, Ctrl/Cmd+Mayús+Z, Ctrl+Y (no en macOS), F1 y `?`.
  Reglas:
  - una tecla sola no actúa en campos de texto, y Ctrl/Cmd+Z en un campo deshace el campo;
  - las flechas sin modificador las usa el control enfocado;
  - Retroceso dentro del modo = `deshacer_marca` y fuera = borrar tiempos;
  - **F no hace nada** en la Fase 5.
  `useAtajosEditor` escucha en `window` **en fase de captura** (`addEventListener('keydown', h, true)`) y llama a `preventDefault()` en las teclas que trata, para que Alt+← no navegue y el Esc global no salte. Esc fuera del modo y sin capas abiertas navega a la Biblioteca (pasando por la guarda).
  En esta tarea se conectan: Espacio, Inicio, ↑/↓, 1/2/3, deshacer/rehacer, F1/? y Esc; el resto llega con 0106–0108 como *callbacks*.
- [x] **Diálogo de atajos** (`DialogoAtajos.tsx`): la tabla de la spec, con F1/? y desde el ⋯ de la cabecera ("Atajos de teclado (F1)").
- [x] **Cabecera**: `CabeceraCancion` con `actual="editor"`, `guardado` (de `useGuardadoEditor`), `incompleta` (de `resumen.lineasSinSincronizar` si es Lista), `historial` (*reducer*) y `menu`. Cada cambio de `version` del *reducer* llama a `cambiarLetra` y/o `cambiarEstilo`.
- [x] **`LETRA_DESACTUALIZADA`** (`ux/06` estado "Letra cambiada fuera del editor", criterio 46; `preguntas/0026` §1). Cuando `useGuardadoEditor` llama a `alDesactualizada()`:
  - se relee la canción con `biblioteca.obtener(id)` y se despacha `cargar`, con lo que deshacer y rehacer quedan vacíos y ⟲ ⟳ `disabled`;
  - si estaba en el modo sincronizar, sale de él (`salir_sync` o `cargar` con `sync.activo = false`);
  - el audio queda **en pausa en la misma posición**, con la misma pista y velocidad;
  - la selección se conserva si esa línea sigue existiendo; si no, pasa a la primera sin inicio (o a la primera línea);
  - toast de tipo **`aviso`**, **persistente** (sin cierre automático), con `edi.toast.recargada`: "La letra ha cambiado fuera del editor y la hemos vuelto a cargar. Puede que tus últimos ajustes de tiempos no se hayan guardado: revísalos.";
  - el indicador de guardado queda en "✓ Guardado": no es un fallo, así que no hay reintento, ni "⚠ No se pudo guardar", ni toast de error. El estilo pendiente se sigue guardando aparte.
  Test con `apiEditorFalsa` configurada para responder `LETRA_DESACTUALIZADA`: comprobar cada punto anterior. Si `gestorToasts` no admite toasts persistentes, se añade la opción `persistente: true` en `componentes/gestorToasts.ts` y `Toasts.tsx`, con su test.
- [x] La separación que termina con el editor abierto saca el toast de spec 04: compruébalo con `useAvisosTrabajos` y ajústalo solo si en la vista editor se suprime.
- [x] Pausa automática cuando la ventana pierde el foco (`window` `blur`) **solo durante el modo sincronizar** (0107 lo usa; aquí se expone `pausarAlPerderFoco`).
- [x] Tests (jsdom, con `apiEditorFalsa` de 0090 y un `MotorAudio` falso):
  - carga, foco inicial y selección inicial;
  - Voz no disponible con el % en el tooltip y activada al llegar el evento;
  - el contador lleva a la primera sin inicio;
  - atajos (tabla de `atajos.ts` completa) y Esc no navega con un diálogo abierto;
  - el tiempo mostrado cambia con `offset_ms`;
  - virtualización: con 1000 líneas se pintan menos de 100 filas;
  - `App` pinta `Editor` en el paso `editor`.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/renderer/src/vistas/editor src/renderer/src/App.test.tsx
npm run semilla && npm run dev   # «Editor: pista de clics» → Continuar
```

## Notas de implementación

- Editor real conectado a la navegación, con apertura de visita, audio, lista virtualizada, transporte, selección, vista previa y atajos base. La separación se actualiza a partir de eventos, sin sobrescribir la edición local. La recarga usa una nueva visita (0027) y conserva estilo, posición y selección cuando es posible.
- Pasaron lint, tipos, formato, Vitest (1650 pasadas, 12 omitidas), build y Playwright (69 pasadas, 2 omitidas). Las interacciones de ajuste, modo, estilo y estado se conectan en 0106–0109. La prueba de recarga con una edición real se completa al conectar 0106.
