# ADR-0010 · Dos rutas encadenadas y temas en reserva

Fecha: 2026-09-29 · Estado: aceptado (decisión del propietario en #574)

## Contexto

La ruta única de 28 temas en 7 módulos no respetaba sus propias dependencias: el módulo Rotación llegaba después de Dinámica y Energía, que ya usaban `v = ω·r`, la aceleración angular y la reducción; Torque y Transmisión enseñaban lo mismo; la mitad de los temas no llegaba al proyecto final; y dos temas (Caída libre y Tiro parabólico) invocaban una pinza y un lanzador que el robot no tiene. La auditoría de contenido externa del 2026-09-26 (hallazgos M-02, M-06, M-07, M-08, M-09) propuso separar la física de la robótica en dos rutas encadenadas donde el robot sigue presente desde el primer tema. Hasta ahora el código suponía una sola ruta (`ruta-1`), exigía que los prerrequisitos estuvieran en la misma ruta y no filtraba por `status`.

## Decisión

- Dos rutas: `ruta-1` «Fundamentos: física y matemática para robots» (4 módulos, 14 temas) y `ruta-2` «Robot móvil: del encoder a la pista» (3 módulos, 11 temas). `ruta-2` declara que sigue a `ruta-1` (`follows` en `ruta.json`).
- Renumeración ahora, antes del lanzamiento: el id de un tema es su posición en su ruta (`ruta-N/mMM-tNN`), con una tabla de equivalencias en `CURRICULUM.md` que es la fuente de la migración del progreso, las redirecciones y el movimiento de carpetas, claves y enlaces.
- Prerrequisitos por tema con id completo, resueltos contra todas las rutas.
- Solo se publica lo que tiene `status: published`. Los temas ocultos pasan a `content/es/reserva/<slug>/` en `draft`, fuera de las rutas; no se borran.
- Las URLs antiguas de temas movidos redirigen con `redirects` de Astro, que en un sitio estático sirve igual en Cloudflare Workers y con Caddy.

Detalle en `ARCHITECTURE.md` §3.2, §3.3, §3.5 y §5.4, y en `CURRICULUM.md`, «Estructura».

## Alternativas descartadas

- **Conservar los ids y cambiar solo el orden.** La URL y la carpeta dejarían de coincidir con el módulo para siempre, y cada tema nuevo arrastraría la excepción. Antes del lanzamiento no hay progreso real que migrar; después, el mismo cambio exige migrar datos de usuarios.
- **Una sola ruta reordenada.** Cumple las dependencias, pero mezcla en un mismo índice la física que un estudiante cursa en paralelo con la robótica que la usa, y no deja una ruta de fundamentos que un docente pueda seguir junto a su curso de Física 1.
- **Borrar Caída libre y Tiro parabólico.** Su física es correcta y su widget está bien resuelto; una ruta futura (lanzador, brazo) puede reutilizarlos.

## Consecuencias

- Tres URLs antiguas (`/ruta/ruta-1/m01/t03`, `/ruta/ruta-1/m01/t04`, `/ruta/ruta-1/m02/t03`) sirven ahora otro tema y no pueden redirigir.
- Hay ids que son a la vez antiguos y nuevos: la migración del progreso se ejecuta una sola vez, y la copia del navegador lleva una versión (`routesVersion`) para no convertirse dos veces.
- El aula, el índice, la portada y «Ruta completada» trabajan por ruta.
- Añadir una ruta futura es añadir su carpeta y su `ruta.json`; un tema de la reserva vuelve a publicarse moviéndolo a una ruta con `status: published`.
