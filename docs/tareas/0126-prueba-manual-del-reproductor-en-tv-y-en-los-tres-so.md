# 0126 — Prueba manual del reproductor: legibilidad a 5 m, sincronía, voz guía, pantalla completa y pantalla encendida (3 SO)
- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: 0115, 0119–0122 (y 0111 como referencia de método)
- ADRs: 0011, 0010
- Spec UX: docs/ux/07-reproductor.md (criterios 1, 4, 5, 9, 26, 33; §"Legibilidad a distancia")
- Archivos: solo esta tarea (resultados en "Notas") y capturas en `docs/ux/revision-fase-6/`.
- Paralelizable con: 0123. **La hace una persona.**

## Objetivo
Comprobar lo que un E2E no puede: lo que se ve y se oye de verdad.

## Pasos y criterios
Con `npm run semilla` y `npm run dev` (o el build), en macOS, Windows y Linux si es posible:
- [ ] **Sincronía** (canción 17 «Editor: pista de clics» tras sincronizarla en el editor, o la 20, cuyos pulsos caen cada 2 s): el barrido y el cambio de línea coinciden con el clic a ojo y oído (≤ 50 ms con cable o altavoces). Repetir tras pausar y reanudar, y tras buscar.
- [ ] **Voz guía**: con una canción real separada, subir y bajar el volumen de la voz y silenciarla. La voz y el instrumental no se desfasan en toda la canción, tampoco tras buscar ni tras el silencio previo. El nivel se recuerda al reabrir.
- [ ] **Silencio previo**: con la canción 20, título ~2 s → «Primera luz…» como siguiente ~1 s → `●●●` 3 s → la línea entra cuando suena el primer pulso. ⏮ lo repite.
- [ ] **Pantalla completa**:
  - en macOS, la entrada y la salida con Esc dejan la ventana como estaba: normal, maximizada (zoom verde con Alt) o ya a pantalla completa;
  - en Windows/Linux, también con la ventana maximizada;
  - F11 / Ctrl+Cmd+F y el botón verde cambian el icono ⛶;
  - con el zoom de la app al 125 %, Ctrl/Cmd + / − / 0 no hacen nada dentro del reproductor y el zoom vuelve a funcionar al salir.
- [ ] **Pantalla encendida**: con el ahorro de energía del sistema a 1 min, una reproducción de 2 min no apaga ni atenúa la pantalla; en pausa sí se apaga a su tiempo.
- [ ] **Legibilidad**: en un televisor (ideal 55" a 5 m; anota el tamaño y la distancia reales), la línea actual se lee bien y la siguiente se puede anticipar, con un estilo claro y uno oscuro. Captura a 1080p y, si hay pantalla 4K, a 2160p (escalado 100 % y 200 %).
- [ ] **Desde el editor**: Probar, `.`/`,`, Esc. La vista previa del editor y el reproductor muestran lo mismo en el mismo instante.

## Notas de implementación
(la persona que lo prueba anota equipo, SO, salida de audio y resultados)
