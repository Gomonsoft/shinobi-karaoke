# 0141 — B6b: "menú Apple" sin carácter de uso privado
- Estado: Pendiente
- Paso del pipeline: 0 (primer arranque)
- Depende de: —
- ADRs: —
- Spec UX: docs/ux/01-primer-arranque.md (`pa.macos.pasos`, wireframe B6b)
- ¿Red?: no.

## Contexto
Comprobado byte a byte el 2026-11-06:
- `app/src/renderer/src/vistas/primer-arranque/textos.ts:118` (`macosPasos`): `menú Apple (U+F8FF)`, un carácter de **uso privado** que solo se dibuja como la manzana con fuentes de Apple;
- `docs/ux/01-primer-arranque.md` (wireframe B6b y `pa.macos.pasos`): `menú Apple ()`, paréntesis **realmente vacío**. Código y spec no coinciden;
- `docs/ux/09` §Accesibilidad ya prohíbe el símbolo y escribe "menú Apple (la manzana de la esquina de la pantalla)".

B6b solo se ve en macOS, así que el defecto visible es limitado: la fuente del sistema dibuja la manzana. Queda el carácter que un lector de pantalla puede leer mal o no leer, y la copia a otros sistemas con "Copiar detalles" si incluye el texto.

## Objetivo
Aplicar el texto que decida el diseñador en código y tests. El texto no lo elige esta tarea.

## Archivos
`textos.ts` y su test o el de `PantallasInicio`; `e2e/primer-arranque.spec.ts` si cita el texto.

## Criterios de aceptación
- [ ] `macosPasos` idéntico a `pa.macos.pasos` de la spec actualizada.
- [ ] Test: ningún texto de `primer-arranque/textos.ts` contiene caracteres de uso privado (U+E000–U+F8FF).
- [ ] Búsqueda de U+F8FF en `app/src` y en la documentación: sin resultados, salvo que se justifique.

## Verificación
```bash
cd app && npx vitest run primer-arranque && npm run lint
grep -rnP "\xEF\xA3\xBF" src
```

## Notas de implementación
(las rellena el programador al terminar)
