# 0118 — Reproductor: modelo puro, atajos y textos; volumen compartido; toasts retenidos
- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: 0112 (campos de voz en `config.reproductor`; para el hook)
- ADRs: 0011 (§3 "Configuración", §4 "Volumen" y "Toasts retenidos")
- Spec UX: docs/ux/07-reproductor.md (§"Atajos de teclado", §"Indicador breve", §"Ocultar controles", §"Pantalla final", §"Inicio y silencio previo", Microcopy; criterios 6, 7, 13, 14, 16, 18, 20, 25)
- Preguntas: 0030 (usuario: voz guía; el control y la tecla los fija la revisión de `ux/07`)
- Archivos:
  - crea `app/src/renderer/src/vistas/reproductor/modelo.ts`, `atajos.ts`, `textos.ts` y sus tests;
  - crea `app/src/renderer/src/karaoke/useVolumenCompartido.ts` (+ test);
  - **compartidos**: `app/src/renderer/src/vistas/editor/Editor.tsx` (sustituir `useVolumenEditor` por el hook nuevo, sin cambio de comportamiento), `app/src/renderer/src/componentes/gestorToasts.ts` (+ `Toasts.test.tsx`).
- Paralelizable con: 0113–0117. Antes de 0119. Si 0122 ya hubiera empezado, este cambio en `Editor.tsx` va antes.

## Contexto para quien implementa
- La spec 07 trae las tablas de atajos, los textos `rep.*` y las reglas de las franjas, el indicador y la pantalla final. **Copia los textos tal cual** de la sección Microcopy de `ux/07` (revisión vigente al empezar). La voz guía sustituye a "voz original" (pregunta 0030). La spec ya trae la voz guía (§"Voz guía", criterios 19–19d):
  - **V** silencia o reactiva la voz;
  - **Mayús + ↑/↓** cambia su nivel ±10 % y la reactiva;
  - reactivarla con el nivel en 0 % lo sube a 30 %;
  - indicadores `rep.ind.voz` / `rep.ind.vozsilenciada`.
- `useVolumenEditor` (en `Editor.tsx`) mantiene `config.reproductor` en estado local y escribe con `config.actualizar({ reproductor })` como mucho cada 500 ms, con vaciado al desmontar.
- `gestorToasts.ts` es un almacén externo con `mostrarToast` (máximo 3 a la vez) y `useSyncExternalStore`.

## Objetivo
Toda la lógica del reproductor que no necesita DOM ni audio, probada aparte, más dos utilidades que comparten el editor y la app.

## Criterios de aceptación
- [ ] **`atajos.ts`**:
  ```ts
  export type AccionReproductor =
    | { tipo: 'alternar' } | { tipo: 'saltar'; deltaMs: -10000 | -5000 | 5000 | 10000 }
    | { tipo: 'volumen'; delta: 0.1 | -0.1 } | { tipo: 'silenciar' }
    | { tipo: 'voz' } | { tipo: 'nivel_voz'; delta: 0.1 | -0.1 }
    | { tipo: 'principio' } | { tipo: 'pantalla_completa' } | { tipo: 'salir' }
    | { tipo: 'desplazar'; deltaMs: 100 | -100 } | { tipo: 'atajos' }
  export function accionDeTeclaReproductor(e: Pick<KeyboardEvent,'key'|'ctrlKey'|'metaKey'|'altKey'|'shiftKey'|'isComposing'>,
    o: { origen: 'biblioteca' | 'editor'; vozDisponible: boolean; focoEnBoton: boolean }): AccionReproductor | null
  ```
  - Espacio/K, ←/→, J/L, ↑/↓, Mayús+↑/↓ (nivel de voz, solo con voz), M, V (solo con voz), Inicio/0, F, Esc, `,`/`.` (solo desde el editor), F1/`?`.
  - Con `focoEnBoton`, Espacio e Intro devuelven `null` (los activa el botón).
  - Con Ctrl, Cmd o Alt devuelven `null`. Mayús solo cuenta en `?` y en Mayús+↑/↓.
  - Test tabla a tabla.
- [ ] **`modelo.ts`** (funciones puras y clases con temporizadores inyectables):
  - `silencioPrevioMs(letra): number`:
    - `t1` = `inicio_ms + offset_ms` de la primera línea con inicio;
    - devuelve `max(0, 6000 − t1)`, y 0 sin líneas con inicio;
    - test con `t1` = 500, 3000, 5900, 6000 y 20000, y con `offset_ms` ≠ 0.
  - `posicionInicial(origen, desdeMs, letra)`: devuelve `−silencioPrevioMs` si `desdeMs === 0`; si no, `desdeMs`. Desde el editor, el silencio previo solo se aplica si el inicio calculado es 0.
  - `textoIndicador(accion, ctx)`: textos `rep.ind.*`, `rep.offset` (signo siempre, coma decimal y dos decimales: "+0,25 s", "+0,00 s"), volumen "Volumen 60 %" / "Silenciado" y voz.
  - `formatearReloj(ms)`: "mm:ss", "h:mm:ss" desde 1 h, y 00:00 con valores negativos. `tiempoEnPalabras(ms, total)` para `aria-valuetext`, igual que en el editor (reutiliza `tiempoHablado` de `Transporte.tsx` moviéndolo aquí o a `shared` si hace falta).
  - `pasoVolumen(actual, delta)`: acota a [0, 1] y redondea a 0,01. Mover el volumen con el sonido silenciado lo activa (`{ volumen, silenciado: false }`).
  - `alternarVoz({ voz_guia, voz_guia_silenciada })`: alterna el silencio y, al reactivar con 0, pone 0,3. `pasoVoz(estado, delta)`: cambia el nivel y reactiva. Tests de los criterios 19b y 19c.
  - `textoIncompleta(n)`: singular y plural.
  - `class VisibilidadControles({ ocultarTrasMs = 3000, temporizador })`:
    - `actividad()`, `fijarRetenida(motivo, activa)` (pausa, puntero sobre una franja, diálogo, arrastre, final, error);
    - `visible(): boolean` y `suscribir(cb)`.
    - Visible al crearse (los controles se ven 3 s al entrar). Se oculta tras 3 s sin actividad si no hay retenciones.
  - `class CuentaFinal({ segundos = 10, temporizador })`: `iniciar()`, `detener()` (cualquier actividad), `suscribir(cb: (n: number | null) => void)` y `alTerminar(cb)`.
- [ ] **`textos.ts`**: constante `R` con todas las claves `rep.*` de la spec y funciones para las que llevan parámetros.
- [ ] **`useVolumenCompartido(inicial: Config['reproductor'])`**: devuelve `{ volumen, silenciado, volumenVoz, vozSilenciada, cambiar(parcial) }`. Escribe todo `reproductor` con `config.actualizar` como mucho cada 500 ms y vacía al desmontar. Mismos tests que tenía el editor, más los campos de voz. `Editor.tsx` lo usa en lugar de `useVolumenEditor`, sin cambio visible (los tests del editor siguen pasando).
- [ ] **Toasts retenidos** (`gestorToasts.ts`):
  - `retenerToasts(activo: boolean)`;
  - mientras está activo, `mostrarToast` guarda el toast en una cola de retenidos y no lo muestra;
  - al desactivarlo, muestra los **3 más recientes** de la cola (en orden) y descarta el resto;
  - `cerrarTodosLosToasts` también vacía la cola;
  - tests.

## Verificación
```bash
cd app && npm run lint && npm run typecheck && npm run format:check && npm test
```

## Notas de implementación
(las rellena el programador al terminar)
