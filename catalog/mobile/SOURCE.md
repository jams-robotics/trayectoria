# Origen de los robots móviles de referencia

Los tres `RobotSpec` de este directorio los ha elegido el proyecto a partir de los órdenes de
magnitud de cada clase de robot. No copian la hoja de características de ningún producto ni
reproducen datos de terceros: son valores redondos, coherentes entre sí y verificables con el
modelo de `sim-core`.

- `pequeno-competitivo.json` — clase de seguidor de línea de competición: chasis corto, ruedas
  pequeñas, motores de muchas revoluciones con reducción baja y un arreglo denso de sensores.
- `educativo-estandar.json` — clase de kit educativo de sobremesa; es el robot de referencia de
  `docs/ROBOT-SPEC.md` §3, con el que están calculados los valores dorados del contenido.
- `grande-lento.json` — clase de plataforma rodante de interior: chasis ancho y pesado, ruedas
  grandes y reducción alta, pensada para moverse despacio y con margen de par.
