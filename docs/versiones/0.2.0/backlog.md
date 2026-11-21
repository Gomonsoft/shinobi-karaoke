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
| [0178 · Cola y máquina de sesión](../../tareas/0178-modelo-puro-de-cola-y-maquina-de-sesion.md) | Hecha | 0177 | `main/sesion/{cola,maquina,proyeccion}.ts` puros: avance, cuenta, eventos tardíos, cierre, reanudación |
| [0179 · Roles de ventana](../../tareas/0179-roles-de-ventana-remitente-por-rol-y-documento-secundario.md) | Hecha | 0177 | `RegistroVentanas`, remitente por rol y documento, eventos dirigidos, `reproductor.html` y entradas de build |
| [0180 · Pantallas y ventana secundaria](../../tareas/0180-pantallas-ventana-secundaria-pantalla-completa-y-reposo.md) | Hecha | 0179 | `ControlPantallaCompleta`, `GestorReposo`, pantallas y Wayland, ventana secundaria, recuperación, dobles de pantallas |
| [0181 · Servicio de sesión e IPC](../../tareas/0181-servicio-de-sesion-e-ipc-en-main.md) | Hecha | 0178, 0180 | `ServicioSesion`, revalidación, defensas de edición, silencio y reposo, canales nuevos, cierre de la app |
| [0182 · Reproductor en la secundaria](../../tareas/0182-reproductor-en-la-ventana-secundaria.md) | Hecha (integración con 0181) | 0177, 0179 | Modo `sesion`, S1–S4, cuenta, reanudación, atajos, diálogo de cierre en la secundaria |
| [0183 · Estado de sesión y bloqueo](../../tareas/0183-estado-de-sesion-en-la-principal-bloqueo-de-edicion-e-indicador.md) | Hecha | 0177 | `renderer/src/sesion/`, textos, `edi.bloqueo` en todos los puntos de entrada, indicador de sesión |
| [0184 · Diálogo de pantallas](../../tareas/0184-dialogo-abrir-el-reproductor-en-otra-pantalla.md) | Hecha | 0183 | «Abrir el reproductor en otra pantalla», Wayland, errores, cabecera |
| [0185 · Panel: sesión y cierre](../../tareas/0185-panel-de-cola-sesion-controles-recuperacion-y-cierre.md) | Hecha | 0183, 0184 | Panel, P1–P6, controles, banners de recuperación, `ses.cierre` en la principal |
| [0186 · Panel: pendientes](../../tareas/0186-panel-de-cola-lista-de-pendientes.md) | Hecha | 0183 | Lista, reordenar con ratón, teclado y menú, quitar y deshacer, vaciar |
| [0187 · Tarjetas y menús](../../tareas/0187-tarjetas-y-menus-de-la-biblioteca-durante-la-sesion.md) | Hecha | 0183, 0184 | «A la cola», ⋯ de Lista, toasts, línea de cola, bloqueos de la tarjeta |
| [0188 · Ajustes › Reproductor](../../tareas/0188-ajustes-cuenta-entre-canciones.md) | Hecha | 0177 | Selector «Cuenta entre canciones» |
| [0189 · Salir con sesión o cola](../../tareas/0189-salir-de-la-app-con-sesion-o-cola.md) | Hecha | 0181, 0183 | `ses.salir`, variante con trabajos y variante de macOS |
| [0190 · Pruebas de integración, capturas e informe](../../tareas/0190-verificacion-e2e-capturas-e-informe-de-la-fase-4.md) | Pendiente | 0177–0189 | Una spec `sesion-flujo` (≤ 4 pruebas), capturas, CI en verde, guía manual ejecutada por el usuario e informe |

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
- `e2e/`: cada tarea puede añadir su propio `*.spec.ts`. 0190 añade solo `sesion-flujo.spec.ts` (ver [estrategia de pruebas](../../pruebas.md)).

## Fase 5 · Estilo, espera, Letra lista y ajuste de silencios

