# 0103 — Cabecera del espacio de canción para el editor: indicador de guardado, insignia "Lista incompleta", ⟲ ⟳ y menú ⋯
- Estado: Hecha
- Paso del pipeline: 4 y 5
- Depende de: 0101 (mismo archivo), 0100 (tooltips; el menú ⋯ usa el `MenuContextual` existente)
- ADRs: —
- Spec UX: docs/ux/06-editor.md ("Cabecera", wireframe A, `edi.guardado`, `edi.lista.incompleta`, `edi.deshacer`/`edi.rehacer`, `edi.menu.*`; criterios 1, 24, 40); docs/ux/02-biblioteca.md (`bib.dialogo.borrador`)
- Archivos: `app/src/renderer/src/vistas/cancion/CabeceraCancion.tsx`, `cabecera.module.css` y `CabeceraCancion.test.tsx`. **Archivo compartido con 0101**: va después.
- Paralelizable con: 0102, 0104 y las de dominio.

## Contexto para quien implementa
`CabeceraCancion({ resumen, actual })` la usan Fuente, Progreso y Letra:
- "‹ Biblioteca" llama a `ir({ tipo: 'biblioteca' })`;
- la insignia de un borrador dice fijo "Borrador · guardado ✓";
- el stepper navega con `ir(...)`.

El editor necesita un indicador de guardado real, separado de la insignia; deshacer y rehacer; y un menú ⋯ con "Atajos de teclado (F1)" y "Volver a borrador…" en canciones Lista. El resto de vistas no debe cambiar de aspecto.

## Criterios de aceptación
- [x] Props nuevas, todas **opcionales**:
  ```ts
  guardado?: 'guardado' | 'guardando' | 'error'           // indicador role="status" separado de la insignia
  incompleta?: number                                      // nº de líneas sin inicio en una Lista → edi.lista.incompleta
  historial?: { puedeDeshacer: boolean; puedeRehacer: boolean; alDeshacer(): void; alRehacer(): void }
  menu?: ItemMenu[]                                        // ítems del ⋯ (los define la vista)
  ```
- [x] Sin las props nuevas, Fuente, Progreso y Letra se ven y se comportan igual: sus tests y los E2E existentes no cambian.
- [x] Con `guardado`:
  - la insignia de un borrador pasa a ser solo "✎ Borrador";
  - el indicador muestra "✓ Guardado" (`texto-2`), "Guardando…" (`texto-2` con spinner de 14 px) o "⚠ No se pudo guardar" (`error`).
- [x] Con `incompleta > 0` en una Lista: insignia "✓ Lista · ⚠ Faltan {n} líneas" (con n = 1, "Falta 1 línea"), con la parte de aviso en `aviso`.
- [x] ⟲ y ⟳: `BotonIcono` con `aria-label` y tooltip `edi.deshacer`/`edi.rehacer` ("Deshacer (Ctrl+Z)" o "(⌘Z)" según `navigator.platform`), y `disabled` si no se puede.
- [x] ⋯: `MenuContextual` con los ítems recibidos.
- [x] Tests: cada estado del indicador, la insignia incompleta en singular y plural, deshacer/rehacer desactivados y el menú.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/renderer/src/vistas/cancion
```

## Notas de implementación

- La cabecera del editor añade indicador de guardado, aviso de Lista incompleta, historial y menú mediante props opcionales. Pasaron los tests de la cabecera y la verificación completa del bloque 2.
