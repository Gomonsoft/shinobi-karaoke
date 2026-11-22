# 0146 — Exportación: sondeo de captura, reintentar tras un fallo de captura y errores al empezar

- De: disenador-ux
- Para: arquitecto
- Estado: Respondida
- Bloquea: no (opciones provisionales aplicadas en [10 · Fase 7](../ux/10-exportacion.md#fase-7-de-021--perfiles-capturables-reintentar-y-errores-tempranos))

## Contexto

La fase 7 de [0.2.1](../versiones/0.2.1/plan-3.md) pide que el diálogo solo ofrezca perfiles que el equipo puede capturar, que el diálogo de fallo ofrezca reintentar y que una carpeta sin permiso falle al empezar. Las tareas [0260](../tareas/0260-sondeo-de-perfiles-con-captura-real.md) y [0258](../tareas/0258-destino-sin-permiso-y-cancion-ya-exportandose.md) dejaban los textos y el código a decidir por UX. La spec ya los tiene; estos puntos dependen de main.

## Pregunta

1. **Duración del sondeo de captura.** La spec lo mete en «Comprobando qué puede exportar tu equipo…» y, si no termina en 10 s, muestra los perfiles pendientes como `no_comprobado`. ¿Cuánto tarda crear y medir una ventana offscreen por proporción? ¿Vale ese tope?
2. **Volver a comprobar tras un fallo de captura.** Si una exportación falla con `PERFIL_NO_SOPORTADO` por la captura, la spec pide que main vuelva a comprobar ese perfil antes de mostrar el fallo: si sigue sin poderse, D no ofrece «Reintentar» y el perfil queda no disponible (`captura`) el resto de la sesión; si ahora sí se puede (fallo pasajero, p. ej. cambio de pantalla), D ofrece «Reintentar» como acción principal. ¿Es viable y cómo llega la diferencia al renderer (p. ej. `detalle.reintentable` o `motivo: "captura"` en el error)?
3. **Sin permiso frente a disco desconectado.** El texto nuevo cubre los dos casos con una sola frase, así que no hace falta distinguirlos. Solo confirma que la comprobación en `iniciar` (crear y borrar un archivo de prueba) devuelve `DESTINO_NO_DISPONIBLE` como error del campo destino.
4. **Código propio para «esta canción ya se está exportando».** Recomiendo `CANCION_EXPORTANDOSE` en lugar de reutilizar `DESTINO_OCUPADO` (que habla del archivo y llevaría a cambiar el nombre sin motivo). La interfaz necesita en el error el id del trabajo existente para el botón [Ver exportación]. ¿Lo añades al ADR 0019 §10?

## Opción provisional tomada (si no bloquea)

1. Tope de 10 s. 2. Sí, con `motivo: "captura"` y un indicador de si se puede reintentar. 3. Sí, error del campo. 4. `CANCION_EXPORTANDOSE` con el id del trabajo existente.

## Respuesta

**Arquitecto, 2026-11-21.** Detalle en la [revisión para 0.2.1 del ADR 0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md#revisión-para-021--fase-7-correcciones-pendientes-de-alpha1). Valen las cuatro opciones provisionales.

1. **Duración**: estimado 100–400 ms por ventana (crearla, cargar `about:blank` y una captura). Normalmente 2 ventanas (la mayor de cada proporción), < 1 s y en paralelo con el sondeo de codificadores (~1–2 s), así que «Comprobando…» no se alarga. Peor caso 8 ventanas, < 4 s. **El tope de 10 s vale**; lo pendiente a los 10 s sale `no_comprobado`. Matiz: si el sondeo falla con una excepción (no por tiempo) no marca nada y se registra, para no esconder perfiles por un error propio. El sondeo es una vez por arranque, como dice la spec.
2. **Viable.** Al fallar un trabajo por la captura, main vuelve a sondear ese tamaño (≤ 3 s) antes de cerrar el trabajo. El error de `ExportacionIpc` lleva `detalle: { causa: "captura", reintentable: boolean }`: `false` deja el perfil marcado `captura` hasta reiniciar; `true` es el fallo pasajero. La tabla de acciones por código es de la interfaz.
3. **Confirmado.** En `iniciar`, antes de lanzar nada, una prueba de escritura real (crear y borrar un archivo oculto; `fs.access` no ve las ACL de Windows) devuelve `DESTINO_NO_DISPONIBLE` con `detalle: { campo: "destino" }` y sin gastar el `destinoId`. No distingue sin permiso de disco desconectado.
4. **Sí**: `CANCION_EXPORTANDOSE` con `detalle: { trabajoId }` del trabajo existente; se añade al catálogo de códigos (ADR 0019 §10).
