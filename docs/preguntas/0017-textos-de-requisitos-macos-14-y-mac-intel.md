# 0017 — Textos de requisitos: macOS 14 en Apple Silicon y Mac Intel no compatible
- De: arquitecto
- Para: disenador-ux
- Estado: Respondida
- Bloquea: no (la tarea 0037 puede usar los textos provisionales de abajo); sí para cerrar 0037 con los textos definitivos

## Contexto
Respuesta a `preguntas/0015`: en Apple Silicon el motor de audio exige **macOS 14 (Sonoma) o posterior** (no 12). Los Mac Intel quedan fuera del MVP de forma provisional (`preguntas/0016`, pendiente del usuario) y solo se publica el DMG para Apple Silicon, así que un Mac Intel no llega a abrir la app.

Técnicamente:
- Un Mac Apple Silicon con macOS 12 o 13 **sí abre la app** y la detección previa lo trata como no soportado → B6. Ese usuario puede resolverlo **actualizando macOS gratis**, a diferencia del resto de casos de B6.
- `pa.nocompat.equipo` necesita la versión de macOS para que se entienda el motivo.

## Pregunta
1. Nuevo texto de requisitos en B1 (`ux/01` paso 2) y en `pa.nocompat.cuerpo`, que hoy dicen "macOS 12 o posterior".
2. ¿B6 tiene una variante para "Mac Apple Silicon con macOS anterior al 14", que sugiera actualizar macOS (y quizá enlace a la página de Apple), o basta el B6 general con la versión en `pa.nocompat.equipo`?
3. Texto de requisitos de la página de descarga y de la guía de instalación (Parte A de `ux/01`): "Mac con Apple Silicon (M1 o posterior) y macOS 14 o posterior; los Mac con procesador Intel no son compatibles por ahora". La alternativa de la Parte A "en macOS 12–14: clic derecho → Abrir" pasa a aplicarse solo a macOS 14.
4. ¿Algún otro sitio (Ajustes → Acerca de, `ux/08`) muestra requisitos?

## Opción provisional tomada (si no bloquea)
- Requisitos B1: "Windows 10/11, macOS 14 o posterior (Mac con Apple Silicon), o Linux de 64 bits · …" (resto igual).
- `pa.nocompat.cuerpo`: "… solo existe para Windows 10/11 y Linux con procesador de 64 bits (x64) y para Mac con Apple Silicon y macOS 14 o posterior."
- `pa.nocompat.equipo` en macOS incluye la versión: "Tu equipo: macOS 13.6 · procesador ARM de 64 bits". Sin variante propia de B6.

## Respuesta
(disenador-ux, 2026-11-04; con la decisión del usuario en `preguntas/0016`: **opción C, Mac Intel no compatible en el MVP**)

Todo está ya en `ux/01` (Parte A §1, §2, §4, §5; B6, nueva B6b, componentes, estados, microcopy y criterios 15, 15b, 15c y 17) y una línea en `ux/08`.

### 1. Textos de requisitos
- Página de descarga (Parte A §2): "Windows 10/11 de 64 bits, Mac con chip Apple y macOS 14 o posterior, o Linux de 64 bits · 8 GB de RAM · …" (resto igual) y, debajo, "Los Mac con procesador Intel no son compatibles por ahora."
- La app no muestra requisitos de SO en B1 (solo descarga, tiempo, espacio y conexión): no cambia.
- `pa.nocompat.cuerpo`: "… solo existe para Windows 10/11 y Linux con procesador de 64 bits (x64) y para Mac con chip Apple y macOS 14 o posterior." Uso "chip Apple" (lo que ve el usuario en "Acerca de este Mac"), no "Apple Silicon".
- `pa.nocompat.equipo` con nombres legibles: en macOS lleva la versión y `chip Apple`/`procesador Intel` (p. ej. "Tu equipo: macOS 15.1 · procesador Intel"); nunca `arm64`/`x64` en crudo.

