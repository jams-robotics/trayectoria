# RobotSpec v1

Único formato de descripción de robot en la plataforma. Todo lo que dibuja, simula o calcula lee un `RobotSpec`. URDF se importa y se mapea; "Mi robot" es un `RobotSpec` de tipo `mobile-diff`; el catálogo son `RobotSpec` con archivos adjuntos.

## 1. Esquema (zod, en `packages/robot-spec/src/schema.ts`)

```ts
export const RobotSpec = z.object({
  specVersion: z.literal(1),
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  kind: z.enum(['mobile-diff', 'arm-serial']),
  source: z.object({
    type: z.enum(['form', 'urdf', 'catalog']),
    catalogId: z.string().optional(),
    urdfPath: z.string().optional(),      // ruta en Storage
    verifiedAt: z.string().datetime().optional(),
  }),
  mobile: MobileSpec.optional(),           // requerido si kind === 'mobile-diff'
  arm: ArmSpec.optional(),                 // requerido si kind === 'arm-serial'
  simConfigs: z.array(SimConfig).default([]),
});
```

### 1.1 MobileSpec

```ts
export const MobileSpec = z.object({
  wheelRadius_m:        z.number().min(0.005).max(0.3),
  wheelBase_m:          z.number().min(0.03).max(1.0),
  maxMotorSpeed_rpm:    z.number().min(1).max(30000),   // rpm del motor antes de la reducción
  gearRatio:            z.number().min(1).max(1000),    // n_motor / n_rueda
  maxAccel_radps2:      z.number().positive().optional(),
  encoderTicksPerRev:   z.number().int().min(1).optional(), // por vuelta de rueda (ya reducido)
  mass_kg:              z.number().min(0.05).max(50),
  length_m:             z.number().positive(),            // para dibujar
  width_m:              z.number().positive(),
  lineSensors: z.object({
    count:            z.number().int().min(1).max(16),
    spacing_m:        z.number().positive(),
    forwardOffset_m:  z.number(),                          // positivo = delante del eje
    footprint_m:      z.number().positive().default(0.004),
  }),
  motor: z.object({                                        // opcional, para M2–M3
    stallTorque_Nm:   z.number().positive(),
    nominalVoltage_V: z.number().positive(),
    efficiency:       z.number().min(0).max(1),
  }).optional(),
  battery: z.object({ capacity_Wh: z.number().positive() }).optional(),
});
```

`omegaMax_radps` de rueda se **deriva** (`rpmToRadps(maxMotorSpeed_rpm) / gearRatio`), no se guarda.

### 1.2 ArmSpec

```ts
export const ArmSpec = z.object({
  baseLink: z.string(),
  endEffectorLink: z.string(),
  links: z.array(z.object({
    name: z.string(),
    visual: z.object({
      meshPath: z.string().optional(),     // relativo a la raíz del paquete/zip
      scale: z.tuple([z.number(), z.number(), z.number()]).default([1,1,1]),
      origin: Origin.default({ xyz: [0,0,0], rpy: [0,0,0] }),
      primitive: z.discriminatedUnion('type', [
        z.object({ type: z.literal('box'), size: z.tuple([z.number(), z.number(), z.number()]) }),
        z.object({ type: z.literal('cylinder'), radius_m: z.number(), length_m: z.number() }),
        z.object({ type: z.literal('sphere'), radius_m: z.number() }),
      ]).optional(),
    }).optional(),
  })),
  joints: z.array(z.object({
    name: z.string(),
    type: z.enum(['revolute', 'continuous', 'prismatic', 'fixed']),
    parent: z.string(),
    child: z.string(),
    origin: Origin,
    axis: z.tuple([z.number(), z.number(), z.number()]).default([1,0,0]),
    limits: z.object({
      lower: z.number(), upper: z.number(),     // rad o m; continuous: ±Infinity
      velocity: z.number().optional(),
      effort: z.number().optional(),
    }).optional(),
  })),
});

const Origin = z.object({
  xyz: z.tuple([z.number(), z.number(), z.number()]),   // m
  rpy: z.tuple([z.number(), z.number(), z.number()]),   // rad, convención URDF
});
```

