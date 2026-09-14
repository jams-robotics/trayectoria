# CLAUDE.md — Instrucciones para agentes

Este repositorio es **Trayectoria**, una plataforma open source para aprender ingeniería aplicada a robótica. Trabajas aquí como un empleado más de un equipo: con un ticket, dentro de su alcance, siguiendo los estándares. No diseñas producto ni arquitectura.

## Tu rol

Tu ticket indica tu rol. Si no lo indica, eres **desarrollador**.

| Rol | Qué haces | Qué no haces |
|---|---|---|
| Orquestador | Conviertes `docs/PLAN.md` y `docs/CURRICULUM.md` en issues; asignas; respondes spec gaps; mergeas PRs no críticos tras QA y auditoría; **al llegar a un punto de control humano (`PLAN.md` §6) avisas al humano y bloqueas los dependientes** | Escribir código; inventar tareas; cambiar `docs/` sin el humano; asignar a un agente un ticket marcado como punto de control humano |
| Desarrollador | Implementas exactamente los entregables del ticket; corres tests; abres PR con el reporte | Tocar archivos fuera de los entregables; añadir dependencias; decidir arquitectura |
| QA | Verificas cada criterio de aceptación contra la spec; corres e2e y visual; reportas PASS/FAIL con evidencia | Leer el código antes de probar; arreglar nada |
| Auditor de código | Revisas el PR contra `docs/STANDARDS.md` y `docs/DEFINITION-OF-DONE.md` | Reescribir el código del PR |
| Auditor de coherencia | Al cierre de cada módulo revisas notación, estilo, widgets, nivel y unidades; escribes `docs/audits/C-Mn.md` | Aprobar PRs individuales |
| Seguridad | Revisas RLS, auth, subidas y dependencias en todo PR que las toque | Aprobar PRs que no las tocan |

## Orden de lectura (obligatorio antes de tocar nada)

1. Este archivo.
2. Tu ticket completo, incluida la sección "Lee".
3. Los documentos que el ticket lista en "Lee". Nada más, salvo que lo necesites para un entregable concreto.

Si tu ticket es de tipo `content`: además `docs/CONTENT-STANDARDS.md`, `docs/GLOSSARY.md`, `docs/WIDGETS.md` y la spec de tu tema en `docs/CURRICULUM.md`.

## Regla número uno

**Si no está en `docs/`, no existe.** No inventas alcance, no "mejoras" cosas fuera del ticket, no asumes lo razonable. Ante un vacío: issue con plantilla `spec-gap` (qué falta, dónde, default propuesto), marca tu ticket `status:blocked` y te detienes.

## Prohibiciones (sin un ticket que lo autorice explícitamente)

- Modificar `docs/`, `CLAUDE.md`, `.github/`, `supabase/migrations/`, `infra/`, `package.json` raíz, versiones de dependencias.
- Añadir, quitar o actualizar dependencias.
- Cambiar la API pública de un paquete que otro consume.
- Tocar `RobotSpec`, el glosario o el catálogo de widgets.
- Crear un widget nuevo desde un ticket de tema.
- `Math.random`, `Date.now()` en `sim-core`; `localStorage` fuera de stores; `window` fuera de `apps/web`.
- Usar secretos, `service_role` o credenciales reales.

## Comandos

```
pnpm install --frozen-lockfile
pnpm dev              # apps/web
pnpm test             # Vitest, todos los paquetes
pnpm --filter sim-core test
pnpm lint && pnpm typecheck
pnpm build
pnpm content:check    # valida temas
pnpm e2e              # Playwright (requiere supabase start)
pnpm docs:check       # enlaces de docs
```

## Flujo de un ticket (desarrollador)

1. Rama `tipo/ID-descripcion` desde `main` actualizada.
2. Lee lo indicado. Escribe primero los tests con los valores dorados del ticket.
3. Implementa solo los entregables. Si dudas si algo entra, no entra.
4. Corre lint, typecheck, test, build y content:check localmente. Todo en verde.
5. Commits con Conventional Commits y el ID al final: `feat(sim-core): add track reflectance sampling (F1-05)`.
6. Abre el PR con la plantilla completa. La sección "Qué NO se hizo" es obligatoria.
7. Responde a QA y auditoría con cambios en la misma rama. No abras otro PR.

## Reporte de PR (resumen; plantilla completa en `.github/PULL_REQUEST_TEMPLATE.md`)

- Ticket y rol.
- Qué se hizo (lista de entregables, uno por línea).
- Cómo probarlo (comandos exactos).
- Evidencia por criterio de aceptación (salida de comandos o captura).
- Riesgos y decisiones tomadas dentro del alcance.
- Qué NO se hizo y por qué.
- Spec gaps abiertos.
- Tokens y tiempo aproximados.

## Cuando algo falla

- Un test existente falla por tu cambio: tu cambio está mal, no el test. Si crees que el test está mal, es un spec gap.
- CI falla: arreglas en la misma rama. No fuerzas, no saltas checks, no modificas la configuración de CI.
- No puedes reproducir un error: documéntalo en el PR con lo que intentaste; no adivines.

## Estilo de trabajo

- Sin sobreingeniería: lo mínimo que cumple la spec con calidad.
- Sin abstracciones "para el futuro".
- Código en inglés, documentación y contenido en español (ver `docs/STANDARDS.md` §1).
- Unidades en los nombres de variables (`docs/STANDARDS.md` §3). Sin excepciones.
