# RETOMAR: Pista 3D (simulador del carrito, v2)

Rama local `feat/simulador-3d-carrito`, **sin push** (pedido: nada a producción; se lanza con la etapa 2 de reels).

## Objetivo

Que el simulador del carrito seguidor de línea esté al nivel de Brazo (`jams286/brazo`): inmersivo, legible y que dé ganas de compartirlo. El brazo de Trayectoria no se tocó.

## Qué hay

- Página nueva **`/simuladores/carrito`** («Pista 3D»), a pantalla completa y oscura, con three.js puro (ya era dependencia de `sims`; no se agregaron dependencias).
- Usa **la misma física** del simulador 2D (`createLineFollowerModel`, controladores, presets de sim-core). La escena 3D solo dibuja esos estados.
- Robot 3D armado con las medidas de «Mi robot»: ruedas que giran según el ángulo real, sensores que se encienden con su lectura y haces IR.
- Estela coloreada por el error: verde si va centrado y rojo si está por perder la línea.
- Cámaras: Persecución, Libre (órbita), Cenital, A bordo y Cine (Cine oculta los paneles). Teclas 1 a 5.
- **Carrera contra el robot de referencia**: un fantasma translúcido con el PID de referencia y la diferencia en segundos en vivo.
- Instrumentos grandes: vuelta actual y mejor vuelta, velocidad, barras de los 5 sensores, aguja del error y telemetría de 8 s (error y ω de cada rueda, con las pérdidas de línea sombreadas).
- Controladores: Manejar (flechas/WASD y botones táctiles), On/off, P y PID, cada uno con una línea que explica qué hace cada ganancia.
- **«Empujón»** (tecla K): desvía el robot 20° para ver cómo se recupera el controlador.
- **8 retos** que se comprueban solos con los números de la simulación, con confeti y «Lo que aprendiste». El progreso se guarda en el navegador.
- **Grabar video** vertical 9:16 (o 16:9) con la vuelta, la mejor vuelta y `trayectoria.org` impresos. Sale en MP4 si el navegador puede y, si no, en WebM. Pensado para los reels.
- Pista nueva «Gran circuito» (5,9 m, con chicana).
- En `/simuladores/movil` hay un aviso que enlaza a la Pista 3D. El 2D y los temas no cambiaron.

## Decisiones tomadas sin ti (todas editables)

1. Página aparte en lugar de reemplazar `/simuladores/movil`: el 2D lo usan los temas, el editor de pistas y las pruebas e2e. **El menú «Simuladores» sigue apuntando al 2D.** Para la v2 bastaría con cambiar el `href` en `apps/web/src/components/Nav.astro`.
2. La escena es oscura en los dos temas (`data-theme="dark"` en la raíz), como un visor. Los colores salen de los tokens de DESIGN.md.
3. Al abrir arranca sola, en el Gran circuito, con un PID un poco más rápido que la referencia y la carrera activa. Así quien llega de un reel ve movimiento al instante.
4. Las metas de los retos se calibraron con el robot de referencia (`challenges.test.ts` prueba que cada reto tiene solución y que no se pasa con los valores por defecto).
5. Las decisiones quedan aquí y no en `CLAUDE.md`/`docs/`, porque el `CLAUDE.md` del proyecto prohíbe tocarlos sin ticket.

## Cómo probar

```
pnpm dev            # http://localhost:4321/simuladores/carrito
pnpm --filter @trayectoria/sims exec vitest run src/mobile/arena
```

## Pendientes

- Probar la grabación en el iPhone y en Chrome (headless no graba video).
- Probar el rendimiento en un celular de gama baja. Si va lento: sombras más chicas (`shadow.mapSize` en `scene/arenaScene.ts`) o `devicePixelRatio` en 1.
- Si la v2 convierte esta pista en el simulador principal: cambiar el menú y decidir qué pasa con el 2D (¿se queda para los temas?).
- Faltan pruebas e2e de la página nueva (Playwright necesita `supabase start`).
- Ideas para después: editor de pistas en 3D, controlador «Propio» con código, obstáculos y sensor ultrasónico, compartir el tiempo por enlace (`?reto=`) y una tabla de récords.
