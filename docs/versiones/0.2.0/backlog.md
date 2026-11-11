# Backlog de Shinobi Karaoke 0.2.0-alfa

Ver el [plan por fases](plan-2.md), la [hoja de ruta](../../roadmap.md) y el [flujo de Git](../../workflow.md).

## Fase 1 · Fin y barrido

| Tarea | Estado | Depende de | Entrega |
|---|---|---|---|
| [0143 · Fin de línea independiente](../../tareas/0143-fin-de-linea-independiente.md) | Hecha | 0091, 0092 | Estado de fin, edición existente y huecos comprobados |
| [0144 · Barrido por renglón visual](../../tareas/0144-barrido-por-renglon-visual.md) | Hecha | 0112 | Geometría real y reparto de progreso |
| [0145 · Verificar fin y barrido en Electron](../../tareas/0145-verificar-fin-y-barrido-en-electron.md) | Hecha | 0143, 0144, 0123 | Regresiones E2E sin red |

0143 y 0144 pueden avanzar en paralelo. La primera trabaja controles de sincronía y modelo de fotograma. La segunda trabaja geometría y pintura de `PantallaLetra`. 0145 integra escenarios en Electron.

## Fase 2 · Línea de tiempo

| Tarea | Estado | Depende de | Entrega |
|---|---|---|---|
| [0146 · Coordenadas y viewport](../../tareas/0146-coordenadas-y-viewport-de-la-linea-de-tiempo.md) | Hecha | Fase 1 | Regiones, límites y transformación de ventana |
| [0147 · Gesto de marcadores](../../tareas/0147-gesto-de-marcadores-y-confirmacion.md) | Hecha | 0146, 0143 | Previsualización y confirmación reversible |
| [0148 · Bucle nativo](../../tareas/0148-bucle-nativo-en-el-motor-de-audio.md) | Hecha | Fase 1 | Motor Web Audio y reloj de bucle |
| [0149 · Integración en Sincronía](../../tareas/0149-integrar-linea-de-tiempo-en-sincronia.md) | Hecha | 0146, 0147, 0148 | Regla, regiones, bucle, zoom y minimapa |
| [0150 · Picos en worker](../../tareas/0150-generar-picos-multinivel-en-worker.md) | Hecha | Fase 1 | PyAV en streaming y pirámide binaria |
| [0151 · Caché e IPC](../../tareas/0151-cache-de-picos-y-contrato-ipc.md) | Hecha | 0150 | Generación, invalidación y lectura validada |
| [0152 · Forma de onda](../../tareas/0152-dibujar-forma-de-onda-y-minimapa.md) | Hecha | 0149, 0151 | Canvas por viewport y estados sin picos |
| [0153 · Verificación](../../tareas/0153-verificar-linea-de-tiempo-bucle-y-picos.md) | Hecha | 0145, 0149, 0152 | E2E y perfil con una hora de audio |

0146, 0148 y 0150 pueden comenzar en paralelo después de integrar la fase 1. 0147 se apoya en 0146. 0149 es el punto de integración de gestos, reloj y editor. 0151 es la única tarea que modifica contratos IPC compartidos. 0152 puede preparar Canvas y pruebas con un doble una vez acordado ese contrato, y lo integra tras 0149 y 0151. 0153 verifica el conjunto.

## Subfase 2.1 · Estabilización del editor

