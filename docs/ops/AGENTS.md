# Agentes: roles, modelos y esfuerzo

Cómo se reparte el trabajo entre agentes de IA en este repositorio. Vale para cualquier sesión, persona o herramienta que orqueste tickets. Decisión del propietario del proyecto (2026-09-29).

## Modelo y esfuerzo por rol

| Rol | Modelo | Esfuerzo | Qué hace |
|---|---|---|---|
| Orquestador | Claude Opus 5.5 | high | Sesión principal. Abre tickets, decide dentro de lo que dice `docs/`, lanza y coordina agentes. Nunca codifica. |
| Especificación (`spec-docs`) | Claude Fable 5.1 | high | Tickets `DOCS-*`: escribe la spec vinculante en `docs/` (física, orden, dorados). |
| Desarrollador de código (`dev-core`) | Claude Opus 5.5 | medium | Implementa un ticket de código con una spec cerrada. |
| Desarrollador de contenido (`dev-content`) | Claude Opus 5.5 | high | Temas MDX, ejercicios y «Al robot» según `CURRICULUM.md`. |
| Seguridad (`seguridad`) | Claude Opus 5.5 | high | Todo PR que toque RLS, auth, migraciones, subidas, dependencias o cabeceras. |
| QA (`qa`) | Claude Sonnet 5.5 | medium | Verifica cada criterio contra la spec, con evidencia. No lee el código antes de probar ni arregla. |
| Auditor de código (`auditor`) | Claude Sonnet 5.5 | medium | Revisa el PR contra `STANDARDS.md` y `DEFINITION-OF-DONE.md`. |
| Auditor de coherencia (`auditor-coherencia`) | Claude Fable 5.1 | high | Al cerrar un módulo o una ruta, o en un PR de spec grande: física, orden, notación, dorados. |
| Rondas de ajustes (`fix`) | Claude Sonnet 5.5 | medium | Corrige hallazgos concretos de QA o auditoría en la misma rama. |

## Reglas de orquestación

- **Máximo 3 agentes a la vez.** El límite de uso es compartido por todos los agentes de la sesión y la máquina local corre sus pruebas.
- **Cada agente se lanza con su rol**, que fija modelo y esfuerzo. Un agente nunca hereda el modelo de la sesión principal por omisión.
- **Un agente por worktree** (`../wt-<ticket>`); nadie trabaja en el checkout principal ni usa `git stash`.
- **Al terminar cada agente**, el orquestador comprueba que no quedan servidores ni navegadores de prueba abiertos.
- Si un agente se corta por límite de uso, su sustituto revisa primero lo que quedó en la rama antes de continuar.

## Dónde viven las definiciones

Las definiciones ejecutables de cada rol (con su modelo y esfuerzo) se mantienen fuera del repositorio público y se copian a `.claude/agents/`, que está en `.gitignore`. Esta tabla es la referencia pública: si una definición y esta tabla difieren, manda esta tabla y se corrige la definición.
