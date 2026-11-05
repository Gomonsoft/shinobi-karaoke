# 0038 — Bloque "Acerca de" y diálogos de licencias (reutilizables por Ajustes)
- Estado: Hecha
- Paso del pipeline: —
- Depende de: 0011, 0016
- ADRs: 0002, 0008 (texto sin HTML en bruto)
- Spec UX: docs/ux/08-ajustes-y-acerca.md (sección Acerca de y criterios 6–7); docs/ux/01-primer-arranque.md ("Licencias (B1)")

## Objetivo
El enlace "Licencias" de B1 debe abrir "Ajustes → Acerca de" en un diálogo (`ux/01`). Se construye ya el bloque Acerca de como componente para que la vista Ajustes de la Fase 3 lo reutilice tal cual.

## Criterios de aceptación
- [x] Componente `AcercaDe` con el contenido de la sección "Acerca de" de `ux/08`: versión (`sistema.info`), "Ver licencia", "Créditos y licencias de terceros", "Web del proyecto" (enlace permitido, ADR 0008), "Aviso sobre YouTube" (texto literal de `ux/03` wireframe B + fecha de aceptación o "No aceptado todavía"), "Abrir carpeta de datos", "Copiar información para soporte" (versión, SO, perfil de hardware, modo de separación; toast "Información copiada") y la línea de créditos `aj.acerca.creditos`.
- [x] `DialogoAcercaDe` (para B1) que envuelve el componente; "Ver licencia" y "Créditos…" abren diálogos desplazables con el texto **sin conexión**.
- [x] Nuevo IPC `sistema.textoLegal('gpl' | 'terceros')` → texto de `LICENSE` y `THIRD_PARTY_NOTICES.md` leídos de los recursos de la app (sin empaquetar: raíz del repo; empaquetado: `process.resourcesPath`, la tarea 0025 los copia). `sistema.abrirCarpetaDatos()`.
- [x] Render: GPL como texto preformateado; `THIRD_PARTY_NOTICES.md` como texto plano o con un renderizador de Markdown que **no** admita HTML en bruto (ADR 0008; si se añade dependencia, licencia compatible y nota en `THIRD_PARTY_NOTICES.md`). Nunca `dangerouslySetInnerHTML`.
- [x] Tests de componente (botones, textos, fecha del aviso, copiar información) y de IPC (lectura de los dos textos, argumento no válido).

## Notas de implementación
- `AcercaDe` (`app/src/renderer/src/vistas/acerca/`) con versión, 6 botones y créditos; `DialogoAcercaDe` (título "Licencias") para B1 (0037 solo debe montarlo); `DialogoTextoLegal` (GPL y terceros, `<pre>` desplazable, texto plano: sin Markdown ni dependencias nuevas, sin `dangerouslySetInnerHTML`); `DialogoAvisoYoutube` (texto del wireframe B sin la línea "Solo te lo mostraremos esta vez", que no aplica al releerlo; fecha larga en español o "No aceptado todavía"). Textos en `textos.ts`.
- IPC `sistema.textoLegal('gpl'|'terceros')` y `sistema.abrirCarpetaDatos()` (shared/canales.ts, ipc.ts, preload, handlers). Lectura en `app/src/main/textoLegal.ts` (raíz del repo sin empaquetar; `process.resourcesPath` empaquetado: 0025 debe copiar `LICENSE` y `THIRD_PARTY_NOTICES.md` ahí). La carpeta de datos se abre con `shell.openPath(rutaDatos())`.
- "Copiar información" copia versión, SO, perfil de hardware (`config.instalacion.perfil_hardware`, "sin detectar" si null) y modo de separación.
- `Dialogo` ahora mantiene una pila: Esc y Tab solo los atiende el diálogo de arriba (necesario para diálogos anidados).
- Pruebas: `AcercaDe.test.tsx`, `textoLegal.test.ts`, casos nuevos en `handlers.test.ts`. Probar: `npx vitest run src/renderer/src/vistas/acerca src/main`.
- Deuda: `DialogoAcercaDe` aún no está montado (lo hace 0037); la vista Ajustes de la Fase 3 usará `AcercaDe` tal cual.