Invariantes verificadas en `parseRobotSpec`: los joints forman un árbol con raíz `baseLink`; `endEffectorLink` existe y es hoja; nombres únicos; `lower < upper` en revolute y prismatic.

### 1.3 SimConfig

```ts
export const SimConfig = z.object({
  id: z.string(), name: z.string(),
  track: z.unknown().optional(),           // Track JSON (sim-core)
  controller: z.enum(['manual', 'onoff', 'p', 'pid']),
  params: z.record(z.number()),
  seed: z.number().int(),
});
```

## 2. Mapeo desde URDF (F1-09)

| URDF | RobotSpec |
|---|---|
| `<robot name>` | `name` |
| `<link name>` | `links[].name` |
| `<visual><geometry><mesh filename scale>` | `visual.meshPath`, `visual.scale` |
| `<visual><geometry><box|cylinder|sphere>` | `visual.primitive` |
| `<visual><origin xyz rpy>` | `visual.origin` |
| `<joint name type>` | `joints[].name`, `type` |
| `<parent link>`, `<child link>` | `parent`, `child` |
| `<origin xyz rpy>` | `origin` |
| `<axis xyz>` | `axis` (default `[1,0,0]` como URDF) |
| `<limit lower upper velocity effort>` | `limits` |
| link sin padre | `baseLink` |
| hoja más profunda (o `<link name="tool0|ee_link|gripper*">` si existe) | `endEffectorLink` |
| `floating`, `planar` | error `urdf.unsupportedJoint` |
| `package://x/` | raíz del zip |
| `<collision>`, `<inertial>`, `<transmission>`, `<gazebo>` | ignorados en v1 |

Errores: `urdf.parse`, `urdf.noRoot`, `urdf.multipleRoots`, `urdf.cycle`, `urdf.missingLink`, `urdf.unsupportedJoint`, `urdf.missingMesh`, `urdf.badLimits`. Todos con clave i18n en `locales/es/urdf.json`.

## 3. Robot de referencia (valores por defecto de "Mi robot")

```json
{
  "name": "Robot de referencia",
  "kind": "mobile-diff",
  "mobile": {
    "wheelRadius_m": 0.032, "wheelBase_m": 0.15,
    "maxMotorSpeed_rpm": 6000, "gearRatio": 30,
    "maxAccel_radps2": 40, "encoderTicksPerRev": 360,
    "mass_kg": 0.9, "length_m": 0.18, "width_m": 0.16,
    "lineSensors": { "count": 5, "spacing_m": 0.012, "forwardOffset_m": 0.09, "footprint_m": 0.004 },
    "motor": { "stallTorque_Nm": 0.012, "nominalVoltage_V": 6, "efficiency": 0.6 },
    "battery": { "capacity_Wh": 11.1 }
  }
}
```

Derivados que el contenido usa como valores dorados: `omegaMax_radps = 6000·2π/60/30 = 20.944 rad/s`; `vMax_mps = 20.944·0.032 = 0.670 m/s`; giro en el lugar a `vL = −vR = 0.3 m/s`: `ω = 0.6/0.15 = 4 rad/s`; torque de rueda en bloqueo `0.012·30·0.6 = 0.216 N·m`; fuerza de tracción por rueda en bloqueo `0.216/0.032 = 6.75 N`; semiancho del arreglo de sensores `(5−1)/2·0.012 = 0.024 m`.

## 4. Brazo plano 2 GDL (catálogo `planar2dof`)

Dos articulaciones revolute sobre Z, `l1 = 0.20 m`, `l2 = 0.15 m`, límites `[−π, π]`, mallas cilíndricas generadas, origen del efector en el extremo de `l2`. Valores dorados en `PLAN.md` F1-08.

## 5. Versionado

`specVersion` entero. Cada cambio incompatible incrementa la versión y añade una función en `migrate.ts`. Los registros de `robots.spec` se migran al leer, nunca en masa.
