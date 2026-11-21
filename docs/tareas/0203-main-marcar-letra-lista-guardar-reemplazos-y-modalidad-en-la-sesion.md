# 0203 — Main: marcar Letra lista, guardar reemplazos y modalidad en la sesión

- Estado: Hecha
- Paso del pipeline: 4–6
- Depende de: [0201](0201-contratos-de-cancion-apariencia-config-e-ipc-de-la-fase-5.md), [0202](0202-resolucion-de-apariencia-con-reemplazos-de-espera.md)
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §3, §5 y §7, [0006](../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-020--fase-5), [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §7 y §9–§10
- Spec UX: no aplica (sin interfaz). Los textos de error los da la spec en las tareas de interfaz.

## Objetivo

Implementar en main la escritura de la modalidad «Letra lista» y de los reemplazos de espera, y llevar la modalidad a la sesión en vivo.

## Contrato

- **`ServicioBiblioteca.marcarLista(id, opciones?)`**:
  - con `modalidad: 'letra_lista'` comprueba `puedeMarcarseLetraLista`; si no, solo `puedeMarcarseLista`;
  - si no se cumple, responde `ARGUMENTOS_NO_VALIDOS` con los motivos, como hoy;
  - escribe `estado: 'lista'` y `modalidad`, y **omite** el campo con `karaoke` para no ensuciar canciones de 0.1.0;
  - `pasos.edicion` pasa a `completado`;
  - sobre una canción ya `lista`, cambia la modalidad sin pasar por borrador;
  - sigue bloqueado durante la sesión (`EDICION_BLOQUEADA`).
- **`volverABorrador`**: retira `modalidad`.
- **`guardarApariencia(id, seleccion)`** con `reemplazos`:
  - ausente: conserva los actuales;
  - `null`: los quita;
  - objeto: los sustituye.
  - Con `{ modo: 'propio', estilo }` se retiran `reemplazos`, porque el estilo propio ya trae su espera.
  - Pasa por la cola de apariencia, como hoy.
- **Resumen**: `modalidad` es la efectiva (`modalidadEfectiva`) y `procedenciaEspera` viene de 0202.
- **Sesión** (`main/sesion/servicio.ts`): al consumir una entrada, la instantánea incluye `modalidad` efectiva. La revalidación de Lista no cambia.
- **Lectura**: una canción `borrador` con `modalidad` en disco se lee sin error y no se reescribe al abrir.

## Archivos

`app/src/main/biblioteca/{servicio,operaciones,resumen}.ts`, el manejador de `marcarLista` y `guardarApariencia` en `app/src/main/ipc/handlers.ts`, la construcción de la entrada activa en `app/src/main/sesion/servicio.ts` y sus pruebas.

## Criterios de aceptación

- [ ] `marcarLista(id, { modalidad: 'letra_lista' })` sobre un borrador completo deja `estado: 'lista'` y `modalidad: 'letra_lista'`.
- [ ] Con una línea sin inicio responde `ARGUMENTOS_NO_VALIDOS` y no escribe.
- [ ] `marcarLista(id)` sobre esa canción vuelve a `karaoke` (sin el campo).
- [ ] `volverABorrador` retira `modalidad`.
- [ ] `guardarApariencia` con reemplazos ausentes, `null` y un objeto produce, respectivamente, conservar, quitar y sustituir. Con `propio`, no quedan reemplazos.
- [ ] Durante una sesión, `marcarLista` con modalidad responde `EDICION_BLOQUEADA`.
- [ ] La entrada activa de la sesión lleva `modalidad`.

## Pruebas de feedback

- Unitarias: `main/biblioteca/servicio.test.ts` (marcar, cambiar, volver a borrador y reemplazos) y `main/sesion` (`modalidad` en la entrada activa, con los dobles existentes).
- E2E: ninguna (la integración visible se verifica en las tareas de interfaz y en el cierre).
- Críticos: sí (toca `main/`). «Marcar como lista» sin modalidad debe seguir funcionando igual.
- Manual: nada.

## Notas de implementación

- **Qué se hizo**:
  - `ServicioBiblioteca.marcarLista(id, opciones?)` (`main/biblioteca/servicio.ts`): con `letra_lista` exige `puedeMarcarseLetraLista` y, si no, `ARGUMENTOS_NO_VALIDOS` con los mensajes de los motivos; escribe `modalidad` solo con `letra_lista` y la retira con `karaoke` (también sobre una canción ya lista).
  - `volverABorrador` retira `modalidad`.
  - `guardarApariencia`: `reemplazos` ausente conserva, `null` quita, objeto sustituye; `propio` deja `{ modo: 'propio' }`. La instantánea sale fusionada por el refresco existente.
  - Manejador de `marcarLista`: reenvía `opciones` solo si vienen (la llamada sin modalidad es idéntica a la de antes). `sinSesion()` ya devolvía `EDICION_BLOQUEADA`.
  - Resumen: `modalidad` efectiva y `procedenciaEspera` (hechos con 0201/0202). Sesión: la instantánea de la entrada activa lleva `modalidad` (`modalidadEfectiva`, hecho junto con 0201 para que compilara; aquí solo se prueba).
  - Una canción `borrador` con `modalidad` en disco se lee sin error (el esquema la admite) y no se reescribe al abrir.
- **Pruebas**: `main/biblioteca/escritura.test.ts` (donde ya están las de marcar lista y volver a borrador) y `main/sesion/servicio.test.ts`. No hay prueba nueva de `EDICION_BLOQUEADA` porque no cambia el manejador de bloqueo.
- **Deuda**: ninguna.
