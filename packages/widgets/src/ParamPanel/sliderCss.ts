// Slider of docs/DESIGN.md §5: 4 px track in `border`, active segment in `primary`, 20 px thumb
// filled `bg-raised` with a 2 px `primary` ring and `shadow-sm`. The pseudo-elements of
// <input type="range"> cannot be reached from utility classes, so they live in one style block.
export const SLIDER_CSS = `
.trayectoria-slider { --fill: 0%; }
.trayectoria-slider::-webkit-slider-runnable-track {
  height: 4px; border-radius: 2px;
  background: linear-gradient(to right,
    var(--color-primary) var(--fill), var(--color-border) var(--fill));
}
.trayectoria-slider::-moz-range-track {
  height: 4px; border-radius: 2px; background: var(--color-border);
}
.trayectoria-slider::-moz-range-progress {
  height: 4px; border-radius: 2px; background: var(--color-primary);
}
.trayectoria-slider::-webkit-slider-thumb {
  appearance: none; width: 20px; height: 20px; margin-top: -8px;
  border-radius: 999px; border: 2px solid var(--color-primary);
  background: var(--color-bg-raised); box-shadow: var(--shadow-sm);
}
.trayectoria-slider::-moz-range-thumb {
  width: 16px; height: 16px; border-radius: 999px;
  border: 2px solid var(--color-primary);
  background: var(--color-bg-raised); box-shadow: var(--shadow-sm);
}
.trayectoria-slider:focus-visible { outline: none; }
.trayectoria-slider:focus-visible::-webkit-slider-thumb {
  outline: 2px solid var(--color-focus); outline-offset: 2px;
}
.trayectoria-slider:focus-visible::-moz-range-thumb {
  outline: 2px solid var(--color-focus); outline-offset: 2px;
}
`;
