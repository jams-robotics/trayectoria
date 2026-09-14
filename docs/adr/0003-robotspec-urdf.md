# ADR-0003 · RobotSpec como único formato interno; URDF como único formato de importación

Fecha: 2026-09-13 · Estado: aceptado

## Contexto
Hay tres orígenes de robot: el perfil "Mi robot" (formulario), el catálogo y los URDF que suben los usuarios. Sin un formato único, cada simulador y widget interpretaría datos distintos.

## Decisión
`RobotSpec` (JSON versionado, validado con zod) es lo único que leen widgets, simuladores y sim-core. URDF es el estándar de facto en robótica y el único formato de importación en v1. Se mapea a RobotSpec en `sim-core/urdf`.

## Alternativas descartadas
- Usar el objeto de `urdf-loader` como modelo: acopla todo a three.js y no sirve para el robot móvil ni para mostrar matrices.
- MJCF o SDF: menos extendidos en brazos educativos; se pueden añadir como importadores en v2.

## Consecuencias
El visor 3D usa `urdf-loader` solo para mallas y jerarquía; los números que ve el usuario salen de sim-core. Un test verifica que coinciden.
