# 0138 — README e `INSTALAR.md` en el estado "sin versión"
- Estado: Pendiente
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
(las rellena el programador al terminar)
