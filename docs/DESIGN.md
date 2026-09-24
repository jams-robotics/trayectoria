# Trayectoria — Sistema de diseño (D-01)

> **Revisión 2026-09-14 (cierre de D-01).** Entrega de Claude Design validada contra `DESIGN-BRIEF.md` §8; hallazgos y evidencia en `design/D-01-REVIEW.md`. Cambios aplicados sobre la entrega: (a) `--color-physical` claro `#b35f08` → `#a25607` para cumplir AA como texto; (b) regla de trazo redundante en gráficas (§2.2); (c) ejercicios sin límite de intentos (§5); (d) pestaña "Propio" del controlador es v2 y se muestra deshabilitada (§6). Todo lo demás es la entrega original.

Documento normativo. Los valores viven en `tokens.css`; aquí se explica por qué y cómo se usan. Un desarrollador debería poder construir cualquier pantalla o widget con estos dos archivos.

---

## 1. Principios

1. **La teoría se toca.** Cada concepto aparece junto a algo manipulable. Si un widget no cambia al mover un parámetro, no es un widget.
2. **El número siempre con su unidad.** Nunca `0.69`; siempre `0.69 m/s`. Los valores numéricos van en mono con `font-variant-numeric: tabular-nums` para que no bailen.
3. **Dos mundos, dos colores.** Azul petróleo (`--color-primary`) = teoría, interfaz, acción. Ámbar (`--color-physical`) = robot, mundo físico, "Al robot", simulador. El ámbar es escaso a propósito: cuando aparece, significa "esto le pasa a tu robot".
4. **Sobrio, no frío.** Sin celebraciones, sin puntos, sin medallas. El feedback es concreto: "Incorrecto · fuera por 12 %". La calidez viene de la tipografía humanista y del ámbar, no de adornos.
5. **Legible proyectado.** Cuerpo 16 px mínimo, contraste AA en todo, objetivos ≥ 44 px. Un aula con proyector barato es el caso base, no el borde.
6. **Superficies planas, jerarquía por borde.** Las tarjetas se separan con `--color-border` y un salto `bg → bg-raised`; las sombras son casi imperceptibles y solo para elementos flotantes.

---

## 2. Color

### 2.1 Paleta base

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--color-bg` | `#f5f7f9` | `#121820` | Fondo de página |
| `--color-bg-raised` | `#ffffff` | `#1a222c` | Tarjetas, paneles, cabecera |
| `--color-fg` | `#1a242f` | `#e4eaf0` | Texto principal |
| `--color-fg-muted` | `#526475` | `#9dadbd` | Texto secundario, etiquetas, ejes |
| `--color-border` | `#d5dde5` | `#2c3845` | Bordes, divisores, pistas de slider |
| `--color-primary` | `#0d6a8e` | `#5fc1dd` | Acción principal, enlaces, estado "en curso", slider activo |
| `--color-primary-fg` | `#ffffff` | `#0a1a22` | Texto sobre primary |
| `--color-primary-hover` | `#0a5471` | `#88d4ea` | Hover de primary |
| `--color-physical` | `#a25607` | `#f0a742` | Robot, botón "Abrir en simulador", eslabones del brazo |
| `--color-physical-fg` | `#ffffff` | `#1f1300` | Texto sobre physical |
| `--color-success` | `#1c7a4e` | `#4fc487` | Correcto, completado, sensor activo |
| `--color-error` | `#bf3a2b` | `#f07a6d` | Incorrecto, con errores, eje x |
| `--color-warning` | `#9c6400` | `#e6b84a` | Avisos (código por vencer, límite de articulación) |
| `--color-focus` | `#2f8fd8` | `#7cc4f5` | Anillo de foco (2 px, offset 2 px) |

**Justificación.** El azul petróleo evita el azul-enlace genérico y sostiene 6:1 sobre blanco; el ámbar quemado es su complementario de temperatura y se distingue del error (rojo) y del warning (ocre) incluso en deuteranopia. El fondo `#f5f7f9` (no blanco puro) deja que las tarjetas blancas se lean sin sombra. En oscuro, los fondos son azul-grises (no negros) para que las líneas de grafica no vibren, y los acentos se aclaran ~2 pasos de luminosidad en vez de invertirse: primary pasa a cian claro con texto oscuro encima.

