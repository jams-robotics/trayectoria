# Trayectoria · De la física al robot

Plataforma web open source, en español, para estudiantes y docentes de ingeniería: aprendes matemática, física y mecánica manipulando cada concepto, y cada tema termina aplicado a un robot que puedes simular y, si quieres, construir.

[![Código: MIT](https://img.shields.io/badge/c%C3%B3digo-MIT-blue)](LICENSE)
[![Contenido: CC BY-SA 4.0](https://img.shields.io/badge/contenido-CC%20BY--SA%204.0-lightgrey)](LICENSE-CONTENT)
[![Deploy](https://github.com/jams-robotics/trayectoria/actions/workflows/deploy.yml/badge.svg)](https://github.com/jams-robotics/trayectoria/actions/workflows/deploy.yml)
[![Versión](https://img.shields.io/github/v/release/jams-robotics/trayectoria?label=versi%C3%B3n)](https://github.com/jams-robotics/trayectoria/releases/latest)

![Simulador móvil: al mover el control del PID, el robot seguidor de línea recorre la pista](apps/web/public/readme/simulador.gif)

## **[Ábrela en trayectoria.org →](https://trayectoria.org)**

[English summary](README.en.md)

## Qué incluye la v1.0.0

Dos rutas encadenadas, tal como las define [`docs/CURRICULUM.md`](docs/CURRICULUM.md):

| Ruta                                             | Módulos                                                             | Temas |
| ------------------------------------------------ | ------------------------------------------------------------------- | ----- |
| **Fundamentos:** física y matemática para robots | 4 (Herramientas · Cinemática · Dinámica · Energía y motor)          | 14    |
| **Robot móvil:** del encoder a la pista          | 3 (Medir y ubicar · Cinemática del diferencial · Seguidor de línea) | 11    |

Además: el simulador móvil 2D (robot diferencial, pistas, sensores de línea y controladores on/off, P y PID), el simulador de brazo 3D, el perfil «Mi robot» y el modo aula. El detalle de la versión está en [`CHANGELOG.md`](CHANGELOG.md).

## Para quién

- **Estudiante de primer año de ingeniería** (mecatrónica, eléctrica, mecánica, sistemas) que lleva las materias base y no ve para qué sirven.
- **Equipo de seguidor de línea** que quiere entender su robot, del encoder al PID, y probarlo en el simulador antes de llevarlo a la pista.
- **Docente** que quiere dar clase con algo que se toque y que el robot del laboratorio tenga su gemelo en la plataforma.

## Qué no es

- No es un LMS: no gestiona cursos, notas, calendarios ni entregas.
- No compite con Gazebo, Isaac Sim ni CoppeliaSim: busca precisión pedagógica y corre en el navegador.
- No es un CAD.
- No reemplaza al docente; lo equipa.

## Cómo se verificó el contenido

Cada tema se contrasta con la bibliografía universitaria que cita en su sección «Profundiza». En septiembre de 2026 se auditaron el contenido (física, matemática y robótica), la experiencia de uso y la seguridad; esas auditorías las hicieron agentes de IA con el rol de revisores, no personas externas. Cada hallazgo es un issue público y se cierra a la vista de todos:

- [Hallazgos de contenido](https://github.com/jams-robotics/trayectoria/issues?q=is%3Aissue+label%3Acontenido)
- [Hallazgos de experiencia de uso](https://github.com/jams-robotics/trayectoria/issues?q=is%3Aissue+label%3Aux)
- [Auditorías de coherencia por módulo](docs/audits/)

## Licencia

- **Código:** MIT ([`LICENSE`](LICENSE)).
- **Contenido** (`content/`, `docs/`): CC BY-SA 4.0 ([`LICENSE-CONTENT`](LICENSE-CONTENT)).

Contacto: `contacto@trayectoria.org`. ¿Encontraste un problema de seguridad? No abras un issue público: sigue [`SECURITY.md`](SECURITY.md).

---

## Para desarrollar

El alcance está en [`docs/PLAN.md`](docs/PLAN.md).

- **Instancia pública:** `https://trayectoria.org`
- **Cómo probarla:** abre la instancia pública o arráncala en local con [los 5 comandos](#arrancar-en-5-comandos).
- **Cómo contribuir:** [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **Cómo autoalojarla:** [`docs/ops/SELF-HOSTING.md`](docs/ops/SELF-HOSTING.md).

### Arrancar en 5 comandos

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

### Estructura

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

### Scripts

| Comando          | Qué hace                                                              |
| ---------------- | --------------------------------------------------------------------- |
| `pnpm dev`       | Sitio en desarrollo (`apps/web`)                                      |
| `pnpm build`     | Build de todos los paquetes                                           |
| `pnpm test`      | Vitest en todos los paquetes (`pnpm --filter sim-core test` para uno) |
| `pnpm lint`      | ESLint                                                                |
| `pnpm typecheck` | `tsc --noEmit` en todos los paquetes                                  |
| `pnpm format`    | Prettier (`pnpm format:check` solo verifica)                          |

### Cómo se trabaja

Todo el trabajo entra por tickets derivados de `docs/PLAN.md`: un ticket, una rama, un PR. Lee [`CONTRIBUTING.md`](CONTRIBUTING.md) y, si eres un agente, [`CLAUDE.md`](CLAUDE.md).

### Documentación

| Documento                                      | Contenido                               |
| ---------------------------------------------- | --------------------------------------- |
| [`docs/PLAN.md`](docs/PLAN.md)                 | Visión, alcance y backlog               |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Estructura, librerías, datos, seguridad |
| [`docs/STANDARDS.md`](docs/STANDARDS.md)       | Estándares de código                    |
| [`docs/CURRICULUM.md`](docs/CURRICULUM.md)     | Los 25 temas de las dos rutas           |
| [`docs/DESIGN.md`](docs/DESIGN.md)             | Sistema de diseño                       |
| [`docs/adr/`](docs/adr/)                       | Decisiones de arquitectura              |
