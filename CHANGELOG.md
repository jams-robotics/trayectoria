# Registro de cambios

Todos los cambios relevantes de Trayectoria se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [versionado semántico](https://semver.org/lang/es/).

## [1.0.0] - 2026-10-01

Primera versión pública. Cubre el alcance congelado de la v1 descrito en [`docs/PLAN.md`](docs/PLAN.md) §1.

### Contenido

- Dos rutas encadenadas completas, 25 temas en 7 módulos, especificadas en [`docs/CURRICULUM.md`](docs/CURRICULUM.md):
  - _Fundamentos: física y matemática para robots_, 14 temas en 4 módulos (M0 Herramientas, M1 Cinemática, M2 Dinámica, M3 Energía y motor).
  - _Robot móvil: del encoder a la pista_, 11 temas en 3 módulos (M0 Medir y ubicar, M1 Cinemática del diferencial, M2 Seguidor de línea), que termina con un proyecto final de un paso por módulo de las dos rutas.
- Los temas de Robot móvil citan como prerrequisito los temas de Fundamentos que usan; los enlaces entre rutas se marcan en el texto.
- Tema nuevo _El motor y la batería_: curva par-velocidad del motor, punto de trabajo con la reducción, corriente, eficiencia de la caja y autonomía de la batería con los datos del perfil; la hoja de datos del motor del perfil incluye las corrientes sin carga y de bloqueo.
- Las direcciones de la ruta única anterior redirigen a su tema en la ruta nueva, y el progreso guardado se conserva.
- Cada tema sigue la plantilla fija de 7 secciones (Gancho, Concepto, Fórmulas, Explora, Al robot, Verifica, Profundiza) y termina aplicado al robot del estudiante.
- Ejercicios con semilla por usuario, respuestas con unidad y tolerancia por componente, y validación de temas con `pnpm content:check`.
- Widgets interactivos reutilizables: parámetros, fórmulas, gráficas, escenas 2D y 3D, vectores, cuerpo libre, cinemática, tiro parabólico, rotación, energía, potencia, curva del motor, engranajes, robot diferencial, sensor de línea y seguidor de línea. Las fórmulas largas se desplazan dentro de su tarjeta en pantallas estrechas.
- Perfil «Mi robot»: masa, radio de rueda, distancia entre ruedas, motor, reducción, batería, encoder y sensores; toda sección «Al robot» calcula con él.
- Auditorías de coherencia de las dos rutas (física, orden, notación, unidades y valores de referencia) con sus correcciones aplicadas; informes en [`docs/audits/`](docs/audits/).

### Sitio

- Portada con una demostración del seguidor de línea, las dos rutas y un tema de prueba que no requiere cuenta.
- Páginas públicas: inicio, `/docentes`, `/contribuir` y `/acerca` (cómo se hizo, hoja de ruta, privacidad y contacto en `contacto@trayectoria.org`).
- Enlace «Reportar un problema» en cada tema y plantilla de issue para errores de contenido.
- SEO y vista previa al compartir: título y descripción por tema, imagen Open Graph, URL canónica, `sitemap.xml` y `robots.txt`.
- Correcciones de las auditorías de UX: menú y navegación en móvil, cuenta, editor de pista, simulador de brazo y distribución de los widgets.

### Simuladores

- Simulador móvil 2D: robot diferencial parametrizable con respuesta del motor de primer orden, sensores de línea, controladores integrados (on/off, proporcional y PID), modo manual, robots de referencia e instrumentación.
- Editor de pistas por segmentos y pistas prediseñadas; pistas guardadas en la cuenta o en el navegador.
- Configuraciones del simulador guardadas y compartibles por enlace.
- Simulador de brazo 3D: carga de URDF, cinemática directa por articulación, marcos, panel de matrices, espacio de trabajo e importación de un URDF propio.
- Ambos simuladores son cinemáticos, sin motor de física, y corren en el navegador.

### Cuenta y aulas

- Cuentas con Supabase Auth, progreso por tema e índice de cada ruta con «Ruta completada».
- Robots guardados y subida de URDF a la cuenta.
- Modo aula mínimo: roles docente y estudiante, grupos por código de invitación, tabla tema × estudiante de las dos rutas y exportación a CSV.
- Unirse a un grupo, salir de él y eliminar la cuenta con sus datos.

### Catálogo

- Brazos de referencia: SO-101 (LeRobot) y brazo plano didáctico de 2 GDL, con sus páginas en `/brazos`.
- Robots móviles de referencia para el simulador.

### Seguridad

- Cabeceras de seguridad y política de seguridad de contenido (CSP) aplicada, idénticas en la instancia pública y en el autoalojado.
- Inicio de sesión con PKCE, enlaces de los correos de autenticación verificados en el propio sitio, reautenticación con código para cambiar la contraseña y para eliminar la cuenta, contraseñas de al menos 10 caracteres y sesiones con caducidad.
- Políticas RLS en todas las tablas, cotas de tamaño y de forma en la base de datos, límites de uso por propietario, códigos de invitación generados por la base con límite de intentos y subidas de URDF restringidas a la carpeta de cada cuenta.
- Exportación a CSV protegida contra inyección de fórmulas y páginas de desarrollo ocultas en producción.
- `SECURITY.md` con el canal privado para reportar vulnerabilidades; dependencias fijadas, revisión automática de actualizaciones e imágenes de contenedor fijadas por digest.

### Accesibilidad y rendimiento

- Widgets operables con teclado, foco visible, `aria-label` en controles y resumen textual de las escenas en regiones `aria-live`; comprobación automática con axe.
- Presupuesto de JavaScript por página de tema, three.js solo en las páginas 3D, carga bajo demanda de widgets e imágenes optimizadas; informe en [`docs/audits/PERF-v1.md`](docs/audits/PERF-v1.md).
- Diseño adaptado a móvil (viewport de 390 px) y temas claro y oscuro.
- QA global de extremo a extremo; informe en [`docs/audits/QA-v1.md`](docs/audits/QA-v1.md).

### Autoalojado y despliegue

- Autoalojado con `docker compose`: sitio estático servido por Caddy junto al compose oficial de Supabase, con la API de Supabase limitada a sus rutas públicas; guía paso a paso en [`docs/ops/SELF-HOSTING.md`](docs/ops/SELF-HOSTING.md).
- Instancia pública en Cloudflare Workers con vistas previas por PR, Supabase (plan gratuito al empezar; Pro cuando haya tráfico), SMTP externo y correos de autenticación en español; pasos, rollback y checklist de lanzamiento en [`docs/ops/DEPLOY.md`](docs/ops/DEPLOY.md#checklist-de-lanzamiento).
- CI en GitHub Actions: lint, typecheck, tests con cobertura, build, presupuesto de bundle, pruebas de políticas pgTAP, e2e con Playwright y auditoría de dependencias.

### Forma de trabajo

- Todo el trabajo entra por tickets con un único PR cada uno, revisado por QA, seguridad cuando aplica y auditoría antes de mergear; lo que no está en `docs/` no existe.
- Agentes de IA con roles, modelo y esfuerzo definidos (especificación, desarrollo, QA, seguridad y auditorías) según [`docs/ops/AGENTS.md`](docs/ops/AGENTS.md); una persona decide y mergea cada PR.

[1.0.0]: https://github.com/jams-robotics/trayectoria/releases/tag/v1.0.0
