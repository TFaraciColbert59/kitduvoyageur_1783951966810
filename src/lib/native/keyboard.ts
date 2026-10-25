import { isNative } from "./platform";

/**
 * Gestion du clavier virtuel mobile
 */
export async function hideNativeKeyboard(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Keyboard } = await import("@capacitor/keyboard");
    await Keyboard.hide();
  } catch {}
}

export async function onKeyboardStateChange(
  onShow?: (info: { keyboardHeight: number }) => void,
  onHide?: () => void
): Promise<() => void> {
  if (!isNative()) return () => {};

  try {
    const { Keyboard } = await import("@capacitor/keyboard");
    const showHandle = onShow ? await Keyboard.addListener("keyboardWillShow", onShow) : null;
    const hideHandle = onHide ? await Keyboard.addListener("keyboardWillHide", onHide) : null;

    return () => {
      showHandle?.remove();
      hideHandle?.remove();
    };
  } catch {
    return () => {};
  }
}
