# Trayectoria · De la física al robot

Plataforma web open source, en español, donde estudiantes de ingeniería aprenden matemática, física y mecánica manipulando cada concepto, y donde cada tema termina aplicado a un robot que pueden simular y, si quieren, construir.

- **Código:** MIT (`LICENSE`).
- **Contenido** (`content/`, `docs/`): CC BY-SA 4.0 (`LICENSE-CONTENT`).

## Estado: v1.0.0

La v1.0.0 incluye dos rutas encadenadas completas, Fundamentos (física y matemática para robots, 14 temas en 4 módulos) y Robot móvil (del encoder a la pista, 11 temas en 3 módulos), el simulador móvil 2D, el simulador de brazo 3D, el perfil «Mi robot» y el modo aula. El alcance está en [`docs/PLAN.md`](docs/PLAN.md) y el detalle de la versión en [`CHANGELOG.md`](CHANGELOG.md).

- **Instancia pública:** `https://trayectoria.org`
- **Cómo probarla:** abre la instancia pública o arráncala en local con [los 5 comandos](#arrancar-en-5-comandos).
- **Cómo contribuir:** [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **Cómo autoalojarla:** [`docs/ops/SELF-HOSTING.md`](docs/ops/SELF-HOSTING.md).

## Arrancar en 5 comandos

Requiere Node 24 (ver `.nvmrc`). pnpm se instala solo con Corepack.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck
pnpm test
pnpm dev
```

`pnpm dev` levanta `apps/web`.

Si `corepack enable` falla por permisos sobre el directorio de Node, usa `corepack enable --install-directory <carpeta-en-tu-PATH>` o `npm install -g pnpm@12.4.1` (la versión fijada en `package.json`).

Los archivos de texto se normalizan a LF en cualquier sistema (`.gitattributes`). En un clon anterior a esa regla, ejecuta una vez `git add --renormalize . && git checkout -- .` para que el árbol de trabajo pase a LF.

## Estructura

```
apps/web            Astro + islas React (el sitio)
packages/sim-core   TS puro, sin DOM: bucle, física, cinemática, URDF, ejercicios
packages/robot-spec Esquema RobotSpec (zod), ejemplos, migraciones
packages/widgets    Componentes React reutilizables
packages/sims       Simulador móvil 2D y de brazo 3D
packages/progress   Servicio de progreso e intentos
packages/auth       Cliente supabase-js, sesión, AuthGate
packages/db         Tipos generados y cliente tipado
packages/i18n       i18next y locales
content/es/         Temas en MDX (currículo como código)
catalog/            Robots de referencia y brazos
supabase/           Migraciones, políticas, seed
infra/              docker-compose, Caddyfile
docs/               Fuente de verdad del proyecto
```

Las dependencias permitidas entre paquetes están en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §2 y las verifica ESLint.

## Scripts

| Comando          | Qué hace                                                              |
| ---------------- | --------------------------------------------------------------------- |
| `pnpm dev`       | Sitio en desarrollo (`apps/web`)                                      |
| `pnpm build`     | Build de todos los paquetes                                           |
| `pnpm test`      | Vitest en todos los paquetes (`pnpm --filter sim-core test` para uno) |
| `pnpm lint`      | ESLint                                                                |
| `pnpm typecheck` | `tsc --noEmit` en todos los paquetes                                  |
| `pnpm format`    | Prettier (`pnpm format:check` solo verifica)                          |

## Cómo se trabaja

Todo el trabajo entra por tickets derivados de `docs/PLAN.md`: un ticket, una rama, un PR. Lee [`CONTRIBUTING.md`](CONTRIBUTING.md) y, si eres un agente, [`CLAUDE.md`](CLAUDE.md).

¿Encontraste un problema de seguridad? No abras un issue público: sigue [`SECURITY.md`](SECURITY.md).

## Documentación

| Documento                                      | Contenido                               |
| ---------------------------------------------- | --------------------------------------- |
| [`docs/PLAN.md`](docs/PLAN.md)                 | Visión, alcance y backlog               |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Estructura, librerías, datos, seguridad |
| [`docs/STANDARDS.md`](docs/STANDARDS.md)       | Estándares de código                    |
| [`docs/CURRICULUM.md`](docs/CURRICULUM.md)     | Los 25 temas de las dos rutas           |
| [`docs/DESIGN.md`](docs/DESIGN.md)             | Sistema de diseño                       |
| [`docs/adr/`](docs/adr/)                       | Decisiones de arquitectura              |
