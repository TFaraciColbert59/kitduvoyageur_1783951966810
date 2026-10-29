type StoryMediaReference = {
  author_id?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  image_url?: string | null;
};

function isOwnedPath(path: string, author: string): boolean {
  // Reject ambiguous encodings before URL/Storage normalization can hide them.
  if (!author || /[/\\%\s]/.test(author) || /[\\%?#\u0000-\u0020\u007f]/.test(path)) return false;
  const parts = path.split('/');
  return (
    parts.length >= 2 &&
    parts[0] === author &&
    parts.every((part) => part !== '' && part !== '.' && part !== '..')
  );
}

/** Only author-owned objects in the two story buckets may reach service-role deletion. */
export function storyPurgeReference(
  row: StoryMediaReference,
  supabaseUrl: string
): { bucket: 'stories-private' | 'carnet-media'; path: string } | null {
  const author = row.author_id;
  if (!author) return null;
  if (row.storage_bucket || row.storage_path) {
    return row.storage_bucket === 'stories-private' &&
      row.storage_path &&
      isOwnedPath(row.storage_path, author)
      ? { bucket: 'stories-private', path: row.storage_path }
      : null;
  }
  try {
    const configured = new URL(supabaseUrl);
    if (
      !['https:', 'http:'].includes(configured.protocol) ||
      configured.username ||
      configured.password
    )
      return null;
    const prefix = `${configured.origin}/storage/v1/object/public/carnet-media/`;
    // Compare the raw prefix; parsing first would normalize traversal/backslashes.
    if (!row.image_url?.startsWith(prefix)) return null;
    const path = row.image_url.slice(prefix.length);
    return isOwnedPath(path, author) ? { bucket: 'carnet-media', path } : null;
  } catch {
    return null;
  }
}
