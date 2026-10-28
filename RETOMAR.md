# RETOMAR: v2 de la Pista 3D (olas 1 a 5)

Todo es local y **sin push**. El pedido es no publicar nada hasta terminar los 25 reels. Plan y milestones en GitHub: issues #679 a #686, milestones «Ola 1» a «Ola 5».

## Ramas (apiladas, de abajo arriba)

| Rama | Issue | Qué trae |
|---|---|---|
| `feat/simulador-3d-carrito` | #679 | Pista 3D en `/simuladores/carrito` |
| `feat/680-duelo` | #680 | Rival configurable y vueltas ganadas |
| `feat/681-modo-libre` | #681 | Arena libre con conos y estrellas |
| `test/679-e2e-pista-3d` | #679 | e2e de la Pista 3D; el menú «Simuladores» abre la Pista 3D |
| `feat/682-dos-jugadores` | #682 | 2 jugadores (WASD y flechas) en pista y arena libre |
| `feat/684-tu-robot` | #684 | Subir STL/GLB del robot propio (solo en el navegador, IndexedDB) |
| `feat/686-pasos` | #686 | Modo «Pasos»: programar con Avanzar, Girar y Repetir; retos del cuadrado y de la estrella |
| `feat/685-aula` | #685 | Sesión de aula: el docente aprueba y el teléfono maneja o ajusta (migración 0014) |

Aparte, desde `main`: `ux/683-2d-legible` (#683), con el simulador 2D y el editor de pistas a ancho de escritorio.

Cada rama contiene a las de arriba. Merge en orden, o todo de una vez desde `feat/685-aula`.

## Cómo probar

```
pnpm dev                         # http://localhost:4321/simuladores/carrito
npx -y supabase@2 start          # para el aula y las e2e
```

- **Aula:** con un docente que tenga grupo, abre el panel «Aula» en la Pista 3D. Copia el enlace y ábrelo en otra ventana con un alumno del grupo.
- **Pasos:** Pista → Arena libre → «Programar con pasos».

## Estado de las pruebas (28 oct)

- `lint`, `typecheck`, `test` (unitarias y 270 pgTAP), `build` y presupuesto de bundle: en verde.
- e2e completo: en verde, salvo los visuales Tema y Plot, que ya fallaban en `main` local.
- Revisión de seguridad del aula: aprobada con cambios, ya aplicados (ver #685).

## Antes de salir a producción

1. Snapshots `-linux`: los genera CI cuando hay push (`playwright.config.ts`, instrucciones arriba del `snapshotPathTemplate`). `ux/683` y esta pila cambian los mismos snapshots de `sim-movil`: se regeneran al integrar.
2. Ola 4 (aula):
   - Respaldo de la base.
   - `npx -y supabase@2 db push --dry-run`, luego `db push` **antes** del deploy.
   - En el panel, Realtime Settings: desactivar «Allow public access».
   - Detalle en `docs/ops/DEPLOY.md`.
3. Probar en iPhone y en un Android de gama baja: grabación de video, rendimiento y manejo con el teléfono.

## Decisiones tomadas sin el responsable (editables)

- **Modelo propio:** se guarda solo en el navegador, sin Storage. Acepta STL y GLB sin Draco; STEP no.
- **Pasos:** botones de pasos fijos, no bloques visuales. 1 casilla = 25 cm, giros de 90°, Repetir con un nivel de anidamiento.
- **Aula:**
  - Sin QR dibujado: no hay librería y no se agregaron dependencias. El panel muestra el enlace en grande.
  - El teléfono solo mueve el robot en arena libre o en manual.
  - Un solo conductor activo a la vez.
- **2 jugadores:** solo con teclado. En móvil se muestran los botones del jugador 1.
- **Ruta 0 (niños):** propuesta en #686. El currículo y `content/` esperan tus decisiones.

## Pendientes

- QR en el aula: agregar una librería (requiere ticket) o escribir un generador propio.
- Magic link y registro: no vuelven a la sesión de aula (el login con contraseña sí vuelve).
- Alumno retirado del grupo: sigue aprobado hasta que lo expulsen. Reabrir la sesión borra las expulsiones (anotado en #685).
- #683: a 1366×768 el lienzo del editor queda en parte bajo el pliegue. `LineFollowerView.tsx` ya pasa de 300 líneas (viene de antes).
- Faltan e2e del modo Pasos y de 2 jugadores, y no se probó un GLB real con texturas.
- Ideas: editor de pistas en 3D, controlador «Propio» con código, sensor ultrasónico, récords por enlace.
