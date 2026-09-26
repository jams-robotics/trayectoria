import AlRobot from './AlRobot.astro';
import Concepto from './Concepto.astro';
import Experimento from './Experimento.astro';
import Explora from './Explora.astro';
import Formula from './Formula.astro';
import Formulas from './Formulas.astro';
import Gancho from './Gancho.astro';
import Profundiza from './Profundiza.astro';
import RobotFormula from './RobotFormula.astro';
import Verifica from './Verifica.astro';
import { catalogWidgetComponents } from './catalogWidgets';

/**
 * Component map the topic page passes to `<Content components={temaComponents} />`
 * (#97, decision 1): the MDX writes `<Gancho>`, `<Concepto>`… and each component paints its `h2`
 * with the i18n title and its fixed anchor, without the content having to repeat them.
 *
 * `Formula` also goes here, and is not imported from the MDX: `content/` lives outside `apps/web`
 * (ADR-0005) and does not resolve the workspace packages.
 *
 * F6-01 (#243): the topic widgets of the catalog enter under their own names through the one-line
 * wrappers of `catalog/` over `CatalogWidget` (`catalogWidgets.ts`), and `RobotFormula` renders
 * an «Al robot» calc with «Mi robot».
 *
 * The map is typed as `unknown`: eslint's type service does not resolve a `.astro`
 * imported from a `.ts` (`astro check` does, and it runs in `pnpm typecheck`), and MDX only
 * needs the value. The shape of each component is validated by `astro check` in the `.astro` that uses it.
 */
export const temaComponents: Readonly<Record<string, unknown>> = {
  Gancho,
  Concepto,
  Formulas,
  Formula,
  Explora,
  Experimento,
  AlRobot,
  RobotFormula,
  Verifica,
  Profundiza,
  ...catalogWidgetComponents,
};

/** Component name of each mandatory section, in the order of CONTENT-STANDARDS §2. */
export const SECTION_COMPONENTS = [
  'Gancho',
  'Concepto',
  'Formulas',
  'Explora',
  'AlRobot',
  'Verifica',
  'Profundiza',
] as const;
