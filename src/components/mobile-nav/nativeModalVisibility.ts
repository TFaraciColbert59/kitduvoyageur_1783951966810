/** An active modal must not compete with the native bottom bar.
 * Independently-owned components can hide it without incorrectly restoring
 * the bar while another modal remains visible. Pure and unit-testable.
 */
export function updateNativeBarHideSources(
  current: ReadonlySet<string>, source: string, hidden: boolean,
): Set<string> {
  const next = new Set(current);
  if (hidden) next.add(source);
  else next.delete(source);
  return next;
}
