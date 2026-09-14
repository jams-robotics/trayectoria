# ADR-0006 · Controlador intercambiable

Fecha: 2026-09-13 · Estado: aceptado

## Contexto
En v1 el estudiante controla el robot con parámetros (sliders). En v2 escribirá su propio controlador. No queremos rehacer el simulador para eso.

## Decisión
Una sola interfaz `Controller<P> { params; reset(); update(reading, state, dt_s) → WheelCommand }`. Los controladores integrados de v1 (manual, on/off, P, PID) la implementan. En v2, el código del estudiante se envuelve en la misma interfaz dentro de un sandbox.

## Consecuencias
Ninguna parte del simulador conoce el tipo concreto de controlador. Los parámetros se exponen mediante un esquema (`ParamPanel`) que en v2 puede venir del código del estudiante.
