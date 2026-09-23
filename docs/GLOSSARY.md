# Glosario y notación

Única fuente de símbolos, unidades y nombres de código. Todo tema, widget y módulo de `sim-core` usa exactamente estos. Añadir un símbolo es un ticket de docs aprobado por el humano.

Convenciones de marcos: marco global `{G}` con X a la derecha, Y hacia arriba (2D) o Z hacia arriba (3D). Marco del robot `{R}` con X hacia adelante, Y hacia la izquierda. Ángulos en radianes, antihorario positivo. `g = 9.81 m/s²`.

## Magnitudes generales

| Símbolo | Nombre | Unidad | Código |
|---|---|---|---|
| t | tiempo | s | `t_s` |
| Δt | intervalo de tiempo; en simulación, el paso | s | `dt_s` |
| x, y, z | posición | m | `x_m`, `y_m`, `z_m` |
| x₀ | posición inicial | m | `x0_m` |
| Δx | desplazamiento en un intervalo (x final − x inicial) | m | `dx_m` |
| h | altura inicial | m | `h_m` |
| s | distancia recorrida (arco) | m | `s_m` |
| v | rapidez / velocidad lineal | m/s | `v_mps` |
| v₀ | velocidad inicial | m/s | `v0_mps` |
| v₁, v₂ | velocidad en dos instantes dados | m/s | `v1_mps`, `v2_mps` |
| v̄ | velocidad media (Δx / Δt) | m/s | `vAvg_mps` |
| vₓ, v_y | componentes de velocidad | m/s | `vx_mps`, `vy_mps` |
| a | aceleración | m/s² | `a_mps2` |
| g | aceleración gravitatoria | m/s² | `G_MPS2` (constante) |
| α (en tiro) | ángulo de lanzamiento | rad | `launchAngle_rad` |
| m | masa | kg | `mass_kg` |
| F | fuerza | N | `force_N` |
| N | fuerza normal | N | `normal_N` |
| f | fuerza de fricción | N | `friction_N` |
| μₛ, μₖ | coeficientes de fricción estática y cinética | — | `mu_s`, `mu_k` |
| φ | ángulo de pendiente | rad | `slope_rad` |
| τ | torque | N·m | `torque_Nm` |
| W | trabajo | J | `work_J` |
| Eₖ, Eₚ, E | energía cinética, potencial, mecánica | J | `kineticEnergy_J`, `potentialEnergy_J`, `mechanicalEnergy_J` |
| P | potencia | W | `power_W` |
| η | eficiencia | — | `efficiency` |
| V, I | voltaje, corriente | V, A | `voltage_V`, `current_A` |
| C | capacidad de batería | Wh | `batteryCapacity_Wh` |
| [q] | unidad de la magnitud q, en análisis dimensional (`[v] = m/s`) | — | — (solo notación) |

## Vectores

| Símbolo | Nombre | Unidad | Código |
|---|---|---|---|
| v⃗ | velocidad como vector, con magnitud \|v⃗\| = v y componentes vₓ, v_y | m/s | `[vx_mps, vy_mps]` |
| a⃗, b⃗ (en vectores) | vector genérico, con componentes a_x, a_y, b_x, b_y y magnitud \|a⃗\|, \|b⃗\| | la de la magnitud que representa | `a: [number, number]`, `b: [number, number]` |
| (a, b) (en enunciados de vectores) | vector dado por sus componentes x e y | la de la magnitud que representa | `[number, number]` |
| a⃗ · b⃗ | producto escalar (a_x·b_x + a_y·b_y) | producto de las unidades de a⃗ y b⃗ | `dot` |
| φ (entre vectores) | ángulo entre dos vectores | rad | `angleBetween_rad` |

## Razón de cambio

| Símbolo | Nombre | Unidad | Código |
|---|---|---|---|
| d/dt | derivada respecto al tiempo (`v = dx/dt`, `a = dv/dt`) | la de la magnitud derivada entre s | — (solo notación) |
| c (en derivadas) | coeficiente constante de c·tⁿ | la que da a c·tⁿ la unidad de la magnitud; en x = c·t², m/s² | `coefC_mps2` |
| n (en derivadas) | exponente de t en c·tⁿ | — | `exponent` |
| a, b (en polinomios de posición) | coeficientes de x(t) = a·t + b·t² | m/s, m/s² | `coefA_mps`, `coefB_mps2` |

## Rotación

