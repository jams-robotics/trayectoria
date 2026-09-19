# SO-101 — origen de los archivos

Todos los archivos de este directorio, salvo `ficha.json` y este mismo documento, se descargaron sin
modificar del repositorio oficial del brazo.

- Repositorio: `TheRobotStudio/SO-ARM100` (<https://github.com/TheRobotStudio/SO-ARM100>)
- Commit: `eecbe3e0a9ebb23e25ad7b2759b03884c6660903`
- Fecha de descarga: 2026-09-19
- Licencia: Apache-2.0, copiada sin modificar en `LICENSE` desde ese mismo commit
- El commit es el mismo que indica `packages/sim-core/test/fixtures/so101/SOURCE.md` (F1-09), de modo
  que el URDF del catálogo y el del fixture describen el mismo brazo.

## Archivos

| Archivo del catálogo | Origen en el repositorio | Bytes |
| --- | --- | ---: |
| `so101.urdf` | `Simulation/SO101/so101_new_calib.urdf` | 16 231 |
| `LICENSE` | `LICENSE` | 11 357 |
| `foto.jpg` | `media/SO101_Follower.webp` | 108 782 |
| `meshes/base_motor_holder_so101_v1.stl` | `Simulation/SO101/assets/base_motor_holder_so101_v1.stl` | 1 877 084 |
| `meshes/base_so101_v2.stl` | `Simulation/SO101/assets/base_so101_v2.stl` | 471 584 |
| `meshes/motor_holder_so101_base_v1.stl` | `Simulation/SO101/assets/motor_holder_so101_base_v1.stl` | 1 129 384 |
| `meshes/motor_holder_so101_wrist_v1.stl` | `Simulation/SO101/assets/motor_holder_so101_wrist_v1.stl` | 1 052 184 |
| `meshes/moving_jaw_so101_v1.stl` | `Simulation/SO101/assets/moving_jaw_so101_v1.stl` | 1 413 584 |
| `meshes/rotation_pitch_so101_v1.stl` | `Simulation/SO101/assets/rotation_pitch_so101_v1.stl` | 883 684 |
| `meshes/sts3215_03a_no_horn_v1.stl` | `Simulation/SO101/assets/sts3215_03a_no_horn_v1.stl` | 865 884 |
| `meshes/sts3215_03a_v1.stl` | `Simulation/SO101/assets/sts3215_03a_v1.stl` | 954 084 |
| `meshes/under_arm_so101_v1.stl` | `Simulation/SO101/assets/under_arm_so101_v1.stl` | 1 975 884 |
| `meshes/upper_arm_so101_v1.stl` | `Simulation/SO101/assets/upper_arm_so101_v1.stl` | 1 303 484 |
| `meshes/waveshare_mounting_plate_so101_v2.stl` | `Simulation/SO101/assets/waveshare_mounting_plate_so101_v2.stl` | 62 784 |
| `meshes/wrist_roll_follower_so101_v1.stl` | `Simulation/SO101/assets/wrist_roll_follower_so101_v1.stl` | 1 439 884 |
| `meshes/wrist_roll_pitch_so101_v2.stl` | `Simulation/SO101/assets/wrist_roll_pitch_so101_v2.stl` | 2 699 784 |

Las 13 mallas suman 16 129 292 bytes (16,13 MB). Superan el límite de 15 MB que fijaba el issue
#132; se aceptan sin modificar por la resolución del spec gap #143.

## Cambios sobre los archivos de origen

1. `so101.urdf` es `so101_new_calib.urdf` con una única sustitución de texto: las rutas de malla
   `filename="assets/…"` pasan a `filename="meshes/…"`, para que apunten al subdirectorio de este
   catálogo. Ningún otro byte cambia. No se usa `package://`: las rutas son relativas al directorio
   del URDF.
2. `foto.jpg` es `media/SO101_Follower.webp` redimensionada a 1280 × 960 px y convertida a JPEG
   (calidad 82) porque el entregable del ticket pide un `.jpg` y el catálogo no sirve WebP. El
   contenido de la imagen no se ha alterado de ninguna otra forma.
3. Las mallas y `LICENSE` son copias byte a byte del origen.

## Datos de `ficha.json`

- `dof = 6`: las articulaciones no fijas de `so101.urdf` (`shoulder_pan`, `shoulder_lift`,
  `elbow_flex`, `wrist_flex`, `wrist_roll`, `gripper`). Lo comprueba
  `packages/sim-core/src/urdf/catalog.test.ts`.
- `reach_m = 0,48`: alcance horizontal máximo calculado con `endEffectorPose` de sim-core sobre el
  propio URDF, muestreando las articulaciones dentro de sus límites (máximo 0,4790 m). No es un dato
  del repositorio de origen, sino una medida de la cinemática que aquí se publica.
- `cost_usd_approx = 122`: total de la lista de materiales de un brazo seguidor en Estados Unidos
  según el README del commit citado ($121,94).
- `payload_kg = null`: el repositorio de origen **no documenta** carga útil, y este proyecto no
  inventa datos que no están en una fuente. La ficha lo declara nulo y la página lo muestra como
  «sin dato». Si aparece una cifra publicada, se actualiza aquí junto con `verifiedAt`.

## Atribución

Brazo SO-101 de The Robot Studio, publicado bajo Apache-2.0. La fotografía procede del mismo
repositorio y commit, cubierta por la misma licencia. Conserva el aviso de `LICENSE` en cualquier
redistribución.
