# 0138 — README e `INSTALAR.md` en el estado "sin versión"
- Estado: Hecha
- Paso del pipeline: 0 (distribución)
- Depende de: —
- ADRs: 0012
- Spec UX: docs/ux/09-descarga-e-instalacion.md (§1.1, §1.3, §2; estado E0), con los ajustes de las respuestas a 0040–0043
- ¿Red?: no.

## Objetivo
Publicar en el repositorio el estado de la Fase 7: **E0, sin ninguna versión publicada**, con la guía provisional.

## Archivos
- `README.md`;
- `INSTALAR.md` (nuevo, en la raíz);
- `app/scripts/guia-instalacion.test.ts`.

## Contratos
- Texto literal de `ux/09`. Se aplican los ajustes de las respuestas a las preguntas: en especial, **se quita la entrada de FUSE** y se ajusta la de macOS (ver el "Impacto en `ux/09`" de 0041 y 0042), una vez que el diseñador los incorpore a la spec. Si aún no lo ha hecho, se copia el texto vigente y se anota.
- `{ARCHIVO_*}` y `{PAQUETE_DEB}`: valores de la respuesta a 0040.
- **Ningún enlace de descarga** ni `releases/latest` (criterio 1 de `ux/09`).
- Aviso E0 y aviso "guía provisional" al principio de `INSTALAR.md`.
- **Criterio 14 de `ux/09`**: en "Requisitos del equipo" del README, "Solo en el primer arranque (descarga ~1–2 GB) y para YouTube/letras" pasa a "Solo en el primer arranque (descarga entre 1 y 6 GB según tu equipo) y para YouTube/letras".
- Los marcadores ⟦…⟧ y los comentarios `<!-- E0 -->` y `<!-- PROVISIONAL -->` no se copian.
- Los enlaces a `github.com/Gomonsoft/shinobi-karaoke` responden 404 sin sesión mientras el repositorio sea privado (`preguntas/0035`). **No bloquea esta tarea**: E0 no promete descarga. Se comprueban sin sesión en 0142.

## Criterios de aceptación
- [ ] Test sin red, sobre `README.md` e `INSTALAR.md`:
  - [ ] sin `releases/latest`, sin ⟦, sin `{` por sustituir (criterios 1 y 8);
  - [ ] la línea de requisitos y "Los Mac con procesador Intel no son compatibles por ahora." son idénticas en ambos (criterio 4);
  - [ ] encabezados del criterio 6 presentes y enlaces internos resueltos;
  - [ ] "macOS 14 Sonoma" en la alternativa de clic derecho y las dos entradas de "¿Sigue sin abrirse?" (criterio 7);
  - [ ] ni `~1–2 GB` ni `--no-sandbox` ni `apparmor_restrict` ni `xattr` (criterios 11 y 14);
  - [ ] no se presenta el modelo Rápido como opción previa.
- [ ] Sin imágenes rotas: línea "Captura pendiente" en cada SO.
- [ ] El README enlaza `INSTALAR.md`.

## Verificación
```bash
cd app && npx vitest run guia-instalacion
```

## Notas de implementación
README quedó en estado E0, sin enlaces de descarga, con el enlace a `INSTALAR.md` y el rango de descarga del primer arranque actualizado a 1–6 GB. Se creó `INSTALAR.md` desde el texto de `ux/09`, retirando marcadores y comentarios. La spec aún conserva en una respuesta antigua la mención de FUSE; siguiendo el ajuste técnico de 0042 y el contrato de esta tarea, la guía solo indica probar el `.deb` o abrir una incidencia cuando AppImage no abre. La guía mantiene el aviso provisional y una línea de captura pendiente por sistema.

Se añadió `app/scripts/guia-instalacion.test.ts`: comprueba estado E0, ausencia de enlaces de descarga y marcadores, consistencia de requisitos y compatibilidad Intel, encabezados y anclas internas, texto de macOS 14, avisos de macOS, referencias de seguridad y capturas pendientes.

Archivos: `README.md`, `INSTALAR.md`, `app/scripts/guia-instalacion.test.ts` y `app/package.json` (ya incluye `scripts/**/*.test.ts` por 0127).

Verificación: las seis pruebas de `guia-instalacion` pasan; `npm test` completo pasa (130 archivos aprobados, 1 omitido; 1810 pruebas aprobadas, 12 omitidas); lint, typecheck, format:check y build pasan. Las pruebas usan solo contenido estático y no requieren red.
