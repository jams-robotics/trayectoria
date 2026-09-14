# Brief de diseño — Trayectoria (para Claude Design)

Este documento se pega completo en Claude Design al iniciar el ticket D-01. Es la entrada; la salida es `docs/DESIGN.md`, `tokens.css` y las 6 pantallas aprobadas.

## 1. Qué es el producto

Plataforma web open source, en español, donde estudiantes universitarios de ingeniería aprenden física, matemática y mecánica manipulando visualizaciones interactivas, y cada tema termina aplicado a un robot que pueden simular. Tiene dos simuladores (robot móvil 2D y brazo 3D), un perfil "Mi robot" que atraviesa todo el contenido, y un modo aula para docentes.

Audiencia: estudiantes de ingeniería (mecatrónica, eléctrica, mecánica, sistemas) y docentes universitarios, principalmente en Latinoamérica, con laptops modestas y a veces en aulas con proyector.

## 2. Personalidad

Moderna, precisa, calmada, confiable. Se siente como un instrumento de laboratorio bien diseñado o como una buena documentación técnica actual: limpia, con aire, con números claros. Es un lugar para leer y experimentar durante 30 minutos seguidos sin fatiga.

No es: edgy, gamer, infantil, "startup con gradientes", corporativo gris, ni dark-only. Sin mascotas, sin ilustraciones caricaturescas, sin neones, sin glassmorphism pesado, sin animaciones decorativas (las únicas animaciones son las de la simulación misma).

## 3. Psicología del color (dirección, no paleta final)

Justificar cada elección en una frase en `DESIGN.md`.

- **Base neutra** para lectura larga: fondos casi blancos con un ligero tono frío en claro; grises azulados profundos (no negro puro) en oscuro. La lectura y las fórmulas mandan.
- **Acento primario** en la familia azul/teal: transmite precisión, tecnología y confianza; va en acciones principales, estado activo, enlaces y la barra de progreso.
- **Acento físico** cálido (ámbar/naranja): reservado para "lo que es el robot" en pantalla: el cuerpo del robot, el vector de velocidad del robot, el punto activo en una simulación, el botón de "abrir en simulador". Contrasta con el primario y dirige la mirada a la parte física. Es el color del hilo conductor de la plataforma.
- **Semánticos** solo con su significado: verde para respuesta correcta y completado; rojo/coral para error y "perdió la línea"; amarillo para advertencia. Nunca color como único canal: siempre acompañado de icono o texto.
- **Paleta de datos** de 6 colores para series de gráficas y vectores, distinguibles con daltonismo (probar con deuteranopia y protanopia), con nombres semánticos fijos: `data-1` a `data-6`, y dos reservados: `vector-velocity` (ámbar) y `vector-force`.
- Claro y oscuro con la **misma jerarquía**: lo que destaca en uno destaca en otro. Contraste AA en todo texto y control, AAA en cuerpo de lectura.

## 4. Tipografía

- Una familia sans humanista o geométrica-suave para UI y lectura larga, con buen soporte de español (tildes, ñ, ¿¡). Preferir fuente del sistema o una de código abierto con licencia OFL; sin webfonts de pago.
- Monoespaciada para números, unidades, matrices, código y lecturas de sensores; los números tabulares se alinean.
- Escala modular documentada (por ejemplo, base 16 y razón 1.2 o 1.25), con los usos: título de tema, título de sección, cuerpo, etiqueta de control, valor numérico grande.
- Ancho de lectura máximo 72 caracteres. Interlineado generoso en cuerpo (1.6).
- Las fórmulas las renderiza KaTeX; diseñar el bloque que las contiene (fondo, margen, lista de variables debajo).

## 5. Layout y principios de UX

