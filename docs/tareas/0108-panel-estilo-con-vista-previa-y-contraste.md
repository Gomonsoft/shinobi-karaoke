# 0108 — Editor: panel Estilo (fondo, colores, fuente) con aviso de contraste y estilo predeterminado
- Estado: En curso (empezada por Codex; ver commit WIP)
- Paso del pipeline: 4
- Depende de: 0097, 0099, 0105
- ADRs: 0006 (formato del estilo; paradas ordenadas desde 0090), 0010 (§2 `guardarEstilo`, §4 contraste)
- Spec UX: docs/ux/06-editor.md (wireframe D; "Estilo (panel D)", "Niveles del aviso de contraste"; criterios 28–32); docs/ux/sistema-visual.md §8–§9
- Archivos: `app/src/renderer/src/vistas/editor/PanelEstilo.tsx` (+ test) y `editor.module.css`; en `Editor.tsx`, solo el punto `aviso` de la pestaña "Estilo". **No toca archivos compartidos.**
- Paralelizable con: 0106, 0107 y 0109.

## Contexto para quien implementa
- Componentes (0099): `SelectorColor`, `SelectorFuente`, `DialAngulo` y `ControlSegmentado`.
- Utilidades (0097): `SUGERIDOS_FONDO`, `SUGERIDOS_LETRA`, `aSolido`, `aDegradado`, `variarLuminosidad30`, `repartirParadas`, `evaluarContraste` y `sugerirResaltado`.
- Cada cambio se despacha como `{ tipo: 'estilo', estilo, clave, ahora: Date.now() }` al *reducer* (0093), que agrupa los cambios del mismo campo en menos de 1 s, y se guarda con `useGuardadoEditor` (0104).
- Configuración: `config.obtener().estilo_predeterminado` y `config.actualizar({ estilo_predeterminado })` (ya existen).

## Criterios de aceptación
- [ ] **Fondo**:
  - Sólido/Degradado con `aDegradado`/`aSolido` (un paso de deshacer);
  - ángulo con `DialAngulo`;
  - de 2 a 4 colores **ordenados y repartidos** (`repartirParadas`); "+ Añadir color" añade al final `variarLuminosidad30(último)`, y ✕ (solo con más de 2) quita una parada y reparte las demás;
  - sugeridos de fondo;
  - en sólido, un solo `SelectorColor`.
- [ ] **Letra**: `SelectorFuente` con las 8 familias, "Color de la letra" y "Color de lo ya cantado" con los sugeridos de letra.
- [ ] **Contraste**:
  - `evaluarContraste` en cada cambio y al entrar;
  - avisos en el orden de la tabla, con sus textos y acciones rápidas ("Usar letra blanca"/"negra" según `accionesLetra`, `edi.contraste.fondo` si `sugerirFondo`, "Sugerir un color de resaltado"), cada acción como un paso de deshacer;
  - `role="status"` anunciado solo al cambiar de nivel;
  - punto `aviso` en la pestaña "Estilo" mientras haya algún ⚠;
  - nunca bloquea nada.
- [ ] **Restablecer estilo predeterminado**: aplica `config.estilo_predeterminado` (deshacible). **Usar este estilo en canciones nuevas**: `config.actualizar` + toast `edi.estilo.predet.toast`; inactivo si el estilo es igual al predeterminado (comparación profunda). No entra en el historial.
- [ ] Cada cambio se ve en la vista previa en < 100 ms (lo garantiza `PantallaLetra`; aquí basta con no hacer trabajo pesado en el render).
- [ ] Todo el panel queda inactivo durante el modo sincronizar.
- [ ] Tests:
  - los tres ejemplos del criterio 30 en el panel;
  - añadir y quitar colores mantiene posiciones 0, ½, 1…;
  - hex inválido no aplica;
  - arrastre de color = 1 paso de deshacer;
  - "Usar este estilo…" inactivo con el predeterminado;
  - punto de aviso en la pestaña.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/renderer/src/vistas/editor
```

## Notas de implementación
(las rellena el programador al terminar)
