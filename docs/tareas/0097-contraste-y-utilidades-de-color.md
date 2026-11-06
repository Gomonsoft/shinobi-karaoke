# 0097 — Karaoke (puro): contraste del estilo y utilidades de color
- Estado: Pendiente
- Paso del pipeline: 4
- Depende de: — (**puede empezar ya**)
- ADRs: 0010 (§4 "Contraste"), 0006 (formato del estilo)
- Spec UX: docs/ux/sistema-visual.md §8 (sugeridos) y §9 (reglas); docs/ux/06-editor.md ("Estilo", "Niveles del aviso de contraste", criterios 28, 30, 31)
- Archivos: crea `app/src/renderer/src/karaoke/contraste.ts`, `contraste.test.ts` y `colores.ts` (sugeridos y derivación de color). **No toca archivos compartidos.** No confundir con `componentes/contraste.test.ts`, que prueba los *tokens* de la interfaz.
- Paralelizable con: todas hasta 0108, que lo usa.

## Contexto para quien implementa
`Estilo` (`app/src/shared/estilo.ts`): `fondo` sólido `{ color }` o degradado `{ angulo_grados, paradas: [{ color, posicion }] }` (2–4 paradas, ordenadas), y `letra: { fuente, color, color_resaltado }`. Colores en `#RRGGBB`.

## Objetivo
Evaluar el contraste según sistema-visual §9 y ofrecer las acciones rápidas del panel Estilo, en funciones puras.

## Criterios de aceptación
- [ ] `colores.ts`:
  - `SUGERIDOS_FONDO` y `SUGERIDOS_LETRA`: los 8 + 8 de §8, en ese orden;
  - `variarLuminosidad30(hex)`, regla definitiva de `ux/06` "Variante de luminosidad" (`preguntas/0026` §2): el mismo color en HSL con el **mismo tono y saturación** y la luminosidad cambiada **+30 puntos si L ≤ 70** o **−30 puntos si L > 70**; se redondea a `#RRGGBB`. Se usa al pasar a degradado y en "+ Añadir color". Ejemplos (con tolerancia de ±1 por canal): `#1B1033` → `#5935A7`, `#000000` → `#4D4D4D` y `#FFFFFF` → `#B3B3B3`;
  - `repartirParadas(colores: string[])`: posiciones 0, 1/(n−1), …, 1;
  - `aSolido(fondo)` y `aDegradado(fondo)`, con las reglas de `ux/06` (a degradado: el color sólido + `variarLuminosidad30(color sólido)`, ángulo 135; a sólido: el primer color).
- [ ] `contraste.ts`:
  - `luminancia(hex)` y `ratio(a, b)` WCAG 2.x;
  - `muestrasFondo(fondo)`: 1 color si es sólido; 11 colores interpolados en sRGB (0 %, 10 %, …, 100 %) si es degradado, entre paradas por posición;
  - `peorRatio(color, fondo)`;
  - `deltaE76(a, b)` en CIELAB (D65);
  - `evaluarContraste(estilo)`, que devuelve:
    ```ts
    { avisos: Array<'letra' | 'resaltado' | 'diferencia'>, // en ese orden
      nivel: 'ok' | 'justo' | 'aviso',
      ratioLetra: number; ratioResaltado: number; deltaE: number,
      accionesLetra: Array<'blanca' | 'negra'>, sugerirFondo: boolean } // sugerirFondo → edi.contraste.fondo
    ```
    Reglas:
    - `aviso` si hay algún aviso;
    - `justo` si no hay avisos pero la letra o el resaltado quedan entre 3 y 4,5;
    - `ok` si no.
    `accionesLetra` (solo con el aviso `letra`):
    - la de mayor peor-ratio entre `#FFFFFF` y `#111111`, y la otra solo si supera 3:1;
    - si ninguna supera 3:1, ambas, con `sugerirFondo: true`;
  - `sugerirResaltado(estilo)`: entre `SUGERIDOS_LETRA` con ΔE ≥ 25 respecto a la letra, el de mayor peor-ratio con el fondo; si ninguno cumple ΔE ≥ 25, el de mayor peor-ratio.
- [ ] Tests con los ejemplos del criterio 30 de `ux/06`:
  - el estilo predeterminado → `ok`;
  - letra `#5A1E6E` sobre el predeterminado → aviso `letra` con `['blanca']` como primera acción;
  - resaltado `#F2F3F7` con letra `#FFFFFF` → aviso `diferencia`.
  Además:
  - un degradado negro→blanco con letra gris → ninguna de las dos supera 3:1 → `sugerirFondo`;
  - los valores de contraste del §8 (blanco sobre `#1B1033` 17,97 y sobre `#5A1E6E` 11,38, con ±0,02);
  - `variarLuminosidad30` con los tres ejemplos anteriores (±1 por canal), un color con L = 70 exacta (+30) y otro con L = 71 (−30);
  - `aDegradado({ tipo: 'solido', color: '#1B1033' })` → paradas `#1B1033` (posición 0) y `#5935A7` (±1 por canal, posición 1), ángulo 135.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/renderer/src/karaoke/contraste.test.ts
```

## Notas de implementación
(las rellena el programador al terminar)
