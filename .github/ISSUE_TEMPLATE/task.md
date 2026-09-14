---
name: Ticket
about: Tarea del backlog de docs/PLAN.md o tema de docs/CURRICULUM.md
title: 'F1-04 · Título del ticket'
labels: status:ready
---

<!-- Ningún campo se deja vacío; si no aplica, escribir "ninguno". Añade las etiquetas type:*, size:* y module:* al crear el issue. -->

```
ID: F1-04                      (o T-4.2 para temas, C-M4 para auditorías)
Título: Modelo diferencial cinemático
Tipo: infra | core | widget | sim | content | qa | docs
Tamaño: S | M | L              (L se divide antes de asignar)
Rol: desarrollador | qa | auditor-codigo | auditor-coherencia | seguridad
Módulo: M0..M6 | ninguno
Crítico (mergea humano): sí | no
Revisión de seguridad: sí | no
```

## Contexto (2 líneas)

Qué es esta pieza y para qué la usa el producto.

## Depende de

IDs de tickets que deben estar en Done.

## Lee (solo esto)

- docs/ARCHITECTURE.md §4.1
- docs/GLOSSARY.md

## Entregables (rutas exactas)

- packages/sim-core/src/mobile/diffDrive.ts
- packages/sim-core/src/mobile/diffDrive.test.ts

## Especificación

Comportamiento, firmas TypeScript, fórmulas, textos, valores por defecto.
Para temas: gancho, objetivos, fórmulas, experimentos, aterrizaje, ejercicios con valores dorados, referencias, widgets con props.

## Criterios de aceptación (verificables, uno por línea)

- [ ] ...
- [ ] ...

## Fuera de alcance

Lo que este ticket explícitamente NO hace.

## Valores dorados

Entradas → salidas esperadas, con tolerancia.