### 2. Variante de B6 → **sí: B6b "Necesitas actualizar macOS"**
Se resuelve sin nosotros, así que no debe parecer un callejón sin salida: banner `aviso` (no `error`), `pa.macos.cuerpo` ("Shinobi Karaoke necesita macOS 14 (Sonoma) o posterior y tu Mac tiene macOS {version}."), `pa.macos.gratis`, pasos para actualizar y botones [Cómo actualizar macOS ↗] (página oficial de Apple en español; el programador fija la URL de support.apple.com) · [Copiar detalles] · [Salir] (primario, foco inicial). Sin "Pedir soporte" ni "Preparar". Orden de la decisión: sin entrada en el manifiesto (incluido **cualquier** Mac Intel) → B6; chip Apple con macOS < 14 → B6b; resto → B1/B0/B5. Un Mac Intel nunca ve B6b.

### 3. Página de descarga y guía (Parte A)
- Botón "Descargar para Mac con chip Apple" con el requisito siempre visible debajo y "¿Qué Mac tengo?" (menú Apple → Acerca de este Mac: "Chip" sí, "Procesador Intel" todavía no). No se detecta Intel desde el navegador (Safari dice "Intel" en todos los Mac).
- Gatekeeper: "Alternativa solo en macOS 14 Sonoma: clic derecho → Abrir → Abrir. En macOS 15 o posterior no existe; usa el paso 3."
- "¿Sigue sin abrirse?": dos entradas nuevas de macOS ("no es compatible con este Mac" → es un Mac Intel; "dice «Necesitas actualizar macOS»" → actualizar gratis).

### 4. Otros sitios
Ajustes → Acerca de (`ux/08`) no muestra requisitos. Solo cambia "Copiar información para soporte", que ahora incluye la versión del SO (p. ej. `macOS 14.5`) y la arquitectura real.

### Cambios que necesita la tarea 0037 (no la edito)
1. Añadir **B6b** a la lista de pantallas y a los tests: wireframe, claves `pa.macos.titulo|cuerpo|gratis|pasos|ayuda`, banner `aviso`, botones [Cómo actualizar macOS] [Copiar detalles] [Salir] (foco), sin "Pedir soporte"/"Preparar"; anuncio una vez; criterio 15b de `ux/01`.
2. `App` decide B6 frente a B6b: hace falta que `runtime.requisitos` diga **por qué** no hay plataforma (p. ej. `motivo: 'plataforma' | 'version_so'` y `versionMinimaSo: '14'`). Hoy solo devuelve `plataforma: null` + `equipo`; el mínimo no debe repetirse en el renderer. Si 0031/0034 no lo exponen, se añade aquí (consultar al arquitecto si cambia la API).
3. Sustituir los textos provisionales de 0017 por los definitivos de `ux/01`: `pa.nocompat.cuerpo` con "Mac con chip Apple y macOS 14 o posterior"; nombres legibles `chip Apple`/`procesador Intel` y versión de macOS en `pa.nocompat.equipo` (criterio 15c).
4. "Copiar detalles" de B6b con la marca `macos por debajo del mínimo (14)`.
5. Tests: macOS 13.6 arm64 → B6b; macOS 14.0 arm64 → B1; Mac Intel (13.6 y 15.1) → B6, nunca B6b; Linux arm64 → B6 con "procesador ARM de 64 bits".
6. Fuera de 0037: la página de descarga/README (criterio 17 de `ux/01`) corresponde a la tarea 0025 o a la que publique la guía.


## Seguimiento (arquitecto, 2026-11-04)
- API: `runtime.requisitos` añade `motivo: null | 'arquitectura' | 'so_antiguo'` y `versionMinimaSo: null | { version: '14', nombre: 'Sonoma' }`; primero se comprueba el manifiesto y después la versión (un Mac Intel siempre da `'arquitectura'`). Tarea 0036 (ajusta `deteccion.ts`, donde 0034 ya aplica la regla macOS < 14).
- B6b, textos definitivos y tests: tarea 0037. "Copiar información para soporte" con la versión del SO: tarea 0054.
- URL de "Cómo actualizar macOS": `https://support.apple.com/es-es/108382` ("Actualizar macOS en el Mac", comprobada el 2026-11-04), añadida a `ENLACES_PERMITIDOS` en 0036 y anotada en ADR 0008 §8.
- Página de descarga (README "Descargar" + *Releases* de GitHub) y guía `INSTALAR.md` (criterios 13 y 17 de `ux/01`): tarea 0025.
