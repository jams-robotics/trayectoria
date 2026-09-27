// Separate `@trayectoria/widgets/dev` entry, parallel to `./scene3d` and for the same reason:
// to isolate from the barrel what must not reach production (docs/ARCHITECTURE.md §8). This holds
// the development API of the `/dev/widgets` playground, which is not public API of the package
// (docs/STANDARDS.md §4). The barrel `src/index.ts` must not re-export anything from here: `StoryGallery`
// loads the stories with `import()`, and its dependency table dragged the `three` chunk into the
// graph of every page that imports `@trayectoria/widgets` (#154).
export { StoryGallery, stories } from './StoryGallery';
export type { WidgetStory, WidgetStories, StoryGalleryProps } from './StoryGallery';
