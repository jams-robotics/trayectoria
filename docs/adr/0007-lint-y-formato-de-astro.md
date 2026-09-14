# ADR-0007 — ESLint y Prettier para archivos `.astro`

Fecha: 2026-09-14 · Estado: aprobado (humano, spec gap #28)

## Contexto

`STANDARDS.md` §5 prohíbe colores y tamaños literales en componentes y §12 exige lint en CI, pero ni ESLint ni Prettier entienden `.astro` sin plugin: ESLint no los lintea y `prettier --check` los omite en silencio (`No parser could be inferred`). Solo `astro check` los cubre, y solo en tipos. `ARCHITECTURE.md` §3.4 fija las librerías y `STANDARDS.md` §8 exige un ADR para añadir cualquiera.

## Decisión

Se autorizan dos herramientas de desarrollo (no llegan al bundle):

- `eslint-plugin-astro` (con su parser `astro-eslint-parser`), en la línea 1.x mientras el repositorio use ESLint 9 (la 2.x exige ESLint 10).
- `prettier-plugin-astro`.

Los `.astro` entran en `pnpm lint` y `pnpm format:check` con las mismas reglas que el resto (`no-restricted-globals`, `no-restricted-imports`, fronteras de arquitectura). Las reglas con información de tipos no se aplican a `.astro` (el parser no ofrece programa de TypeScript estable); esas las cubre `astro check`.

## Consecuencias

- Dos dependencias de desarrollo más, fijadas sin `^`.
- Un hex o un `px` literal en un `.astro` sigue sin ser detectable por ESLint (no hay regla para eso en ningún lenguaje); la revisión de estilo literal sigue siendo del auditor, como en `.tsx`.
- Al subir a ESLint 10 habrá que pasar a `eslint-plugin-astro` 2.x en el mismo PR.
