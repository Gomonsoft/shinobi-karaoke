# 0086 — Vista Letra: letra elegida y edición del texto con autoguardado (wireframe C)
- Estado: Hecha
- Paso del pipeline: 3
- Depende de: 0084, 0079 (`letraATexto`). Integración real con 0083.
- ADRs: 0005 (editar el texto), 0006 (autoguardado, `lista` e `incompleta`)
- Spec UX: docs/ux/05-letra.md (wireframe C y "C con el área vacía", "Edición en C", `let.actual`, `let.actual.vacia`, `let.edicion.aviso`, `let.edicion.marcas`, `let.importar.ignoradas`, `let.error.listaSinLineas`, `let.boton.otra`, `let.boton.editor`, criterios 11, 14–15, 17, 19, sección "Casos de la Fase 4")
- Preguntas: `preguntas/0022` §1, §2, §3, §9; `preguntas/0023` §2–§3
- Cuándo: después de 0084; en paralelo con 0085 y 0087.

## Objetivo
Pantalla de la letra ya elegida: resumen del origen, área de texto editable que conserva la sincronía de lo que no cambia, y salidas a "Buscar otra letra", "Importar archivo" e "Ir al editor".

## Criterios de aceptación
- [ ] **Resumen** `let.actual` con el formato `Letra actual · {origen} · {sincronía} · {n} líneas` ("1 línea" en singular; `0022` §1):
  - `{origen}`: "de LRCLIB" / "pegada" / "de un archivo" (sin nombre de archivo; el esquema no cambia);
  - `{sincronía}`: "sincronizada por palabra" / "sincronizada por línea" / "sin sincronizar" / "sincronizada en parte", con la regla de `ux/05` §1 (en parte = hay líneas con y sin inicio);
  - `{n}` = `contarLineas`. Atribución "Letra: LRCLIB" (enlace) mientras `origen === 'lrclib'` (criterio 6).
- [ ] **Área de texto**:
  - contenido inicial con `letraATexto` (0079) y etiqueta accesible;
  - aviso `let.edicion.aviso` (ⓘ) siempre visible;
  - aviso informativo `let.edicion.marcas` mientras algún renglón del área empiece por una marca `[m:ss]` o `[mm:ss.xx]` (regex por renglón en el renderer, sin el main; `0023` §3). Las marcas se guardan como texto literal y no bloquean el guardado;
  - **autoguardado** con `letras.editarTexto` al salir del área (blur) o tras 1 s sin escribir, y también al desmontar la vista si hay cambios pendientes;
  - "✎ Borrador · guardado" en la cabecera tras confirmarse.
  **No se reescribe** el contenido del área mientras tiene el foco, aunque el guardado normalice (por ejemplo, funda renglones vacíos): el texto normalizado aparece al volver a la vista.
- [ ] **Cero líneas** (`0022` §2, criterio 15):
  - en `borrador` se guarda y **la vista sigue en C**: se muestra `let.actual.vacia` en lugar del resumen, "Ir al editor" queda inactivo, el stepper pasa a Letra ○ y Editor no navegable con `paso.motivo.sinLetra`;
  - en `lista`, el main lo rechaza (0083) y se muestra `let.error.listaSinLineas` bajo el área sin borrar lo escrito; el aviso desaparece en cuanto el área tiene ≥ 1 línea, que se guarda con normalidad. Sin botón "Volver a borrador".
- [ ] **Renglones ignorados al importar** (`0022` §9, criterio 19): si la importación (0085) llega con `ignoradas > 0`, C muestra `let.importar.ignoradas` (ⓘ, singular con 1) con [×]; desaparece al cerrarlo o al salir de la vista. Es estado de la vista, no se guarda.
- [ ] **Botones**:
  - "Buscar otra letra" → A con la búsqueda automática **sin** caché;
  - "Importar archivo" → flujo de 0085;
  - "Ir al editor" → `{ paso: 'editor' }`, que es el marcador de la Fase 5.
- [ ] **Cambios que llegan de fuera**: si un `evento:cancion` trae una letra distinta de la que muestra la vista (por ejemplo, tras sustituirla con "Importar archivo") y el área no tiene el foco ni guardados pendientes, el texto se recarga.
- [ ] Tests (API falsa con un `editarTexto` que aplica `aplicarTextoEditado` de verdad):
  - autoguardado por blur y por inactividad (temporizadores falsos);
  - guardado al desmontar;
  - textos del resumen para los tres orígenes, las cuatro sincronías y "1 línea";
  - `let.edicion.marcas` aparece y desaparece al escribir/borrar una marca al principio de un renglón;
  - `let.importar.ignoradas` tras importar con ignoradas, se cierra con ×;
  - atribución solo con LRCLIB;
  - cero líneas en borrador (`let.actual.vacia`, "Ir al editor" inactivo) y en lista (`let.error.listaSinLineas`, que se va al escribir una línea);
  - "Buscar otra letra" lanza la búsqueda;
  - "Ir al editor" navega;
  - el área no se reescribe con el foco.

## Notas de implementación
- Qué se hizo: vista C real en `app/src/renderer/src/vistas/letra/LetraElegida.tsx` (resumen `let.actual`, atribución LRCLIB, área de texto con autoguardado, avisos `let.edicion.aviso`/`let.edicion.marcas`/`let.error.listaSinLineas`, aviso `let.importar.ignoradas` con [×], botones). Lógica pura en `modeloElegida.ts` (`sincroniaActual`, `hayMarcasDeTiempo`, `tieneLineas`, `huella`); textos en `textosElegida.ts`.
- Decisiones: el texto del área es estado controlado que solo cambia al escribir o al recargar por un cambio externo (nunca con el foco). Guarda con `letras.editarTexto` por blur, a 1 s sin escribir y al desmontar. El resumen de C se calcula en el renderer aplicando `aplicarTextoEditado` a la letra local tras cada guardado exitoso (la respuesta de `editarTexto` solo trae el `ResumenCancionIpc`). Cero líneas: en borrador se guarda y se muestra `let.actual.vacia`; en lista el rechazo del main muestra `let.error.listaSinLineas` (se quita al escribir una línea). "Ir al editor" inactivo con `noDisponible` (`aria-disabled`, enfocable). Cambios externos: ante `evento:cancion` se relee `biblioteca.obtener` y, si la letra difiere (huella sin ids) y no hay foco ni pendientes, se recarga.
- Cambios en archivos compartidos: `Letra.tsx` (guarda la letra que muestra C en `letraC`, con `clave` para remontarla al sustituirla; pasa el origen a `guardada`: lrclib/manual/archivo; `sinCache` para "Buscar otra letra"), `BusquedaLetra.tsx` (prop `sinCacheInicial`), y las aserciones `Letra elegida · N líneas` de `Letra.test.tsx` y `PegarLetra.test.tsx` pasan a `Letra actual · … · N líneas` (y sus fixtures de `letra` llevan `origen`). `TEXTO.letraElegida` de `textos.ts` queda sin uso.
- Probar: `npx vitest run src/renderer/src/vistas/letra` (`LetraElegida.test.tsx`, 21 tests; API falsa con `editarTexto` que aplica `aplicarTextoEditado`).
- Deuda: sin E2E propio (0088); el aviso de lista usa tipo `aviso` (role status). E2E de Biblioteca fallan por la semilla de 0087 (15 tarjetas en vez de 12), no por esta tarea.
