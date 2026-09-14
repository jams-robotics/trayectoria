# Revisión de D-01 — entrega de Claude Design

Fecha: 2026-09-14 · Revisor: Claude (sesión de diseño con Jams) · Veredicto: **aprobado con correcciones aplicadas** (ver `DESIGN.md` cabecera). Pendiente menor: D-02 (móvil).

## 1. Tokens (`DESIGN-BRIEF.md` §7)

- 57 tokens requeridos: **57 presentes, 0 faltantes, 0 extra**. Todos los colores tienen override en `[data-theme="dark"]`.
- Fuentes: Source Sans 3 y Source Code Pro (ambas OFL). Deben **autoalojarse** en `apps/web/public/fonts/` (sin CDN de terceros): añadido a F0-04.

## 2. Contraste WCAG (calculado con los valores reales)

Claro, sobre `bg` / `bg-raised`:

| Token | Ratio | Uso como texto |
|---|---|---|
| fg | 14.6 / 15.7 | sí |
| fg-muted | 5.7 / 6.1 | sí |
| primary | 5.6 / 6.1 | sí |
| **physical (entregado #b35f08)** | **4.29 / 4.61** | **fallaba AA (4.5) sobre `bg`** → corregido a `#a25607`: 5.05 / 5.43; blanco sobre él 5.43 |
| success / error / warning | 5.0 / 5.1 / 4.6 | sí |
| focus | 3.2 | solo anillo (≥ 3 ok) |
| vector-velocity / vector-force | 4.7 / 6.0 | sí |
| data-1, data-6 | 4.8 / 4.9 | sí |
| data-2 … data-5 | 3.2 – 4.1 | **solo gráfico**, nunca texto (regla añadida a §2.2) |

Oscuro: todo texto ≥ 5.9; tinta sobre acentos 8.6 y 9.0. Sin hallazgos.

## 3. Paleta de datos bajo daltonismo (simulación Machado 2009, severidad 1.0, ΔE CIE76 tras simular)

Pares más cercanos (ΔE < 20 = difícil de distinguir):

| Tema | Protanopia | Deuteranopia |
|---|---|---|
| Claro | data-1/data-5 **12.0**; data-4/data-5 17.0; data-1/data-4 17.6 | data-1/data-5 **12.1**; data-1/data-6 **14.5**; data-3/data-4 17.6 |
| Oscuro | data-1/data-6 **13.4**; data-4/data-5 14.7 | data-1/data-6 **5.5**; data-3/data-4 18.4 |

Conclusión: las cuatro series principales (`data-1` … `data-4`) son distinguibles con margen aceptable; `data-5` y `data-6` no lo son frente a `data-1`. No se rediseñó la paleta (ninguna de 6 colores con ≥ 3:1 sobre claro pasa ambas simulaciones limpiamente); se resolvió con **codificación redundante obligatoria** (trazo sólido / discontinuo / punteado / raya-punto) y el tope de 4 series que `DESIGN.md` ya fijaba. Cumple WCAG 1.4.1 (no solo color).

## 4. `DESIGN.md` contra la lista de componentes del brief

Los 15 componentes base están especificados con estados. Sin faltantes. Observaciones aplicadas:
- Ejercicio: la maqueta y el texto decían "Intento 1 de 3"; el plan no limita intentos (F3-01). Corregido a "Intento n".
- Selector de controlador: la maqueta muestra "Ninguno · P · PID · Propio". v1 tiene Manual · On/off · P · PID; "Propio" es v2 (ADR-0006) y se muestra deshabilitada.
- Profundiza: la maqueta muestra enlaces a otros temas; `CONTENT-STANDARDS.md` §2 exige referencias a libros y permite un enlace a un tema posterior. El diseño del bloque sirve para ambos.

## 5. Pantallas

Las 6 pantallas, en claro y oscuro, son coherentes entre sí y con la personalidad del brief §2. La página de tema respeta las 7 secciones y la columna concepto | fórmulas. El simulador móvil respeta el componente único de controles de simulación.

Faltante respecto al brief §6: **maquetas móviles** (`DESIGN.md` §9 las deja como reglas sin maqueta). No bloquea F0-04 (las reglas de §9 bastan para el layout responsive), pero sí conviene antes de F2-13 y F4-02. Se crea **D-02**.

## 6. Recomendación no aplicada (decisión del humano)

En oscuro, la pista pasa a clara (`--sim-track: #d3dbe3`). El modelo de sensores (`ARCHITECTURE.md` §4.2) y los seguidores reales asumen línea oscura sobre suelo claro. Opción: introducir `--sim-floor` (superficie clara fija dentro del visor en ambos temas) para que la pista sea siempre oscura y coincida con lo que el estudiante construye. Si se adopta, es un ticket de docs sobre `DESIGN.md` y `tokens.css` antes de F4-02.

## 7. Archivos integrados

- `docs/DESIGN.md` (con cabecera de revisión)
- `docs/design/tokens.css` (F0-04 lo copia a `apps/web/src/styles/tokens.css` sin modificar)
- `docs/design/01…06-*-claro|oscuro.png`
- `docs/design/source/` (archivo de Claude Design para reabrir el diseño)
