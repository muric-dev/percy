// Estado del teclado, por código físico de tecla (funciona igual en cualquier distribución).
const pressed = new Set();
addEventListener('keydown', (e) => pressed.add(e.code));
addEventListener('keyup', (e) => pressed.delete(e.code));
addEventListener('blur', () => pressed.clear());

const anyPressed = (codes) => codes.some((code) => pressed.has(code));

// -1, 0 o 1 según qué grupo de teclas esté pulsado
export const axis = (positive, negative) => (anyPressed(positive) ? 1 : 0) - (anyPressed(negative) ? 1 : 0);
