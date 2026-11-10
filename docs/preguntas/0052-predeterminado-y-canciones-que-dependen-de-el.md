# 0052 — ¿Qué pasa con las canciones que dependen del tema predeterminado cuando lo cambias?

- De: disenador-ux
- Para: usuario
- Estado: Respondida
- Bloquea: no (se sigue con la recomendación, marcada como provisional en las specs)

## Contexto

En [0047](0047-temas-asignados-edicion-y-borrado.md) decidiste que el tema predeterminado se elige en Ajustes y que, si se borra, cada canción nueva recibe un tema al azar del catálogo, fijo al reabrirla. Al borrar un tema, sus canciones conservan su aspecto como «Tema personalizado». Queda sin decidir qué pasa cuando **cambias** el predeterminado sin borrar nada. Hay tres grupos de canciones:

1. Las que **siguen al predeterminado** (se crearon con predeterminado y no tienen tema de canción, álbum ni artista).
2. Las que recibieron un **tema al azar** al crearse, porque no había predeterminado.
3. Las que recibieron el **estilo incluido** porque no tenías ningún tema.

Ninguna regla toca las canciones con tema personalizado ni las que tienen tema de canción, álbum o artista.

Ver [Ajustes · Fase 3](../ux/08-ajustes-y-acerca.md#fase-3-de-020--temas-y-biblioteca), [Editor · Fase 3](../ux/06-editor.md#conceptos-y-procedencia) y el [ADR 0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §3 y §6.

## Preguntas

**A. Cambias el predeterminado de «Noche ninja» a «Neón».** ¿Las canciones del grupo 1 pasan a «Neón»?
- A1. Sí, tras una confirmación que dice cuántas cambiarán (como al guardar un tema).
- A2. No, se quedan con «Noche ninja» y solo las nuevas usan «Neón».

**B. Quitas el predeterminado** (eliges «Ninguno · un tema al azar para cada canción nueva»). ¿Qué pasa con el grupo 1?
- B1. Conservan «Noche ninja» (sin cambio visible) y siguen vinculadas a ese tema.
- B2. Pasan al estilo incluido de Shinobi Karaoke, tras una confirmación.
- B3. Cada una recibe un tema al azar, tras una confirmación.

**C. Eliges un predeterminado nuevo.** ¿Las canciones de los grupos 2 y 3 lo adoptan?
- C1. No: conservan el tema al azar o el estilo incluido que recibieron al crearse.
- C2. Sí, tras una confirmación.

## Recomendación de UX

**A1, B1 y C1.**
- A1 es lo que el plan ya llama «resolución: canción, álbum, artista, predeterminado»: el predeterminado es un vínculo vivo más, y la confirmación de impacto evita sorpresas.
- B1 evita que el aspecto de muchas canciones cambie por una opción que se refiere a «canciones nuevas». Tampoco las convierte en personalizadas: si luego editas «Noche ninja», cambian con él.
- C1 respeta tu indicación de que la elección al azar sea estable. Para cambiar esas canciones de golpe ya existe «Aplicar tema…» en la Biblioteca.

## Opción provisional tomada (si no bloquea)

A1, B1 y C1. El ADR 0016 coincide en A1 y C1. Para B1 el ADR aún resuelve como B2 (estilo incluido); el arquitecto debe fijar la base de esas canciones al quitar el predeterminado si se confirma B1. Mientras tanto, la confirmación muestra el impacto real que calcula la app.

## Respuesta

A1, B1 y C1 (respuesta del usuario en la sesión principal, 2026-11-09):

- A1. Al cambiar el predeterminado, las canciones que lo siguen pasan al nuevo tras una confirmación con el recuento.
- B1. Al quitar el predeterminado, esas canciones conservan el tema que tenían y siguen vinculadas a él.
- C1. Un predeterminado nuevo no cambia las canciones que recibieron un tema al azar o el estilo incluido.

**Nota del arquitecto (2026-11-09).** Recogido en el [ADR 0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §3, §6 y §7. Para B1, la misma operación confirmada que quita el predeterminado fija en cada canción que lo seguía `base: { tipo: "predeterminado_anterior", tema_id }` y después escribe el catálogo. Su procedencia es `predeterminado_anterior` («Tema predeterminado anterior»). Los textos que faltan en el editor y en la tarjeta se piden en [0055](0055-textos-de-predeterminado-anterior-y-ajustes-de-la-fase-3.md).
