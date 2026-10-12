import * as THREE from 'three';

// Valores compartidos por varios módulos de la escena.

// Color del polvo en suspensión: horizonte del cielo y niebla usan el mismo tono
export const DUST_COLOR = 0xd29a5e;

// Sol de tarde: bajo y a contraluz para sombras largas
export const SUN_DIRECTION = new THREE.Vector3(-0.25, 0.12, -1).normalize();

// Donde aparece el rover, mirando hacia el sol
export const ROVER_START = { x: 0, z: 20, heading: Math.PI };
