# Etiquetas de GitHub

Las etiquetas del repositorio están definidas en `.github/labels.yml`. Ese archivo es la fuente de verdad; GitHub se sincroniza desde él con el comando de abajo. Cambiar una etiqueta se hace editando el archivo y volviendo a ejecutar el comando.

## Aplicar

Requiere `gh` autenticado con permiso de escritura y Node (ya presente por `.nvmrc`). Desde la raíz del repositorio:

```bash
node -e '
const fs = require("fs");
const src = fs.readFileSync(".github/labels.yml", "utf8");
const re = /^- name: (.+)\n\s+color: ([0-9a-fA-F]{6})\n\s+description: (.+)$/gm;
const rows = [...src.matchAll(re)];
const expected = (src.match(/^- name:/gm) || []).length;
if (rows.length !== expected) {
  console.error(`labels.yml: ${rows.length} entradas válidas de ${expected}; revisa el formato`);
  process.exit(1);
}
for (const [, name, color, description] of rows) {
  console.log([name, color, description].join("\t"));
}
' | while IFS=$'\t' read -r name color description; do
  gh label create "$name" --color "$color" --description "$description" --force
done
```

Formato estricto por entrada: `- name:`, `color:` (6 hex, sin comillas) y `description:` en ese orden, sin comillas; el script aborta si alguna entrada no lo cumple. `--force` actualiza color y descripción si la etiqueta ya existe, así que el comando es idempotente. No borra etiquetas que no estén en el archivo: eso se hace a mano con `gh label delete`.

Verificar: `gh label list --limit 50` debe mostrar las 23 etiquetas del archivo (además de las que GitHub crea por defecto, como `bug` o `enhancement`, que no se usan).

## Significado

| Etiqueta | Significado | Fuente |
|---|---|---|
| `type:infra` | Monorepo, CI, Supabase, despliegue, autoalojado | `PLAN.md` §6, tipo `infra` |
| `type:core` | `sim-core` y `robot-spec` | `PLAN.md` §6, tipo `core` |
| `type:widget` | Componentes del catálogo `WIDGETS.md` | `PLAN.md` §6, tipo `widget` |
| `type:sim` | Simuladores, cuenta, progreso, aula | `PLAN.md` §6, tipo `sim` |
| `type:content` | Temas `T-m.n` y catálogo de robots | `PLAN.md` §6, tipo `content` |
| `type:qa` | Accesibilidad, rendimiento, QA global | `PLAN.md` §6, tipo `qa` |
| `type:docs` | Cambios en `docs/`; siempre mergea el humano | `PLAN.md` §5 y §6 |
| `module:M0` … `module:M6` | Módulo de la ruta 1 al que sirve el ticket | `PLAN.md` §2, `CURRICULUM.md` |
| `size:S` / `size:M` / `size:L` | ≤ 2 h, ≤ medio día, ≤ 1 día de agente; un `L` se divide antes de asignar | `PLAN.md` §6 |
| `status:ready` | Columna Ready del tablero: dependencias en Done, listo para asignar | `PLAN.md` §5 |
| `status:blocked` | Hay un spec gap abierto o una dependencia sin cerrar | `STANDARDS.md` §11, `CLAUDE.md` |
| `status:qa` | Columna QA: hay PR abierto y QA está verificando | `PLAN.md` §5 |
| `status:audit` | Columna Auditoría: QA reportó PASS y el auditor de código revisa | `PLAN.md` §5 |
| `spec-gap` | Issue creado con la plantilla *Spec gap* | `STANDARDS.md` §11 |
| `security` | Toca RLS, auth, subidas o dependencias; exige revisión del rol Seguridad | `CLAUDE.md`, `PLAN.md` §5 |

## Tablero

Columnas de `PLAN.md` §5: Backlog → Ready → En progreso → QA → Auditoría → Done. Ready, QA y Auditoría corresponden a `status:ready`, `status:qa` y `status:audit`. Backlog es un ticket sin `status:*`; En progreso es un ticket asignado con rama abierta; Done es el issue cerrado por el merge de su PR.

## Propuesta de flujo (no está en `docs/`; la aprueba el humano)

`PLAN.md` §5 define las columnas pero no quién mueve las etiquetas. Propuesta para incorporar a `PLAN.md` §5 si el humano la acepta; hasta entonces es orientativa:

- El orquestador pone `type:*`, `size:*` y `module:*` al crear el ticket, y `status:ready` cuando sus dependencias están en Done.
- Quien abre un spec gap pone `status:blocked` en el ticket afectado (`STANDARDS.md` §11 paso 3) y lo quita al resolverse.
- El desarrollador pone `status:qa` al abrir el PR; QA lo cambia a `status:audit` al dar PASS.
- Un ticket lleva una sola `type:*`, una sola `size:*` y como máximo una `status:*`; un bug no lleva `type:*` hasta convertirse en ticket.
