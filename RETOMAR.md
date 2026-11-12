# RETOMAR: después de la versión 1.5

## Objetivo

La versión 1.5 (temas con reto primero, widgets más claros y simuladores ordenados) ya está en producción. Lo que sigue es atender los pendientes de abajo y decidir qué entra en la siguiente versión.

## Estado (11 nov 2026)

- Se hizo squash merge del PR «version 1.5, challenge-first topics, clearer widgets and simulators» a `main` (89e6f6c) y el deploy terminó bien.
- Las cinco observaciones del propietario quedaron resueltas y verificadas a 1763×950:
  - El encuadre de la rampa contiene la rampa y el robot con cualquier ángulo y velocidad.
  - La odometría muestra las dos trazas completas, con leyenda.
  - La maniobra se dibuja como un plan antes de reproducirla y puede encadenarse desde donde quedó el robot.
  - Los paneles de parámetros tienen «Valores iniciales».
  - Las gráficas del seguidor de línea y del PID tienen un interruptor entre «Ajustar a los datos» y «Rango completo», un aviso cuando el eje amplía una variación pequeña y una línea de «Cómo leerla».
- Se cerraron el PR del ancho de escritorio del simulador 2D, el de Dependabot «npm-minor-patch» y el issue de la vulnerabilidad de devalue: los tres ya estaban incluidos en la 1.5.
- Se borraron las ramas `pista/*`, `pulido/*` y `v2/integracion`. `delete_branch_on_merge` está activado.

## Decisiones tomadas

- Tema a una sola columna en todos los anchos; contenedor del sitio de 1440 px (`--size-site`).
- La escala completa de las gráficas sale de los límites del robot: `v = ω_rueda·r` y `ω = 2v/L`. El error va de -1 a 1.
- El aviso de ampliación aparece cuando los datos cubren menos del 25 % del rango completo.
- La maniobra muestra solo «Giro» y «Avance»; encenderla o apagarla vuelve a los valores iniciales.

## Siguiente paso

Elegir qué pendientes entran en la siguiente versión y registrarlos como issues.

## Pendientes

1. Los estilos `.prose ul/li` del texto del tema se aplican también a las listas dentro de los widgets (posible sangría de la leyenda de `Plot` en móvil).
2. Control de zoom en el visor de odometría.
3. En modo desarrollo, el componente `Html` de drei, en el visor 3D del brazo, lanza «unmount a root while rendering». Hace fallar en local la prueba de errores de consola del playground. Ya pasaba antes de la 1.5 y no aparece en el build de producción.
4. La prueba de la maniobra que lee la región `aria-live` falla a veces bajo la carga de todo el monorepo; sola pasa siempre.
5. Las gráficas fuera del seguidor de línea (cinemática, curva del motor, rotación) no tienen «Rango completo».
6. Sin hacer en la 1.5:
   - Fotos o video de robots reales en los temas.
   - Fórmulas largas con scroll horizontal propio en móvil.
   - El visor de Potencia es estrecho a 390 px.
   - Las etiquetas de fuerzas pequeñas se enciman en el diagrama de cuerpo libre.
   - Las etiquetas de los dos marcos se solapan cuando el robot está casi alineado con el origen.
7. Verificación en Firefox y Safari.
9. La excepción de la 1.5 en `CLAUDE.md` (trabajo sin ticket en `v2/integracion`) venció con el merge: hay que quitarla.
8. Siguen abiertos los PRs de Dependabot de actions, Node 26, Caddy, `@types/node` 26 y TypeScript 6, y el PR de la versión 2 de la pista 3D. Las actualizaciones de seguridad de Dependabot sobre `main` fallaron el 11 nov.
