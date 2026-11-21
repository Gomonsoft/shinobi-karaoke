# 0202 — Resolución de la apariencia con reemplazos de espera

- Estado: Pendiente
- Paso del pipeline: 4–6
- Depende de: [0201](0201-contratos-de-cancion-apariencia-config-e-ipc-de-la-fase-5.md)
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §3, [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §3, §8 y [revisión de la fase 5](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md#revisión-para-020--fase-5)
- Spec UX: no aplica (sin interfaz)

## Objetivo

Hacer que la resolución única de main aplique la espera de la canción sobre el tema, informe de su procedencia y la conserve o la integre de forma coherente en las operaciones de temas.

## Contrato

- **`resolverApariencia`** (`shared/temas.ts`):
  - después de resolver el estilo (pasos 2 y 3), si `apariencia.reemplazos?.espera` existe y el modo es `tema` o `heredar`, el estilo resuelto es `{ ...estilo, espera: reemplazos.espera }`;
  - el resultado añade `procedenciaEspera`, que es `'cancion'` si hay reemplazo y, si no, la misma procedencia del estilo;
  - con `propio`, la espera es la de `estilo` y la procedencia es `propio`;
  - con `respaldo` (la instantánea), se vuelve a aplicar el reemplazo, que es idempotente porque la instantánea ya lo lleva fusionado.
- **Instantánea de respaldo** (`main/temas` y `main/biblioteca`, en el refresco oportunista de ADR 0016 §2): guarda el estilo fusionado.
- **Congelar al borrar un tema** (`main/temas/borrado.ts`): escribe el estilo **fusionado** como `propio` y retira `reemplazos`.
- **Operaciones de `temas.ejecutar`** (aplicar en lote, heredar o asignar a un grupo) **conservan** los `reemplazos` de cada canción. `alHeredar` se calcula conservando también `reemplazos`.
- **Usos e impacto**: no cambian. Una canción con espera propia sigue contando como uso del tema.
- `resumen.ts` y `resuelta` exponen `procedenciaEspera`.

## Archivos

`app/src/shared/temas.ts` (`resolverApariencia` y funciones auxiliares; **no** el esquema, que es de 0201), `app/src/main/temas/{borrado,operaciones}.ts`, `app/src/main/biblioteca/resumen.ts` y sus pruebas.

## Criterios de aceptación

- [ ] Con un tema A (puntos) y una canción `heredar` con reemplazo (cuenta), el estilo resuelto lleva la espera de la canción y el fondo de A, con `procedenciaEspera: 'cancion'`. Sin reemplazo, la procedencia es igual a la del estilo (`album`, `artista`, `predeterminado`…).
- [ ] Al borrar A, la canción queda `propio` con el fondo de A y la cuenta, y sin `reemplazos`.
- [ ] Aplicar un tema B en lote conserva el reemplazo.
- [ ] `alHeredar` no pierde el reemplazo.
- [ ] Las pruebas existentes de resolución, neutra, usos y borrado siguen pasando.

## Pruebas de feedback

- Unitarias: `shared/temas.test.ts` (fusión y procedencia), `main/temas/borrado.test.ts` (congelar con la espera fusionada) y `operaciones.test.ts` (el lote conserva el reemplazo).
- E2E: ninguna.
- Críticos: sí (toca `shared/` y `main/`).
- Manual: nada.

## Notas de implementación
