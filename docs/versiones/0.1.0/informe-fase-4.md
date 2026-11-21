# Informe de la Fase 4 — Letras

Fecha: 2026-11-05. Rama: `fase-4-letras` (sale de `fase-3-separacion`, commit `f26e582`).

## Cómo revisarlo
```bash
git checkout fase-4-letras
cd app && npm install && npm run semilla && npm run dev   # 15 canciones de ejemplo, letras inventadas
export SHINOBI_UV=$(which uv)
npm run lint && npm run typecheck && npm run format:check && npm test
npm run build && npx playwright test
# Opcional, con red real a LRCLIB:
SHINOBI_TESTS_RED=1 npx vitest run src/main/letras/lrclib.red.test.ts
```

## Verificación final (17:22, sesión principal)
| Comprobación | Resultado |
|---|---|
| lint / typecheck / format:check | OK |
| Vitest | **1526 pasan**, 12 omitidos (incluye pruebas con red) |
| Playwright | **69 pasan**, 2 omitidos (YouTube y LRCLIB con red) |
| Worker pytest | **312 pasan** |

## Qué se hizo (tareas 0077–0089, todas Hechas)
- **Contratos** (0077): API `letras.*`, error `ARCHIVO_SIN_LETRA`, regla del paso Letra (≥1 línea), `SHINOBI_LRCLIB_URL` solo sin empaquetar.
- **Conversores** (0078–0080): texto plano, LRC, LRC mejorado, normalización y exportación; edición del texto conservando la sincronía (diff LCS); Lyricsfile de LRCLIB con `yaml` (solo en main).
- **LRCLIB** (0081, 0082): cliente con User-Agent del proyecto sin datos personales, peticiones en serie con 250 ms, respeto de `Retry-After`, 10 s máximos; búsqueda get + search, Lyricsfile > LRC > texto, orden por sincronía y duración, instrumental, caché de 10 min, cancelación.
- **Guardar e importar** (0083): único escritor del campo `letra` de `cancion.json`, `.lrc`/`.txt` con UTF-8/UTF-16/Windows-1252, renglones ignorados.
- **Vista Letra** (0084–0086): búsqueda con resultados y vista previa, pegar, importar con confirmación de sustitución, letra actual con edición y autoguardado.
- **Integración** (0087): stepper con motivos definitivos, Progreso, "Continuar", Biblioteca, semilla con 15 canciones.
- **E2E** (0088): 8 escenarios con un doble HTTP de LRCLIB local, sin red. **Prueba opcional con LRCLIB real** (0089) en Vitest y E2E, también como paso opcional de `runtime-real`.

## Licencias y privacidad
LRCLIB no declara licencia de las letras: uso personal, sin redistribución, atribución "Letra: LRCLIB" (ADR 0005). Fixtures y E2E usan solo letras inventadas; las pruebas con red solo comprueban estructura y no guardan ni imprimen letras.

## Pendiente
- **Pregunta 0024 (para UX, no bloquea)**: ✓ de Letra en el stepper estando en la vista de Letra, y cómo volver a Letra desde el Editor (afecta a la Fase 5).
- **Texto sin spec**: la 0085 añadió "El texto es demasiado largo (máximo 512 KB)." al pegar; revisar con UX.
- Siguen pendientes de GitHub las tareas 0058 y 0062 de la Fase 3 (`runtime-real`).
