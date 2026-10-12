import * as THREE from 'three';

// Crea una textura dibujando en un canvas cuadrado: draw(ctx, size)
export function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  return new THREE.CanvasTexture(canvas);
}
