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
| h | altura inicial; en `E_p = mgh`, altura sobre el nivel de referencia | m | `h_m` |
| s | distancia recorrida (arco) | m | `s_m` |
| D (en enunciados) | distancia dada (longitud de pista o separación inicial) | m | `distance_m` |
| v | rapidez / velocidad lineal | m/s | `v_mps` |
| v₀ | velocidad inicial | m/s | `v0_mps` |
| v₁, v₂ | velocidad en dos instantes dados | m/s | `v1_mps`, `v2_mps` |
| v_A, v_B | velocidades de dos móviles A y B | m/s | `vA_mps`, `vB_mps` |
| v̄ | velocidad media (Δx / Δt) | m/s | `vAvg_mps` |
| vₓ, v_y | componentes de velocidad | m/s | `vx_mps`, `vy_mps` |
| a | aceleración | m/s² | `a_mps2` |
| g | aceleración gravitatoria | m/s² | `G_MPS2` (constante) |
| t_caída | tiempo de caída | s | `fallTime_s` |
| v_impacto | rapidez de impacto | m/s | `impactSpeed_mps` |
| α (en tiro) | ángulo de lanzamiento | rad | `launchAngle_rad` |
| t_v | tiempo de vuelo | s | `flightTime_s` |
| R (en tiro) | alcance horizontal | m | `range_m` |
| H (en tiro) | altura máxima | m | `apexHeight_m` |
| m | masa | kg | `mass_kg` |
| F | fuerza | N | `force_N` |
| F_∥ | componente del peso a lo largo de la rampa (mg·sinφ) | N | `weightAlong_N` |
| F_rueda | fuerza de tracción de una rueda | N | `wheelForce_N` |
| N | fuerza normal | N | `normal_N` |
| f | fuerza de fricción | N | `friction_N` |
| f_max | fricción estática máxima (μₛ·N) | N | `maxFriction_N` |
| a_max | aceleración máxima sin patinar | m/s² | `maxAccel_mps2` |
| β | fracción del peso sobre las ruedas motrices | — | `drivenWeightFraction` |
| d_frenado | distancia de frenado deslizando | m | `brakingDistance_m` |
| μₛ, μₖ | coeficientes de fricción estática y cinética | — | `mu_s`, `mu_k` |
| φ | ángulo de pendiente | rad | `slope_rad` |
| φ_max | pendiente máxima sin deslizar (tanφ_max = μₛ) | rad | `maxSlope_rad` |
| τ | torque | N·m | `torque_Nm` |
| τ_motor, τ_rueda | torque en el eje del motor y en la rueda | N·m | `motorTorque_Nm`, `wheelTorque_Nm` |
| ℓ (en brazo) | brazo de palanca | m | `leverArm_m` |
| W | trabajo | J | `work_J` |
| W_neto | trabajo neto (suma del trabajo de todas las fuerzas) | J | `netWork_J` |
| d (en trabajo) | distancia recorrida por el punto de aplicación de la fuerza | m | `workDistance_m` |
| θ (en trabajo) | ángulo entre F⃗ y el desplazamiento | rad | `forceAngle_rad` |
| Eₖ, Eₚ, E | energía cinética, potencial, mecánica | J | `kineticEnergy_J`, `potentialEnergy_J`, `mechanicalEnergy_J` |
| h_max | altura máxima que alcanza por inercia (v² / 2g) | m | `maxHeight_m` |
| P | potencia | W | `power_W` |
| P_el, P_mec | potencia eléctrica y mecánica | W | `electricalPower_W`, `mechanicalPower_W` |
| η | eficiencia | — | `efficiency` |
| V, I | voltaje, corriente | V, A | `voltage_V`, `current_A` |
| C | capacidad de batería | Wh | `batteryCapacity_Wh` |
| t_autonomía | autonomía (C / P_el) | h | `autonomy_h` |
| [q] | unidad de la magnitud q, en análisis dimensional (`[v] = m/s`) | — | — (solo notación) |

## Vectores

