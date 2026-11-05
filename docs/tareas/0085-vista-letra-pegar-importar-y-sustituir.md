# 0085 — Vista Letra: pegar la letra, importar archivo y confirmar la sustitución (wireframe B)
- Estado: Hecha
- Paso del pipeline: 3
- Depende de: 0084, 0078 (conversores en `shared/`). Integración real con 0083.
- ADRs: 0005, 0006
- Spec UX: docs/ux/05-letra.md (wireframe B, "Pegar la letra", "Importar archivo", "Usar esta letra" con diálogo, `let.pegar.*`, `let.dialogo.sustituir`, `let.dialogo.sustituirTexto`, `let.error.archivo`, criterios 5, 9–10, 16, 19)
- Preguntas: `preguntas/0022` §4, §6, §7, §9; `preguntas/0023` §1–§2
- Cuándo: después de 0084; en paralelo con 0086 y 0087.

## Objetivo
Las dos alternativas manuales de la vista Letra y la confirmación común antes de sustituir una letra que ya tiene alguna línea.

## Criterios de aceptación
- [ ] **"Pegar la letra"** muestra B: título, ayuda `let.pegar.ayuda` (ampliada con "Borra los renglones que no se cantan…", `0022` §6; sin filtrado de renglones de estructura) y un área de texto con etiqueta accesible y el foco.
  - **Toda la conversión es del renderer** con los conversores puros de `shared/letras` (`esLrc`, `lrcALetra`, `textoPlanoALetra`, `contarLineas`), sin llamadas al main hasta guardar (`preguntas/0023` §1). Se calcula sobre un valor diferido (`useDeferredValue`) para no bloquear la escritura con textos largos; `generarId` puede ser `crypto.randomUUID` (el main renormaliza al guardar).
  - **Contador en vivo** `let.pegar.contador` con `contarLineas(convertir(texto))`, sin contar renglones vacíos.
  - Si `esLrc(texto)` (0078), aparece el aviso `let.pegar.lrc` y, si `lrcALetra(texto).ignoradas > 0`, también `let.pegar.ignoradas` con el recuento en vivo (singular con 1; nada con 0).
  - "Usar esta letra" se deshabilita con 0 líneas.
  - "Volver a los resultados" (fantasma) vuelve a A sin perder los resultados y **conserva el texto** de B, que reaparece al volver a "Pegar la letra" mientras no se salga de la vista Letra ni se use (`0022` §7). Al salir de la vista o tras guardar, se descarta.
  - Al usar: `letras.guardar({ origen: 'manual', lrclib_id: null, lineas })`, con las líneas de `lrcALetra` o `textoPlanoALetra` según la detección (criterio 9).
- [ ] **"Importar archivo .lrc o .txt"** (en A, B y C):
  1. `letras.leerArchivo()`.
  2. Si se cancela, no pasa nada.
  3. Con `ARCHIVO_SIN_LETRA`, aparece un aviso en línea (`role="alert"`) con `let.error.archivo` junto a los botones y **la letra existente no cambia** (criterio 10).
  4. Si no, confirmación de sustituir (abajo) y `letras.guardar({ origen: 'archivo', lrclib_id: null, lineas })`.
  5. Si se guardó y la respuesta de `leerArchivo` trae `ignoradas > 0`, se pasa a la vista C para que muestre `let.importar.ignoradas` (0086; `preguntas/0023` §2). Es estado local: no se persiste. Dos llamadas (`leerArchivo` y `guardar`), no una.
- [ ] **Confirmación de sustituir** (criterio 5):
  - Se pide antes de guardar desde "Usar esta letra" (A), "Usar esta letra" (B) o "Importar", si la canción ya tiene **≥ 1 línea** (`contarLineas ≥ 1`). En la importación, el diálogo sale **después** de leer el archivo y solo si este es válido (`preguntas/0022` §4, criterio 16).
  - Texto: `let.dialogo.sustituir` si alguna línea existente tiene `inicio_ms`; si no, `let.dialogo.sustituirTexto`. Foco en [Cancelar]; [Sustituir] es destructivo. Cancelar o Esc no escriben nada.
  - Con cero líneas existentes se guarda sin preguntar.
- [ ] **Tras guardar**: vista C con el foco en "Ir al editor" y el stepper con Letra ✓, que llega por `evento:cancion`.
- [ ] Tests (API falsa):
  - contador con renglones vacíos y estrofas;
  - aviso de LRC al pegar texto con marcas;
  - `let.pegar.ignoradas` con 1 y con 2 renglones sin tiempo, y ausente con 0;
  - el texto de B se conserva tras "Volver a los resultados" y se descarta al salir de la vista;
  - botón deshabilitado con 0 líneas;
  - guardar texto plano y LRC;
  - importar cancelado, válido y con `ARCHIVO_SIN_LETRA`, sin cambios en la letra;
  - diálogo de sustituir: `sustituir` con sincronía previa, `sustituirTexto` sin ella, sin diálogo con cero líneas; Cancelar y Sustituir, desde A, B e Importar;
  - importar un LRC con `ignoradas: 2` → C muestra el aviso.

## Notas de implementación
- **Qué se hizo**: vista B (`PegarLetra.tsx`), importar de archivo (`importar.ts`, hook `useImportarArchivo`) y confirmación de sustituir (`sustituir.tsx`, hook `useConfirmarSustituir` + `existenteDe`). Textos en `textosPegar.ts` (`let.pegar.*`, `let.importar.ignoradas`, `let.error.archivo`, diálogo).
- **Conversión** 100 % en el renderer (`esLrc`/`lrcALetra`/`textoPlanoALetra`, `useDeferredValue`, `crypto.randomUUID`); sin llamadas al main hasta guardar. Texto > 512 KB: aviso `error` propio (copy no previsto en la spec; anotarlo para el diseñador).
- **Estado en `Letra.tsx`**: `pegando`, `textoPegado` (se conserva al ir a A y volver; se limpia al guardar o al salir), `existente` (líneas y si hay sincronía, actualizado tras cada guardado) e `ignoradasImportadas` (estado local para C). `BusquedaLetra` recibe `confirmar` y su `onUsada` pasa también las líneas.
- **Importar**: `leerArchivo` → (cancelado: nada; `ARCHIVO_SIN_LETRA`: aviso `role="alert"` bajo la vista, letra intacta; otro error: toast) → confirmar si hay ≥ 1 línea → `guardar({origen:'archivo'})`.
- **Diálogo**: foco en Cancelar, Sustituir destructivo, Esc/Cancelar no guardan.
- **Probar**: `npx vitest run src/renderer/src/vistas/letra/PegarLetra.test.tsx`. Los caminos con diálogo (A, B, Importar) se prueban con un arnés que monta cada pieza con letra previa, porque con letra existente la vista abre en C.
- **Deuda**: ninguna pendiente propia. Fallos e2e ajenos en la ejecución completa: biblioteca (semilla: 14 tarjetas en vez de 11) y separación (importar/cola), no relacionados con la vista Letra.
