# 0200 — Esquema del estilo ampliado, espera y normalización

- Estado: Hecha
- Paso del pipeline: 4–6
- Depende de: fase 4 integrada en `alpha-2`
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §1 y §3, [0006](../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-020--fase-5), [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md#revisión-para-020--fase-5)
- Spec UX: no aplica (sin interfaz)

## Objetivo

Ampliar el esquema del estilo con campos **opcionales**, sin subir `estilo.version` ni ningún `esquema`, y dar a toda la fase una forma normalizada para leer y comparar estilos. Es la base de 0201–0207.

## Contrato

- **`shared/espera.ts`** (nuevo):
  - `esperaSchema` con `{ puntos, barra, cuenta, primera_entrada }` booleanos y `umbral_ms` entero de 1000 a 60 000;
  - tipo `Espera`;
  - `ESPERA_LEGADA = { puntos: true, barra: false, cuenta: false, primera_entrada: true, umbral_ms: 4000 }`;
  - `CUENTA_MS = 3000`;
  - `UMBRAL_PRIMERA_ENTRADA_MS = 4000`, que es el instante en que desaparece el título.
- **`shared/estilo.ts`**, en el fondo `degradado`:
  - `forma?: 'lineal' | 'radial' | 'conico'`;
  - `centro?: { x, y }`, cada uno en [0, 1];
  - `movimiento?: { periodo_s: entero de 10 a 120, sentido: 'horario' | 'antihorario' } | null`;
  - `angulo_grados` y `paradas` siguen obligatorios y con las mismas reglas;
  - el fondo `solido` no admite `movimiento`. Como la unión es estricta en `tipo`, basta con no declararlo en el sólido y que la prueba lo confirme.

  En el estilo se añade `espera?: Espera`. Se exportan las constantes `PERIODO_MIN_S`, `PERIODO_MAX_S` y `AMPLITUD_ORBITA = 0.1`.

- **`normalizarEstilo(estilo): EstiloNormalizado`** es una función pura que rellena `forma: 'lineal'`, `centro: { x: 0.5, y: 0.5 }`, `movimiento: null` (solo en el degradado) y `espera: ESPERA_LEGADA`. No modifica la entrada y **no se usa para escribir**.
- **`estilosIguales`** (`shared/temas.ts`) compara `canonico(normalizarEstilo(a))` con el de `b`. Es el único cambio de esta tarea en `temas.ts`.
- **`ESTILO_PREDETERMINADO` no cambia.**
- **Copia congelada del esquema de 0.1.0** en `shared/__fixtures__/estilo-0.1.0.ts`: el `estiloSchema` de la etiqueta `v0.1.0` copiado tal cual, con un comentario de procedencia, para probar la compatibilidad.

## Archivos

`app/src/shared/estilo.ts`, `app/src/shared/espera.ts` (nuevo), la función `estilosIguales` de `app/src/shared/temas.ts`, `app/src/shared/__fixtures__/estilo-0.1.0.ts` (nuevo) y sus pruebas.

## Criterios de aceptación

- [ ] Un estilo de 0.1.0 (sin campos nuevos) se valida igual que antes y `normalizarEstilo` lo deja como lineal estático con `ESPERA_LEGADA`.
- [ ] Un estilo cónico con centro, movimiento y espera se valida con el esquema nuevo. Con la **copia de 0.1.0** también se valida, y el resultado conserva `angulo_grados` y `paradas` sin los campos nuevos.
- [ ] Se rechazan `periodo_s` fuera de 10–120, `centro` fuera de [0, 1], `umbral_ms` fuera de 1000–60 000 y `movimiento` en un fondo sólido.
- [ ] `estilosIguales(sinEspera, conEsperaLegadaExplicita)` es `true`. Las pruebas existentes de `esAparienciaNeutra` y de `catalogoInicial` («Shinobi»/«Mi estilo») siguen pasando.

## Pruebas de feedback

- Unitarias: `estilo.test.ts` (validación, normalización y compatibilidad con la copia de 0.1.0), `espera.test.ts` (esquema y constante) y `temas.test.ts` (solo `estilosIguales`).
- E2E: ninguna.
- Críticos: sí (toca `shared/`).
- Manual: nada.

## Notas de implementación

**Qué se hizo.** `shared/espera.ts` (esquema, `ESPERA_LEGADA`, `CUENTA_MS`, `UMBRAL_PRIMERA_ENTRADA_MS`); en `shared/estilo.ts`, los campos opcionales `forma`, `centro` y `movimiento` del degradado, `espera?` en el estilo, `PERIODO_MIN_S`/`PERIODO_MAX_S`/`AMPLITUD_ORBITA` y `normalizarEstilo` (pura, con `structuredClone`); `estilosIguales` compara estilos normalizados. `ESTILO_PREDETERMINADO` y las versiones no cambian.

**Archivos.** `app/src/shared/{espera.ts,estilo.ts,temas.ts}`, `app/src/shared/__fixtures__/estilo-0.1.0.ts` y las pruebas `espera.test.ts`, `estilo.test.ts`, `temas.test.ts`.

**Cómo probarlo.** `npm run test:cambios`; sin interfaz, nada manual.

**Desviaciones y deuda.**

- La etiqueta `v0.1.0` no existe en este clon. La copia congelada se tomó de `estilo.ts` tal como estaba, sin cambios desde la tarea 0006, y así consta en su comentario de procedencia.
- `fondoSolido` pasa a `z.strictObject`: con un objeto normal Zod descartaría `movimiento` en silencio y el sólido no lo «rechazaría». Efecto: un sólido con claves desconocidas deja de validar (antes se descartaban). Si molestase, avisar al arquitecto.