Decisión en el [ADR 0018](../../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md), con revisiones de fase 5 en 0005, 0006, 0010, 0011, 0015 y 0016 y la revisión del 2026-11-20, que adapta el ADR a las specs. Rama de trabajo: `alpha-2`. La **primera ola** (0200–0210) no depende de la interfaz. Las tareas con interfaz (0211–0219) siguen las specs de la fase 5:

- [06 · Editor](../../ux/06-editor.md#fase-5-de-020--estilo-espera-y-letra-lista): G1–G12, IE1–IE7, LL1–LL8 y AS1–AS9;
- [07 · Reproductor](../../ux/07-reproductor.md#fase-5-de-020--estilo-espera-y-letra-lista): R1–R14;
- [02 · Biblioteca](../../ux/02-biblioteca.md#fase-5-de-020--estilo-espera-y-letra-lista): LB1–LB7;
- [sistema visual](../../ux/sistema-visual.md#020--estilo-espera-y-letra-lista-fase-5);
- respuesta de UX a [0101](../../preguntas/0101-contratos-de-la-fase-5-para-las-specs.md).

Ajustes no cambia en esta fase. Preguntas al usuario: [0100](../../preguntas/0100-decisiones-provisionales-de-la-fase-5.md) y [0110](../../preguntas/0110-decisiones-provisionales-de-ux-de-la-fase-5.md), ninguna de las dos bloquea.

| Tarea | Estado | Depende de | Entrega |
|---|---|---|---|
| [0200 · Esquema del estilo ampliado](../../tareas/0200-esquema-del-estilo-ampliado-y-normalizacion.md) | Hecha | Fase 4 | `forma`, `centro`, `movimiento` y `espera` opcionales; `shared/espera.ts`; `normalizarEstilo`; `estilosIguales` normalizado; copia congelada del esquema de 0.1.0 |
| [0201 · Contratos de la fase 5](../../tareas/0201-contratos-de-cancion-apariencia-config-e-ipc-de-la-fase-5.md) | Pendiente | 0200 | `cancion.modalidad`, `apariencia.reemplazos`, motivos de Letra lista, `config.editor.omitir_aviso_letra_lista`, IPC (`marcarLista`, `reemplazos`, `modalidad` y `procedenciaEspera`), entrada de la sesión, preload y dobles |
| [0202 · Resolución con reemplazos](../../tareas/0202-resolucion-de-apariencia-con-reemplazos-de-espera.md) | Pendiente | 0201 | Fusión de la espera en `resolverApariencia`, `procedenciaEspera`, congelación y lotes |
| [0203 · Main: Letra lista y reemplazos](../../tareas/0203-main-marcar-letra-lista-guardar-reemplazos-y-modalidad-en-la-sesion.md) | Pendiente | 0201, 0202 | `marcarLista` con modalidad, volver a borrador, `guardarApariencia` con reemplazos y `modalidad` en la entrada activa |
| [0204 · Geometría y CSS del fondo](../../tareas/0204-geometria-del-fondo-y-css-de-los-tres-degradados.md) | Hecha | 0200 | `karaoke/fondo.ts` y `fondoCss` con lineal, radial y cónico (cierre) |
| [0205 · Peor contraste por tramos](../../tareas/0205-peor-contraste-por-tramos-y-cierre-conico.md) | Hecha | 0200 | 9 muestras por tramo y cierre del cónico |
| [0206 · Comodines en el fotograma](../../tareas/0206-derivacion-de-los-comodines-de-espera-en-el-fotograma.md) | Hecha | 0200 | `espera` en `FotogramaLetra`; puntos legados idénticos; adaptación mínima de `PantallaLetra` |
| [0207 · Detección de voz y propuesta](../../tareas/0207-deteccion-de-voz-y-propuesta-de-ajuste-de-silencios.md) | Hecha | 0200 | `shared/silencios.ts` con picos sintéticos |
| [0208 · Nivel base de picos](../../tareas/0208-lectura-del-nivel-base-de-picos-en-el-editor.md) | Hecha | — | `vistas/editor/picosBase.ts` sobre `picos.leer` |
| [0209 · Historial: reemplazos y ajuste](../../tareas/0209-historial-del-editor-reemplazos-y-ajustar-silencios.md) | Pendiente | 0201, 0207 | `reemplazos` en `AparienciaEditor`; acciones `espera` y `ajustar_silencios` (un paso) |
| [0210 · Calibración de silencios](../../tareas/0210-herramienta-de-calibracion-del-ajuste-de-silencios.md) | Hecha | 0207 | `app/scripts/calibrar-silencios.ts`, de solo lectura, para las 6 canciones del usuario |
| [0211 · Editor: degradados](../../tareas/0211-editor-controles-de-degradado-y-movimiento.md) | Pendiente | 0200, 0204, 0205 (0213 para G7/G8) | Forma, cuadrícula de centro, ángulo de inicio, reparto i/n del cónico, movimiento con velocidad, «Detener el movimiento» y resumen D1/D4 (G1–G11) |
| [0212 · Editor: indicadores de espera](../../tareas/0212-editor-indicadores-de-espera.md) | Pendiente | 0202, 0203, 0209, 0213 | Sección «Indicadores de espera», umbral, «Cambiar solo en esta canción» o «Usar los del tema», D3 y «Ver un ejemplo» (IE1–IE7) |
| [0213 · Pantalla de letra](../../tareas/0213-pantalla-de-letra-fondo-en-movimiento-indicadores-y-sin-barrido.md) | Hecha | 0204, 0206 | Fondo por fotograma con movimiento reducido o detenido, barra y cuenta en posiciones reservadas, anuncio por hueco y `barrido={false}` (R2, R3, R5–R12) |
| [0214 · Editor: Letra lista](../../tareas/0214-editor-letra-lista.md) | Pendiente | 0201, 0203 | Botón en el dock, popover, diálogo de la primera activación, insignias, cambio de modalidad en ⋯ y contraste informativo (LL1–LL7) |
| [0215 · Editor: «Ajustar los silencios»](../../tareas/0215-editor-ajustar-los-silencios.md) | Pendiente | 0207, 0208, 0209 | Botón en la línea de tiempo y en ⋯, motivos, diálogo con recuentos y lista, recálculo, toast y resalte; un E2E en `editor.spec.ts` (AS1–AS8) |
| [0216 · Reproductor, sesión y «Probar»](../../tareas/0216-reproductor-sesion-y-probar-modalidad-y-movimiento.md) | Pendiente | 0203, 0213 | `barrido` según la modalidad en el reproductor local, la secundaria y «Probar»; fondo quieto en S1, S2 y S4 (R1–R4, R12, R13, LL8) |
| [0217 · Biblioteca: Letra lista](../../tareas/0217-biblioteca-insignia-letra-lista.md) | Pendiente | 0201 (dobles), 0203 | Insignia, aria, filtro *Listas*, toast de vuelta y portadas en fase 0 (LB1–LB6) |
| [0218 · Capturas de revisión](../../tareas/0218-capturas-de-revision-de-la-fase-5.md) | Pendiente | 0211–0217 | `e2e/fase5-capturas.spec.ts` *opt-in* (F5-1, R14 y LB7). Sustituye a la reserva «Temas y Ajustes», que no hace falta |
| [0219 · Integración, guía e informe](../../tareas/0219-integracion-guia-manual-e-informe-de-la-fase-5.md) | Pendiente | 0200–0218 | `e2e/fase5.spec.ts` (≤ 4 pruebas), CI, casos de la guía manual para `qa`, calibración e informe |

Quedan libres 0220–0229 para ajustes que salgan de las respuestas a 0100 y 0110 o de la calibración.

**Paralelismo.**

1. **Primera ola**:
   - 0200 primero; 0208 ya está hecha;
   - después, cuatro líneas a la vez:
     - **contratos y main**: 0201 → 0202 → 0203;
     - **render**: 0204, 0205 y 0206 en paralelo;
     - **silencios**: 0207 → 0210;
     - **historial**: 0209, que espera a 0201 y 0207.
2. **Interfaz**, a medida que se integran sus dependencias:
   - **render compartido**: 0213, en cuanto estén 0204 y 0206. Es el cuello de botella de 0211 (G7/G8), 0212 y 0216;
   - **editor**: 0211, 0214 y 0215 pueden avanzar en paralelo como componentes nuevos. 0212 espera a 0209 y 0213, y se integra en `PanelEstilo.tsx` después de 0211;
   - **reproductor y biblioteca**: 0216 tras 0213 y 0203. 0217 en paralelo con cualquier otra tarea, contra dobles de 0201.
3. **Cierre**: 0218 (capturas) tras 0211–0217, y después 0219.

**Propiedad de archivos.**

- **Primera ola**:
  - `shared/estilo.ts`, `shared/espera.ts`, `shared/__fixtures__/estilo-0.1.0.ts` y `estilosIguales`: solo 0200;
  - `shared/{cancion,config,ipc,sesion,derivados}.ts`, `aparienciaSchema` de `shared/temas.ts`, los dobles de resumen y sesión en `shared/__fixtures__/` y `preload/`: solo 0201;
  - `resolverApariencia` de `shared/temas.ts`, `main/temas/**` y `main/biblioteca/resumen.ts`: 0202;
  - `main/biblioteca/{servicio,operaciones}.ts`, los manejadores de `marcarLista` y `guardarApariencia` y la entrada activa de `main/sesion/servicio.ts`: 0203;
  - `karaoke/{fondo,estiloCss}.ts`: 0204;
  - `karaoke/contraste.ts`: 0205;
  - `karaoke/render.ts` y el cambio mínimo de `PantallaLetra.tsx`: 0206;
  - `shared/silencios.ts` y `shared/__fixtures__/picos.ts`: 0207;
  - `vistas/editor/picosBase.ts`: 0208;
  - `vistas/editor/{estado,guardado}.ts`: 0209;
  - `app/scripts/calibrar-silencios.ts`: 0210.
- **Interfaz**:
  - `karaoke/PantallaLetra.tsx`, `pantallaLetra.module.css` y `karaoke/useMovimientoReducido.ts`: 0213;
  - `vistas/editor/estilo/{ControlesFondo,paradas}`: 0211;
  - `vistas/editor/estilo/{SeccionEspera,ejemploEspera}`: 0212;
  - `vistas/editor/{BotonLista,BotonLetraLista,DialogoLetraLista}`: 0214;
  - `vistas/editor/silencios/**` y `PistaSincronia.tsx` (botón y resalte): 0215;
  - `vistas/reproductor/**`: 0216;
  - `vistas/biblioteca/{TarjetaCancion,tarjeta}` y los textos de la Biblioteca: 0217.
- **Archivos compartidos**, en pocas líneas por tarea y por orden de integración:
  - `vistas/editor/PanelEstilo.tsx`: 0211 → 0212 → 0214 (solo la presentación del aviso de contraste);
  - `vistas/editor/Editor.tsx`: 0211 (botón «Detener») → 0214 (dock, cabecera y ⋯) → 0215 (ítem de ⋯) → 0216 (modalidad en «Probar»);
  - `vistas/editor/textos.ts`: cada tarea añade su bloque (`edi.fondo.*`, `edi.espera.*`, `edi.letraLista.*` y `edi.silencios.*`), en el mismo orden;
  - `Biblioteca.tsx`: solo 0217 (toast de vuelta).
- **`e2e/`**:
  - 0215 añade una prueba en `editor.spec.ts`;
  - 0218, `fase5-capturas.spec.ts` (*opt-in*);
  - 0219, `fase5.spec.ts`.

**Verificación.** Pruebas de feedback según [pruebas.md](../../pruebas.md): Vitest con picos sintéticos, la copia del esquema de 0.1.0 y el render con reloj simulado. Los críticos se ejecutan en las tareas que tocan `shared/`, `main/`, el dock de «Marcar como lista» o el reproductor. Lo visual, la distancia, el hardware modesto, las dos pantallas, el movimiento reducido del sistema y la calibración con canciones reales van a la guía manual que escribe `qa` (lista de casos en 0219).

## Fase 6 · Exportación

Decisión en el [ADR 0019](../../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md), con la prueba técnica en [`docs/poc/0019-exportacion/`](../../poc/0019-exportacion/) y revisiones de fase 6 en 0005, 0006, 0008, 0009, 0011, 0012, 0013 y 0017. Spec: [10 · Exportar a video](../../ux/10-exportacion.md) (V1–V30 sin V24, M1–M9) y las secciones «Fase 6» de [02](../../ux/02-biblioteca.md#fase-6-de-020--exportación), [06](../../ux/06-editor.md#fase-6-de-020--exportación) y el [sistema visual](../../ux/sistema-visual.md#020--exportación-de-video-fase-6). Preguntas: [0050](../../preguntas/0050-perfiles-y-concurrencia-exportacion.md) y [0131](../../preguntas/0131-contratos-tecnicos-de-la-exportacion.md) respondidas; [0130](../../preguntas/0130-decisiones-de-producto-de-la-exportacion.md) (usuario) y [0120](../../preguntas/0120-formatos-y-resoluciones-de-la-exportacion.md) (usuario) no bloquean.

Resumen: render por índice de fotograma en una ventana offscreen con el mismo `PantallaLetra`, captura en main y fotogramas BGRA por la tubería al worker PyAV, que codifica MKV (AV1 + Opus, por defecto) o WebM (VP9 + Opus). 8 resoluciones × 24/30/60 FPS. Una exportación a la vez, en cola propia; convive con la separación y con la sesión en vivo.

| Tarea | Estado | Depende de | Entrega |
|---|---|---|---|
| [0230 · Contratos compartidos](../../tareas/0230-contratos-compartidos-de-la-exportacion.md) | Pendiente | Fase 4, 0200, 0201 | `shared/exportacion.ts` (catálogo, estimaciones, nombre), IPC, rol `exportacion`, errores, `config.exportacion`, preloads y dobles |
| [0231 · Worker `exportar`](../../tareas/0231-worker-comando-exportar.md) | Pendiente | — | Fotogramas por stdin, mezcla, AV1/VP9 + Opus, progreso, errores, verificación; pytest en los 3 SO |
| [0232 · Capacidades y licencias](../../tareas/0232-capacidades-de-exportacion-y-licencias-de-codecs.md) | Pendiente | — | `capacidades-exportacion`, `inspeccionar_av.py` exige los códecs, `THIRD_PARTY_NOTICES.md` |
| [0233 · Tubería y bucle](../../tareas/0233-cliente-del-worker-con-tuberia-y-bucle-de-fotogramas.md) | Pendiente | 0230 | Cliente del worker con stdin y prioridad baja; bucle con ≤ 2 fotogramas pendientes |
| [0234 · Ventana offscreen](../../tareas/0234-ventana-offscreen-de-exportacion-y-rol.md) | Pendiente | 0230 | `exportacion.html`, rol, remitente, captura BGRA a escala 1, verificación del paquete |
| [0235 · Render por fotograma](../../tareas/0235-render-por-fotograma-y-marca-de-agua.md) | Pendiente | 0230, 0234, 0204, 0206, 0213 | `PantallaLetra` con `tiempoFijoMs`, animaciones por fotograma, anfitrión y marca de agua |
| [0236 · Destinos y diario](../../tareas/0236-destinos-temporal-y-diario-de-exportacion.md) | Pendiente | 0230 | Destino en main, temporal junto al destino, `rename`, limpieza y diario tras caída |
| [0237 · Servicio e IPC](../../tareas/0237-servicio-de-exportacion-e-ipc.md) | Pendiente | 0231–0234, 0236, 0202, 0203 | `ServicioExportacion`: cola, perfiles, instantánea, orquestación, cancelación, suspensión, cierre e IPC |
| [0238 · Diálogo: formulario](../../tareas/0238-dialogo-de-exportacion-formulario.md) | Pendiente | 0230 | A, E y F con formato, perfiles no soportados, destino, estimación, notas y muestra |
| [0239 · Progreso y resultado](../../tareas/0239-progreso-resultado-y-estado-de-exportaciones.md) | Pendiente | 0238 | Estado de exportaciones, B–D, toasts y anuncios |
| [0240 · Puntos de entrada](../../tareas/0240-puntos-de-entrada-de-la-exportacion.md) | Pendiente | 0239 | Biblioteca, editor (Ctrl/Cmd + E), panel de actividad, eliminar y cierre |
| [0241 · Integración, capturas e informe](../../tareas/0241-pruebas-de-integracion-capturas-e-informe-de-la-fase-6.md) | Pendiente | 0230–0240 | `exportacion.spec.ts` (≤ 3 pruebas), capturas opt-in, informe |

**Paralelismo.**

1. 0231 y 0232 (worker, Python) pueden empezar ya, sin esperar a nada.
2. 0230 va primero en TypeScript (necesita 0200 y 0201 de la fase 5).
3. Con 0230 integrada, cuatro líneas a la vez: main (0233 y 0236 en paralelo), ventana (0234), interfaz (0238 → 0239 → 0240, contra la API falsa) y render (0235, cuando también estén 0204, 0206 y 0213).
4. 0237 es el punto de integración de main (necesita 0231–0234 y 0236, y 0202/0203 de la fase 5).
5. La integración en Electron de 0235 y 0238–0240 necesita 0237. Hasta entonces, cada una se prueba con dobles.
6. 0241 cierra la fase.

**Propiedad de archivos.**
- `shared/{exportacion,canales,ipc,errores,config}.ts`, `shared/__fixtures__/exportacion.ts` y `preload/`: solo 0230.
- `worker/shinobi_worker/exportar.py` y `worker/tests/test_exportar.py`: 0231. `worker/shinobi_worker/capacidades_exportacion.py`, `worker/scripts/inspeccionar_av.py` y `THIRD_PARTY_NOTICES.md`: 0232. `worker/shinobi_worker/comandos.py`: 0231 y luego 0232 (una línea cada una).
- `main/trabajos/worker.ts` y `main/exportacion/bucle.ts`: 0233.
- `main/exportacion/ventana.ts`, `main/ventana/registro.ts`, `main/seguridad.ts`, `electron.vite.config.ts`, `renderer/exportacion.html` y el script de verificación del paquete: 0234.
- `karaoke/PantallaLetra.tsx`, su CSS y `karaoke/animacionesPorFotograma.ts`, y `renderer/src/exportacion/{main.tsx,AppExportacion.tsx,MarcaDeAgua.tsx}`: 0235 (después de 0213, que toca el mismo `PantallaLetra`).
- `main/exportacion/{destinos,diario}.ts`: 0236.
- `main/exportacion/servicio.ts`, `main/ipc/handlers.ts`, `main/index.ts` y `main/cierre.ts`: 0237.
- `renderer/src/exportacion/dialogo/**` y `textos.ts`: 0238; `renderer/src/exportacion/estado.ts` y los estados B–D: 0239.
- `vistas/biblioteca/` (menú y línea de la tarjeta, eliminar), `vistas/editor/` (⋯ y atajo), panel de actividad y `navegacion/{DialogoCierre,textosCierre}`: 0240.
- `e2e/`: 0234 añade `exportacion-captura.spec.ts` y amplía `seguridad.spec.ts`; 0241 añade `exportacion.spec.ts` y `exportacion-capturas.spec.ts` (opt-in).

**Guía manual de la fase** (`docs/Test-manuales/0.2.0/fase-6-exportacion.md`, la escribe `qa`): M1–M9 de la spec 10; tiempos y tamaños de 1080p30 y 4K/60 en Windows y Linux frente a la tabla del ADR; exportar durante una sesión en dos pantallas reales con un perfil modesto y con 4K/60; suspensión del equipo durante una exportación larga; reproducción del archivo en VLC, OBS, navegadores y los reproductores de serie de los 3 SO (alimenta `exp.formato.ayuda`).

## Fases siguientes

| Fase | Alcance | Desglose |
|---|---|---|
| 3 | Temas y agrupación de biblioteca | Desglosada arriba (0163–0176), con [0047](../../preguntas/0047-temas-asignados-edicion-y-borrado.md) y [0052](../../preguntas/0052-predeterminado-y-canciones-que-dependen-de-el.md) |
| 4 | Ventana secundaria y cola | Desglosada arriba (0177–0190), con [0048](../../preguntas/0048-escucha-editor-durante-evento.md), [0049](../../preguntas/0049-politica-cola-de-reproduccion.md) y [0058](../../preguntas/0058-interfaz-de-la-sesion-en-vivo-y-la-cola.md)–[0061](../../preguntas/0061-reproductor-en-otra-pantalla-con-wayland.md) |
| 5 | Degradados, comodines, Letra lista y ajuste de silencios | Desglosada arriba: 0200–0219 (primera ola 0200–0210, interfaz 0211–0219) ([ADR 0018](../../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md)) |
| 6 | Exportación | Desglosada arriba (0230–0241), con la prueba técnica de [0050](../../preguntas/0050-perfiles-y-concurrencia-exportacion.md) ([ADR 0019](../../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md)) |

La [publicación pendiente del MVP](../../tareas/0142-primera-version-publica.md) sigue en la hoja de ruta.

## Publicación en Releases

Petición del usuario (2026-11-20): desde 0.2.0, cada versión tiene su *Release* en GitHub, generada por el workflow. Decisión en el [ADR 0020](../../adr/0020-publicacion-en-github-releases-y-politica-de-versiones.md); procedimiento en el [flujo de Git](../../workflow.md#versiones-y-publicación). Independiente de las fases: puede avanzar en paralelo y no toca `src/`.

| Tarea | Qué entrega | Depende de |
|---|---|---|
| [0191](../../tareas/0191-script-de-version-subir-y-comprobar.md) | `app/scripts/version.mjs`: `version:subir` y `version:comprobar` sobre los 5 archivos de versión | — |
| [0192](../../tareas/0192-workflow-disparador-por-etiqueta-y-comprobar-version.md) | `empaquetado.yml`: disparador `v*`, `concurrency` y trabajo `comprobar-version` | 0191 |
| [0193](../../tareas/0193-workflow-preparar-la-publicacion-y-notas.md) | Trabajo `preparar-publicacion`: `SHA256SUMS.txt`, notas y artefacto `publicacion-<versión>` (el ensayo) | 0192 |
| [0194](../../tareas/0194-workflow-publicar-en-github-releases.md) | Trabajo `publicar`: único con `contents: write`; borrador → recursos → publicar; *pre-release* si hay sufijo | 0193 |
| [0195](../../tareas/0195-ensayo-de-publicacion-y-version-0-2-0-alpha-1.md) | Versión `0.2.0-alpha.1`, borrador de notas y ensayo con `workflow_dispatch` en `alpha-2` sin publicar | 0191–0194 |

**Orden.** 0191 → 0192 → 0193 → 0194 → 0195, en secuencia: 0192–0194 editan el mismo `empaquetado.yml` y `workflow-empaquetado.test.ts`.

**Propiedad de archivos.** `app/scripts/version.mjs` y su test: 0191. `.github/workflows/empaquetado.yml` y `app/scripts/workflow-empaquetado.test.ts`: 0192 → 0193 → 0194. `app/scripts/preparar-publicacion.mjs` y `.github/publicacion/`: 0193. Los 5 archivos de versión y `docs/versiones/0.2.0/notas/`: 0195.

**Preguntas.** [0140](../../preguntas/0140-publicar-las-alfas-como-pre-release-publica.md) (usuario: publicar alfas como *pre-release* antes de cerrar la puerta de 0142, *immutable releases* y protección de etiquetas) condiciona solo la primera etiqueta real. [0141](../../preguntas/0141-readme-y-notas-con-solo-versiones-preliminares.md) (diseñador: README y notas con solo versiones preliminares) no bloquea; 0193 usa textos provisionales. [0036](../../preguntas/0036-numero-de-version-y-politica-de-versiones.md) queda con opción provisional.

**Verificación.** Las pruebas de feedback validan la estructura del YAML con Vitest (y `actionlint` si está disponible). El ensayo de 0195 demuestra en GitHub todo menos la creación de la *Release*. La publicación real se verifica con la primera etiqueta `v0.2.0-alpha.N`, en la guía manual de la versión.
