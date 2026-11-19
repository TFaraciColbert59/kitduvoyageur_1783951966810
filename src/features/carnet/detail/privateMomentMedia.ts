export const PRIVATE_MOMENT_BUCKET = 'hub-carnet-media';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PATTERN = new RegExp(`^/api/carnets/(${UUID})/media/(${UUID})/(${UUID}\\.(?:jpg|png|mp4|mov|webm|m4a|ogg))$`, 'i');

export function privateMomentMediaPath(reference: unknown, carnetId?: string): string | null {
  if (typeof reference !== 'string') return null;
  const match = reference.match(PATTERN);
  if (!match || (carnetId && match[1] !== carnetId)) return null;
  return `${match[2]}/carnet-moments/${match[1]}/${match[3]}`;
}

export function privateMomentMediaRef(carnetId: string, owner: string, file: string) {
  return `/api/carnets/${carnetId}/media/${owner}/${file}`;
}
