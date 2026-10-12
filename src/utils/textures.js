import * as THREE from 'three';

// Creates a texture by drawing on a square canvas: draw(ctx, size)
export function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  return new THREE.CanvasTexture(canvas);
}
