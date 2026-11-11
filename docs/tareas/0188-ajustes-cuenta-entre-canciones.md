# 0188 — Ajustes › Reproductor: cuenta entre canciones

- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: [0177](0177-contratos-compartidos-de-sesion-cola-y-roles.md)
- ADRs: [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §12, [0006](../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-020--fase-4)
- Spec UX: [Ajustes · Fase 4](../ux/08-ajustes-y-acerca.md#fase-4-de-020--ventana-secundaria-y-cola) (AR1–AR4)

## Objetivo

Añadir la sección «Reproductor», entre «Temas» y «Acerca de», con el selector «Cuenta entre canciones».

## Contrato

- El selector nativo ofrece 2, 3, 4 (predeterminado), 5, 8, 10 y 15 s. Lee `config.reproductor.transicion_s`.
- Un valor válido (de 1 a 30) que no está en la lista se añade como opción «{n} s».
- Se guarda al elegir con `config.actualizar({ reproductor: { transicion_s } })`. Si falla, vuelve al valor anterior y muestra el toast `aj.rep.toast.error` con [Copiar detalles].
- La etiqueta y la ayuda van asociadas al selector (`aria-describedby`).

## Archivos

`app/src/renderer/src/vistas/ajustes/**` (sección nueva y sus textos) y sus pruebas.

## Criterios de aceptación

- [ ] AR1–AR3 en Vitest. AR2 en la parte de main (la siguiente cuenta dura 10 s) se verifica en [0190](0190-verificacion-e2e-capturas-e-informe-de-la-fase-4.md).
- [ ] Un `config.json` con `transicion_s: 7` muestra la opción «7 s» seleccionada. Con un valor no válido, ya leído como 4 por el esquema, muestra «4 s (predeterminado)».

## Notas de implementación
