# Protección de `main`

Configuración del repositorio `jams-robotics/trayectoria` que aplica el humano (requiere permiso de administrador). Materializa las reglas de `PLAN.md` §5 y `STANDARDS.md` §9 y §12: `main` protegida, un ticket = un PR, squash merge, CI en verde antes de mergear.

## 0. Prerrequisito: visibilidad del repositorio

GitHub solo ofrece reglas de protección de rama (rulesets y branch protection) en repositorios **públicos** o en organizaciones con plan de pago (Team/Enterprise). En un repositorio privado de una organización con plan gratuito la API responde `403: Upgrade to GitHub Pro or make this repository public to enable this feature` y la pestaña *Rules* no aparece. Verificado el 2026-09-13 con el repositorio en privado.

Opciones:
1. Hacer público el repositorio (Settings → General → Danger Zone → Change visibility). Es coherente con el modelo del proyecto (`PLAN.md` §1: open source, MIT / CC BY-SA 4.0).
2. Contratar GitHub Team para la organización.

Hasta que se aplique una de las dos, la protección de `main` es solo disciplina: nadie hace `git push` directo y todo entra por PR con CI en verde, pero GitHub no lo impide.

El workflow `.github/workflows/ci.yml` publica siete checks con estos nombres exactos: **`lint`**, **`typecheck`**, **`test`**, **`build`**, **`audit`**, **`db`**, **`e2e`**. Son los que se exigen abajo. Si se renombra un job en el workflow hay que actualizar la regla.

## 1. Método de merge (Settings → General → Pull Requests)

| Opción | Valor |
|---|---|
| Allow merge commits | **desactivado** |
| Allow squash merging | **activado**; "Default commit message": *Pull request title and description* |
| Allow rebase merging | desactivado |
| Automatically delete head branches | activado |

Con esto el título del PR (Conventional Commits con el ID del ticket) es el mensaje del commit en `main`.

## 2. Regla de protección (Settings → Rules → Rulesets → New branch ruleset)

| Campo | Valor |
|---|---|
| Ruleset name | `main` |
| Enforcement status | Active |
| Bypass list | vacía (los administradores también pasan por PR) |
| Target branches | Include default branch |

Reglas a marcar:

- **Restrict deletions**: activado.
- **Require linear history**: activado (consecuencia del squash).
- **Require a pull request before merging**: activado.
  - Required approvals: `0` (la aprobación la dan QA y auditoría en comentarios; el humano decide al mergear).
  - Dismiss stale pull request approvals when new commits are pushed: activado.
  - Allowed merge methods: solo *Squash*.
- **Require status checks to pass**: activado.
  - Require branches to be up to date before merging: activado.
  - Status checks required: `lint`, `typecheck`, `test`, `build`, `audit`, `db`, `e2e` (aparecen en el buscador una vez que el workflow ha corrido al menos una vez en un PR).
- **Block force pushes**: activado.

Todo lo demás desactivado.

## 3. Equivalente por línea de comandos

Requiere `gh` autenticado con permiso de administrador sobre el repositorio.

```bash
gh api --method POST repos/jams-robotics/trayectoria/rulesets \
  --input - <<'EOF'
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_linear_history" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["squash"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "lint" },
          { "context": "typecheck" },
          { "context": "test" },
          { "context": "build" },
          { "context": "audit" },
          { "context": "db" },
          { "context": "e2e" }
        ]
      }
    }
  ]
}
EOF
```

Método de merge del repositorio:

```bash
gh api --method PATCH repos/jams-robotics/trayectoria \
  -F allow_merge_commit=false \
  -F allow_squash_merge=true \
  -F allow_rebase_merge=false \
  -F squash_merge_commit_title=PR_TITLE \
  -F squash_merge_commit_message=PR_BODY \
  -F delete_branch_on_merge=true
```

## 4. Verificación

1. Abrir un PR de prueba con un cambio trivial: deben aparecer los siete checks y el botón de merge debe quedar bloqueado hasta que pasen.
2. `git push origin main` directo desde una copia local debe ser rechazado con `GH013: Repository rule violations`.
3. En el PR de prueba solo debe ofrecerse *Squash and merge*.

## 5. Qué no cubre

- Despliegue (F7-05b añade su propio workflow; no es un check requerido).
- `STANDARDS.md` §12 pide además `content:check` y cobertura en `test`. Quedan fuera hasta que existan: `content:check` no existe hasta F0-05/F2-13; la cobertura se configura con los primeros tests (F1). Cuando entren al workflow hay que añadirlos también a la lista de checks requeridos del ruleset. `pnpm audit --audit-level=high` ya corre como check `audit` (F0-02b).
