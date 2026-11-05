# 0023 — Recuento de renglones ignorados y detección de LRC en la vista Letra
- De: disenador-ux
- Para: arquitecto
- Estado: Respondida
- Bloquea: no (si no es viable tal cual, se ajusta la spec 05; mientras tanto, sin aviso de renglones ignorados como en la opción provisional de `0022` §9)

## Contexto
Al responder [`0022`](0022-huecos-ux-de-la-vista-letra-fase-4.md) §9 se ha decidido **avisar** cuando un LRC tiene renglones con texto sin marca de tiempo (`ux/05`, claves `let.pegar.ignoradas` y `let.importar.ignoradas`, criterio 19). La tarea 0078 ya hace que `lrcALetra` devuelva `{ lineas, ignoradas }`, pero no está claro que el recuento llegue al renderer.

## Pregunta
1. **Pegar (B)**: el aviso y el contador de líneas son "en vivo" mientras se escribe. ¿Puede el renderer usar los conversores puros de `shared/` (detección de LRC, `lrcALetra`, `contarLineas`) solo para la vista previa, aunque el guardado definitivo siga pasando por `letras.*` en el main? Si no, ¿se añade una llamada de previsualización al main (con *debounce*)?
2. **Importar**: ¿puede la respuesta de la importación (tarea 0083) incluir `ignoradas: number` para que la vista C muestre el aviso? Encaja con el flujo de `0022` §4: leer el archivo → (si es válido y hay letra) confirmar → guardar. ¿Es una sola llamada con confirmación en medio o dos (leer/previsualizar y luego guardar)?
3. **Regla del aviso `let.edicion.marcas`** (vista C, `0022` §3): se calcula en el renderer con una expresión regular sobre el texto del área (algún renglón empieza por `[m:ss]` o `[mm:ss.xx]`). Confirmar que no hace falta nada del main.

## Opción provisional tomada (si no bloquea)
1 y 3: cálculo en el renderer con los conversores de `shared/`. 2: la respuesta de la importación trae `ignoradas`; si no llega, no se muestra el aviso.

## Respuesta
Respondida por arquitecto el 2026-11-05. Se acepta la opción provisional en los tres puntos.

1. **Pegar (B): todo en el renderer, sin llamada al main.** Los conversores de `shared/letras` (`esLrc`, `lrcALetra`, `textoPlanoALetra`, `contarLineas`) son funciones puras sin dependencias de Node y ya están pensados para usarse en los dos procesos. El renderer los usa para la vista previa (contador, `let.pegar.lrc`, `let.pegar.ignoradas` con el `ignoradas` de `lrcALetra`) **y** para obtener las `lineas` que envía a `letras.guardar` (como ya decía 0085). No hace falta un canal de previsualización: añadiría IPC por pulsación sin aportar nada. El main no se fía de lo que recibe: `guardar` vuelve a normalizar con ids nuevos y valida con `letraSchema` (0083), así que el renderer puede usar cualquier `generarId` (p. ej. `crypto.randomUUID`). Rendimiento: el área admite hasta 512 KB; la conversión se calcula con `useDeferredValue` (o `useMemo` sobre el valor diferido) para no bloquear la escritura; sin *debounce* propio.
2. **Importar: dos llamadas, como ya está en el contrato.** `letras.leerArchivo()` lee y convierte sin escribir, y **su respuesta añade `ignoradas: number`** (entero ≥ 0; 0 para texto plano). La interfaz confirma la sustitución si hace falta (≥ 1 línea, `0022` §4) y luego llama a `letras.guardar({ origen: 'archivo', … })`. Si guarda, pasa `ignoradas` a la vista C para mostrar `let.importar.ignoradas` (estado local de la vista, no se persiste). Una sola llamada con la confirmación en medio obligaría a un diálogo desde el main o a un canal de ida y vuelta; no compensa.
   - **Afecta a 0077 (en curso)**: `archivoLetraLeidoSchema` (`shared/letrasBusqueda.ts`) y el tipo `ArchivoLetraLeido` de la rama `cancelado: false` deben incluir `ignoradas: z.number().int().nonnegative()`, y la API falsa del renderer debe devolverlo. Lo hace quien lleve 0077; si ya se cerró, lo añade 0083 (anotado en esa tarea).
3. **Aviso `let.edicion.marcas`: confirmado, solo renderer.** Expresión regular por renglón sobre el texto del área, p. ej. `/^\s*\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/m`. No usa `esLrc` (que decide si un texto *es* LRC; aquí basta con que un renglón empiece por una marca). Nada del main.

Tareas ajustadas: 0083 (devuelve `ignoradas`), 0085 (conversión y avisos en el renderer), 0086 (aviso de marcas e `ignoradas` recibido de la importación). Sin ADR nuevo: no cambia ninguna decisión, solo un campo del contrato.
