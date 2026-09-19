# ADR-0008 — `fflate` para leer zips en el navegador

Fecha: 2026-09-19 · Estado: aceptado

## Contexto

La subida de un robot propio llega como un `.zip` con el URDF y sus mallas (F3-04, y el visor de F5-04). Hay que abrirlo y validarlo **en el navegador**, sin servidor: listar entradas, comprobar tamaños y rutas antes de descomprimir nada, y extraer solo los archivos que el visor necesita. `ARCHITECTURE.md` §3.4 fija las librerías y `STANDARDS.md` §8 exige un ADR para añadir cualquiera.

## Decisión

Se autoriza `fflate 0.8.3` (MIT) en `packages/sims` como **única** librería para leer y validar zips en el navegador, detrás del envoltorio propio `sims/urdf/zip`. Ningún otro paquete la importa directamente. Versión fijada sin `^`.

## Alternativas descartadas

- **Lector propio sobre `DecompressionStream`.** Sin dependencia, pero obliga a escribir y auditar el recorrido del directorio central del zip, los tamaños y los casos límite: más código propio que revisar que la superficie que evita.
- **`jszip`.** Cubre el caso, pero es notablemente más pesada en el bundle y su API asíncrona no aporta nada aquí; `fflate` permite inspeccionar las entradas sin descomprimirlas.

## Consecuencias

- Una dependencia de producción más en `packages/sims`, en el bundle solo de las páginas que cargan el visor.
- La validación (rutas, tamaños, número de entradas) vive en `sims/urdf/zip`, no en quien llama; cambiarla es un cambio de ese envoltorio.
- Si en el futuro hiciera falta escribir zips, se decide en un ADR nuevo: este solo autoriza leerlos.