**Regla de tinta sobre acento.** El texto sobre `primary`, `physical`, `success` y `error` usa `--color-primary-fg` / `--color-physical-fg` / `--color-bg-raised` respectivamente — nunca `#fff` fijo (en oscuro fallaría AA).

### 2.2 Paleta de datos

Basada en Okabe-Ito, ajustada para AA sobre `--color-bg` en claro.

| Token | Claro | Oscuro | Asignación fija |
|---|---|---|---|
| `--color-data-1` | `#0072b2` | `#5aa9e6` | Serie principal, error de línea, traza, eje z |
| `--color-data-2` | `#d55e00` | `#ff8c42` | Rueda / motor izquierdo |
| `--color-data-3` | `#009e73` | `#3ccf9a` | Rueda / motor derecho |
| `--color-data-4` | `#b8578f` | `#e79fc7` | Cuarta serie |
| `--color-data-5` | `#2d8fc4` | `#8fd3f8` | Quinta serie |
| `--color-data-6` | `#6a5acd` | `#a190f0` | Sexta serie |
| `--color-vector-velocity` | `#a85a05` | `#f0a742` | Vector velocidad (siempre) |
| `--color-vector-force` | `#7b3fb8` | `#b48ae8` | Vector fuerza (siempre) |

Reglas: una gráfica no usa más de 4 series; cada serie lleva leyenda con texto, nunca solo color; las series se distinguen además por orden (izq antes que der). **Trazo redundante:** la serie 1 es sólida, la 2 discontinua (8-4), la 3 punteada (2-3) y la 4 raya-punto; `data-5` y `data-6` solo aparecen en tablas o como quinta y sexta serie de un `Plot` de comparación, nunca como único canal (bajo deuteranopia `data-1`/`data-5` y `data-1`/`data-6` se confunden; ver `design/D-01-REVIEW.md`). Los colores `data-2` a `data-5` en claro cumplen ≥ 3:1 como gráfico pero **no** se usan como texto. Los vectores velocidad/fuerza tienen color fijo en toda la plataforma. Ejes de marco 3D: x = `error`, y = `success`, z = `data-1` (convención RGB de robótica, legible en daltonismo por posición y etiqueta).

### 2.3 Contraste verificado (WCAG 2.x, ratio sobre `bg` / `bg-raised`)

Claro: fg 14.6/15.7 · fg-muted 5.7/6.1 · primary 5.6/6.1 · physical 5.1/5.4 · success 5.0/5.3 · error 5.1/5.5 · warning 4.6/5.0 · primary-fg/primary 6.1 · physical-fg/physical 5.4 · vector-velocity 4.7/5.1 · data-1 4.8/5.2 · data-6 4.9/5.3 · data-2..5 3.4–4.1 (gráfico, ≥3:1).
Oscuro: todo texto ≥ 5.9; primary-fg/primary 8.6; physical-fg/physical 9.0.
`--color-focus` es 3.2–3.5 sobre fondos (componente no textual, ≥3:1 OK). Bordes son decorativos (no se exige ratio).

---

## 3. Tipografía

