# Auditoría de rendimiento — PERF-v1

2026-09-26 · QA de rendimiento / Claude Opus 5.5 · F7-02 (#435) · rama `perf/F7-02` sobre `main` (6e3157e) más el arreglo descrito en §5.

## 1. Spec

`docs/PLAN.md` § Fase 7, F7-02: presupuesto por página de tema ≤ 250 kB de JS comprimido sin 3D; `three` solo en páginas 3D; imágenes optimizadas; Lighthouse rendimiento ≥ 90 en tema y ≥ 80 en simuladores en laptop de gama media.

## 2. Método

- Build de producción: `CLAUDECODE='' pnpm build` (40 páginas).
- **JS en ejecución**: Playwright (Chromium 1243, contexto limpio, sin sesión) abre cada una de las 40 páginas, espera `networkidle` + 800 ms y registra cada `.js` que pide el navegador. El tamaño es el gzip (nivel por defecto de Node) del archivo en `dist/_astro`. Incluye los chunks cargados con `import()` durante la hidratación, que el estudiante descarga igual.
- **Guardia existente**: `apps/web/src/lib/bundle/bundleBudget.test.ts` (`BUNDLE_BUDGET=1`), que mide el cierre de imports **estáticos** de `/ruta/ruta-1/m00/t01/` y comprueba que el chunk de `three` no aparece fuera de las páginas 3D.
- **Lighthouse** 13.5.0 (`npx lighthouse`, sin añadirlo al repo), preset `desktop` como «laptop de gama media», solo la categoría de rendimiento, contra `dist` servido con gzip en `127.0.0.1:4378`: un servidor estático temporal, porque `astro preview` no comprime y Cloudflare sí. Tres pasadas en los simuladores y en T-0.1, de las que se da la mediana. Como referencia, dos pasadas con el preset móvil por defecto.
- Imágenes: auditoría `image-delivery-insight` de Lighthouse sobre `/brazos/` y revisión de `dist`.

## 3. Resultados

### 3.1 JS comprimido por página (kB gzip)

«Antes» es `main` (6e3157e) y «después», con el arreglo de §5. «Tema ≤ 250» solo aplica a las páginas de tema.

| Página | Antes | Después | Archivos JS | `three` | Tema ≤ 250 |
| --- | ---: | ---: | ---: | --- | --- |
| `/404.html` | 325,7 | 196,1 | 18 | no | — |
| `/aula/` | 334,1 | 333,5 | 62 | no | — |
| `/auth/login/` | 327,4 | 197,9 | 20 | no | — |
| `/auth/recuperar/` | 327,6 | 198,1 | 20 | no | — |
| `/auth/registro/` | 327,6 | 198,1 | 20 | no | — |
| `/brazos/` | 325,7 | 196,1 | 18 | no | — |
| `/brazos/planar2dof/` | 325,7 | 196,1 | 18 | no | — |
| `/brazos/so101/` | 325,7 | 196,1 | 18 | no | — |
| `/cuenta/` | 332,9 | 332,3 | 66 | no | — |
| `/cuenta/robots/` | 336,5 | 335,9 | 66 | no | — |
| `/dev/sims/` | 615,4 | 614,8 | 66 | sí | — |
| `/dev/tema-seguidor/` | 357,6 | 357,0 | 64 | no | — |
| `/dev/tema/` | 340,9 | 303,8 | 40 | no | — |
| `/dev/widgets/` | 590,4 | 586,7 | 50 | sí | — |
| `/` | 326,0 | 196,5 | 19 | no | — |
| `/ruta/ruta-1/` | 328,4 | 198,9 | 21 | no | — |
| `/ruta/ruta-1/m00/t01/` | 340,9 | 303,8 | 40 | no | **no** |
| `/ruta/ruta-1/m00/t02/` | 340,9 | 295,1 | 38 | no | **no** |
| `/ruta/ruta-1/m00/t03/` | 351,1 | 311,4 | 36 | no | **no** |
| `/ruta/ruta-1/m01/t01/` | 362,3 | 323,1 | 40 | no | **no** |
| `/ruta/ruta-1/m01/t02/` | 362,3 | 323,1 | 40 | no | **no** |
| `/ruta/ruta-1/m01/t03/` | 340,9 | 299,5 | 39 | no | **no** |
| `/ruta/ruta-1/m01/t04/` | 340,9 | 299,5 | 39 | no | **no** |
| `/ruta/ruta-1/m02/t01/` | 340,9 | 296,2 | 37 | no | **no** |
| `/ruta/ruta-1/m02/t02/` | 340,9 | 296,2 | 37 | no | **no** |
| `/ruta/ruta-1/m02/t03/` | 340,9 | 298,0 | 38 | no | **no** |
| `/ruta/ruta-1/m03/t01/` | 340,9 | 299,0 | 37 | no | **no** |
| `/ruta/ruta-1/m03/t02/` | 340,9 | 298,5 | 40 | no | **no** |
| `/ruta/ruta-1/m04/t01/` | 340,9 | 303,8 | 40 | no | **no** |
| `/ruta/ruta-1/m04/t02/` | 340,9 | 303,8 | 40 | no | **no** |
| `/ruta/ruta-1/m04/t03/` | 362,3 | 325,3 | 41 | no | **no** |
| `/ruta/ruta-1/m04/t04/` | 340,9 | 298,0 | 38 | no | **no** |
| `/ruta/ruta-1/m04/t05/` | 340,9 | 305,5 | 42 | no | **no** |
| `/ruta/ruta-1/m05/t01/` | 340,9 | 305,5 | 42 | no | **no** |
| `/ruta/ruta-1/m05/t02/` | 340,9 | 305,5 | 42 | no | **no** |
| `/ruta/ruta-1/m05/t03/` | 340,9 | 305,5 | 42 | no | **no** |
| `/ruta/ruta-1/m05/t04/` | 340,9 | 305,5 | 42 | no | **no** |
| `/simuladores/brazo/` | 604,2 | 603,6 | 70 | sí | — |
| `/simuladores/movil/` | 380,5 | 379,9 | 67 | no | — |
| `/unirse/` | 328,2 | 327,6 | 62 | no | — |

Guardia existente (solo imports estáticos) tras el arreglo: `/ruta/ruta-1/m00/t01/` 215,7 kB, **pasa**. Página 404: 101,0 kB.

Desglose de `/ruta/ruta-1/m00/t01/` después del arreglo (303,8 kB en ejecución):

| Chunk | kB gzip | Origen |
| --- | ---: | --- |
| `Formula.*` | 75,6 | KaTeX (fórmulas del tema) |
| `client.D3_*` | 63,6 | `react-dom` |
| `client.1zmY*` | 53,5 | `@supabase/supabase-js` (sesión; `import()` desde `RobotSession` y el progreso) |
| `src.BOSH*` | 33,5 | `@trayectoria/robot-spec` + `zod` (validación de «Mi robot») |
| `src.B31A*` | 29,7 | `i18next` / `react-i18next` |
| `content.*` | 10,6 | textos del tema |
| resto (≈ 30 chunks) | ≈ 37 | widgets del tema, islas, runtime |

Las páginas con gráficas (`uPlot`, 21,5 kB) son las más pesadas: T-1.1, T-1.2 y T-4.3 (≈ 323–325 kB).

### 3.2 `three` solo en páginas 3D

El chunk de `three` (`Frame.*`) solo se pide en `/simuladores/brazo/`, `/dev/sims/` y `/dev/widgets/` (tabla de §3.1, antes y después). La guardia existente también pasa. **Cumple.**

### 3.3 Lighthouse (preset desktop, mediana)

| Página | Rendimiento | FCP | LCP | TBT | CLS | Objetivo |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `/ruta/ruta-1/m00/t01/` (98, 99, 99) | 99 | 0,7 s | 1,0 s | 0 ms | 0 | ≥ 90 · cumple |
| `/ruta/ruta-1/m01/t01/` | 99 | 0,6 s | 1,0 s | 60 ms | 0 | ≥ 90 · cumple |
| `/ruta/ruta-1/m05/t04/` | 99 | 0,6 s | 0,9 s | 0 ms | 0 | ≥ 90 · cumple |
| `/` | 100 | 0,4 s | 0,7 s | 0 ms | 0 | — |
| `/brazos/` | 100 | — | 0,7 s | — | 0 | — |
| `/simuladores/movil/` (75, 72, 75) | 75 | 0,7 s | 1,1–1,2 s | 0–30 ms | 0,63–0,77 | ≥ 80 · **no cumple** |
| `/simuladores/brazo/` (75, 61, 80) | 75 | 0,8 s | 1,4–1,7 s | 260–650 ms | 0,13 | ≥ 80 · **no cumple** |

Referencia con el preset móvil (CPU 4× más lenta, 4G lenta simulada), fuera del objetivo de la spec: T-0.1 obtiene 77 (LCP 4,7 s) y el simulador móvil 74 (LCP 4,8 s, TBT 250 ms). Lighthouse estima 101 KiB de JS no usado en T-0.1.

### 3.4 Imágenes

- Solo hay dos imágenes de contenido, en `/brazos/` y `/brazos/<id>/`: `foto.svg` (2,8 kB) y `catalog/arms/so101/foto.jpg` (640 × 480, 106 kB, `loading="lazy"`, con `width` y `height`, sin CLS). Lighthouse estima 93 KiB de ahorro sirviéndola en WebP o AVIF. **Parcial**: está bien dimensionada pero no usa un formato moderno.
- Los temas no tienen imágenes rasterizadas.

## 4. Resumen frente a la spec

| Criterio | Resultado |
| --- | --- |
| Tema ≤ 250 kB JS gzip sin 3D | **No cumple en ejecución** (295–325 kB en los 21 temas). Sí cumple con la definición de la guardia actual (imports estáticos: 215,7 kB) |
| `three` solo en páginas 3D | Cumple |
| Imágenes optimizadas | Parcial (una JPEG sin WebP ni AVIF) |
| Lighthouse tema ≥ 90 | Cumple (99) |
| Lighthouse simuladores ≥ 80 | No cumple (75 y 75) |

## 5. Arreglo aplicado en este PR

`apps/web/src/stores/robotPersistence.ts` importaba `configureMyRobotPersistence`, `parseStoredRobot` y `robotSpecToJson` desde el barrel `@trayectoria/widgets`. `RobotSession` está en el layout base y carga ese módulo con `import()` tras hidratar, así que **todas las páginas** descargaban el catálogo entero de widgets, KaTeX incluido. Ahora importa de `@trayectoria/widgets/MyRobotWidget`, una entrada pública que ya existía (ADR-0009) y exporta lo mismo. No cambia nada de lo que se ve.

Efecto: −130 kB en las páginas sin widgets (404, inicio, auth, brazos: de ≈ 326 a ≈ 196 kB), entre −37 y −39 kB en los temas, y ningún cambio en los simuladores ni en el aula. Se añadió una guardia nueva en `bundleBudget.test.ts`: el cierre de imports estáticos y dinámicos de la página 404 no puede contener `Formula`, `DiffDriveWidget` ni `Plot`. Falla con el import anterior y pasa con el nuevo.

## 6. Hallazgos no corregidos (requieren decisión o tocan otros paquetes)

1. **Definición del presupuesto.** La guardia cuenta solo los imports estáticos, pero lo que el estudiante descarga al abrir un tema son ≈ 88 kB más (supabase, KaTeX y widgets vía `import()`). Hay que decidir cuál de las dos medidas manda y, si es la de ejecución, ampliar la guardia.
2. **KaTeX en el cliente (75,6 kB en cada tema).** Si las fórmulas estáticas se renderizaran en el build y KaTeX se cargara solo para las interactivas, todos los temas quedarían por debajo de 250 kB. Toca `@trayectoria/widgets` (`Formula`).
3. **`robot-spec` + `zod` en todas las páginas (33,5 kB).** Lo arrastra el store de «Mi robot» para validar el robot guardado. Bastaría con validar solo cuando hay un robot guardado. Toca `@trayectoria/widgets` y `robot-spec`.
4. **`supabase-js` en todas las páginas (53,5 kB)**, incluso sin sesión. Ya se carga diferido; cargarlo solo cuando hay sesión local lo quitaría a los visitantes anónimos. Toca `@trayectoria/auth`.
5. **`Toast` importado por el barrel** en `/aula/`, `/unirse/`, `/cuenta/` y `/cuenta/robots/`, que descargan ≈ 330 kB (el catálogo entero). Arreglarlo requiere una entrada `./Toast` en `packages/widgets/package.json`, que cambia la API pública de otro paquete.
6. **Simuladores por debajo de 80.** Móvil: CLS de 0,63–0,77, que Lighthouse atribuye a la `section` principal con la causa «Web font loaded». En Playwright sin throttling el CLS es 0,07, así que depende de cuándo llega la fuente respecto a la hidratación de la isla `client:visible`. Brazo: la isla `client:only` aparece de golpe (CLS 0,13), y `react-dom` y `three` bloquean el hilo principal 260–650 ms. Opciones: reservar la altura de la isla, ajustar las métricas de la fuente de respaldo (`size-adjust`) o diferir la inicialización de la escena. Todas cambian el primer fotograma, así que quedan para la validación del humano.
7. **`so101/foto.jpg` sin WebP ni AVIF** (93 KiB estimados). Solo aparece en `/brazos/` y con carga diferida; prioridad baja.

## 7. Cómo reproducir

```
CLAUDECODE='' pnpm build
BUNDLE_BUDGET=1 pnpm --filter @trayectoria/web exec vitest run
# servir dist con gzip en 127.0.0.1:4378 y después:
npx lighthouse http://127.0.0.1:4378/ruta/ruta-1/m00/t01/ --preset=desktop --only-categories=performance
```

Los scripts de medición con Playwright y el servidor gzip fueron temporales y no forman parte del PR.

## 8. F7-02b (#444): arreglos técnicos de §6

2026-09-26 · rama `perf/444-fixes` sobre `main` (a64f850). Mismo método que §2: build de producción servido con gzip en `127.0.0.1:4386`, Lighthouse 13.5.0 con el preset `desktop` (Chromium 1243 de Playwright). Para aislar el ruido de la máquina, «antes» (`main`, servido en `:4387`) y «después» se midieron intercalados en la misma sesión: 3 pasadas en el simulador móvil y 5 en el de brazo, de las que se da la mediana.

### 8.1 Cambios

- **`Toast` por entrada directa (§6.5).** `@trayectoria/widgets` expone `./Toast` (entrada nueva y aditiva en su `package.json`; el barrel sigue exportando lo mismo). El aula, «Unirse», la cuenta, «Mis robots» y los simuladores importan `Toast` de ahí, y `MyRobotWidget`, `useMyRobot`, `parseStoredRobot`, `robotSpecToJson` y `SPEEDS` de sus entradas ya existentes (`./MyRobotWidget`, `./SimControls`). En `apps/web` ya no queda ningún import de valor del barrel.
- **CLS de los simuladores (§6.6).** La causa era la barra de desplazamiento: la página cabía en la ventana mientras la isla cargaba y, al aparecer el simulador, crecía, salía la barra vertical y todo el contenido centrado se desplazaba 7 px a la izquierda. Ahora los estados de carga reservan una altura menor que la del simulador ya cargado, así que la página ya es más alta que la ventana desde el primer fotograma y la versión cargada no cambia: el aviso de carga del móvil (720 px; el simulador mide ≥ 999 px), un `fallback` vacío de la isla `client:only` del brazo (740 px; ≥ 758 px cargado), el aviso mientras carga `three` (540 px; visor ≥ 549 px) y la isla mientras `ArmViewer` muestra su línea de carga (740 px).
- Guardia nueva en `bundleBudget.test.ts`: el grafo estático de `/aula/`, `/unirse/`, `/cuenta/` y `/cuenta/robots/` no puede contener `Formula`, `DiffDriveWidget` ni `Plot`. Falla sobre `main` y pasa con el cambio.

### 8.2 Resultados

| Página | Antes | Después | CLS antes → después | TBT antes → después |
| --- | ---: | ---: | --- | --- |
| `/simuladores/movil/` (75, 74, 74 → 97, 97, 97) | 74 | **97** | 0,63 → 0,001 | 0–20 ms → 0 ms |
| `/simuladores/brazo/` (86, 85, 86, 86, 87 → 84, 89, 91, 90, 92) | 86 | **90** | 0,13 → 0 | 150–190 ms → 140–270 ms |

JS comprimido del grafo estático (imports estáticos desde el HTML, kB gzip):

| Página | Antes | Después |
| --- | ---: | ---: |
| `/aula/` | 336,8 | 165,7 |
| `/unirse/` | 330,9 | 159,8 |
| `/cuenta/` | 335,7 | 204,0 |
| `/cuenta/robots/` | 339,3 | 207,6 |
| `/simuladores/movil/` | 284,9 | 154,7 |
| `/simuladores/brazo/` | 148,1 | 148,2 |

En ejecución los simuladores descargan lo mismo que antes (≈ 396 y ≈ 620 KiB transferidos): `@trayectoria/sims` sigue importando el barrel de `@trayectoria/widgets` y lo trae con su `import()`. La cuenta aún puede alcanzar el catálogo con el `import()` de `@trayectoria/sims` al guardar un robot, pero no al abrir la página.

Capturas (`e2e/visual`) de los simuladores y e2e de ambos simuladores: en verde sin regenerar ninguna.

### 8.3 Qué queda

- **TBT del brazo.** Lo domina la tarea larga de `react-dom` y `three` al montar la escena (Chromium sin GPU en Lighthouse). No hay trabajo no crítico acotado que diferir en `apps/web`; reducirlo pasa por `@trayectoria/sims` (entradas en vez del barrel) o por cambiar el primer fotograma.
- **Barrel de `@trayectoria/widgets` en `@trayectoria/sims`** (11 módulos): quitarlo bajaría el JS en ejecución de los simuladores. Toca otro paquete.
- **`so101/foto.jpg` a WebP (§6.7):** el servicio de imágenes de Astro necesita `sharp` resoluble desde `apps/web`, que hoy solo lo tiene `astro`. Pendiente del spec gap #457.
