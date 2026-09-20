// Entrada aparte `@trayectoria/widgets/dev`, en paralelo a `./scene3d` y por el mismo motivo:
// aislar del barrel lo que no debe llegar a producción (docs/ARCHITECTURE.md §8). Aquí vive la
// API de desarrollo del playground `/dev/widgets`, que no es API pública del paquete
// (docs/STANDARDS.md §4). El barrel `src/index.ts` no debe reexportar nada de aquí: `StoryGallery`
// carga las stories con `import()`, y su tabla de dependencias arrastraba el chunk de `three` al
// grafo de toda página que importa `@trayectoria/widgets` (#154).
export { StoryGallery, stories } from './StoryGallery';
export type { WidgetStory, WidgetStories, StoryGalleryProps } from './StoryGallery';
