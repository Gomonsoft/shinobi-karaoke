# 0120 — Reproductor: pantalla final, errores, lista incompleta, diálogo de atajos, desplazamiento y anuncios
- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: 0119
- ADRs: 0011 (§3 errores, §4, §5)
- Spec UX: docs/ux/07-reproductor.md (wireframes C, D y E; §"Pantalla final", §"Prueba desde el editor" (solo el desplazamiento), estados de error y lista incompleta, §"Accesibilidad", Microcopy; criterios 18, 20, 22–24, 29 (parte del reproductor), 32)
- Preguntas: 0031 §4 (respondida: tipos de error y "Copiar detalles")
- Archivos: `app/src/renderer/src/vistas/reproductor/Reproductor.tsx` (secciones nuevas), crea `PantallaFinal.tsx`, `PantallaError.tsx`, `DialogoAtajosReproductor.tsx` y sus tests. Sin archivos compartidos fuera de `vistas/reproductor/`.
- Paralelizable con: 0121 y 0122 (que solo montan el componente; los tres tocan carpetas distintas).

## Contexto para quien implementa
- 0119 deja preparados los puntos de enganche: `alDesplazar`, `alFallarPista` y las acciones `desplazar`/`atajos` del teclado. El motor (0117) da `finalizado`, `errorPrincipal` y `errorVoz` con `{ tipo, detalle, ruta }`.
- "Copiar detalles": `sistema.info()` da la versión y el SO. La escritura en el portapapeles se hace como en el resto de la app (busca el uso actual de "Copiar detalles", p. ej. en la vista de progreso o en el guardado del editor).
- `CuentaFinal` y `textoIncompleta` están en `modelo.ts` (0118).

## Objetivo
Cerrar todos los estados del reproductor y lo que solo aparece según el origen.

## Criterios de aceptación
- [ ] **Pantalla final** (wireframe D):
  - con `finalizado`: `evitarReposo(false)`, franjas ocultas y cursor visible;
  - título y artista sobre el fondo del estilo; [↻ Otra vez] y [✕ `rep.volver.biblioteca` | `rep.volver.editor`] con el foco;
  - cuenta atrás `rep.cierre` (10 → 1) que al terminar llama a `alSalir`;
  - cualquier actividad (ratón, tecla, Tab) la **detiene** y oculta el texto;
  - "Otra vez" y Espacio/K con el foco en la superficie: `buscar(0)` + `reproducir` con el silencio previo;
  - ←, J o la barra vuelven atrás, siguen sonando y cierran la pantalla final;
  - anuncio `rep.aria.fin`.
- [ ] **Error de la pista principal** (wireframe E, fondo `fondo-0`, `role="alert"`):
  - `no_encontrada` → `rep.error.titulo` + `rep.error.pistas` (en modo `original`, `rep.error.mezcla`);
  - `lectura` o `decodificacion` → `rep.error.audio`;
  - botones [`rep.copiar`] y [Volver a … según el origen] (primario, foco);
  - llama una vez a `alFallarPista({ pista: 'principal', tipo })` y a `evitarReposo(false)`;
  - Esc sale.
  "Copiar detalles" copia exactamente:
  ```
  Shinobi Karaoke {versión} · {so}
  Reproductor: {instrumental|original} ({ruta}) · {tipo} · {detalle}
  ```
- [ ] **Error solo de la voz**: sigue sonando el instrumental, el control de voz queda inactivo con `rep.voz.nodisponible` (0119) y se llama a `alFallarPista({ pista: 'voz', tipo })`. Sin pantalla de error.
- [ ] **Lista incompleta** (solo `origen === 'biblioteca'` y `lineasSinSincronizar > 0`):
  - `avisoTitulo = textoIncompleta(n)` en `PantallaLetra` (pantalla de título);
  - el mismo texto en `t-pequeno` con ⚠ bajo «título · artista» de la franja superior, cuando se ve;
  - anunciado una sola vez con `aria-live` al empezar, junto a `rep.aria.inicio`;
  - nada en la zona de la letra.
  Desde el editor no se muestra nunca.
- [ ] **Diálogo de atajos** (F1, `?` o ⌨): componente `Dialogo` del sistema con `rep.atajos.titulo` y la tabla de la spec. Sin las filas que no aplican: `,`/`.` fuera del editor, la voz sin voz disponible. Al abrir pausa la reproducción; al cerrar sigue en pausa y el foco vuelve a donde estaba.
- [ ] **Desplazamiento** (solo con `alDesplazar`):
  - `,`/`.` llaman a `alDesplazar(∓100)`;
  - el indicador dura **1 s** y muestra el valor **total** que llega por `cancion.letra.offset_ms` tras el cambio ("Desplazamiento: +0,25 s");
  - en ±30 000 ms no cambia y el indicador añade `edi.offset.rango` (importa el texto de `vistas/editor/textos.ts`);
  - la letra se ve desplazada al momento (la prop `letra` cambia y `PantallaLetra` usa el nuevo `offset_ms`).
- [ ] **Anuncios** `aria-live="polite"` solo en los hitos de §"Accesibilidad": inicio, pausa/reanudación, volumen, voz y fin. Nunca cada línea ni el tiempo.
- [ ] Tests de componente con el motor falso:
  - final con cuenta atrás (temporizadores falsos), detenida por actividad;
  - "Otra vez" pide el silencio previo;
  - error `no_encontrada`: texto, foco, `alFallarPista` y texto copiado;
  - `decodificacion` → `rep.error.audio`;
  - incompleta, singular y plural, ausente desde el editor;
  - el diálogo pausa;
  - `,` en el tope muestra el aviso de rango.

## Verificación
```bash
cd app && npm run lint && npm run typecheck && npm run format:check && npm test
```

## Notas de implementación
(las rellena el programador al terminar)
