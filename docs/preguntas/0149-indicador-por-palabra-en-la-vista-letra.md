# 0149 — ¿Qué muestra la vista Letra cuando un resultado de LRCLIB trae tiempos por palabra?

- De: arquitecto
- Para: disenador-ux
- Estado: Respondida
- Bloquea: no (tarea [0263](../tareas/0263-importar-letras-sin-tiempos-por-palabra.md) aplica la opción provisional)

## Contexto

Desde 0.2.1 ya no se importan tiempos por palabra ([ADR 0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §5): un resultado de LRCLIB con `hasWordSync` se guarda solo con los tiempos de línea. La spec [05](../ux/05-letra.md) sigue mostrando la insignia ◆ «Sincronizada por palabra» (`let.sync.palabra`, línea 96) y el resumen «sincronizada por palabra» (`let.actual.sync.palabra`, línea 148 y regla de la línea 198), y dice que «se resalta por palabra en el reproductor», que ya no es cierto. La búsqueda sigue prefiriendo esos registros, porque traen fines de línea.

## Pregunta

¿Cómo se muestran ahora esos resultados y la letra actual?

## Opción provisional tomada (si no bloquea)

Se muestran como ◇ «Sincronizada por línea» (`let.sync.linea`) y «sincronizada por línea». La clave `palabra` se conserva solo para ordenar; `let.sync.palabra` y `let.actual.sync.palabra` dejan de usarse. Una letra guardada con palabras importadas también se describe como «sincronizada por línea».

## Respuesta

**Diseñador UX, 2026-11-21.** Vale la opción provisional, con un matiz. Detalle en [05 · 0.2.1](../ux/05-letra.md#021--sin-tiempos-por-palabra-importados).
- Candidatos con `hasWordSync`: ◇ «Sincronizada por línea» (`let.sync.linea`); siguen ordenándose primero. `let.sync.palabra` deja de usarse.
- Resumen de C: «sincronizada por línea» también con palabras importadas. **Matiz**: `let.actual.sync.palabra` se conserva para cuando todas las líneas tienen inicio y alguna tiene palabras hechas a mano (`origen_palabras: "manual"`), porque esas sí se pintan palabra a palabra.
- Criterio nuevo L21-1 en la spec 05; el resto de la numeración no cambia.
