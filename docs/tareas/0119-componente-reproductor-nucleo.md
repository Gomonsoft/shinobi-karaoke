# 0119 — Componente `Reproductor`: capa, audio, letra, controles que se ocultan, teclado, indicador breve, voz guía, pantalla completa y pantalla encendida
- Estado: Hecha
- Paso del pipeline: 6
- Depende de: 0112, 0116, 0117, 0118
- ADRs: 0011 (§1–§4), 0010 (§1 teclado en fase de captura, §4 render), 0008
- Spec UX: docs/ux/07-reproductor.md (wireframes A, B y C; §"Entrada" (fila "En los dos casos"), §"Inicio y silencio previo", §"Letra", §"Controles", §"Ocultar controles", voz guía, §"Atajos de teclado", §"Indicador breve", §"Legibilidad a distancia", estados Cargando / Reproduciendo / En pausa / Modo ventana, §"Accesibilidad"; criterios 3, 5–19, 21, 26, 31–33); docs/ux/sistema-visual.md (§7 foco doble, §10)
- Preguntas: 0030 (usuario: voz guía), 0031 (respondida)
- Archivos: crea `app/src/renderer/src/vistas/reproductor/Reproductor.tsx`, `Controles.tsx`, `IndicadorBreve.tsx`, `reproductor.module.css`, `Reproductor.test.tsx`; una entrada en `app/src/renderer/src/vistas/Muestrario.tsx` (compartido, solo añadir) con la API falsa. **No** toca `App.tsx` ni el editor (los anfitriones son 0121 y 0122).
- Paralelizable con: 0113, 0114, 0115, 0124. Antes de 0120–0122.

## Contexto para quien implementa
- Piezas ya hechas:
  - `MotorReproductor` (0117);
  - `PantallaLetra` con `avisoTitulo`, `cargando` y tiempos negativos (0116);
  - modelo, atajos, textos, `VisibilidadControles`, `useVolumenCompartido` y `retenerToasts` (0118);
  - `window.shinobi.ventana.*` (0112; con API falsa en los tests);
  - componentes `BotonIcono` (tiene variante de 44 px "en el reproductor"), `Icono` (28 px), `Deslizador` (input range) y `Tooltip`; la clase `foco-doble`;
  - iconos de `lucide-react`.
- El editor captura el teclado así (`useAtajosEditor`): `window.addEventListener('keydown', …, true)` con `preventDefault()`. Ignora las teclas si existe un `[role="dialog"]` en el documento. Los atajos globales (`navegacion/useAtajosGlobales.ts`) se pausan si hay un `[aria-modal="true"]`. El reproductor es esa capa: los dos se apartan solos.
- `Dialogo.tsx` (0100) pone `inert` al resto del `body` mientras está abierto: reutiliza ese mecanismo (o su función) para la capa.
- `PantallaLetra` necesita `obtenerTiempoAudio()` = **tiempo de canción** (resta `offset_ms` ella misma) y `reproduciendo`. En pausa se pasa `reproduciendo = true` con el tiempo congelado del motor (letra congelada, criterio 11), nunca el modo estático del editor.

## Objetivo
El reproductor completo salvo la pantalla final, los errores, la lista incompleta, el diálogo de atajos y el desplazamiento (0120), listo para que lo monten la Biblioteca (0121) y el editor (0122).

## Criterios de aceptación
- [ ] **Props**:
  ```ts
  export interface CancionReproductor {
    id: string; titulo: string; artista: string; duracionMs: number; gananciaDb: number
    letra: Letra; estilo: Estilo; lineasSinSincronizar: number
  }
  export interface PropsReproductor {
    cancion: CancionReproductor
    origen: 'biblioteca' | 'editor'
    modo: 'karaoke' | 'original'          // original: vista previa del editor sin instrumental
    desdeMs: number                        // 0 desde la Biblioteca
    volumen: ReturnType<typeof useVolumenCompartido>
    alSalir(r: { posicionMs: number }): void
    alDesplazar?(deltaMs: 100 | -100): void   // solo desde el editor (0120 lo usa)
    alFallarPista?(e: { pista: 'principal' | 'voz'; tipo: ErrorPista }): void // 0120
    crearMotor?: (o: OpcionesMotorReproductor) => MotorReproductor          // tests
  }
  ```
- [ ] **Capa**:
  - `role="dialog"`, `aria-modal="true"`, nombre `rep.aria.region` (la spec pide `region`; un `dialog` modal con nombre cumple el mismo papel y pausa los atajos globales: anótalo en las notas);
  - `position: fixed; inset: 0`, por encima de todo salvo los diálogos propios;
  - pone `inert` al resto de la app y lo quita al desmontar;
  - el foco va a la superficie (`tabindex="-1"`) al montar.
- [ ] **Ciclo de vida**:
  - al montar: `retenerToasts(true)`, `ventana.modoReproductor(true)`, crear el motor con el volumen compartido, `cargar()` y `reproducir({ desdeMs: posicionInicial(origen, desdeMs, letra) })`;
  - al desmontar: `destruir()`, `evitarReposo(false)`, `modoReproductor(false)` y `retenerToasts(false)`;
  - la salida (Esc o ✕) llama a `alSalir({ posicionMs: max(0, motor.posicionMs()) })`; el anfitrión desmonta.
