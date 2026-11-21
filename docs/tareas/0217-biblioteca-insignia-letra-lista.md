# 0217 — Biblioteca: insignia «Letra lista», toast y portadas quietas

- Estado: Pendiente
- Paso del pipeline: 5
- Depende de: [0201](0201-contratos-de-cancion-apariencia-config-e-ipc-de-la-fase-5.md) (con dobles); [0203](0203-main-marcar-letra-lista-guardar-reemplazos-y-modalidad-en-la-sesion.md) para los datos reales
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §5
- Spec UX: [02 · Fase 5](../ux/02-biblioteca.md#fase-5-de-020--estilo-espera-y-letra-lista) (LB1–LB6) y [sistema visual · fase 5](../ux/sistema-visual.md#020--estilo-espera-y-letra-lista-fase-5) (insignia)

## Objetivo

Distinguir las canciones Letra lista en la Biblioteca sin cambiar sus acciones, y mostrar el toast al volver del editor.

## Contrato

- **Tarjeta**:
  - con `resumen.modalidad === 'letra_lista'` y `estado === 'lista'`, insignia `bib.estado.letraLista` con icono `captions` y colores `exito`, y `title` `bib.estado.letraLista.ayuda`;
  - nombre accesible `bib.aria.letraLista`;
  - si está incompleta, la línea `bib.lista.incompleta`, como en una Lista.
- **Filtro**: cuenta en *Listas*, sin cambios en `filtrado.ts` si ya filtra por `estado`.
- **Menú ⋯, acción principal y cola**: sin cambios.
- **Vuelta desde el editor**: si la navegación indica la modalidad Letra lista, el toast es `bib.toast.letraLista` con [▶ Reproducir] en lugar del de Lista. Filtro, foco y resalte, como hoy.
- **Portadas** (LB6): siguen usando `fondoCss` **sin geometría**, es decir, la fase 0. Basta con una prueba.

## Archivos

`vistas/biblioteca/{TarjetaCancion,tarjeta}.ts(x)`, los textos de la Biblioteca, el toast de vuelta en `Biblioteca.tsx` (pocas líneas) y sus pruebas.

## Criterios de aceptación

- [ ] LB1–LB6.
- [ ] LB4: la persistencia la cubre 0203; aquí, que la insignia sigue al resumen tras `cancion:cambiada`.

## Pruebas de feedback

- Unitarias:
  - `TarjetaCancion` o `tarjeta.test.ts`: insignia, aria, incompleta y portada con un estilo con movimiento;
  - `Biblioteca.test.tsx`: filtro *Listas* y toast de vuelta.
- E2E: ninguna propia (el flujo va en el E2E de 0219).
- Críticos: no, salvo que se toque el camino de vuelta de «Marcar como lista». En ese caso, sí.
- Manual: nada.

## Notas de implementación
