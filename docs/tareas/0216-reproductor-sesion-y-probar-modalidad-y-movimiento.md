# 0216 — Reproductor, sesión y «Probar»: modalidad, espera y movimiento

- Estado: Hecha
- Paso del pipeline: 5–6
- Depende de: [0203](0203-main-marcar-letra-lista-guardar-reemplazos-y-modalidad-en-la-sesion.md), [0213](0213-pantalla-de-letra-fondo-en-movimiento-indicadores-y-sin-barrido.md)
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §2 y §5, [0011](../adr/0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md#revisión-para-020--fase-5), [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §10
- Spec UX: [07 · Fase 5](../ux/07-reproductor.md#fase-5-de-020--estilo-espera-y-letra-lista) (R1–R4, R12, R13) y [06 · LL](../ux/06-editor.md#ll--letra-lista-feature-12) (LL8)

## Objetivo

Conectar la modalidad, la espera y el movimiento con las tres superficies de reproducción.

## Contrato

- **`Reproductor.tsx`**:
  - pasa `barrido = modalidad !== 'letra_lista'` a `PantallaLetra`, con la modalidad tomada **al empezar**:
    - reproductor local: del resumen o de `obtener` al abrir;
    - sesión: de la instantánea de la entrada activa (0203);
    - «Probar» desde el editor: de la canción del editor (LL8);
  - pasa el tiempo de audio que necesita el fondo (0213).
- **Secundaria**:
  - en S1, S2 y S4 (cuenta, espera y fallo), el fondo de la candidata en fase 0: `PantallaEstadoSesion` usa `fondoCss` sin geometría;
  - en S3 (fin de cola) y en la pantalla final, la fase del último instante: se conserva el último valor pintado;
  - el movimiento reducido se detecta en la ventana donde se ve.
- **Cambio de modalidad durante la reproducción**: no afecta a la reproducción en curso (R13).

## Archivos

`vistas/reproductor/{Reproductor,ReproductorBiblioteca,PantallaFinal}.tsx`, `vistas/reproductor/sesion/PantallaEstadoSesion.tsx`, el paso de la modalidad en «Probar a pantalla completa» (`Editor.tsx`, pocas líneas, o en el contexto `navegacion/reproductor.tsx`) y sus pruebas.

## Criterios de aceptación

- [ ] R1, R2, R3 y R4 en el reproductor y la secundaria.
- [ ] R12 (la vista previa del editor sigue con barrido) y R13.
- [ ] LL8.

## Pruebas de feedback

- Unitarias:
  - `Reproductor.test.tsx`: `barrido` según la modalidad en `local`, `sesion` y «Probar»; R13 con un cambio de modalidad a mitad;
  - pruebas de `PantallaEstadoSesion`: fondo en fase 0 en S1, S2 y S4.
- E2E: ninguna propia. R13 en la secundaria va en el E2E de 0219, que reutiliza las utilidades de `sesion-flujo`.
- Críticos: sí (el reproductor forma parte del flujo crítico).
- Manual (guía de la fase): que una Letra lista se lea bien sin barrido en una canción rápida, y el movimiento fluido en la secundaria con dos pantallas.

## Notas de implementación

- **Qué se hizo**:
  - `Reproductor.tsx`: `CancionReproductor.modalidad?` (por defecto `karaoke`); `barrido` se fija al montar con `useState` (R13: un cambio posterior no afecta a la reproducción en curso). `alAnunciarEspera` escribe `rep.espera.aria` (`R.espera.aria`, en `textos.ts`) en la región `aria-live` existente. La pantalla final deja `--k-fondo` en la fase del último instante (fase 0 con movimiento reducido).
  - Orígenes de la modalidad: local (`modalidadEfectiva(cancion)` de `obtener` en `ReproductorBiblioteca`), sesión (`activa.entrada.modalidad` en `AppSecundaria`) y «Probar» (`resumen.modalidad` en `Editor.tsx`, una línea; LL8). La vista previa del editor no pasa `barrido` (siempre con barrido, R12).
  - Secundaria: S1, S2 y S4 ya usaban `variablesEstilo` (= `fondoCss` sin geometría, fase 0), así que no hizo falta `fondoEstatico`; no usan `PantallaLetra`. S3 conserva la fase del último instante: `AppSecundaria` guarda la última posición informada y `PantallaEstadoSesion` pinta `fondoCssEn(fondo, posicionFinalMs)`. El movimiento reducido se lee con `useMovimientoReducido` en la ventana donde se ve.
- **Pruebas**: `Reproductor.modalidad.test.tsx` (barrido por origen, R13, anuncio de espera) y dos casos nuevos en `AppSecundaria.test.tsx` (R4 y S3).
- **Manual**: que una Letra lista se lea bien sin barrido en una canción rápida; el movimiento fluido en la secundaria con dos pantallas; R13 completo en la secundaria (Lista ⇄ Letra lista durante la reproducción) va en el E2E de 0219; el anuncio `rep.espera.aria` con un lector de pantalla.
- **Deuda**: la fase final de la pantalla final local se lee de `motor.posicionMs()` durante el render (es estable tras el fin); sin prueba de captura de píxeles (R1/R12 por captura quedan para 0218/0219).