- [ ] **Pantalla encendida**: `ventana.evitarReposo(estado.sonando)` en cada cambio de `sonando`. Durante el silencio previo cuenta como sonando.
- [ ] **Cargando** (criterio 21): fondo y título desde el primer fotograma (< 200 ms, sin esperar al audio). Si `listo` tarda > 1 s, `PantallaLetra` recibe `cargando` con `rep.cargando`. Mientras carga, los controles de reproducción están inactivos y Esc funciona.
- [ ] **Letra**: `PantallaLetra` a pantalla completa con `obtenerTiempoAudio = () => motor.posicionMs()`, `reproduciendo = true` siempre que el motor esté `listo`, y `avisoTitulo` según 0120 (aquí `undefined`).
- [ ] **Franjas** (wireframe B):
  - **superior** (alto ≤ 12 %): [✕ Salir] a la izquierda y «título · artista» a la derecha en una línea con "…";
  - **inferior** (desde el 82 %): fila 1 con tiempo, barra (`Deslizador` en ms, `aria-valuetext` en palabras, arrastre → `buscar` al soltar) y duración; fila 2 con ⏮, ▶/❚❚, ↺5, 5↻, `rep.pausa` en pausa, y a la derecha el control de voz guía (salvo en modo `original`), silenciar + volumen de 120 px, ⌨ y ⛶;
  - degradados negros de la spec, botones de 44 px con iconos de 28 px en `#FFFFFF`, tooltips con nombre + atajo y `aria-keyshortcuts`;
  - orden de tabulación según §"Accesibilidad";
  - nada entre el 25 % y el 75 % del alto (test de CSS o geometría con `getBoundingClientRect` en jsdom con tamaños fijos; la captura real va en 0123).
- [ ] **Ocultar** (`VisibilidadControles`):
  - visible 3 s al entrar;
  - actividad = mover el ratón, clic en la superficie (que no pausa), Tab;
  - retenida en pausa, con el puntero sobre una franja, arrastrando o con un diálogo o tooltip abierto;
  - al ocultarse, el cursor se oculta (`cursor: none`) y, si el foco estaba en un control, vuelve a la superficie;
  - fundido de 200 ms, sin fundido con `prefers-reduced-motion`.
- [ ] **Teclado** en fase de captura con `accionDeTeclaReproductor`, `preventDefault()` en lo que trata, y sin actuar si hay un diálogo propio abierto (Esc lo cierra el diálogo):
  - alternar; saltar (acotado; +5 s en los últimos 5 s lleva al final);
  - volumen ±10 %; silenciar; voz;
  - principio (busca 0 y, sonando, vuelve a reproducir con el silencio previo; conserva el estado de pausa);
  - pantalla completa (`fijarPantallaCompleta(!actual)`); salir.
  Las acciones `desplazar` y `atajos` se entregan a 0120: aquí basta con un *callback* interno vacío.
- [ ] **Indicador breve**: cada atajo y cada clic en ⏮, ↺5, 5↻, voz o silenciar muestra `textoIndicador` 600 ms en una píldora centrada en horizontal con su centro al 12 % del alto. Uno nuevo sustituye al anterior. Los atajos **no** muestran las franjas (salvo la pausa, que las retiene).
- [ ] **Voz guía** (spec 07 §"Voz guía", criterios 19–19d):
  - botón 🎤 (`aria-pressed` cuando suena; icono `mic-off` y atenuado cuando está silenciada) + etiqueta "Voz" + deslizador de 96 px (`rep.aria.vozguia`) + porcentaje;
  - V y Mayús+↑/↓ (`alternarVoz`/`pasoVoz` de 0118);
  - cada cambio pasa por `motor.fijarVoz(…)` y `volumen.cambiar({ voz_guia, voz_guia_silenciada })` (se recuerda en `config.reproductor`) y muestra el indicador;
  - en modo `original` el control no aparece y V / Mayús+↑↓ no hacen nada;
  - si la voz falla (`errorVoz`), el control queda `aria-disabled` con el tooltip `rep.voz.nodisponible`, y V no hace nada.
- [ ] **Pantalla completa**: estado inicial con `estaEnPantallaCompleta()`, actualizado con `alCambiarPantallaCompleta`. El icono y el tooltip de ⛶ siguen `rep.tooltip.ventana` / `rep.tooltip.completa`. La raíz expone `data-pantalla-completa="true|false"` para los E2E.
- [ ] **Volumen**: el deslizador y ↑/↓ usan `pasoVolumen`; mover con el sonido silenciado lo activa. `motor.fijarVolumen` y `volumen.cambiar` en cada cambio.
- [ ] Tests de componente (Testing Library + API falsa + motor falso inyectado):
  - monta y llama a `modoReproductor(true)`; desmonta y llama a `false`;
  - silencio previo pedido con `desdeMs` negativo;
  - Espacio pausa y retiene las franjas;
  - Espacio con el foco en un botón activa solo el botón;
  - Esc llama a `alSalir` una vez;
  - Ctrl+N no hace nada;
  - las franjas se ocultan a los 3 s (temporizadores falsos) y el foco vuelve a la superficie;
  - indicador "Volumen 70 %" con ↓;
  - V cambia la voz;
  - `evitarReposo` sigue a `sonando`;
  - toasts retenidos mientras está montado.

## Verificación
```bash
cd app && npm run lint && npm run typecheck && npm run format:check && npm test
npm run dev    # Muestrario → Reproductor (API falsa), revisión visual
```

## Notas de implementación
- `Reproductor` mantiene la vista de origen montada y dibuja la capa modal con letra, audio, controles, voz guía, teclado, indicador y pantalla completa. Libera audio, pantalla encendida y toasts al desmontarse.
- `Controles` separa las franjas superior e inferior y mantiene la letra fuera de la zona central. La pausa mantiene la letra congelada con el reloj del motor.
- Los anuncios, estados finales, errores y desplazamiento se conectaron en la tarea 0120. La integración del editor se completa en 0122.
- Pasaron 40 pruebas dirigidas del modelo, atajos y reproductor; ESLint y Prettier dirigidos están en verde. Typecheck global pasó.