| Símbolo | Nombre | Unidad | Código |
|---|---|---|---|
| v⃗ | velocidad como vector, con magnitud \|v⃗\| = v y componentes vₓ, v_y | m/s | `[vx_mps, vy_mps]` |
| F⃗, a⃗ (en dinámica) | fuerza y aceleración como vectores | N, m/s² | `[fx_N, fy_N]`, `[ax_mps2, ay_mps2]` |
| a⃗, b⃗ (en vectores) | vector genérico, con componentes a_x, a_y, b_x, b_y y magnitud \|a⃗\|, \|b⃗\| | la de la magnitud que representa | `a: [number, number]`, `b: [number, number]` |
| (a, b) (en enunciados de vectores) | vector dado por sus componentes x e y | la de la magnitud que representa | `[number, number]` |
| a⃗ · b⃗ | producto escalar (a_x·b_x + a_y·b_y) | producto de las unidades de a⃗ y b⃗ | `dot` |
| φ (entre vectores) | ángulo entre dos vectores | rad | `angleBetween_rad` |

## Razón de cambio

| Símbolo | Nombre | Unidad | Código |
|---|---|---|---|
| d/dt | derivada respecto al tiempo (`v = dx/dt`, `a = dv/dt`) | la de la magnitud derivada entre s | — (solo notación) |
| ẋ, ẏ, θ̇ | derivada respecto al tiempo en notación de punto (`ẋ = dx/dt`) | la de la magnitud derivada entre s | — (solo notación) |
| c (en derivadas) | coeficiente constante de c·tⁿ | la que da a c·tⁿ la unidad de la magnitud; en x = c·t², m/s² | `coefC_mps2` |
| n (en derivadas) | exponente de t en c·tⁿ | — | `exponent` |
| a, b (en polinomios de posición) | coeficientes de x(t) = a·t + b·t² | m/s, m/s² | `coefA_mps`, `coefB_mps2` |

## Rotación

| Símbolo | Nombre | Unidad | Código |
|---|---|---|---|
| θ | ángulo / orientación (heading) | rad | `theta_rad` |
| θ₀ | ángulo inicial | rad | `theta0_rad` |
| ω | velocidad angular | rad/s | `omega_radps` |
| ω_motor | velocidad angular del eje del motor | rad/s | `omegaMotor_radps` |
| ω_rueda | velocidad angular de la rueda (ω_motor / i) | rad/s | `omegaWheel_radps` |
| ω_max | velocidad angular máxima de la rueda (ω_motor sin carga / i) | rad/s | `omegaMax_radps` |
| ω₀ | velocidad angular inicial | rad/s | `omega0_radps` |
| Δω | cambio de velocidad angular en un intervalo | rad/s | `dOmega_radps` |
| α | aceleración angular | rad/s² | `alpha_radps2` |
| a_t | aceleración tangencial (α·r) | m/s² | `tangentialAccel_mps2` |
| n | velocidad de giro | rpm | `speed_rpm` (solo entrada de usuario) |
| n_motor, n_rueda | velocidad de giro del motor y de la rueda | rpm | `motorSpeed_rpm`, `wheelSpeed_rpm` |
| T | período | s | `period_s` |
| f | frecuencia | Hz | `frequency_Hz` |
| r | radio de rueda | m | `wheelRadius_m` |
| a_c | aceleración centrípeta | m/s² | `centripetalAccel_mps2` |
| i | relación de reducción (n_motor / n_salida) | — | `gearRatio` |
| z | número de dientes | — | `teeth` |
| subíndices 1, 2 (en transmisión) | eje de entrada y de salida de un par (z₁, z₂, n₁, n₂, ω₁, ω₂, τ₁, τ₂, P₁, P₂); z₃, z₄, los de la segunda etapa | la de la magnitud | `z1`…`z4`; entrada `nIn_rpm`, `torqueIn_Nm` |
| i₁, i₂ | relación de cada etapa de un tren | — | `stageRatio` |
| i_total | relación del tren (i₁·i₂) | — | `totalRatio` |
| N_e | ticks del encoder por revolución | — | `encoderTicksPerRev` |
| ticks | cuenta del encoder | — | `ticks` |
| Δticks | ticks contados en un intervalo | — | `deltaTicks` |
| res | resolución lineal del encoder (2πr / N_e) | m | `encoderResolution_m` |

## Robot diferencial

