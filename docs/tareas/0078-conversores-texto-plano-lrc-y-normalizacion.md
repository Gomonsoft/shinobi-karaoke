# 0078 — Conversores puros: texto plano, LRC, LRC mejorado, normalización y exportación
- Estado: Hecha
- Paso del pipeline: 3
- Depende de: 0006 (Hecha). Las fixtures de 0077 se pueden ir añadiendo en paralelo.
- ADRs: 0005 (Decisión §3, Revisiones 2026-11-04 cierre y 2026-11-05), 0006 (invariantes)
- Spec UX: docs/ux/05-letra.md ("Pegar la letra", "Renglones vacíos", criterios 9–10)
- Cuándo: **puede empezar ya**, en paralelo con 0077 y 0081.

## Objetivo
Convertir texto plano, LRC y LRC mejorado al formato interno (`ElementoLetra[]`) con la normalización del ADR 0005, para que el resultado cumpla siempre `validarInvariantesLetra`. Son funciones puras en `app/src/shared/letras/`, **sin dependencias**: las usan el main y el renderer (contador y detección de LRC al pegar).

## Criterios de aceptación
- [x] **`textoPlanoALetra(texto)`**:
  - un renglón es una línea sin tiempos (`inicio_ms: null`), con los extremos recortados;
  - los renglones vacíos o solo con espacios son pausas: varias seguidas se funden en una y se descartan las del principio y del final;
  - `\r\n`, `\r` y `\n` valen como saltos.
  Los renglones como `[Estribillo]` o `(x2)` se conservan como líneas (provisional, `preguntas/0022` §6).
- [x] **`esLrc(texto)`**: `true` si al menos la mitad de los renglones no vacíos y sin etiquetas de metadatos empiezan por una o más marcas `[m:ss]`, `[m:ss.x]`, `[m:ss.xx]` o `[m:ss.xxx]`. Los minutos pueden ser mayores de 59, y se acepta `:` como separador decimal (`[01:02:50]`).
- [x] **`lrcALetra(texto)`**:
  - Varias marcas en un renglón generan una copia por marca. Después se ordena todo por tiempo, con orden estable.
  - `[offset:±ms]` se aplica a los tiempos: `t − offset`, con mínimo 0.
  - Se ignoran las etiquetas `[ar:]`, `[ti:]`, `[al:]`, `[by:]`, `[length:]`, `[re:]`, `[ve:]`, `[#…]` y cualquier otra `[clave:valor]` no temporal, y también los renglones con texto pero sin marca. `lrcALetra` devuelve cuántos ha ignorado (`{ lineas, ignoradas }`), porque la UX **sí avisa** de los renglones ignorados (`preguntas/0022` §9; 0083/0085 lo muestran).
  - Una marca sin texto es una **pausa con tiempo**. Si es la última, pasa a ser el `fin_ms` de la última línea (si `inicio < fin`) y la pausa desaparece. Si es la primera, se descarta.
- [x] **LRC mejorado** (`<mm:ss.xx>` dentro del renglón):
  - Cada tramo entre marcas es una palabra, con el texto tal cual, incluido el espacio final, y `inicio_ms` igual a su marca. El `texto` de la línea es la concatenación con los espacios normalizados.
  - `fin` de una palabra = inicio de la siguiente. La última termina en la marca de cierre si la hay; si no, en `min(inicio del siguiente elemento con tiempo, inicio + 1000)`.
  - Las palabras vacías se descartan.
  - Si no hay `[mm:ss]` de línea, el inicio de la línea es el de su primera palabra.
- [x] **`normalizarLetra(lineas, generarId)`**, que usan todos los conversores, la Lyricsfile (0080) y `letras.guardar` (0083). Implementa la Revisión 2026-11-04 (cierre) del ADR 0005:
  - inicios iguales → el posterior +1 ms, repetido si hace falta;
  - ids nuevos y únicos (`generarId` inyectable para tests deterministas);
  - listas de palabras vacías → `null`;
  - pausas fundidas o descartadas: al fundir dos pausas se conserva el tiempo de la primera que lo tenga;
  - palabras recortadas o descartadas si no cumplen sus invariantes;
  - `fin_ms` fijado que no cumpla `inicio < fin ≤ siguiente inicio` → `null`.
  Si aun así `validarInvariantesLetra` devuelve problemas, se quitan **todos** los tiempos (líneas y palabras) y se conservan los textos.
- [x] **Exportar** (sin interfaz en el MVP; sirve para los tests de ida y vuelta): `letraALrc(letra)` y `letraALrcMejorado(letra)`, con las pausas con tiempo como marcas vacías y sin las líneas sin tiempo. La ida y vuelta LRC → letra → LRC conserva textos y tiempos (redondeados a centésimas).
- [x] **Límites**: más de 5000 elementos o más de 512 KB de texto lanzan un error tipado (`ErrorLetraDemasiadoGrande`), que el main traduce a `ARCHIVO_SIN_LETRA` o `ARGUMENTOS_NO_VALIDOS`.
- [x] Tests (Vitest, cobertura ≥ 95 % de líneas en `shared/letras/`) con las fixtures de 0077 y casos de borde:
  - dúo con dos marcas iguales (+1 ms);
  - LRC desordenado;
  - offset negativo y positivo;
  - marca final vacía;
  - palabras fuera de su línea;
  - `[00:00.00]` vacío al principio;
  - texto con BOM;
  - solo pausas → cero líneas;
  - CRLF.
  Además, un test de propiedad (generador sencillo propio, sin dependencias nuevas): cualquier salida de `normalizarLetra` cumple `letraSchema`.

## Notas de implementación
- Código en `app/src/shared/letras/` (`normalizar.ts`, `texto.ts`, `lrc.ts`, `index.ts`, exportado desde `shared/index.ts`) y tests en `letras.test.ts` (cobertura de líneas 97 %).
- `lrcALetra` devuelve `{ lineas, ignoradas }`: la UX (preguntas/0022 §9) sí avisa; 0083/0085 deben mostrarlo.
- Decisiones propias: una línea sin texto ni palabras pasa a pausa en `normalizarLetra`; el texto previo a la primera marca `<>` de LRC mejorado se descarta; con varias marcas de línea y palabras, solo la primera copia conserva las palabras; la exportación no escribe `[offset:]` (offset_ms es 0 tras importar) y añade una marca final vacía si la última línea tiene fin fijado. `MAX_ELEMENTOS_LETRA` se reutiliza de `letrasBusqueda.ts` (0077).
- Pendiente de otros: el test `separacion.test.ts > PROCESO_TERMINADO` falla por cambios en curso de la 0077 (ajeno a esta tarea).
- Probar: `npx vitest run src/shared/letras`.
