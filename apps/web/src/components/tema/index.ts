import AlRobot from './AlRobot.astro';
import Concepto from './Concepto.astro';
import Experimento from './Experimento.astro';
import Explora from './Explora.astro';
import Formula from './Formula.astro';
import Formulas from './Formulas.astro';
import Gancho from './Gancho.astro';
import Profundiza from './Profundiza.astro';
import Verifica from './Verifica.astro';

/**
 * Mapa de componentes que la página del tema pasa a `<Content components={temaComponents} />`
 * (#97, decisión 1): el MDX escribe `<Gancho>`, `<Concepto>`… y cada componente pinta su `h2`
 * con el título i18n y su ancla fija, sin que el contenido tenga que repetirlos.
 *
 * `Formula` también va aquí, y no se importa desde el MDX: `content/` vive fuera de `apps/web`
 * (ADR-0005) y no resuelve los paquetes del workspace.
 *
 * El mapa se tipa como `unknown`: el servicio de tipos de eslint no resuelve un `.astro`
 * importado desde un `.ts` (sí lo hace `astro check`, que corre en `pnpm typecheck`), y MDX solo
 * necesita el valor. La forma de cada componente la valida `astro check` en el `.astro` que lo usa.
 */
export const temaComponents: Readonly<Record<string, unknown>> = {
  Gancho,
  Concepto,
  Formulas,
  Formula,
  Explora,
  Experimento,
  AlRobot,
  Verifica,
  Profundiza,
};

/** Nombre del componente de cada sección obligatoria, en el orden de CONTENT-STANDARDS §2. */
export const SECTION_COMPONENTS = [
  'Gancho',
  'Concepto',
  'Formulas',
  'Explora',
  'AlRobot',
  'Verifica',
  'Profundiza',
] as const;
