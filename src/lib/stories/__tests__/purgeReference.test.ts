import { describe, expect, it } from 'vitest';
import { storyPurgeReference } from '../purgeReference';

const origin = 'https://project.supabase.co';
const privateRow = {
  author_id: 'author',
  storage_bucket: 'stories-private',
  storage_path: 'author/upload-random/file.jpg',
};

describe('storyPurgeReference', () => {
  it('accepts uploader paths independently of the story row id', () => {
    expect(storyPurgeReference(privateRow, origin)).toEqual({
      bucket: 'stories-private',
      path: privateRow.storage_path,
    });
  });
  it.each([
    'other/upload/file.jpg',
    'author-other/upload/file.jpg',
    'author/../other/file',
    'author/%2e%2e/file',
    'author/upload%2ffile',
    'author/upload%5cfile',
    'author\\upload/file',
    '/author/upload/file',
    'author//file',
    'author/upload/file?x',
    'author/upload/file#x',
  ])('rejects unbound or ambiguous private path %s', (path) => {
    expect(storyPurgeReference({ ...privateRow, storage_path: path }, origin)).toBeNull();
  });
  it('rejects other buckets and does not fall back from invalid private metadata', () => {
    expect(
      storyPurgeReference(
        {
          ...privateRow,
          storage_bucket: 'user-documents',
          image_url: `${origin}/storage/v1/object/public/carnet-media/author/legacy.jpg`,
        },
        origin
      )
    ).toBeNull();
  });
  it('accepts only configured origin and exact public legacy prefix', () => {
    expect(
      storyPurgeReference(
        {
          author_id: 'author',
          image_url: `${origin}/storage/v1/object/public/carnet-media/author/legacy.jpg`,
        },
        origin
      )
    ).toEqual({ bucket: 'carnet-media', path: 'author/legacy.jpg' });
  });
  it.each([
    'https://evil.test/storage/v1/object/public/carnet-media/author/file.jpg',
    `${origin}.evil.test/storage/v1/object/public/carnet-media/author/file.jpg`,
    `${origin}/anything/carnet-media/author/file.jpg`,
    `${origin}/storage/v1/object/public/carnet-media/other/file.jpg`,
    `${origin}/storage/v1/object/public/carnet-media/author/../other/file.jpg`,
    `${origin}/storage/v1/object/public/carnet-media/author/%252fother.jpg`,
    `${origin}/storage/v1/object/public/carnet-media/author/file.jpg?download=1`,
  ])('rejects spoofed legacy URLs %s', (image_url) => {
    expect(storyPurgeReference({ author_id: 'author', image_url }, origin)).toBeNull();
  });
});
