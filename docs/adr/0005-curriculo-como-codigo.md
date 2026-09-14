# ADR-0005 · Currículo como código

Fecha: 2026-09-13 · Estado: aceptado

## Contexto
El contenido es open source y lo producen agentes y, después, la comunidad. Necesita revisión por PR, versionado, tests y validación automática.

## Decisión
Los temas viven en `content/` como MDX con frontmatter validado por zod, ejercicios en TypeScript con tests, y se despliegan estáticos. La base de datos solo guarda datos de usuario. El catálogo de brazos vive en `catalog/`.

## Consecuencias
Un tema se revisa como código: CI, QA y auditoría. `pnpm content:check` es el guardián de estructura. Cambiar contenido publicado requiere PR.
