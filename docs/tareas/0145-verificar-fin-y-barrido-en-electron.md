# 0145 — Verificar fin y barrido en Electron

- Estado: Hecha
- Paso del pipeline: 4 y 6
- Depende de: [0143](0143-fin-de-linea-independiente.md), [0144](0144-barrido-por-renglon-visual.md), [0123](0123-e2e-reproductor-sin-red.md)
- ADRs: [0005](../adr/0005-letras-y-formato-de-sincronia.md), [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md), [0011](../adr/0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md)
- Specs: [Editor](../ux/06-editor.md), [Reproductor](../ux/07-reproductor.md)

## Objetivo

Comprobar la geometría y el comportamiento temporal a través de los puntos de entrada reales.

## Archivos y contrato

Ampliar `app/e2e/editor.spec.ts` y `app/e2e/reproductor.spec.ts`, con fixtures existentes o una canción con audio generado y letra inventada. Sembrar tiempos deterministas sin red ni descarga de modelos. Para evaluar geometría, medir los renglones reales y cobertura decorativa de un fotograma en un intervalo donde el resultado esperado sea estable. Esperar condiciones observables en vez de usar demoras fijas.

## Criterios de aceptación

- [x] En Editor se fija 15,80 s como fin de la línea que comienza a 12,40 s. Guardar y volver a abrir conserva esa marca y el siguiente inicio de 17,10 s.
- [x] Vista previa y reproductor muestran el hueco sin línea activa, incluso al buscar en él durante reproducción. La siguiente entra a 17,10 s. Cubrir offset en los cálculos.
- [x] Una ventana angosta parte el texto en varios renglones. Se verifica un fotograma con avance solo en el primero y otro con el primero lleno y el siguiente parcial. Se cambia ancho durante reproducción y se comprueba el mismo orden en la disposición nueva.
- [x] Los E2E no dependen del tiempo de carga de red, de letras reales ni de modelos.

## Verificación

Desde `app/`, con Node 24 y `SHINOBI_UV` apuntando a uv, ejecutar:

```sh
npm run build
npx playwright test e2e/editor.spec.ts e2e/reproductor.spec.ts --workers=1
npm test
npm run lint
npm run typecheck
npm run format:check
```

## Notas de implementación

- `editor.spec.ts` verifica la marca persistida al volver a abrir el editor. Con un desplazamiento de +500 ms, comprueba la línea activa antes del hueco, el silencio al buscar y la entrada de la línea siguiente en vista previa y reproductor.
- `reproductor.spec.ts` mide los rectángulos de texto de Chromium y su recorte decorativo. Comprueba el barrido secuencial y vuelve a medir tras redimensionar una ventana de Electron durante la reproducción. Ambos escenarios usan el audio generado de la semilla y letras inventadas.
- En Windows pasaron la compilación, las dos suites Playwright (22 pruebas), lint, tipos y formato. La ejecución global de Vitest registró 1866 pruebas correctas, 13 omitidas y 10 fallos fuera de estas suites. Ocho fallos se deben a permisos de enlaces simbólicos y dos afectan a los conteos de procesos huérfanos del worker. Quedan pendientes de verificación global.
