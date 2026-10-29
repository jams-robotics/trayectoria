# RETOMAR: v2 de la Pista 3D

La pila de la v2 está en un solo PR, **#694 · v2 Pista 3D** (rama `feat/685-aula`, ya en GitHub). Encima va la rama **local** `feat/aula-telefono`, sin push, con lo que salió de la prueba manual del 28 oct.

## Ramas

| Rama | Dónde | Qué trae |
|---|---|---|
| `feat/685-aula` | GitHub, PR #694 | Pista 3D, duelo, arena libre, 2 jugadores, tu robot, Pasos y sesión de aula (#679 a #686) |
| `feat/aula-telefono` | Solo local | Encima de la anterior: el teléfono maneja de verdad, control como el de brazo, QR, grupos del docente en `/cuenta` y Pasos a 720 px (#697, #698) |

Para integrar `feat/aula-telefono` en el PR #694: `git switch feat/685-aula && git merge --ff-only feat/aula-telefono && git push`.

## Cómo probar en local (con teléfono)

```
npx -y supabase@2 start
cd apps/web
PUBLIC_SUPABASE_URL=http://192.168.1.29:54321 CLAUDECODE= pnpm dev --host 0.0.0.0
```

- Entra como docente en `http://192.168.1.29:4321` (no en localhost; si no, el QR sale con localhost).
- Cuentas locales, todas con la contraseña `trayectoria-e2e-2026`: `docente@example.com` (dueño de «Grupo de prueba») y `alumno1@example.com` a `alumno3@example.com`. Se recrean con `node <scratchpad>/aula-usuarios.mts` si se reinicia Supabase.
- Pista 3D → «Aula» → «Abrir sesión» → «Mostrar QR en grande» → el alumno escanea, pide unirse → «Aprobar» → «Dar el control».
- Si el teléfono no carga la página, abre el firewall (PowerShell como administrador): `New-NetFirewallRule -DisplayName "Trayectoria dev" -Direction Inbound -Protocol TCP -LocalPort 4321,54321 -Action Allow -Profile Private`.

## Estado de las pruebas (28 oct, rama `feat/aula-telefono`)

- `lint`, `typecheck`, unitarias (sim-core 462, sims 578, web 337, content 656, auth y progress), `build` y `content:check`: en verde.
- e2e completo (266): en verde. `formula-desborde-390` falla de vez en cuando por una navegación; repetido 6 de 6 en verde.
- Visuales Plot, Tema y Tema-mobile: corregidos (las `-win32` eran anteriores al marcador dentro de la gráfica y al bloque de cierre del #661).
- Recorrido manual con capturas como docente a 1884×936 y teléfono a 390×844: Pasos, aula, recarga del teléfono, vistas y progreso.
- Si el dev server da «504 Outdated Optimize Dep» (pasó al agregar `qrcode-generator`), bórrale la caché: `rm -rf apps/web/node_modules/.vite`.

## Antes de salir a producción

1. Respaldo de la base, `npx -y supabase@2 db push --dry-run`, luego `db push` (migración `0014`) **antes** del deploy.
2. En el panel de Supabase, Realtime Settings: desactivar «Allow public access».
3. Merge del PR #694 a `main` (despliega solo). Detalle en `docs/ops/DEPLOY.md`.
4. Snapshots `-linux` de `sim-movil`: los regenera CI al hacer push.

## Decisiones tomadas sin el responsable (editables)

- **Aula, modo del simulador:** dar el control a un teléfono pasa la Pista 3D a la arena libre. Que el teléfono ajuste una ganancia la pasa a la pista con PID y sin fantasma. Si el docente estaba en Pasos o en un reto, se pierde. Un solo conductor a la vez.
- **Control del teléfono:** joystick de un dedo que se cuantiza a 8 direcciones (el protocolo sigue siendo −1, 0 o 1 por eje), y pestaña «Ajustar» que empieza en las ganancias de referencia. Sin botón PARAR: soltar el joystick detiene el robot.
- **Vista y progreso:** dar el control reinicia la arena en «Persecución». El teléfono elige entre Persecución, A bordo y Cenital, ve las estrellas y el tiempo, y al terminar tiene «Jugar otra vez». Un teléfono que se recarga recupera su turno sin pedir unirse.
- **Pasos:** el programa va en un panel a la derecha y cada paso se puede subir, bajar o quitar. Un «Repetir» o «Fin» se va con su pareja.
- **QR:** `qrcode-generator` 2.0.4 (MIT, sin dependencias), autorizado el 28 oct. Se dibuja oscuro sobre blanco en ambos temas.
- **Pasos:** botones de 48 px y «Ejecutar» fijo al pie del panel.

## Pendientes

- #699 · Aula: varios alumnos, un carrito por teléfono.
- #696 · Vulnerabilidad en devalue: bloquea `audit` en CI.
- Joystick en Safari de iOS: arreglado sin probar en un iPhone (WebKit de Windows no emula el dedo). Probarlo.
- El `aria-live` del joystick anuncia cada cambio de dirección con lector de pantalla.
- Error de hidratación de `TopicStatus` en el log del dev server (viene de antes; no lo toca esta rama).
- Magic link y registro no vuelven a la sesión de aula (el login con contraseña sí vuelve).
- Ramas remotas de los PRs cerrados #687 a #693 y `delete_branch_on_merge` sin activar.