| Símbolo | Nombre | Unidad | Código |
|---|---|---|---|
| (x, y, θ) | pose del robot en {G} | m, m, rad | `pose: { x_m, y_m, theta_rad }` |
| R(θ) (en marcos) | matriz de rotación 2D | — | `rotationMatrix` |
| p⃗_G, p⃗_R (en marcos) | un punto expresado en {G} y en {R}; el subíndice nombra el marco, no la rueda | m | `point_m` |
| p⃗_{R,0} | origen de {R} en {G}: el (x, y) de la pose | m | `[x_m, y_m]` |
| θ_objetivo | rumbo hacia un objetivo | rad | `targetHeading_rad` |
| (x_o, y_o) | punto objetivo | m | `target_m` |
| Δs_L, Δs_R | arco recorrido por cada rueda en un paso de odometría | m | `deltaSL_m`, `deltaSR_m` |
| Δs | avance del robot en un paso de odometría | m | `deltaS_m` |
| Δθ | giro del robot en un paso de odometría | rad | `deltaTheta_rad` |
| L | distancia entre ruedas (wheelbase lateral) | m | `wheelBase_m` |
| ω_L, ω_R | velocidad angular de rueda izquierda y derecha | rad/s | `omegaL_radps`, `omegaR_radps` |
| v_L, v_R | velocidad lineal de rueda | m/s | `vL_mps`, `vR_mps` |
| v, ω | velocidad lineal y angular del robot | m/s, rad/s | `v_mps`, `omega_radps` |
| v_max | velocidad lineal máxima del robot (ω_max · r) | m/s | `vMax_mps` |
| v_max,curva | rapidez máxima en curva sin patinar (√(μₛ·g·R)) | m/s | `maxCurveSpeed_mps` |
| R | radio de giro | m | `turnRadius_m` |
| CIR | centro instantáneo de rotación | m | `icr: { x_m, y_m }` |
| N | número de sensores de línea | — | `lineSensors.count` |
| d | distancia del arreglo de sensores al eje de ruedas | m | `lineSensors.forwardOffset_m` |
| e_s | separación entre sensores | m | `lineSensors.spacing_m` |
| p | posición de la línea bajo el arreglo, en [−1, 1] | — | `linePosition` |
| e | error del controlador | — | `error` |
| K_p, K_i, K_d | ganancias PID (con `u` en rad/s y `e` adimensional) | rad/s, rad/s², rad | `kp`, `ki`, `kd` |
| u | acción de control | rad/s | `u_radps` |
| ω_base | velocidad base de las ruedas | rad/s | `omegaBase_radps` |

## Seguidor de línea

Símbolos del Módulo 6 (#396). Los que chocan con otro símbolo llevan calificador, como `α (en tiro)`.

| Símbolo | Nombre | Unidad | Código |
|---|---|---|---|
| k (en sensores) | índice del sensor, 0 el de la izquierda | — | `k` |
| v_k (en sensores) | lectura normalizada del sensor k, en [0, 1] | — | `values[k]` |
| k̄ | índice ponderado de la línea | — | `weightedIndex` |
| b_k | lectura binaria del sensor k | — | `binary[k]` |
| u (en umbral) | umbral de la lectura binaria | — | `threshold` |
| y_línea | desplazamiento lateral de la línea, positivo a la derecha (mismo signo que p) | m | `lineOffset_m` |
| σ (en sensores) | desviación estándar del ruido de lectura | — | `noiseSigma` |
| u_0 | amplitud del control on/off | rad/s | `delta_radps` |
| \|e\|_max | error máximo considerado | — | `maxError` |
| k (en PID) | paso de muestreo; e_k, e_{k−1} y u_k son e y u en el paso k y en el anterior | — | `k` |
| P, I, D (en PID) | términos proporcional, integral y derivativo de u | rad/s | `pidTerms` |
| I_max | límite de la integral del error, \|Σ e_j·Δt\| ≤ I_max (anti-windup) | s | `iMax` |
| v_ext, v_int | velocidad de la rueda exterior e interior en curva | m/s | `vOuter_mps`, `vInner_mps` |
| Δθ | error de rumbo | rad | `headingError_rad` |
| y_sensor | desplazamiento lateral de la línea en el arreglo | m | `sensorOffset_m` |
| y_perdida | desplazamiento al que se pierde la línea | m | `lossOffset_m` |
| w | ancho de la línea (el de la pista) | m | `lineWidth_m` |
| Δs_ciclo | avance por ciclo de control | m | `stepDistance_m` |
| Δt_c | período del lazo de control | s | `controlPeriod_s` |
| v_pred | velocidad predicha, ω_base·r | m/s | `predictedSpeed_mps` |
| t_pred | tiempo de vuelta predicho | s | `predictedLapTime_s` |
| v_med | velocidad media medida (la «Velocidad media» del widget) | m/s | `measuredSpeed_mps` |
| t_vuelta | tiempo de vuelta medido | s | `lapTime_s` |
| Δ% | diferencia relativa entre v_pred y v_med | % | `speedDiff_pct` |

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
