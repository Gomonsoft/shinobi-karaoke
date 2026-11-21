# 0201 — Contratos de canción, apariencia, configuración e IPC de la fase 5

- Estado: Hecha
- Paso del pipeline: 4–6
- Depende de: [0200](0200-esquema-del-estilo-ampliado-y-normalizacion.md)
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §3, §5 y §7, [0006](../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-020--fase-5), [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md#revisión-para-020--fase-5), [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §10–§11
- Spec UX: no aplica (sin interfaz)

## Objetivo

Fijar en `shared/` y en el preload el contrato de datos e IPC de la fase 5, para que main (0202, 0203) y renderer (0204–0209) avancen en paralelo contra dobles. **Es la única tarea de la fase que modifica `shared/ipc.ts`, `shared/cancion.ts`, `shared/config.ts`, `shared/sesion.ts`, `shared/derivados.ts`, `aparienciaSchema` de `shared/temas.ts` y `preload/`.** No implementa la lógica de main.

## Contrato

- **`shared/cancion.ts`**:
  - `modalidad?: 'karaoke' | 'letra_lista'` (`MODALIDADES`);
  - helper `modalidadEfectiva(cancion)`, que devuelve `'letra_lista'` solo si `estado === 'lista'` y `modalidad === 'letra_lista'`, y `'karaoke'` en cualquier otro caso.
- **`aparienciaSchema`** (`shared/temas.ts`):
  - `reemplazos?: { espera?: Espera }`, como objeto estricto con lista blanca;
  - `superRefine` rechaza `reemplazos` con `modo: 'propio'`.
- **`shared/derivados.ts`**:
  - `motivosParaNoEstarLetraLista(cancion)`, que suma a los motivos de Lista el código `FIN_NO_VALIDO` (con `lineas`) para cada línea con inicio cuyo `finEfectivo` no cumpla `inicio < fin ≤ inicio del siguiente elemento con inicio`;
  - `puedeMarcarseLetraLista`;
  - `CodigoMotivo` añade `FIN_NO_VALIDO`.
- **`shared/config.ts`**:
  - `editor.omitir_aviso_letra_lista: boolean` con `.catch(false)`, con la misma lectura tolerante que `editor.paneles`;
  - `configParcialRendererSchema` lo admite como booleano estricto.
- **`shared/ipc.ts`**:
  - `biblioteca.marcarLista` pasa a `args: [idCancion, { modalidad }?]`, como objeto estricto opcional;
  - `seleccionAparienciaSchema` añade `reemplazos?: { espera?: Espera } | null` en los modos `tema` y `heredar`, con esta semántica: ausente conserva, `null` quita y un objeto sustituye (ADR 0018 §3);
  - `resumenCancionSchema` añade `modalidad` (efectiva) y `apariencia.procedenciaEspera`;
  - `resueltaSchema` añade `procedenciaEspera`;
  - `ApiShinobi.biblioteca.marcarLista(id, opciones?)`.
- **`shared/sesion.ts`**: el DTO de la entrada activa (el que ya lleva `letra` y `estilo`) añade `modalidad`.
- **`preload/index.ts`**: `marcarLista(id, opciones)` reenvía el segundo argumento.
- **Dobles**: `shared/__fixtures__/` con un constructor de resumen y de entrada de sesión que admiten `modalidad` y `procedenciaEspera`, con valores por defecto `karaoke` y la procedencia del estilo.

## Archivos

Los de «Objetivo» y sus pruebas. Si falta una función de main al compilar, se deja un _stub_ que lanza un error, documentado en las notas para 0203.

## Criterios de aceptación

- [ ] Una canción sin `modalidad` se valida y `modalidadEfectiva` da `karaoke`. Con `estado: 'borrador'` y `modalidad: 'letra_lista'` también da `karaoke`.
- [ ] `aparienciaSchema` acepta `reemplazos.espera` con `tema` y `heredar`, y lo rechaza con `propio` y con claves fuera de la lista blanca.
- [ ] `motivosParaNoEstarLetraLista`:
  - una letra de API con fines automáticos y de palabras no da motivos;
  - una línea sin inicio da `LINEAS_SIN_INICIO`, con su número.
- [ ] Un `config.json` con `omitir_aviso_letra_lista: "x"` se lee como `false` sin apartar el archivo. `configParcialRendererSchema` rechaza `"x"`.
- [ ] `marcarLista` acepta `[id]` y `[id, { modalidad: 'letra_lista' }]`, y rechaza modalidades desconocidas y claves extra.
- [ ] `npm run typecheck` pasa con los cambios de esquema.

## Pruebas de feedback

- Unitarias: `cancion.test.ts`, `temas.test.ts` (solo el esquema), `derivados.test.ts`, `config.test.ts` y una prueba de contrato de `ipc.ts` para `marcarLista` y `guardarApariencia`.
- E2E: ninguna.
- Críticos: sí (toca `shared/` y `preload/`).
- Manual: nada.

## Notas de implementación

- **Qué se hizo**: `modalidad`/`modalidadEfectiva`/`MODALIDADES` en `shared/cancion.ts`; `reemplazosSchema` y su regla `propio` en `aparienciaSchema`; `motivosParaNoEstarLetraLista`, `puedeMarcarseLetraLista` y `FIN_NO_VALIDO` en `derivados.ts`; `editor.omitir_aviso_letra_lista` (tolerante en `configSchema`, estricto y opcional en `configParcialRendererSchema`; `editor.paneles` pasa a opcional en el parcial para poder escribir solo el aviso); `marcarLista(id, opciones?)` (`opcionesMarcarListaSchema`), `reemplazos` en `seleccionAparienciaSchema` (modos `tema` y `heredar`), `modalidad` y `apariencia.procedenciaEspera` en el resumen, `procedenciaEspera` en `resuelta`; `modalidad` en `entradaCargarIpcSchema` (sesión); preload reenvía `opciones`.
- **Dobles**: `shared/__fixtures__/fase5.ts` (`resumenDePrueba`, `entradaCargarDePrueba`). Se ajustaron los dobles existentes del renderer (`resumenPrueba.ts`, `fixturesApi.ts` de editor y letra, `AppSecundaria.test.tsx`) solo con los valores por defecto para que compile.
- **Stubs para 0202/0203**: `main/biblioteca/resumen.ts` pone `procedenciaEspera = procedencia` (provisional, lo sustituye 0202). `modalidad` del resumen y de la entrada de sesión ya usa `modalidadEfectiva` (0203 solo añade pruebas). `ServicioBiblioteca.marcarLista` aún ignora `opciones` (0203): el manejador del IPC no se ha tocado.
- **Pruebas**: `shared/fase5.test.ts` (modalidad, reemplazos, motivos, config, contrato IPC y dobles).
- **Deuda**: ninguna.
