# ADR-0004 · Sin motor de física en v1

Fecha: 2026-09-13 · Estado: aceptado

## Contexto
La ruta 1 completa y ambos simuladores se pueden cubrir con modelos cinemáticos: el robot diferencial sin deslizamiento y la cinemática directa del brazo. Un motor de cuerpos rígidos (Rapier, cannon) añade meses, indeterminismo y superficie de errores.

## Decisión
Ambos simuladores son cinemáticos en v1. La dinámica (fuerzas, fricción, torques) se enseña con cálculo y visualización en M2–M3, no con simulación de cuerpos rígidos.

## Consecuencias
Sin colisiones, deslizamiento ni gravedad en los simuladores de v1. `sim-core` mantiene la interfaz `Model` para que un motor de física entre en v2 como otro modelo.
