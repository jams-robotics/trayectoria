# Estándares de código

Aplican a todo el código del repositorio. El auditor de código revisa contra este documento; QA no lo lee.

## 1. Idiomas

- Código, identificadores, nombres de archivo, commits, mensajes de PR: **inglés**.
- Comentarios de código: inglés.
- Documentación en `docs/`, contenido en `content/`, textos de interfaz (locales): **español**.
- Claves i18n en inglés (`exercise.check`, `urdf.noRoot`), valores en español.

## 2. TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- Prohibido `any`. Usar `unknown` y estrechar. Prohibido `as` salvo en tests o con comentario `// SAFETY:` explicando por qué.
- Tipos por `interface` para objetos públicos, `type` para uniones y utilidades.
- Funciones exportadas con tipos de parámetros y retorno explícitos.
- `sim-core` y `robot-spec`: solo funciones puras y datos inmutables (`readonly`). Nada de clases con estado mutable, salvo `Simulation` y `SeededRng`, que están documentadas como tales.

## 3. Unidades en los nombres

Toda variable, propiedad o parámetro con magnitud física lleva sufijo de unidad SI:

| Magnitud | Sufijo | Ejemplo |
|---|---|---|
| Longitud | `_m` | `wheelRadius_m` |
| Tiempo | `_s` | `dt_s` |
| Ángulo | `_rad` | `theta_rad` |
| Velocidad | `_mps` | `v_mps` |
| Velocidad angular | `_radps` | `omega_radps` |
| Aceleración | `_mps2`, `_radps2` | `maxAccel_radps2` |
| Masa | `_kg` | `mass_kg` |
| Fuerza | `_N` | `force_N` |
| Torque | `_Nm` | `torque_Nm` |
| Potencia | `_W` | `power_W` |
| Energía | `_J` | `energy_J` |
| Revoluciones por minuto (solo en entrada de usuario o specs) | `_rpm` | `maxMotorSpeed_rpm` |

Los adimensionales no llevan sufijo (`gearRatio`, `mu_s`). Conversión solo en `sim-core/src/math/units.ts` y en la capa de UI. Un identificador con magnitud física sin sufijo es un hallazgo de auditoría.

## 4. Estructura y nombres

- Un módulo por concepto. Archivos en `camelCase.ts`; componentes React en `PascalCase.tsx` dentro de un directorio con `index.ts`, `Component.tsx`, `Component.test.tsx`, `Component.stories.tsx` (demo para `/dev/widgets`).
- Exportaciones nombradas; `export default` solo donde Astro o React lo exigen.
- Sin barrels gigantes: `index.ts` reexporta solo la API pública del paquete.
- Máximo 300 líneas por archivo, 40 por función. Si se excede, dividir.

## 5. React

- Componentes de función con hooks. Sin clases.
- Props tipadas con `interface XProps`. Sin props opcionales sin default documentado.
- Estado local con `useState`/`useReducer`; estado entre islas solo con nanostores.
- Sin `useEffect` para derivar datos; derivar en render o con `useMemo`.
- Render de canvas y three fuera del ciclo de React: refs y el driver de simulación.
- Accesibilidad obligatoria: controles con etiqueta, foco visible, operables con teclado.
- Estilo solo con clases de Tailwind mapeadas a los tokens de `docs/DESIGN.md`. Un color hexadecimal, un `px` de espaciado o una fuente escritos a mano en un componente son hallazgos de auditoría.

## 6. Errores

- `sim-core` y `robot-spec` no lanzan para errores esperados: devuelven `Result<T, E>` (`{ ok: true, value } | { ok: false, errors }`). Lanzan solo por bugs (invariantes).
- Errores de usuario llevan `code` y `i18nKey`. Nunca se muestra un mensaje en inglés al usuario.

## 7. Tests

- Cada archivo de `sim-core` tiene su `*.test.ts` con al menos un valor dorado analítico y un caso límite.
- Los valores dorados de `PLAN.md` y `CURRICULUM.md` son obligatorios y se citan en el nombre del test (`'F1-04 golden: vR=2vL circle radius'`).
- Sin `Math.random` en tests; semillas fijas.
- Capturas de regresión visual en `apps/web/e2e/visual/`; se actualizan solo con justificación en el PR.
- Las utilidades de espaciado y tamaño solo usan la escala de tokens `0..12` (o `w-panel`); `apps/web/src/styles/spacingScale.test.ts` falla con archivo y clase ante cualquier otra (#225).

## 8. Dependencias

- Solo las listadas en `ARCHITECTURE.md` §3.4. Añadir una requiere un ADR aprobado por el humano antes del PR.
- Versiones fijadas. `pnpm audit --audit-level=high` limpio.

## 9. Commits y PR

- Conventional Commits: `feat(sim-core): add differential drive model (F1-04)`. Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `content`. Scope = paquete o módulo. El ID del ticket va al final entre paréntesis.
- Rama: `tipo/ID-descripcion-corta` (`core/F1-04-diff-drive`).
- Un ticket = un PR. Un PR que toca archivos fuera de los entregables del ticket se rechaza.
- Squash merge. El título del squash sigue Conventional Commits.
- La plantilla de PR se llena completa (ver `templates/PR.md`).

## 10. Prohibiciones para agentes desarrolladores

Sin un ticket cuyo tipo lo autorice explícitamente, un desarrollador **no**:
- Modifica `docs/`, `CLAUDE.md`, `.github/`, `supabase/migrations/`, `infra/`, `package.json` raíz ni las versiones de dependencias.
- Añade, quita o actualiza dependencias.
- Cambia la API pública de un paquete que otro paquete ya consume.
- Toca el esquema de `RobotSpec`, el glosario o el catálogo de widgets.
- Crea un widget nuevo para un tema: los temas componen widgets existentes. Si falta uno, es un spec gap.
- Usa `Math.random`, `Date.now()` dentro de `sim-core`, `localStorage` fuera de los stores, ni `window` fuera de `apps/web`.

## 11. Protocolo de spec gap

Cuando falta información para completar el ticket:
1. No improvisar. No "asumir lo razonable".
2. Abrir un issue con la plantilla `spec-gap`: qué falta, dónde en la spec, qué default propones y por qué.
3. Comentar en el ticket original enlazando el spec gap y marcarlo `status:blocked`.
4. Detenerse. El orquestador responde y actualiza la spec (o el humano actualiza `docs/`).

## 12. CI

Todo PR ejecuta: `pnpm install --frozen-lockfile`, `lint`, `typecheck`, `test` (con cobertura), `build`, `content:check`, `audit`, `db`. Todo en verde antes de pasar a QA.

El check `db` ejecuta `supabase db reset` y `supabase test db` (pgTAP) en CI; corre en todo PR y es bloqueante para los que tocan `supabase/`.
