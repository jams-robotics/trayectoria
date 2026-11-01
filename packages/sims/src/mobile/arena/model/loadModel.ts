import { Group, LoadingManager, Mesh, MeshStandardMaterial } from 'three';
import type { Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

import type { ModelKind } from './modelFile';

// Parses an already validated file with the plain loaders only: no Draco, no Meshopt, no KTX2,
// so a GLB that needs a decoder fails. External resources a GLB may point to are never fetched.

const BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

function offline(): LoadingManager {
  const manager = new LoadingManager();
  manager.setURLModifier((url) =>
    url.startsWith('blob:') || url.startsWith('data:') ? url : BLANK_IMAGE,
  );
  return manager;
}

function parseGlb(bytes: ArrayBuffer): Promise<Object3D> {
  return new Promise((resolve, reject) => {
    new GLTFLoader(offline()).parse(bytes, '', (gltf) => resolve(gltf.scene), reject);
  });
}

/** An STL is only geometry: it gets one neutral material, tinted later. */
function parseStl(bytes: ArrayBuffer): Object3D {
  const geometry = new STLLoader().parse(bytes);
  // Many exporters write zero normals in the facets, which renders the model black.
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, new MeshStandardMaterial());
  const group = new Group();
  group.add(mesh);
  return group;
}

/** The model as a tree of meshes; rejects when the file cannot be parsed. */
export async function parseModel(kind: ModelKind, bytes: ArrayBuffer): Promise<Object3D> {
  const object = kind === 'glb' ? await parseGlb(bytes) : parseStl(bytes);
  let meshes = 0;
  object.traverse((child) => {
    if (child instanceof Mesh) meshes += 1;
  });
  if (meshes === 0) throw new Error('no meshes');
  return object;
}
