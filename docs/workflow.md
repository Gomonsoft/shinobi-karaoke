# Flujo de Git

`develop` integra las fases de la versión en curso. `main` es la rama de publicación protegida y recibe cambios por PR.

1. Abre cada fase desde `develop` en una rama `fase/0.2.0-N-<nombre>`.
2. Al cerrar la fase, incluye su informe y abre un PR hacia `develop`. La revisión comprueba los criterios de aceptación y las verificaciones de la fase.
3. Al cerrar la versión, abre un PR de `develop` hacia `main`. Tras fusionarlo, etiqueta el commit de publicación como `v0.2.0-alpha`.
