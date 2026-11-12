# RETOMAR: versión 1.5, rediseño de la experiencia

## Objetivo

Sacar a producción la versión 1.5: los 25 temas con reto primero, widgets más claros y grandes, simuladores ordenados. Todo está en un solo PR, **«version 1.5, challenge-first topics, clearer widgets and simulators»**, de `v2/integracion` a `main`.

## Estado (11 nov 2026)

- PR abierto, sin conflictos y con CI en verde. **No se ha hecho merge:** el merge despliega y lo autoriza el propietario. Se recomienda squash.
- Verificado en local: lint, typecheck, unitarias, build, `content:check`, `docs:check`, audit y 270 de 270 e2e contra Supabase recién reiniciado. Dos revisiones de seguridad de solo lectura, aptas.
- El propietario revisó el build el 11 nov y dejó las observaciones de abajo. **Faltan por trabajar antes del merge.**
- El job `e2e` de CI falló tres veces por causas distintas de tiempo e infraestructura antes de pasar (espera de islas, cálculo del espacio de trabajo del brazo, «JWT issued at future»). En local no se reproducen. Si vuelve a pasar, relanzar el job antes de investigar.

## Cómo levantar el build para revisar

```
# Docker Desktop abierto
pnpm dlx supabase@2.117.0 start
cd apps/web
pnpm build && pnpm exec astro preview --port 4340 --host 127.0.0.1
```

El worktree de integración necesita los `.env` locales (raíz y `apps/web`), que no están en git. La base local se reinició el 11 nov: no hay usuarios de prueba.

## Observaciones del propietario por trabajar

Ninguna está investigada todavía: reproducir primero a 1763×950, que es su ancho de pantalla.

1. **Trabajo y energía (`ruta-1/m03/t01`): la rampa se sale del visor.** Con «Ángulo de la rampa» a 45° el robot y la rampa quedan fuera del encuadre; solo vuelven a verse al subir la velocidad inicial al máximo. El encuadre debe contener siempre la rampa y el robot, con cualquier combinación de ángulo y velocidad.
2. **Odometría (`ruta-2/m01/t03`): no se ve lo que el experimento pide.** El primer experimento dice «Cambia: nada» y «Observa: la traza real y la traza estimada», pero:
   - Mientras corre, la vista hace zoom y sigue al robot, y solo se ve un trazo naranja; no se distingue la real de la estimada.
   - Al terminar sí hay un trazo azul, pero como el foco está en el robot no se ve la trayectoria completa.
   - Hace falta ver las dos trazas enteras y distinguibles (leyenda, encuadre de toda la trayectoria al terminar o una opción para alejar).
3. **Restricción no holonómica (`ruta-2/m01/t04`): «Maniobra en tres movimientos» no se entiende.**
   - Solo se ven dos movimientos: gira y luego avanza.
   - La orientación cambia mientras se mueve el control, antes de reproducir.
   - Si se intenta otra maniobra desde donde quedó el robot, vuelve a la posición 0.
   - No hay forma de volver a los valores de partida después de cambiarlos.
4. **«Valores iniciales» en todos los widgets con simulación del robot.** El seguidor de línea y el PID ya tienen ese botón; falta en el robot diferencial y, en general, en los widgets donde se mueven parámetros.
5. **Gráficas del PID: poder alejar la escala.** La gráfica de error ajusta el eje vertical a los datos, así que una variación de 0.25 parece enorme. Pedir una forma de alejar o fijar la escala (por ejemplo, un interruptor entre «ajustar a los datos» y el rango completo del error), para ver que de lejos es casi una recta.

Sus capturas están fuera del repo, en `Auditoria/revision-2026-11-10-trayectoria/observaciones-2026-11-11/`.

## Decisiones tomadas

- Flujo de la 1.5 sin tickets, directo a `v2/integracion` y un solo PR (registrado en `CLAUDE.md`).
- Tema a una sola columna en todos los anchos; el widget de Explora ocupa todo el ancho. Se descartó el tema a dos columnas con el widget fijo.
- Contenedor del sitio de 1440 px (`--size-site`), compartido por barra, pie, temas y simuladores.
- Escena de Torque rehecha como cadena de motor, reducción y rueda, en vez de cambiar de widget.
- El Proyecto final fija su propia meta de vuelta (`targetLap_s={5.5}`).
- Editables, a criterio del propietario: las tres primeras.

## Siguiente paso

1. Trabajar las cinco observaciones, verificando cada una en navegador a 1763×950, 1366×768 y 390×844.
2. Batería completa, e2e, regenerar capturas `-win32` (sin GPU) y subir las `-linux` que genere CI.
3. Nueva revisión del propietario y, con su OK, merge con squash.

## Pendientes

- Después del merge: cerrar el PR del ancho de escritorio del simulador 2D y el de Dependabot «npm-minor-patch», y el issue de la vulnerabilidad de devalue; borrar las ramas `pista/*` y `pulido/*` y sus worktrees; activar `delete_branch_on_merge`.
- Sin hacer en la 1.5: fotos o video de robots reales en los temas; fórmulas largas con scroll horizontal propio en móvil; el visor de Potencia estrecho a 390 px; etiquetas de fuerzas pequeñas encimadas en el diagrama de cuerpo libre; solape de las etiquetas de los dos marcos cuando el robot está casi alineado con el origen.
- Los commits de la rama llevan el correo personal del autor; con squash desde GitHub no entran a `main`.
- Verificación en Firefox y Safari.
