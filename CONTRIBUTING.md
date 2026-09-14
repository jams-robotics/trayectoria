# Contribuir a Trayectoria

Gracias por el interés. Hasta la v1.0 las contribuciones de contenido están cerradas; las de código y robots se aceptan siguiendo estas reglas.

## Regla número uno

**Si no está en `docs/`, no existe.** El alcance vive en [`docs/PLAN.md`](docs/PLAN.md); la arquitectura en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); los estándares en [`docs/STANDARDS.md`](docs/STANDARDS.md). Un cambio de alcance o de arquitectura se propone primero ahí (o con un ADR en `docs/adr/`), nunca en el código.

## Flujo

1. Todo trabajo parte de un issue con la plantilla de ticket (`docs/templates/TASK.md`). Si no hay ticket, ábrelo o propónlo antes de escribir código.
2. Rama `tipo/ID-descripcion-corta` desde `main` actualizada. Ejemplo: `core/F1-04-diff-drive`.
3. Escribe primero los tests con los valores dorados del ticket. Implementa solo los entregables.
4. Antes de abrir el PR, todo en verde localmente:

   ```bash
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```

5. Commits con [Conventional Commits](https://www.conventionalcommits.org/) y el ID del ticket al final: `feat(sim-core): add differential drive model (F1-04)`.
6. Un ticket = un PR. Llena la plantilla completa; la sección "Qué NO se hizo" es obligatoria.
7. Squash merge. `main` está protegida y exige CI en verde.

## Idiomas

- Código, identificadores, nombres de archivo, commits y PR: inglés.
- Documentación, contenido y textos de interfaz: español.

## Lo que no se hace sin un ticket que lo autorice

- Modificar `docs/`, `CLAUDE.md`, `.github/`, `supabase/migrations/`, `infra/` o el `package.json` raíz.
- Añadir, quitar o actualizar dependencias (requiere un ADR aprobado).
- Cambiar la API pública de un paquete que otro consume.

## Spec gaps

Si falta información para completar un ticket: no improvises. Abre un issue con la plantilla `spec-gap` (qué falta, dónde, qué default propones), marca el ticket como bloqueado y detente.

## Licencias

Al contribuir aceptas que el código se publique bajo MIT (`LICENSE`) y el contenido bajo CC BY-SA 4.0 (`LICENSE-CONTENT`). Los robots del catálogo deben tener licencia abierta verificable en hardware y software.

## Código de conducta

Este proyecto sigue el [Código de Conducta](CODE_OF_CONDUCT.md).