- Contenido primero. En escritorio, el widget interactivo va al lado del concepto que explica (dos columnas); en móvil, debajo.
- Progreso visible pero discreto: barra fina y estado por tema en el índice; sin gamificación (sin puntos, medallas ni rachas).
- Navegación mínima: Inicio, Ruta, Simuladores, Brazos, Cuenta. El tema tiene anterior/siguiente y un índice lateral de sus 7 secciones.
- Los controles de simulación (reproducir, pausar, paso, reiniciar, velocidad) son un componente único y siempre igual en toda la plataforma.
- Sliders muestran valor y unidad; se pueden editar por teclado escribiendo el número.
- Estados del ejercicio: pendiente, verificando, correcto, incorrecto con "fuera por X %". El feedback es concreto, nunca celebratorio.
- Todo operable con teclado; foco visible; objetivos táctiles ≥ 44 px; funciona proyectado en un aula (texto no menor de 16 px, contraste alto).

## 6. Pantallas a diseñar (claro y oscuro, escritorio y móvil)

1. **Inicio**: propuesta de valor en una frase, el hilo de la ruta (un diagrama simple de módulos que terminan en el robot), entrada a la ruta y a los simuladores, bloque para docentes.
2. **Índice de la ruta**: 7 módulos con sus temas, estado de cada uno, tiempo estimado, tarjeta "Mi robot" compacta.
3. **Página de tema**: las 7 secciones (Gancho, Concepto, Fórmulas, Explora, Al robot, Verifica, Profundiza) con un widget real de ejemplo en Explora (una rueda girando con vector de velocidad y un panel de 2 sliders), un bloque de fórmula con variables, y dos ejercicios en distintos estados.
4. **Simulador móvil 2D**: pista con el robot y sus sensores, panel de robot, selector de controlador con sus ganancias, controles de simulación, gráficas en vivo, tiempo de vuelta.
5. **Simulador de brazo 3D**: visor con el brazo y marcos, sliders por articulación, panel del efector (posición y orientación), panel de matrices plegable, botón de espacio de trabajo.
6. **Aula del docente**: lista de grupos, código de invitación, tabla tema × estudiante con estados, exportar CSV.

## 7. Entregables y formato

- `docs/DESIGN.md`: principios, paleta con justificación, tipografía, escala de espaciado, radios y sombras, componentes base con sus estados (botón primario/secundario/fantasma, slider, campo numérico, tarjeta, tabs, panel de parámetros, controles de simulación, gráfica, bloque de fórmula, ejercicio, toast, barra de progreso, tabla, navegación, pie), reglas de claro/oscuro, y la paleta de datos.
- `tokens.css`: variables CSS con exactamente estos prefijos, en `:root` y `[data-theme="dark"]`:
  - color: `--color-bg`, `--color-bg-raised`, `--color-fg`, `--color-fg-muted`, `--color-border`, `--color-primary`, `--color-primary-fg`, `--color-primary-hover`, `--color-physical`, `--color-physical-fg`, `--color-success`, `--color-error`, `--color-warning`, `--color-focus`, `--color-data-1` … `--color-data-6`, `--color-vector-velocity`, `--color-vector-force`
  - tipografía: `--font-sans`, `--font-mono`, `--text-xs` … `--text-3xl`, `--leading-body`, `--leading-tight`
  - espaciado: `--space-1` … `--space-12`
  - forma: `--radius-sm`, `--radius-md`, `--radius-lg`, `--shadow-sm`, `--shadow-md`
  - simulación: `--sim-grid`, `--sim-axis`, `--sim-track`, `--sim-robot`, `--sim-sensor-on`, `--sim-sensor-off`, `--sim-trace`
- Maquetas de las 6 pantallas exportadas en `docs/design/` (PNG o el formato que Claude Design exporte), nombradas `01-inicio-claro.png`, `01-inicio-oscuro.png`, etc.

## 8. Criterios de aprobación

- Contraste AA verificado en todas las combinaciones texto/fondo y control/fondo de la paleta.
- La paleta de datos pasa simulación de deuteranopia y protanopia.
- Un desarrollador puede construir F0-04 y cualquier widget usando solo `DESIGN.md` y `tokens.css`, sin preguntar nada.
- Las 6 pantallas se ven coherentes entre sí y con la personalidad del §2.