| Entrega | Estado | Depende de |
|---|---|---|
| [0154 · Ancho estable de forma de onda y minimapa](../../tareas/0154-ancho-estable-de-forma-de-onda-y-minimapa.md) | Hecha | Fase 2 |
| [Spec de layout adaptable y paneles accesibles](../../ux/06-editor.md#subfase-21--layout-adaptable-y-paneles) | Hecha | Fase 2 |
| [0155 · Preferencia de paneles en config y ventana mínima](../../tareas/0155-preferencia-de-paneles-en-config-y-ventana-minima.md) | Hecha | Spec de subfase |
| [0156 · Modelo puro de distribución](../../tareas/0156-modelo-puro-de-distribucion-del-editor.md) | Hecha | 0155 |
| [0157 · Layout a alto completo](../../tareas/0157-layout-del-editor-a-alto-completo.md) | Hecha | 0154, 0156 |
| [0158 · Transporte en dos filas y panel angosto](../../tareas/0158-transporte-en-dos-filas-y-panel-angosto.md) | Hecha | Spec de subfase |
| [0159 · Divisores y restablecer](../../tareas/0159-divisores-accesibles-y-restablecer-distribucion.md) | Hecha | 0157 |
| [0160 · Modos minimizados](../../tareas/0160-modos-minimizados-con-controles-rapidos.md) | Hecha | 0159 |
| [0161 · Persistencia de la distribución](../../tareas/0161-persistir-la-distribucion-de-paneles.md) | Hecha | 0155, 0160 |
| [0162 · Regresión Electron, capturas e informe](../../tareas/0162-regresion-electron-capturas-e-informe-de-la-subfase-2-1.md) | Hecha | 0154, 0155, 0157–0161 |

El [reporte](reporte-editor-fase-2.md) contiene pasos y criterios. Decisiones de la subfase: revisiones de los ADR [0010](../../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--layout-adaptable-y-paneles) (layout y ventana mínima de contenido 1024 × 576) y [0006](../../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-020--preferencias-de-paneles-del-editor) (`config.editor.paneles`).

0154, 0155 y 0158 pueden avanzar en paralelo porque no comparten archivos. 0154 trabaja en `PistaSincronia`, `PistaOndaVoz`, sus CSS y `editor.spec.ts`. 0155 trabaja en `shared/`, `main/` y `e2e/ventana.spec.ts`. 0158 trabaja en `Transporte`, `PanelSincronia`, `CampoTiempo` y los bloques de transporte y desplazamiento de `editor.module.css`. 0156 solo crea archivos nuevos y puede empezar en cuanto 0155 publique `shared/paneles.ts`. 0157 es el punto de integración: necesita 0154, porque toca el CSS de la pista, y 0156. Crea `e2e/editor-layout.spec.ts` y los ayudantes `e2e/fixtures/editor.ts`. 0159 y 0160 son secuenciales porque ambas reescriben `Editor.tsx`. 0161 puede preparar su hook tras 0155 y lo conecta después de 0160. 0155 es la única tarea que modifica contratos compartidos (`shared/config.ts`, `shared/ipc.ts`, `shared/paneles.ts`). Los E2E de layout no dependen de que haya picos. [Informe de la subfase](informe-fase-2.1.md).

La subfase usa las tareas 0154–0162. La fase 3 empieza tras integrar el PR de esta subfase en `develop`.

## Fase 3 · Temas y biblioteca

| Tarea | Estado | Depende de | Entrega |
|---|---|---|---|
| [0163 · Modelo puro de temas e identidad](../../tareas/0163-modelo-puro-de-temas-e-identidad.md) | Hecha | Subfase 2.1 | `shared/identidad.ts`, `shared/temas.ts`, `apariencia` en `cancion.ts`, códigos de error |
| [0164 · Contratos IPC](../../tareas/0164-contratos-ipc-de-temas-y-apariencia.md) | Hecha | 0163 | Canales, esquemas, preload, `config.biblioteca.agrupar`, dobles y puente de `guardarApariencia` |
| [0165 · Catálogo y cola en main](../../tareas/0165-catalogo-y-cola-de-apariencia-en-main.md) | Hecha | 0163 | `temas.json`, siembra, solo lectura, apartado, cola, crear/renombrar/duplicar, usos |
| [0166 · Impactos y operaciones confirmadas](../../tareas/0166-impactos-fichas-y-operaciones-confirmadas.md) | Hecha | 0165 | Fichas, obsoleta, editar, lote por canción, grupo, predeterminado (A1/B1/C1), progreso |
| [0167 · Borrado recuperable](../../tareas/0167-borrado-recuperable-de-temas.md) | Hecha | 0166 | Diario, congelación, retirada, reanudar y cancelar |
| [0168 · Migración, creación y resolución](../../tareas/0168-migracion-creacion-de-canciones-y-resolucion-en-la-biblioteca.md) | Hecha | 0164, 0165 | Esquema 1 sin reescritura, apariencia inicial, metadatos por la cola, IPC `temas.*`, semilla |
| [0169 · Base de temas en el renderer](../../tareas/0169-base-de-temas-en-el-renderer.md) | Hecha | 0164 | `renderer/src/temas/`: catálogo, textos, muestra, selector y diálogos compartidos |
| [0170 · Panel Estilo · sección Tema](../../tareas/0170-panel-estilo-seccion-tema.md) | Hecha | 0169 | D1, D2, D4, historial por selección, retirada de «Usar este estilo…» |
| [0171 · Editar tema](../../tareas/0171-editar-tema-con-borrador-y-confirmacion.md) | Hecha | 0170 | D3, guardar con impacto, salir y cerrar con borrador |
| [0172 · Agrupación y búsqueda](../../tareas/0172-biblioteca-agrupacion-busqueda-y-linea-de-tema.md) | Hecha | 0164 | Agrupar por, grupos, búsqueda en álbum, línea de tema, portada, editar datos |
| [0173 · Selección múltiple y lote](../../tareas/0173-biblioteca-seleccion-multiple-y-aplicar-tema.md) | Hecha | 0169, 0172 | Modo selección, «Aplicar tema…», resultado por canción |
| [0174 · Tema de artista y álbum](../../tareas/0174-biblioteca-tema-de-artista-y-album.md) | Hecha | 0169, 0172 | [Tema…] del encabezado de grupo |
| [0175 · Ajustes › Temas](../../tareas/0175-ajustes-seccion-temas.md) | Hecha | 0169 | Predeterminado, lista, avisos, borrado pendiente, volver al origen |
| [0176 · Verificación, capturas e informe](../../tareas/0176-verificacion-e2e-capturas-e-informe-de-la-fase-3.md) | Hecha | 0163–0175 | E2E sin red (incluida biblioteca de esquema 1), capturas e informe |

Decisiones: [ADR 0016](../../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) (revisado tras [0052](../../preguntas/0052-predeterminado-y-canciones-que-dependen-de-el.md), [0054](../../preguntas/0054-detalles-de-interfaz-de-temas-y-biblioteca.md) , [0055](../../preguntas/0055-textos-de-predeterminado-anterior-y-ajustes-de-la-fase-3.md) y [0056](../../preguntas/0056-destino-respaldo-y-canciones-pendientes.md)) y las revisiones de fase 3 de los ADR 0006, 0008 y 0010. Specs: [editor](../../ux/06-editor.md#fase-3-de-020--temas-y-biblioteca), [Biblioteca](../../ux/02-biblioteca.md#fase-3-de-020--temas-y-biblioteca), [Ajustes](../../ux/08-ajustes-y-acerca.md#fase-3-de-020--temas-y-biblioteca) y [revisión visual](../../ux/revision-fase-3/README.md). [0056](../../preguntas/0056-destino-respaldo-y-canciones-pendientes.md) respondida: destino «respaldo» sin nombre de tema y lista común tras un fallo a mitad (`ListaFalloAMitad`, dueña 0169); el resultado por canción lleva `titulo` y `artista` (ADR 0016, revisión 3).

**Paralelismo.** 0163 va primero. Después, 0164 (contratos) y 0165 (catálogo en main) en paralelo. Con 0164 y 0165 integradas pueden avanzar a la vez cuatro líneas: main (0166 → 0167), integración de la biblioteca (0168), renderer de temas (0169 → 0170 → 0171, con 0175 en paralelo a 0170) y Biblioteca (0172 → 0173 y 0174 en paralelo). 0176 cierra la fase.

**Propiedad de archivos.**
- `shared/cancion.ts`, `shared/temas.ts`, `shared/identidad.ts` y `shared/errores.ts`: solo 0163.
- `shared/ipc.ts`, `shared/canales.ts`, `shared/config.ts` y `preload/index.ts`: solo 0164. Única excepción: 0170 retira `estilo_predeterminado` de `configParcialRendererSchema`.
- `main/temas/`: 0165, luego 0166 y luego 0167, en secuencia. 0168 no lo toca: inyecta el puerto de canciones desde `main/index.ts`.
- `main/biblioteca/servicio.ts`, `main/biblioteca/resumen.ts`, `main/index.ts` y `main/ipc/handlers.ts`: 0168, después de los cambios provisionales de 0164 (puente de `guardarApariencia` y campos nuevos del resumen).
- `renderer/src/temas/`: solo 0169.
- `vistas/editor/`: 0170 y después 0171.
- `vistas/biblioteca/`: 0172 crea `EncabezadoGrupo.tsx` con los huecos `casilla` y `tema`. 0173 y 0174 los rellenan con archivos propios y solo comparten unas líneas de `Biblioteca.tsx`.
- `vistas/ajustes/` y `navegacion/estado.ts`: 0175.

## Fase 4 · Ventana secundaria y cola

| Tarea | Estado | Depende de | Entrega |
|---|---|---|---|
| [0177 · Contratos compartidos](../../tareas/0177-contratos-compartidos-de-sesion-cola-y-roles.md) | Hecha | Fase 3 | `shared/sesion.ts`, canales y `ROLES_POR_CANAL`, contrato IPC, códigos, `config.reproductor.transicion_s`/`secundaria`, `preload/secundaria.ts`, dobles |
| [0178 · Cola y máquina de sesión](../../tareas/0178-modelo-puro-de-cola-y-maquina-de-sesion.md) | Pendiente | 0177 | `main/sesion/{cola,maquina,proyeccion}.ts` puros: avance, cuenta, eventos tardíos, cierre, reanudación |
| [0179 · Roles de ventana](../../tareas/0179-roles-de-ventana-remitente-por-rol-y-documento-secundario.md) | Pendiente | 0177 | `RegistroVentanas`, remitente por rol y documento, eventos dirigidos, `reproductor.html` y entradas de build |
| [0180 · Pantallas y ventana secundaria](../../tareas/0180-pantallas-ventana-secundaria-pantalla-completa-y-reposo.md) | Pendiente | 0179 | `ControlPantallaCompleta`, `GestorReposo`, pantallas y Wayland, ventana secundaria, recuperación, dobles de pantallas |
| [0181 · Servicio de sesión e IPC](../../tareas/0181-servicio-de-sesion-e-ipc-en-main.md) | Pendiente | 0178, 0180 | `ServicioSesion`, revalidación, defensas de edición, silencio y reposo, canales nuevos, cierre de la app |
| [0182 · Reproductor en la secundaria](../../tareas/0182-reproductor-en-la-ventana-secundaria.md) | Pendiente | 0177, 0179 | Modo `sesion`, S1–S4, cuenta, reanudación, atajos, diálogo de cierre en la secundaria |
| [0183 · Estado de sesión y bloqueo](../../tareas/0183-estado-de-sesion-en-la-principal-bloqueo-de-edicion-e-indicador.md) | Pendiente | 0177 | `renderer/src/sesion/`, textos, `edi.bloqueo` en todos los puntos de entrada, indicador de sesión |
| [0184 · Diálogo de pantallas](../../tareas/0184-dialogo-abrir-el-reproductor-en-otra-pantalla.md) | Pendiente | 0183 | «Abrir el reproductor en otra pantalla», Wayland, errores, cabecera |
| [0185 · Panel: sesión y cierre](../../tareas/0185-panel-de-cola-sesion-controles-recuperacion-y-cierre.md) | Pendiente | 0183, 0184 | Panel, P1–P6, controles, banners de recuperación, `ses.cierre` en la principal |
| [0186 · Panel: pendientes](../../tareas/0186-panel-de-cola-lista-de-pendientes.md) | Pendiente | 0183 | Lista, reordenar con ratón, teclado y menú, quitar y deshacer, vaciar |
| [0187 · Tarjetas y menús](../../tareas/0187-tarjetas-y-menus-de-la-biblioteca-durante-la-sesion.md) | Pendiente | 0183, 0184 | «A la cola», ⋯ de Lista, toasts, línea de cola, bloqueos de la tarjeta |
| [0188 · Ajustes › Reproductor](../../tareas/0188-ajustes-cuenta-entre-canciones.md) | Pendiente | 0177 | Selector «Cuenta entre canciones» |
| [0189 · Salir con sesión o cola](../../tareas/0189-salir-de-la-app-con-sesion-o-cola.md) | Pendiente | 0181, 0183 | `ses.salir`, variante con trabajos y variante de macOS |
| [0190 · Verificación, capturas e informe](../../tareas/0190-verificacion-e2e-capturas-e-informe-de-la-fase-4.md) | Pendiente | 0177–0189 | E2E sin red, capturas, verificación manual en dos pantallas e informe |

**Decisiones.**

- [ADR 0017](../../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md), con la revisión 1 tras las specs y las preguntas, y las revisiones de fase 4 de los ADR [0006](../../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-020--fase-4), [0008](../../adr/0008-seguridad-de-electron-y-protocolos-propios.md#revisión-para-020--fase-4), [0010](../../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--fase-4) y [0011](../../adr/0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md#revisión-para-020--fase-4).
- Specs: [Biblioteca](../../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola), [Editor](../../ux/06-editor.md#fase-4-de-020--ventana-secundaria-y-cola), [Reproductor](../../ux/07-reproductor.md#fase-4-de-020--ventana-secundaria-y-cola), [Ajustes](../../ux/08-ajustes-y-acerca.md#fase-4-de-020--ventana-secundaria-y-cola), [mapa](../../ux/00-mapa-de-vistas.md) y [sistema visual](../../ux/sistema-visual.md).
- Preguntas respondidas:
  - [0058](../../preguntas/0058-interfaz-de-la-sesion-en-vivo-y-la-cola.md) (interfaz);
  - [0059](../../preguntas/0059-conductas-de-la-sesion-en-vivo-ante-incidencias.md): 1B (la pantalla perdida no pausa), 2A (pantalla encendida toda la sesión), **3B (con la cola agotada, añadir arranca la cuenta)** y 4A (confirmar al salir);
  - [0060](../../preguntas/0060-letra-y-controles-de-sonido-durante-la-sesion.md): 1A (Letra bloqueada) y 2A (sin volumen en el panel);
  - [0061](../../preguntas/0061-reproductor-en-otra-pantalla-con-wayland.md) (Wayland).
- La cuenta acepta enteros de 1 a 30 s, con 4 por defecto, y el selector ofrece 2, 3, 4, 5, 8, 10 y 15 s.

**Paralelismo.**

1. 0177 va primero.
2. Después pueden avanzar a la vez tres líneas:
   - **main**: 0178 (puro) en paralelo con 0179 → 0180, y las dos confluyen en 0181;
   - **secundaria**: 0182, contra la `ApiReproductor` falsa;
   - **principal**: 0183, y 0188 en paralelo.
3. Con 0183 integrada:
   - 0184 → 0185 y 0187;
   - 0186 en paralelo con 0185, como componente aislado que se monta en su hueco.
4. 0189 espera a 0181 y 0183.
5. La integración en Electron de 0182 y 0184–0187 necesita 0181. Hasta entonces, cada una se prueba con dobles.
6. 0190 cierra la fase.

**Propiedad de archivos.**
- `shared/{sesion,canales,ipc,errores,config}.ts`, `shared/__fixtures__/sesion.ts` y `preload/`: solo 0177.
- `main/sesion/{cola,maquina,proyeccion}.ts`: solo 0178.
- `main/ventana/registro.ts`, `main/seguridad.ts`, `electron.vite.config.ts`, `renderer/reproductor.html` y la parte de registro de `main/ipc/handlers.ts`: 0179.
- `main/ventana/{pantallaCompleta,reposo,modoReproductor}.ts` y `main/sesion/{pantallas,ventanaSecundaria,pantallasPrueba}.ts`: 0180.
- `main/sesion/servicio.ts`, el resto de `main/ipc/handlers.ts` y `main/cierre.ts`: 0181.
- `main/index.ts`: en secuencia 0179 → 0180 (solo la inyección de `GestorReposo`) → 0181.
- `renderer/src/secundaria/**` (0179 deja el provisional) y `vistas/reproductor/**`: 0182.
- `renderer/src/sesion/**` (estado, textos de las specs 02 y 06 y diálogo de bloqueo), `App.tsx`, `navegacion/{Marco,reproductor,estado,useAvisosTrabajos}`, y la escucha y el stepper de `vistas/progreso/` y `vistas/anadir/`: 0183.
- `vistas/biblioteca/sesion/`: 0184.
- `vistas/biblioteca/cola/**`: 0185, salvo `ListaPendientes.tsx`, `FilaPendiente.tsx` y el arrastre, que son de 0186.
- `TarjetaCancion.tsx`, `tarjeta.ts`, `DialogosCancion.tsx` y `BarraSeleccion.tsx`: 0187.
- `Biblioteca.tsx`: 0184 (cabecera), 0185 (colocación del panel y botón «Cola») y 0187 (menú). Son pocas líneas cada una y se integran en ese orden.
- `vistas/ajustes/`: 0188.
- `navegacion/{DialogoCierre,textosCierre}`: 0189.
- `e2e/`: cada tarea puede añadir su propio `*.spec.ts`. 0190 reúne y completa la batería.

## Fases siguientes

| Fase | Alcance | Desglose |
|---|---|---|
| 3 | Temas y agrupación de biblioteca | Desglosada arriba (0163–0176), con [0047](../../preguntas/0047-temas-asignados-edicion-y-borrado.md) y [0052](../../preguntas/0052-predeterminado-y-canciones-que-dependen-de-el.md) |
| 4 | Ventana secundaria y cola | Desglosada arriba (0177–0190), con [0048](../../preguntas/0048-escucha-editor-durante-evento.md), [0049](../../preguntas/0049-politica-cola-de-reproduccion.md) y [0058](../../preguntas/0058-interfaz-de-la-sesion-en-vivo-y-la-cola.md)–[0061](../../preguntas/0061-reproductor-en-otra-pantalla-con-wayland.md) |
| 5 | Degradados, comodines y Letra lista | Al iniciar la fase |
| 6 | Exportación | Al iniciar la fase, con prueba técnica de [0050](../../preguntas/0050-perfiles-y-concurrencia-exportacion.md) |

La [publicación pendiente del MVP](../../tareas/0142-primera-version-publica.md) sigue en la hoja de ruta.
