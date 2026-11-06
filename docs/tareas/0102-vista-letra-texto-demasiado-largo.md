# 0102 — Vista Letra: texto demasiado largo (`let.pegar.demasiado` y `let.error.demasiadoLarga`)
- Estado: Pendiente
- Paso del pipeline: 3
- Depende de: — (**puede empezar ya; tarea pequeña**)
- ADRs: 0005 (límites de 512 KB y 5000 elementos)
- Spec UX: docs/ux/05-letra.md ("Pegar la letra", "Casos de la Fase 4" §10, criterio 21; microcopy `let.pegar.demasiado` y `let.error.demasiadoLarga`)
- Archivos: `app/src/renderer/src/vistas/letra/textosPegar.ts`, `PegarLetra.tsx`, `textosElegida.ts`, `LetraElegida.tsx` y sus tests (`PegarLetra.test.tsx`, `LetraElegida.test.tsx`). **No toca archivos compartidos.**
- Paralelizable con: todas.

## Contexto para quien implementa
- La tarea 0085 añadió, sin spec, el texto "El texto es demasiado largo (máximo 512 KB)." en B (pegar). Lo detecta `PegarLetra.tsx` cuando el conversor lanza `ErrorLetraDemasiadoGrande` (`shared/letras`), que cubre tanto más de 512 KB como más de 5000 renglones (`'elementos'`).
- En C (`LetraElegida.tsx`, edición con autoguardado), un texto demasiado largo hace fallar `letras.editarTexto` (`ARGUMENTOS_NO_VALIDOS`; el contrato limita a 512 KB) y hoy sale el toast genérico `errorGuardar` "No se pudo guardar la letra.".
- La UX lo corrige (`ux/05` §10): "KB" no se muestra y los textos dicen qué hacer.

## Criterios de aceptación
- [ ] **B** (`textosPegar.ts`): `demasiado` pasa a ser `let.pegar.demasiado`: "Este texto es demasiado largo para ser una letra. Comprueba que has pegado solo la letra de la canción.".
  - Se muestra como aviso `error` en línea bajo el área, tanto si se superan los 512 KB (UTF-8) como los 5000 renglones;
  - con el aviso visible **no** se muestran el contador de líneas ni los avisos de LRC, y "Usar esta letra" queda inactivo;
  - el aviso desaparece en cuanto el texto vuelve a caber.
- [ ] **C** (`textosElegida.ts`): clave nueva `demasiadoLarga` = `let.error.demasiadoLarga`: "El texto es demasiado largo para ser una letra. Este cambio no se ha guardado.".
  - Antes de llamar a `editarTexto`, el componente comprueba el tamaño en el cliente: bytes UTF-8 > `MAX_BYTES_TEXTO_LETRA` (de `shared/letrasBusqueda.ts`), o renglones que superen el límite de elementos (`MAX_ELEMENTOS_LETRA`; los renglones vacíos cuentan como posibles pausas, así que basta contar renglones).
  - Si lo supera: muestra el aviso `error` bajo el área, **no** llama a `editarTexto`, no borra lo escrito y no sale el toast genérico.
  - Si `editarTexto` respondiera igualmente `ARGUMENTOS_NO_VALIDOS` por tamaño, se muestra el mismo aviso.
  - Al salir de la vista se conserva la última letra guardada (no se fuerza ningún guardado).
- [ ] El texto "512 KB" no aparece en la interfaz: hay un test que busca "KB" en los textos de `vistas/letra/` y no lo encuentra.
- [ ] Al importar un archivo demasiado grande se mantiene `let.error.archivo` (sin cambios).
- [ ] Tests de B y C para los dos límites (bytes y renglones) y para la desaparición del aviso.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/renderer/src/vistas/letra
```

## Notas de implementación
(las rellena el programador al terminar)
