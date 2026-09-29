# Política de seguridad

Trayectoria gestiona cuentas de estudiantes y docentes, su progreso, sus grupos y los robots que suben. Si encuentras un problema de seguridad, avísanos en privado para poder corregirlo antes de que nadie lo aproveche.

## Cómo reportar

**No abras un issue público, un PR ni una discusión** con los detalles de una vulnerabilidad: cualquiera podría usarla contra el sitio y contra las copias autoalojadas antes de que exista el parche.

Usa uno de estos dos canales privados:

1. **GitHub**: en la pestaña _Security_ del repositorio, botón _Report a vulnerability_ (_Private vulnerability reporting_). Es el canal preferido: el reporte, la conversación y el parche quedan en un aviso privado.
2. **Correo**: escribe a `contacto@trayectoria.org` con el asunto `[Seguridad]`.

Incluye, si puedes:

- Qué componente está afectado (URL, archivo o función).
- Los pasos para reproducirlo y qué obtiene quien lo aprovecha.
- La versión o el commit en que lo viste.

No hace falta que el reporte esté pulido: un aviso incompleto a tiempo vale más que uno perfecto tarde.

## Qué puedes esperar

- **Primera respuesta en 7 días naturales** como máximo, confirmando que recibimos el reporte.
- Te contamos si lo reproducimos, cómo pensamos corregirlo y cuándo.
- Cuando el parche está publicado, lo anunciamos en un aviso de seguridad del repositorio y te damos crédito si quieres.

Te pedimos que no divulgues el problema hasta que el parche esté publicado o hasta que acordemos una fecha contigo.

## Alcance

Dentro:

- Las políticas RLS, las funciones y las migraciones de Supabase (`supabase/`).
- La autenticación: registro, entrada, recuperación de contraseña, reautenticación y sesiones.
- Las subidas de archivos (URDF de los robots) y el almacenamiento.
- El código del sitio (`apps/web`, `packages/`) y el contenido que se renderiza.
- Las dependencias y la cadena de suministro: `pnpm-lock.yaml`, workflows de `.github/`, imágenes y configuración de `infra/`.
- La instancia pública en `trayectoria.org`.

Fuera:

- Las copias autoalojadas por otras instituciones cuando el fallo está en su configuración y no en este repositorio: repórtalo a quien la administra. Si el fallo está en el código o en la guía de `docs/ops/SELF-HOSTING.md`, sí es nuestro.
- Ataques de denegación de servicio, pruebas de carga y spam contra la instancia pública.
- Ingeniería social o ataques físicos a quien mantiene el proyecto.
- Informes automáticos de escáneres sin una forma concreta de aprovecharlos.

Si pruebas contra `trayectoria.org`, usa solo cuentas tuyas, no accedas a datos de otras personas ni los modifiques, y detente en cuanto demuestres el problema.

## Versiones soportadas

Solo recibe correcciones de seguridad **la última versión publicada** (la rama `main` y su etiqueta más reciente). Si autoalojas Trayectoria, actualiza a esa versión siguiendo `docs/ops/SELF-HOSTING.md`, sección «Actualizar a una versión nueva».
