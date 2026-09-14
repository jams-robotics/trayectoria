# Etiquetas de GitHub

Las etiquetas del repositorio están definidas en `.github/labels.yml`. Ese archivo es la fuente de verdad; GitHub se sincroniza desde él con el comando de abajo. Cambiar una etiqueta se hace editando el archivo y volviendo a ejecutar el comando.

## Aplicar

Requiere `gh` autenticado con permiso de escritura y Node (ya presente por `.nvmrc`). Desde la raíz del repositorio:

```bash
node -e '
const fs = require("fs");
const src = fs.readFileSync(".github/labels.yml", "utf8");
const re = /^- name: (.+)\n\s+color: ([0-9a-fA-F]{6})\n\s+description: (.+)$/gm;
for (const [, name, color, description] of src.matchAll(re)) {
  console.log([name, color, description].join("\t"));
}
' | while IFS=$'\t' read -r name color description; do
  gh label create "$name" --color "$color" --description "$description" --force
done
```

`--force` actualiza color y descripción si la etiqueta ya existe, así que el comando es idempotente. No borra etiquetas que no estén en el archivo: eso se hace a mano con `gh label delete`.

Verificar: `gh label list --limit 50` debe mostrar las 23 etiquetas del archivo (además de las que GitHub crea por defecto, como `bug` o `enhancement`, que no se usan).

## Significado

| Etiqueta | Cuándo se pone | Quién |
|---|---|---|
| `type:infra` | Monorepo, CI, Supabase, despliegue, autoalojado (`PLAN.md` §6, tipo `infra`) | Orquestador al crear el ticket |
| `type:core` | `sim-core` y `robot-spec` | Orquestador |
| `type:widget` | Componentes del catálogo `WIDGETS.md` | Orquestador |
| `type:sim` | Simuladores, cuenta, progreso, aula | Orquestador |
| `type:content` | Temas `T-m.n` y catálogo de robots | Orquestador |
| `type:qa` | Accesibilidad, rendimiento, QA global | Orquestador |
| `type:docs` | Cambios en `docs/`; siempre mergea el humano | Orquestador o humano |
| `module:M0` … `module:M6` | Tickets de contenido y auditorías `C-Mn`; también widgets o core si sirven a un solo módulo | Orquestador |
| `size:S` / `size:M` / `size:L` | Estimación de `PLAN.md` §6 (≤ 2 h, ≤ medio día, ≤ 1 día). Un `L` se divide antes de asignar | Orquestador |
| `status:ready` | Dependencias en Done; listo para asignar | Orquestador |
| `status:blocked` | Hay un spec gap abierto o una dependencia sin cerrar. Se quita al resolverlo | Quien abre el spec gap |
| `status:qa` | Hay PR abierto y QA está verificando | Desarrollador al abrir el PR |
| `status:audit` | QA reportó PASS; el auditor de código revisa | QA al dar PASS |
| `spec-gap` | Issue creado con la plantilla *Spec gap* | Automática por la plantilla |
| `security` | El PR toca RLS, auth, subidas o dependencias; exige revisión de seguridad (`CLAUDE.md`, rol Seguridad) | Orquestador al crear el ticket, o desarrollador si lo descubre |

Un ticket lleva exactamente una etiqueta `type:*`, una `size:*` y como máximo una `status:*`. `module:*` solo si aplica. Un issue de bug no lleva `type:*` hasta que se convierte en ticket.

## Tablero

Columnas de `PLAN.md` §5: Backlog → Ready → En progreso → QA → Auditoría → Done. Las columnas Ready, QA y Auditoría corresponden a `status:ready`, `status:qa` y `status:audit`; Backlog es un ticket sin `status:*`; En progreso es un ticket asignado con rama abierta; Done es el issue cerrado por el merge de su PR.
