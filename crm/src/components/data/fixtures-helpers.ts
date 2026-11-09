/** Clé stable des arguments d'une RPC, pour indexer les fixtures de design. */
export function argsKey(args: Record<string, unknown>): string {
  return Object.keys(args).sort().map((key) => `${key}=${String(args[key])}`).join('&');
}
