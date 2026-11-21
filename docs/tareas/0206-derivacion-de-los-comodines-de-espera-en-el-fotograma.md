# 0206 — Derivación de los comodines de espera en el fotograma

- Estado: Pendiente
- Paso del pipeline: 4–6
- Depende de: [0200](0200-esquema-del-estilo-ampliado-y-normalizacion.md)
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §3, [0005](../adr/0005-letras-y-formato-de-sincronia.md#revisión-para-020--fase-5), [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md) §4
- Spec UX: no aplica al modelo. Los indicadores nuevos (barra y cuenta) se pintan en 0213 con la spec.

## Objetivo

Calcular en el modelo puro del render qué ayudas de espera tocan en cada instante, a partir del intervalo real y de la configuración de espera del estilo resuelto, conservando exactamente los puntos del MVP con `ESPERA_LEGADA`.

## Contrato

- **`ContextoRender`** añade `espera: Espera`, la del estilo resuelto normalizado. Si falta, vale `ESPERA_LEGADA`.
- **`FotogramaLetra`** sustituye `puntos` por:

  ```ts
  espera: {
    origenMs, destinoMs, restanteMs, fraccion, primera: boolean,
    puntos: 0 | 1 | 2 | 3,       // 0 si la casilla está desactivada o restante > 3000
    cuenta: 1 | 2 | 3 | null,    // null si la casilla está desactivada o restante > 3000
    barra: boolean,              // casilla activada
    clave: string                // cambia al empezar la espera y en cada dígito
  } | null
  ```

- **Reglas**, todas en tiempo de letra y con el mismo `t` que el resto del fotograma:
  - **primera entrada**: si `primera_entrada`, desde `inicio₁ − UMBRAL_PRIMERA_ENTRADA_MS` (cuando acaba el título) hasta `inicio₁`, sin umbral;
  - **entre versos**: `[finEfectivo(anterior), inicio(siguiente))` sobre las líneas con inicio, solo si `hueco ≥ umbral_ms` y no hay línea activa;
  - **sin siguiente**: `null`;
  - **puntos y cuenta**: `ceil(restante / 1000)` cuando `restante ≤ CUENTA_MS`;
  - **barra**: `fraccion = clamp((t − origen) / (destino − origen), 0, 1)`.

  Con `ninguna casilla activa`, el resultado es `null`.
- **`fotogramaEstatico`**: `espera: null`.
- **Adaptación mínima de `PantallaLetra.tsx`**: pinta los puntos a partir de `fotograma.espera?.puntos` con el mismo marcado de hoy. **No** añade barra ni cuenta, que corresponden a 0213. Lo que dependa de `f.puntos` (por ejemplo, `claveTransicion`) pasa a usar `espera?.clave`.

## Archivos

`app/src/renderer/src/karaoke/render.ts`, el cambio mínimo de `PantallaLetra.tsx` y sus pruebas. Si otro sitio construye el contexto del render (editor, reproductor o secundaria), se le pasa `espera` del estilo que ya tiene.

## Criterios de aceptación

- [ ] Con `ESPERA_LEGADA`, una batería de instantes (antes del título, primera entrada, hueco de 3,9 s, hueco de 4 s, hueco de 10 s y última línea) da los **mismos** puntos que el `render.ts` actual. Esto se compara con una tabla tomada del comportamiento previo.
- [ ] Con la cuenta y la barra en un hueco de 10 s: barra 0,5 a mitad y 1 en el inicio siguiente, y cuenta 3, 2 y 1 en los últimos 3 s.
- [ ] Con un hueco de 2 s (umbral 1000) la cuenta empieza en 2.
- [ ] Sin siguiente no hay espera. Con `primera_entrada: false` no hay espera inicial.
- [ ] Mismo `t` tras buscar, igual fotograma.
- [ ] Las pruebas existentes de `render.test.ts` y `PantallaLetra.test.tsx` pasan, adaptadas solo en el nombre del campo.

## Pruebas de feedback

- Unitarias: `render.test.ts` y `PantallaLetra.test.tsx`.
- E2E: ninguna. El E2E `reproductor.spec.ts` existente lo ejecuta el CI.
- Críticos: sí (el render forma parte del flujo principal del reproductor).
- Manual: nada.

## Notas de implementación
