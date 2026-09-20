# ADR-0009 — Exports por widget en `@trayectoria/widgets`

Fecha: 2026-09-20 · Estado: aceptado

## Contexto

`ARCHITECTURE.md` §8 fija un presupuesto de 250 kB de JS comprimido por página de tema. Medido, el bundle de una página de tema llega a 297,6 kB gzip (#188): por encima del presupuesto. La causa está en la superficie pública del paquete, no en ningún widget concreto. `@trayectoria/widgets` se consume por su barrel (`.`), así que importar un widget arrastra el módulo que reexporta todos los demás, y un tema que usa dos widgets paga por todo el catálogo.

## Decisión

`@trayectoria/widgets` expone **cada widget como una entrada propia** en `exports` (`"./VectorWidget"`, `"./ExerciseWidget"`, …), además del barrel `.` y de las entradas que ya existen (`./scene3d`, `./dev`). El barrel no se elimina: sigue siendo la API de quien quiere todo el catálogo, y quitarlo rompería a los consumidores actuales sin necesidad.

La página de tema resuelve cada widget que su MDX declara con `import()` dinámico por nombre, desde la entrada de ese widget. Los componentes de interfaz comunes (`ParamPanel`, `Formula`, `Plot`) pueden seguir en un chunk compartido: los usan casi todos los widgets y separarlos no ahorra nada.

Con esto la aserción del presupuesto de `ARCHITECTURE.md` §8 pasa a ser exigible en CI.

## Alternativas descartadas

- **Subir el presupuesto a 300 kB.** Cambia el criterio en vez del problema. El presupuesto de §8 se fijó para que una página de tema cargue rápido en una conexión escolar; el bundle no es grande porque el contenido lo exija, sino porque el barrel impide separar lo que no se usa.
- **`manualChunks` en la configuración de Rollup.** Reparte el mismo código en más archivos, pero la página de tema los sigue pidiendo todos: el grafo de importación no cambia, solo su empaquetado. Además ata el rendimiento a una configuración del bundler en vez de a la forma del paquete.

## Consecuencias

- La superficie pública de `@trayectoria/widgets` crece: una entrada por widget. Añadir un widget nuevo implica añadir su entrada en `exports`, además de lo que ya pide `DEFINITION-OF-DONE.md`.
- `STANDARDS.md` §4 sigue mandando: cada entrada apunta al `index.ts` de su widget, que reexporta solo la API pública de ese widget.
- Un widget importado del barrel y otro de su entrada propia son el mismo módulo; no hay estado duplicado que vigilar.
- El presupuesto de §8 deja de ser una meta y pasa a ser una aserción que rompe CI si se supera, así que una regresión de bundle se ve en el PR que la introduce.
- `/cuenta` y `/aula` no tienen presupuesto propio en §8; se miden y se anotan, pero no bloquean.
