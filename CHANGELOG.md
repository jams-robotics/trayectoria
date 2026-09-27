# Registro de cambios

Todos los cambios relevantes de Trayectoria se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [versionado semántico](https://semver.org/lang/es/).

## [1.0.0] - por confirmar

Primera versión pública. Cubre el alcance congelado de la v1 descrito en [`docs/PLAN.md`](docs/PLAN.md) §1.

### Contenido

- Ruta 1, _De la física al robot móvil_, completa: 27 temas en 7 módulos (M0 Herramientas, M1 Cinemática de la partícula, M2 Dinámica, M3 Energía, M4 Rotación, M5 Robot diferencial, M6 Seguidor de línea), especificados en [`docs/CURRICULUM.md`](docs/CURRICULUM.md).
- Cada tema sigue la plantilla fija de 7 secciones (Gancho, Concepto, Fórmulas, Explora, Al robot, Verifica, Profundiza) y termina aplicado al robot del estudiante.
- Ejercicios con semilla por usuario, respuestas con unidad y tolerancia por componente, y validación de temas con `pnpm content:check`.
- Widgets interactivos reutilizables: parámetros, fórmulas, gráficas, escenas 2D y 3D, vectores, cuerpo libre, cinemática, tiro parabólico, rotación, energía, potencia, engranajes, robot diferencial, sensor de línea y seguidor de línea.
- Perfil «Mi robot»: masa, radio de rueda, distancia entre ruedas, motor, reducción, encoder y sensores; toda sección «Al robot» calcula con él.
- Páginas públicas: inicio, `/docentes`, `/contribuir` y `/acerca`.

### Simuladores

- Simulador móvil 2D: robot diferencial parametrizable con respuesta del motor de primer orden, sensores de línea, controladores integrados (on/off, proporcional y PID), modo manual, robots de referencia e instrumentación.
- Editor de pistas por segmentos y pistas prediseñadas; pistas guardadas en la cuenta o en el navegador.
- Configuraciones del simulador guardadas y compartibles por enlace.
- Simulador de brazo 3D: carga de URDF, cinemática directa por articulación, marcos, panel de matrices, espacio de trabajo e importación de un URDF propio.
- Ambos simuladores son cinemáticos, sin motor de física, y corren en el navegador.

### Cuenta y aulas

- Cuentas con Supabase Auth, progreso por tema e índice de ruta con «Ruta completada».
- Robots guardados y subida de URDF a la cuenta.
- Modo aula mínimo: roles docente y estudiante, grupos por código de invitación, tabla tema × estudiante y exportación a CSV.
- Unirse a un grupo, salir de él y eliminar la cuenta con sus datos.
- Políticas RLS en todas las tablas, cotas de tamaño en pistas y robots, y límites de uso por propietario.

### Catálogo

- Brazos de referencia: SO-101 (LeRobot) y brazo plano didáctico de 2 GDL, con sus páginas en `/brazos`.
- Robots móviles de referencia para el simulador.

### Accesibilidad y rendimiento

- Widgets operables con teclado, foco visible, `aria-label` en controles y resumen textual de las escenas en regiones `aria-live`; comprobación automática con axe.
- Presupuesto de JavaScript por página de tema, three.js solo en las páginas 3D, carga bajo demanda de widgets e imágenes optimizadas; informe en [`docs/audits/PERF-v1.md`](docs/audits/PERF-v1.md).
- Diseño adaptado a móvil (viewport de 390 px) y temas claro y oscuro.
- QA global de la ruta completa de extremo a extremo; informe en [`docs/audits/QA-v1.md`](docs/audits/QA-v1.md).

### Autoalojado y despliegue

- Autoalojado con `docker compose`: sitio estático servido por Caddy junto al compose oficial de Supabase; guía paso a paso en [`docs/ops/SELF-HOSTING.md`](docs/ops/SELF-HOSTING.md).
- Instancia pública en Cloudflare Workers con vistas previas por PR, Supabase (plan gratuito al empezar; Pro cuando haya tráfico), SMTP externo y correos de autenticación en español; pasos, rollback y checklist de lanzamiento en [`docs/ops/DEPLOY.md`](docs/ops/DEPLOY.md#checklist-de-lanzamiento).
- CI en GitHub Actions: lint, typecheck, tests con cobertura, build, presupuesto de bundle, pruebas de políticas pgTAP, e2e con Playwright y auditoría de dependencias.

[1.0.0]: https://github.com/jams-robotics/trayectoria/releases/tag/v1.0.0
