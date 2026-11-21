# 0214 — Editor: «Marcar como letra lista», aviso, insignia y cambio de modalidad

- Estado: Hecha
- Paso del pipeline: 4
- Depende de: [0201](0201-contratos-de-cancion-apariencia-config-e-ipc-de-la-fase-5.md), [0203](0203-main-marcar-letra-lista-guardar-reemplazos-y-modalidad-en-la-sesion.md)
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §4 y §5
- Spec UX: [06 · LL · Letra lista](../ux/06-editor.md#ll--letra-lista-feature-12) (LL1–LL7) y [mapa](../ux/00-mapa-de-vistas.md)

## Objetivo

Marcar una canción como Letra lista desde el editor, con el aviso de la primera activación, cambiar de modalidad desde el menú ⋯ y mostrar los avisos de contraste según la modalidad.

## Contrato

- **Dock, fila 2**: botón secundario «Marcar como letra lista» a la izquierda de «Marcar como lista», con la misma lógica de `BotonLista`.
  - Cuando no se puede marcar, `aria-disabled` y el popover `edi.falta.titulo.letra` con los motivos de `motivosParaNoEstarLetraLista`, incluido «Ir a la primera».
  - Al confirmar:
    1. se vacía el guardado;
    2. se llama a `biblioteca.marcarLista(id, { modalidad: 'letra_lista' })`;
    3. se vuelve a la Biblioteca como con «Marcar como lista», pasando que la modalidad es Letra lista para que la Biblioteca muestre `bib.toast.letraLista` (en [0217](0217-biblioteca-insignia-letra-lista.md)).
- **Diálogo de la primera activación**: aparece si `config.editor.omitir_aviso_letra_lista` es `false`.
  - El foco inicial va al botón de confirmar.
  - Cancelar no escribe nada y devuelve el foco.
  - Confirmar con la casilla marcada escribe `config.actualizar({ editor: { omitir_aviso_letra_lista: true } })`. Si esa escritura falla, se marca igualmente la canción y se registra el error, sin bloquear.
- **Cabecera**: insignias `✓ Letra lista` y `edi.letraLista.incompleta`.
- **Menú ⋯ de la cabecera**:
  - en una Lista, «Cambiar a «Letra lista»…», con el aviso si no está omitido;
  - en una Letra lista, «Cambiar a «Lista»»;
  - los dos usan `marcarLista` con la modalidad nueva, sin salir del editor y sin entrar en el historial, con los toasts `edi.letraLista.toast.*` y su anuncio.
- **Contraste en Letra lista** (LL7): los avisos `resaltado` y `diferencia` de `evaluarContraste` se presentan como informativos con `edi.contraste.soloEditor` y no encienden el punto de la pestaña. En D3 se mantienen como aviso. La evaluación no cambia.
- La vista previa del editor **siempre** con barrido.
- **Textos**: las claves `edi.letraLista.*`, `edi.falta.titulo.letra` y `edi.contraste.soloEditor`.

## Archivos

`vistas/editor/BotonLista.tsx` (o un `BotonLetraLista.tsx` nuevo que comparta lógica), `vistas/editor/DialogoLetraLista.tsx` (nuevo), la cabecera y el menú ⋯ en `Editor.tsx`, la presentación del aviso en `PanelEstilo.tsx` (solo el aviso de contraste), los textos y sus pruebas.

## Criterios de aceptación

- [ ] LL1–LL7. LL3 «tras reiniciar» se cubre con la prueba de `config` de 0201 y en la guía manual.
- [ ] LL4, en su parte de la Biblioteca, con 0217.
- [ ] La fila del dock no se parte a 1024 × 576 ni a 1280 × 720 (LL1). Se comprueba en el E2E de 0219 o con capturas de 0218.

## Pruebas de feedback

- Unitarias:
  - `BotonLista.test.tsx` o `BotonLetraLista.test.tsx`: motivos, popover y llamada con la modalidad;
  - `DialogoLetraLista.test.tsx`: cancelar sin escribir, y confirmar con y sin la casilla;
  - `Editor.test.tsx`: menú ⋯ con los dos cambios sin historial, insignias e incompleta;
  - prueba de la presentación del contraste (LL7).
- E2E: ninguna propia. El flujo completo (marcar → Biblioteca → reproducir sin barrido) va en el E2E de 0219.
- Críticos: sí (toca el dock de «Marcar como lista», que es parte del flujo crítico).
- Manual (guía de la fase): que el aviso se entienda a la primera.

## Notas de implementación

- **Qué se hizo**:
  - `BotonLetraLista.tsx` (nuevo): botón secundario a la izquierda de «Marcar como lista», solo en borrador. Popover `edi.falta.titulo.letra` con los renglones de siempre más `FIN_NO_VALIDO` (de `motivosParaNoEstarLetraLista`). Al confirmar: vaciar → `marcarLista(id, { modalidad: 'letra_lista' })` → Biblioteca, con el toast de `mensajeListaMarcada` (0217).
  - `BotonLista.tsx`: se extrae `RenglonesFaltas` (compartido) y se exporta `avisarError`.
  - `DialogoLetraLista.tsx` (nuevo): foco inicial en confirmar, Cancelar no escribe; confirmar con la casilla escribe `editor.omitir_aviso_letra_lista` (si falla, se registra y se sigue).
  - `Editor.tsx`: ítems del ⋯ «Cambiar a «Letra lista»…» / «Cambiar a «Lista»» (`cambiarModalidad`, sin historial, toast + anuncio), estado local del aviso omitido y punto de la pestaña sin los avisos informativos.
  - `CabeceraCancion.tsx`: insignia `✓ Letra lista` (la insignia ya existía por 0217; «Falta/Faltan n líneas» se mantiene tal cual).
  - `PanelEstilo.tsx`: prop `soloEditor`; `resaltado` y `diferencia` pasan a `info` con `edi.contraste.soloEditor` salvo en D3.
  - Textos en `textosLetraLista.ts` (archivo propio para no chocar con `textos.ts` de 0212/0215). `fixturesApi.ts`: el doble de `marcarLista` acepta modalidad y `config.actualizar` guarda la casilla.
- **Archivos de pruebas**: `BotonLetraLista.test.tsx`, `Editor.test.tsx` (cambio por el ⋯), `PanelEstilo.test.tsx` (LL7).
- **Cómo probarlo**: borrador completo → «Marcar como letra lista» (aviso, casilla, Biblioteca con su toast); en una Lista, ⋯ → «Cambiar a «Letra lista»…».
- **Manual**: que el aviso se entienda a la primera; LL1 (la fila del dock no se parte a 1024 × 576 ni 1280 × 720) y LL3 tras reiniciar; con sesión en vivo el cambio responde `EDICION_BLOQUEADA` y se muestra el toast de error genérico.
- **Deuda**: el E2E crítico solo corre con la sandbox desactivada (necesita red/uv).
