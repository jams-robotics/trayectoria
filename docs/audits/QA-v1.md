# QA global — QA-v1

2026-09-26 · QA · F7-04 (#464) · rama `qa/F7-04-qa-global` sobre `main` (a618bb1)

## 1. Spec

`docs/PLAN.md` § Fase 7, F7-04: e2e de la ruta completa (registro → 27 temas con al menos un ejercicio cada uno → simulador móvil con «Mi robot» → docente ve el progreso); smoke en móvil (viewport 390 px); informe de defectos. Aceptación: `docs/audits/QA-v1.md` sin defectos bloqueantes abiertos.

## 2. Método

Entorno: Supabase local (`pnpm dlx supabase@2.117.0 start` + `db reset` para aplicar las migraciones 0001–0007), `astro dev` propio de esta QA en el puerto 4390 (`apps/web/playwright.local.config.ts`, sin versionar), Chromium de Playwright 1.63.0 (única versión instalada en este repo; `devices['iPhone 12']` se usa solo por su viewport/UA/touch, forzando `browserName: 'chromium'`).

Dos specs nuevos, `apps/web/e2e/ruta-completa.spec.ts` y `apps/web/e2e/movil-smoke.spec.ts`:

- **`ruta-completa.spec.ts`**: registra un estudiante nuevo, recorre los 27 temas de `content/es/ruta-1/ruta.json` (`/ruta/ruta-1/<mNN>/<tYY>`) y resuelve un ejercicio escalar de `Verifica` en cada uno, guarda un radio de rueda propio en `/cuenta` y lo comprueba en `/simuladores/movil` («Mi robot», como `my-robot-fuera-de-cuenta.spec.ts`), y por último un docente crea un aula, el estudiante se une (`helpers/supabase.ts`, como `aula-progreso.spec.ts`) y el docente ve al menos una celda de progreso que dejó de ser `pending`.
  - `apps/web` (esta QA incluida) solo puede importar de `sims`, `widgets`, `progress`, `auth`, `db`, `i18n`, `robot-spec` y `content` (`docs/ARCHITECTURE.md` §2, `import-x/no-restricted-paths`), así que el spec no puede traer `@trayectoria/sim-core` para regenerar la respuesta esperada desde la semilla del ejercicio, y QA no lee las fórmulas de cada `ejercicios.ts` antes de probar. Cada ejercicio se resuelve como una caja negra: `check()` (`packages/sim-core/src/exercises/check.ts`) devuelve un error relativo `|respuesta − esperado| / |esperado|` para cualquier intento, así que un valor de prueba y su error implican dos candidatos algebraicos para «esperado»; el spec prueba ambos, se queda con el que reduce más el error, y repite hasta acertar o agotar los intentos. Solo puede resolver así ejercicios de respuesta escalar (un campo), así que por tema elige el primer ejercicio de `Verifica` con exactamente un campo.
- **`movil-smoke.spec.ts`**: `devices['iPhone 12']` (390 px) sobre inicio, un tema de nivel inicial (m00-t01), un tema de M6 (m06-t01), el simulador móvil, el simulador de brazo y el aula del docente; en cada uno comprueba consola sin errores, sin scroll horizontal y los controles principales visibles.

Comandos:

```
pnpm dlx supabase@2.117.0 start
pnpm dlx supabase@2.117.0 db reset
CLAUDECODE='' pnpm exec playwright test --config=apps/web/playwright.local.config.ts --workers=1
```

## 3. Resultados por criterio de aceptación

| Criterio | Resultado | Evidencia |
| --- | --- | --- |
| e2e registra un estudiante nuevo | Cumple | `ruta-completa.spec.ts`, paso 1 (`signUp('student', …)` + login por UI) |
| Recorre los 27 temas de `ruta.json` | Cumple | `expect(TOPICS).toHaveLength(27)`; los 27 aparecen en el log (`[ruta-completa] <topicId> (<título>): ok`) |
| Resuelve al menos un ejercicio por tema | Cumple, 27/27 | Los 27 temas se gradúan `data-status="correct"` en la corrida final (ver §5) |
| Simulador móvil con «Mi robot» | Cumple | Guarda radio de rueda 0.05 m en `/cuenta`, `/simuladores/movil` muestra `robot-source-select = "my-robot"` y reproduce con `t > 0` |
| Un docente ve el progreso del estudiante en su aula | Cumple, con matiz | El docente ve la fila del estudiante y al menos una celda de progreso deja de ser `pending`. Una celda pasa a `completed` (y cuenta en el resumen «N/27») solo cuando **todos** los ejercicios obligatorios de ese tema están correctos (`packages/progress/src/model.ts` `isCompleted`); este spec resuelve uno por tema, así que el resumen puede seguir en «0/27» aunque los 27 temas se hayan intentado — ver defecto D-3 (severidad menor, es de este método de prueba, no del producto) |
| Smoke móvil (390 px), 5 páginas, sin errores de consola, sin scroll horizontal, controles visibles | Cumple, 6 páginas (se añadió el aula) | `movil-smoke.spec.ts`, 6/6 en verde |
| `docs/audits/QA-v1.md` sin defectos bloqueantes abiertos | Cumple | Ningún defecto de la tabla §4 es bloqueante |

## 4. Tabla de defectos

| id | dónde | pasos para reproducir | severidad | evidencia |
| --- | --- | --- | --- | --- |
| D-1 | `packages/widgets/src/ExerciseWidget/state.ts` (`useSeed`) | Con sesión iniciada, abrir cualquier tema de la ruta y llegar (scroll) a un `ExerciseWidget` de Verifica. | mayor | Consola: «Hydration failed because the server rendered text didn't match the client»; el enunciado cambia de número justo tras la carga. Reproducido en 26 de 27 temas durante esta misma corrida (`ruta-completa.spec.ts`, log `hydration mismatch on Verifica`). Issue [#482](https://github.com/jams-robotics/trayectoria/issues/482) |
| D-2 | `/` (inicio) | Ninguno; hallazgo de diseño del spec, no del producto — el CTA de inicio es «Empezar la ruta» (`common.home.startRoute`), no «Crear cuenta»; corregido en el spec antes de esta corrida. | — (no es defecto de producto) | Ver commit del spec; se deja anotado por transparencia del método |
| D-3 | `/aula` — resumen de progreso | Resolver un solo ejercicio (de varios obligatorios) de un tema y mirar `progress-summary` en el aula del docente. | menor | El resumen «N/27» solo cuenta temas `completed` (todos los ejercicios obligatorios correctos); un tema con un ejercicio correcto de varios se queda en `in_progress` y no suma. Es el comportamiento esperado de `isCompleted` (`packages/progress/src/model.ts`), documentado aquí porque el criterio de aceptación de F7-04 («el docente ve el progreso») podría leerse como «ve avance», y el resumen agregado no lo refleja hasta completar el tema entero — no se abre issue: no es una desviación de la spec de progreso (F3-02b), solo una aclaración para quien valide este informe |

Ningún defecto de la tabla es bloqueante. D-1 se abrió como issue `bug` porque, aunque no bloquea el flujo (el ejercicio queda usable tras el remount), es sistemático y visible como error de consola en casi cada tema para todo estudiante con sesión.

## 5. Resumen frente a la spec

Los 27 temas de la ruta se completan con al menos un ejercicio correcto, el simulador móvil refleja «Mi robot», y el docente ve el progreso del estudiante en su aula. El único hallazgo con severidad mayor (D-1) no impide ningún flujo: el ejercicio se recupera solo tras el remount y el estudiante puede responder con normalidad; se reporta porque ocurre en casi cada tema y ensucia la consola con un error de React en cada carga con sesión. No hay defectos bloqueantes.

## 6. Para la validación del humano

- F7-04 es un punto de control humano (`docs/PLAN.md` § Puntos de control humanos): F7-06 depende de que el humano apruebe este informe.
- D-1 (mayor) queda abierto en [#482](https://github.com/jams-robotics/trayectoria/issues/482) sin agente asignado; no bloquea este informe pero sí conviene resolverlo antes del lanzamiento público, dado que afecta a todo estudiante con sesión en casi cualquier tema.
- El método de resolución de ejercicios de `ruta-completa.spec.ts` (caja negra, sin leer `ejercicios.ts`) es deliberado: `apps/web` no puede importar `@trayectoria/sim-core` y QA no lee el código fuente antes de probar. Vale la pena que el humano confirme que este método —y no una lista de valores dorados leída del contenido— es el que se espera de este ticket.

## 7. Cómo reproducir

```bash
git fetch origin && git worktree add ../wt-qa -b qa/verify origin/main
cd ../wt-qa
corepack pnpm install --frozen-lockfile
cp .env.example .env
export PATH="/c/Users/user/AppData/Local/Programs/DockerDesktop/resources/bin:$PATH"
corepack pnpm dlx supabase@2.117.0 start
corepack pnpm dlx supabase@2.117.0 db reset
# apps/web/playwright.local.config.ts (sin versionar): puerto 4390, reuseExistingServer: false,
# testMatch: ['ruta-completa.spec.ts', 'movil-smoke.spec.ts']
cd apps/web
CLAUDECODE='' corepack pnpm exec playwright test --config=playwright.local.config.ts --workers=1
```