| Símbolo | Nombre | Unidad | Código |
|---|---|---|---|
| θ | ángulo / orientación (heading) | rad | `theta_rad` |
| ω | velocidad angular | rad/s | `omega_radps` |
| ω_motor | velocidad angular del eje del motor | rad/s | `omegaMotor_radps` |
| ω_rueda | velocidad angular de la rueda (ω_motor / i) | rad/s | `omegaWheel_radps` |
| ω_max | velocidad angular máxima de la rueda (ω_motor sin carga / i) | rad/s | `omegaMax_radps` |
| α | aceleración angular | rad/s² | `alpha_radps2` |
| n | velocidad de giro | rpm | `speed_rpm` (solo entrada de usuario) |
| T | período | s | `period_s` |
| f | frecuencia | Hz | `frequency_Hz` |
| r | radio de rueda | m | `wheelRadius_m` |
| a_c | aceleración centrípeta | m/s² | `centripetalAccel_mps2` |
| i | relación de reducción (n_motor / n_salida) | — | `gearRatio` |
| z | número de dientes | — | `teeth` |
| N_e | ticks del encoder por revolución | — | `encoderTicksPerRev` |

## Robot diferencial

| Símbolo | Nombre | Unidad | Código |
|---|---|---|---|
| (x, y, θ) | pose del robot en {G} | m, m, rad | `pose: { x_m, y_m, theta_rad }` |
| L | distancia entre ruedas (wheelbase lateral) | m | `wheelBase_m` |
| ω_L, ω_R | velocidad angular de rueda izquierda y derecha | rad/s | `omegaL_radps`, `omegaR_radps` |
| v_L, v_R | velocidad lineal de rueda | m/s | `vL_mps`, `vR_mps` |
| v, ω | velocidad lineal y angular del robot | m/s, rad/s | `v_mps`, `omega_radps` |
| v_max | velocidad lineal máxima del robot (ω_max · r) | m/s | `vMax_mps` |
| R | radio de giro | m | `turnRadius_m` |
| CIR | centro instantáneo de rotación | m | `icr: { x_m, y_m }` |
| N | número de sensores de línea | — | `lineSensors.count` |
| d | distancia del arreglo de sensores al eje de ruedas | m | `lineSensors.forwardOffset_m` |
| e_s | separación entre sensores | m | `lineSensors.spacing_m` |
| p | posición de la línea bajo el arreglo, en [−1, 1] | — | `linePosition` |
| e | error del controlador | — | `error` |
| K_p, K_i, K_d | ganancias PID | — | `Kp`, `Ki`, `Kd` |
| u | acción de control | rad/s | `u_radps` |
| ω_base | velocidad base de las ruedas | rad/s | `omegaBase_radps` |

## Brazo serial

| Símbolo | Nombre | Unidad | Código |
|---|---|---|---|
| q | vector de articulaciones | rad o m | `q: number[]` |
| qᵢ | articulación i | rad / m | `q[i]` |
| l₁, l₂ | longitudes de eslabón | m | `linkLength_m` |
| ᴬT_B | transformación homogénea de {B} expresada en {A} | — | `T_A_B: Mat4` |
| R | matriz de rotación | — | `R: Mat3` |
| p | posición del efector final | m | `endEffector.position_m` |
| (roll, pitch, yaw) | orientación RPY, convención URDF | rad | `rpy_rad: [roll, pitch, yaw]` |
| J | jacobiano | — | `jacobian` |
| GDL | grados de libertad | — | `dof` |

## Términos

| Término | Definición usada en la plataforma |
|---|---|
| Robot diferencial | Dos ruedas motrices independientes en un mismo eje, más apoyos pasivos. |
| Sin deslizamiento | La rueda no patina: el punto de contacto tiene velocidad cero respecto al suelo, de modo que `v = ω·r`. |
| Cinemática directa | De las velocidades de las ruedas (o los ángulos de articulación) al movimiento del robot (o la pose del efector). |
| Cinemática inversa | De la velocidad deseada del robot (o la pose del efector) a las velocidades de rueda (o articulaciones). |
| Odometría | Estimación de la pose integrando las lecturas de los encoders. |
| Restricción no holonómica | Restricción sobre velocidades que no se puede integrar a una restricción de posición; el robot no puede moverse lateralmente. |
| Eslabón (link) | Cuerpo rígido de la cadena. |
| Articulación (joint) | Unión entre dos eslabones con 1 GDL: revolute, continuous, prismatic; fixed tiene 0. |
| Efector final | El último eslabón de la cadena, donde va la herramienta. |
| Espacio de trabajo | Conjunto de posiciones alcanzables por el efector. |
| Motorreductor | Motor con caja de engranajes integrada, de relación `i`. |
| Encoder | Sensor que cuenta fracciones de vuelta del eje. |
