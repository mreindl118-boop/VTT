// One table of keyboard shortcuts. The keydown handlers in main.ts and viewSlider.ts read it, and tips show a key
// chip from it (only once a key has been pressed in the session, so touch-only tables never see key hints).

export const KEYMAP = {
  search: { key: '/', label: 'Go to area' },
  rotateLeft: { key: 'r', label: 'Rotate left' },
  rotateRight: { key: 'R', label: 'Rotate right' },
  findParty: { key: 'f', label: 'Find the party' },
  nextTurn: { key: 'n', label: 'Next turn' },
  sliderDown: { key: '[', label: 'Slide toward Players' },
  sliderUp: { key: ']', label: 'Slide toward DM' },
  peek: { key: '\\', label: 'Hold to peek' },
  escape: { key: 'Escape', label: 'Close or stop' },
} as const;

export type KeyAction = keyof typeof KEYMAP;

/** Does this key event press the shortcut for `action`? */
export const isKey = (e: KeyboardEvent, action: KeyAction): boolean => e.key === KEYMAP[action].key;

/** The text of a key chip ('Esc' for Escape). */
export const keyText = (action: KeyAction): string => (KEYMAP[action].key === 'Escape' ? 'Esc' : KEYMAP[action].key);

let seen = false;
/** True once any key has been pressed in this session. */
export const keysSeen = (): boolean => seen;
if (typeof addEventListener === 'function') addEventListener('keydown', () => { seen = true; }, { capture: true, passive: true });
