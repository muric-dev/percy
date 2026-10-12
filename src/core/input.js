// Keyboard state, by physical key code (works the same on any keyboard layout).
const pressed = new Set();
addEventListener('keydown', (e) => pressed.add(e.code));
addEventListener('keyup', (e) => pressed.delete(e.code));
addEventListener('blur', () => pressed.clear());

const anyPressed = (codes) => codes.some((code) => pressed.has(code));

// -1, 0 or 1 depending on which group of keys is pressed
export const axis = (positive, negative) => (anyPressed(positive) ? 1 : 0) - (anyPressed(negative) ? 1 : 0);

// Calls fn once per key press (ignores the auto-repeat of a held key)
export function onPress(code, fn) {
  addEventListener('keydown', (e) => e.code === code && !e.repeat && fn());
}