- `--font-sans`: **Source Sans 3** (OFL). Humanista, ancha, con números claros; excelente proyectada. Pesos: 400 cuerpo, 500 etiquetas/nav, 600 títulos y botones, 700 solo glifos de estado. Itálica 400 para variables en prosa.
- `--font-mono`: **Source Code Pro** (OFL). Todo número con unidad, símbolos de variable (`ω`, `r`, `q₁`), lecturas, matrices, códigos, encabezados de columna de tema (`1.3`).
- Subconjuntos autoalojados (spec gap #27): **latín** y **griego** de cada familia, con `unicode-range` para que el griego solo se descargue cuando aparece. Los subíndices se escriben con `<sub>1</sub>` (no con el glifo `₁`) y las flechas (`→`) se aceptan en la fuente de respaldo del sistema; ambos quedan fuera de los subconjuntos disponibles.
- Fórmulas de bloque: `'Latin Modern Math', 'STIX Two Math', 'Cambria Math', serif`, itálica, 28 px, centradas. (En producción: KaTeX con los mismos colores.)

Escala (1.25, base 16): `--text-xs` 13 · `--text-sm` 14 · `--text-base` 16 · `--text-lg` 20 · `--text-xl` 25 · `--text-2xl` 31 · `--text-3xl` 39. Interlineado `--leading-body` 1.6 en prosa, `--leading-tight` 1.2 en títulos y cifras grandes.

Uso: h1 de página `2xl`/600; h1 de Inicio `3xl`; h2 de sección `lg`/600 con numeral mono `xs` muted delante; cuerpo `base`; ayuda y metadatos `sm` muted; etiquetas mono en mayúsculas `xs` con `letter-spacing .06em`. Ancho de lectura máximo **72ch**. Nunca menos de 13 px, y 13 px solo en mono para ejes/leyendas.

---

## 4. Espaciado, forma, elevación

Espaciado base 4: `--space-1..12` = 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96.
Uso típico: interior de tarjeta 20–24; entre tarjetas 12–20; entre secciones de tema 48; márgenes de página 40 (escritorio), 20 (móvil); gap de controles 6–12.

Radios: `--radius-sm` 4 (inputs, botones de simulación, chips de estado en tabla) · `--radius-md` 8 (botones, campos, sliders-thumb contenedor) · `--radius-lg` 12 (tarjetas, paneles, visores). Píldoras (`999px`) solo para estado y filtros.

Sombras: `--shadow-sm` para thumbs de slider y tarjetas flotantes dentro de un visor; `--shadow-md` solo para toasts y popovers. Las tarjetas en flujo **no** llevan sombra.

Anchos: contenido 1120 px (Inicio, Ruta), 1200 px (Tema), 1240 px (Aula); simuladores a ancho completo con padding 32. Panel lateral de simulador 340–360 px, token `--size-panel-side` = 352 px (utilidad `w-panel`); índice de secciones 200 px; lateral de Ruta 300 px.

Página de tema (#302): texto corrido, tarjetas `Formula` y `RobotFormula`, tarjetas `Experimento`, `MyRobotWidget` y ejercicios de Verifica comparten una sola columna de lectura de 72ch, con los mismos bordes izquierdo y derecho. Solo los widgets grandes de Explora (simuladores con visor) usan todo el ancho de la columna de contenido. En móvil no cambia nada (§9).

---

## 5. Componentes base

Todos: altura mínima 40 px (44 px en acciones principales y en móvil), foco `outline: 2px solid var(--color-focus); outline-offset: 2px`, transición 120 ms solo en color/fondo, nunca en tamaño.

### Botón
- **Primario**: fondo `primary`, texto `primary-fg`, borde 1 px `primary`, 600, radio `md`, altura 44 (40 en barras). Hover: `primary-hover`. Un primario por vista.
- **Físico** (variante de primario): fondo `physical`, texto `physical-fg`. Solo para "Abrir en simulador" y acciones que afectan al robot. Lleva glifo de chasis a la izquierda.
- **Secundario**: fondo `bg-raised`, borde `border`, texto `fg`, 600. Hover: borde `fg-muted`.
- **Fantasma**: transparente, sin borde (o borde `border` si está sobre `bg`), texto `fg-muted`; hover texto `fg`. Para acciones de baja prioridad ("Comprobar" antes de escribir, "Editar").
- Deshabilitado: opacidad 0.45, cursor default. Nunca ocultar el botón.

### Slider (parámetro)
Fila de cabecera: nombre + símbolo mono itálico a la izquierda; a la derecha un **campo numérico** mono con unidad en muted (`20.9 rad/s`) dentro de una caja `border`/`bg` radio `sm` — ese campo es editable: clic o Tab escribe el número, Enter aplica, flechas ±paso, Shift+flecha ×10.
Pista: 4 px, `border`; tramo activo `primary`; thumb 20 px, fondo `bg-raised`, borde 2 px `primary`, `shadow-sm`. Min/máx bajo la pista en mono `xs` muted. Área de arrastre 24 px alto. Foco: anillo en el thumb.
Enlace "Usar los valores de Mi robot" al pie del panel cuando aplica.

### Campo numérico
Mono, `tabular-nums`, unidad como sufijo muted no editable. Borde `border`; foco `focus`; error `error` con mensaje `sm` debajo; éxito `success`. Altura 40.

### Tarjeta
`bg-raised`, borde 1 px `border`, radio `lg`, padding 20–24. Título `base`/600 o `lg`/600 con acción secundaria a la derecha (enlace `sm`). Sin sombra.

### Tabs / segmentado
Contenedor con borde `border`, radio `md`, hijos separados por borde interno; activo fondo `primary` + `primary-fg`; inactivo `fg-muted`. Versión chip (Directa/Inversa) radio `sm` y padding 3×10. Navegación superior: texto 500, subrayado 2 px `primary` en activo.

### Panel de parámetros
Tarjeta con `dl` en grid `1fr auto`: `dt` muted, `dd` mono `tabular-nums` alineado a la derecha. Gap 8×12. Cabecera con nombre y origen ("Mi robot").

### Controles de simulación (componente único)
Orden fijo: **Reproducir · Pausa · Paso · Reiniciar · [Velocidad 1×] · t 00.00 s**. Botones altura 40 (36 dentro de widgets), radio `sm`, Reproducir es el único primario; los demás secundarios. Selector de velocidad es una caja mono con opciones 0.25×, 0.5×, 1×, 2×, 4×. Reloj mono con `tabular-nums` y dos decimales. Atajos: Espacio play/pausa, `.` paso, `R` reiniciar. En widgets pequeños, el mismo componente sin reloj, alineado abajo-izquierda del visor.

### Gráfica
Tarjeta con cabecera: título `sm`/600 a la izquierda, leyenda a la derecha (rectángulo 10×3 de color + nombre en mono muted). Ejes `--sim-axis` 1 px, rejilla `--sim-grid`, líneas 2 px `round`. Etiquetas de tiempo mono 11–12 px en extremos. Sin fondo de área. Altura 200 en simulador. Ventana deslizante de 8 s.

### Bloque de fórmula
Tarjeta; fórmula centrada 28 px serif-math itálica; debajo, separada por línea `border`, tabla de variables en grid `auto 1fr auto`: símbolo mono itálico · nombre muted · unidad mono muted.

### Ejercicio
Tarjeta con enunciado precedido de `E1`, `E2` en mono muted. Fila: campo numérico con unidad · botón Comprobar · estado.
Estados: **pendiente** (campo `border`, Comprobar primario) · **verificando** (Comprobar deshabilitado, texto "Verificando…") · **correcto** (campo borde `success`, ✓ en círculo `success` + "Correcto"; Comprobar pasa a fantasma) · **incorrecto** (campo borde `error`, ✕ en círculo `error` + "Incorrecto · fuera por 12 %", línea `sm` muted con pista e "Intento n"; no hay límite de intentos). Nunca confeti, nunca exclamaciones.

### Toast
Esquina inferior derecha, `bg-raised`, borde `border`, punto de 8 px `success`/`error`/`fg-muted` al inicio del texto (nunca franja lateral de color), radio `md`, `shadow-md`, texto `sm`, se cierra en 5 s o con Esc. Uso: "Copiado", "CSV exportado", "Parámetros de Mi robot aplicados".

### Barra de progreso
4 px, fondo `border`, relleno `primary`, radio 2. Siempre acompañada de la cifra mono (`9/29` o `31 %`). Nunca animada al cargar.

### Tabla
`bg-raised` con borde y radio `lg`, `overflow:auto`. Cabecera `sm`/600, columnas de tema en mono `xs` muted centradas. Filas 44 px con divisor `border`. Primera columna sticky. Celdas de estado: cuadrado 26 px radio `sm` — completado `success` con "C", en curso `primary` con "E", con errores `error` con "✕", pendiente solo borde. Tinta sobre el color: `bg-raised`. Cada estado tiene letra además de color y `title`.

### Navegación
Cabecera 56 px `bg-raised` con borde inferior. Marca (glifo de chasis ámbar + "Trayectoria" 18/600) · enlaces 500 muted, activo `primary` con subrayado 2 px · derecha: progreso 96 px + cifra mono, avatar 32 px con iniciales. En móvil: marca + botón menú; los enlaces pasan a hoja inferior.
Índice lateral de tema (200 px, sticky): lista con borde izquierdo 2 px `border`; sección actual borde `primary` y texto `primary` 600.

### Pie
`sm` muted, licencia a la izquierda, enlaces a la derecha, sin fondo.

---

## 6. Visores de simulación

Fondo `bg-raised` con rejilla `--sim-grid` (líneas 1 px cada 40 px = 0.25 m en 2D; 24 px en widgets). Escala visible en la esquina inferior izquierda (`0.5 m`). Ejes `--sim-axis`. Pista `--sim-track` 10 px. Robot `--sim-robot` (= `physical`): chasis con radio 6, ruedas `fg`, sensores círculos 5 px `--sim-sensor-on`/`--sim-sensor-off`. Vector velocidad `--color-vector-velocity` 3 px con flecha. Traza `--sim-trace` punteada 2 px.
Leyenda arriba-izquierda (mono `xs` muted, con estado de sensores en vivo). Tarjeta de métrica (tiempo de vuelta) abajo-derecha, `shadow-sm`. Controles de vista (Espacio de trabajo, Marcos, Vista) arriba-izquierda como secundarios 36 px. El selector de controlador muestra Manual · On/off · P · PID; la pestaña "Propio" (código del estudiante) es v2 y se muestra deshabilitada con etiqueta "v2". Ayuda de interacción mono `xs` abajo-izquierda.
Editor de pista: ocupa la caja del visor, no una columna aparte. Un segmentado «Simulación» / «Editar pista» sobre el visor alterna entre los dos y el simulador conserva su tamaño; nunca se encoge para dejarle sitio al editor (#158). Con un segmento seleccionado, sus acciones frecuentes (invertir sentido, borrar) salen en una barra flotante junto a la pista, dentro de la misma caja, en vez de solo en el panel numérico; el segmento seleccionado se resalta en el lienzo (#159, #160). La barra flotante se muestra solo con la herramienta «Seleccionar»: con «Recta», «Arco» o «Borrar» no aparece, para no tapar el lienzo mientras se dibuja; los atajos `F` y `Supr` siguen disponibles con cualquier herramienta (#180). El 16/9 del visor se le aplica al lienzo del editor, no a la caja que lo contiene: fijando la caja, en 390 px la barra de herramientas ocupa tres filas y el lienzo se queda en una franja; fijando el lienzo, la caja crece lo justo y el lienzo conserva la forma del visor en las dos maquetas (#189, PR #196).
Reproducción: mover un parámetro del controlador o la velocidad de reproducción se aplica sobre la carrera en curso sin pausarla, para que el cambio de respuesta se vea ocurrir; cambiar de controlador o de pista reinicia la carrera pausada en `t = 0` (#161).

Brazo 3D: base `fg-muted`, eslabones `physical` con grosor decreciente (22/18/14), articulaciones círculos `fg`, marco del efector en RGB (x error, y success, z data-1). Panel de matrices plegable con `⁰T₃ = ⁰T₁ · ¹T₂ · ²T₃`, matriz 4×4 mono alineada a la derecha, columna de traslación en `data-1`, chips para elegir qué matriz se ve.

---

## 7. Claro / oscuro

- Se conmuta con `data-theme="dark"` en `<html>`; respeta `prefers-color-scheme` por defecto y recuerda la elección en `localStorage`.
- Todo color viene de tokens; **ningún hex en componentes**. La única excepción son los SVG de imágenes, que deben usar `currentColor` o `var()`.
- En oscuro no se invierten imágenes; los visores mantienen `bg-raised` y la pista pasa a claro (`--sim-track` `#d3dbe3`).
- Sombras suben de opacidad (0.3/0.35) porque sobre fondos oscuros las de 0.06 desaparecen.
- La tinta sobre acentos cambia con el tema (ver §2.1); por eso `--color-primary-fg` y `--color-physical-fg` existen como tokens.

---

## 8. Accesibilidad

- Contraste AA en texto y ≥3:1 en gráficos y bordes de control (verificado, §2.3).
- Todo control operable por teclado; orden de tabulación = orden visual; foco `--color-focus` 2 px siempre visible (no se elimina nunca).
- Objetivos ≥ 44 × 44 px en acciones y en móvil; 40 px aceptable en barras densas de escritorio.
- Estados nunca solo por color: letra, glifo o texto además.
- Sliders exponen `aria-valuenow/min/max` y `aria-valuetext` con unidad ("20.9 radianes por segundo").
- Animaciones de simulación se pausan con `prefers-reduced-motion`; el usuario avanza con "Paso".
- Idioma `lang="es"`; comillas y signos en español; unidades SI con espacio fino antes del símbolo.

---

## 9. Móvil (390 px)

Maquetas: `docs/design/07-tema-movil-claro.png`, `08-simulador-2d-movil-claro.png`, `09-ruta-movil-claro.png`. Solo tema claro; el oscuro aplica los mismos tokens (§7).

1. **Rejilla.** Una columna, gutter lateral 16 px. Cabecera de 56 px: logo, progreso `9/29` y botón de menú 44×44 px. La navegación horizontal de escritorio se oculta tras el menú.
2. **Tipografía.** Sin reducir la escala: cuerpo 16 px; H1 móvil usa `--text-xl` en lugar de `--text-2xl`. Mínimo 12 px solo en etiquetas de eje y unidades mono.
3. **Objetivos táctiles.** 44 px mínimo en enlaces, botones y filas; cabeceras de acordeón 48–52 px.
4. **Acordeones (tema).** La barra lateral de secciones desaparece; cada sección es un acordeón, solo uno abierto a la vez (por defecto "Explora"). Cabecera: número mono, título y control "ver ▾ / ocultar ▴" con texto además del glifo. Navegación anterior/siguiente en vertical.
5. **Sliders.** Thumb 24 px, pista 4 px, mínimo y máximo en mono bajo la pista; el valor en cápsula a la derecha de la etiqueta.
6. **Visor del simulador.** Ancho completo, 240 px de alto, sin radio en los bordes. Nota: el visor 3D con `Scene3D` y aspecto 16/9 sale de 219 px de alto en 390 px de ancho, no de 240 px; la desviación queda registrada y el visor 2D mantiene los 240 px. Leyenda de sensores arriba-izquierda, reloj `t` abajo-izquierda, escala dentro del visor, tarjeta "Tiempo de vuelta" abajo-derecha. Robot escalado a 0.7.
7. **Barra inferior de controles.** Fija al borde inferior del viewport, 56 px: Reproducir (primario, ancho flexible), Pausa, Reiniciar y velocidad `1×`; todos de 44 px de alto. "Paso" no aparece en móvil. El contenido lleva 56 px de padding inferior para no quedar oculto.
8. **Paneles del simulador.** Robot, Controlador, Lecturas y Gráficas pasan a acordeones entre el visor y la barra; cada cabecera muestra un resumen en línea (`PID`, `v 0.64 m/s`) legible cerrada. Las gráficas se apilan a 120 px cada una. Cada `Plot` va en un contenedor `w-0 min-w-full overflow-hidden`, y el panel que las agrupa en `overflow-hidden`: uPlot fija al lienzo un ancho en píxeles que luego no vuelve a encoger, y en una columna elástica eso se realimenta y la maqueta no se asienta. Es el patrón para cualquier `Plot` dentro de una columna o un acordeón (#195).
9. **Tabla de la ruta.** Scroll horizontal con primera columna sticky de 196 px (nombre del tema y punto de estado); columnas Estado (texto y color), Progreso (barra 72 px y %) y Duración. Las filas de módulo son `<th>` sticky con fondo `--color-bg`; las de tema usan `--color-bg-raised`. Línea de ayuda bajo la tabla anunciando el scroll lateral.
10. **Orden de la ruta.** Progreso global arriba, tarjeta "Continuar" antes de la tabla, "Mi robot" al final en horizontal (miniatura 96 px y lista de parámetros).
11. **Estado y color.** Solo tokens. El estado nunca se codifica solo por color: siempre lleva texto (Completado / En curso / Pendiente).
12. **Tabla del aula.** Sin maqueta propia; sigue el mismo patrón que la tabla de la ruta (scroll horizontal, primera columna sticky).
