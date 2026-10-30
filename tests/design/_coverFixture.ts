/** Média de couverture déjà téléversé : les clubs et les carnets exigent une image. */
export const COVER = [
  {
    id: 'cover-1',
    name: 'couverture.jpg',
    type: 'image/jpeg',
    size: 1200,
    previewUrl: 'blob:preview',
    url: 'https://exemple.test/couverture.jpg',
    alt: '',
    cover: true,
    status: 'uploaded' as const,
    progress: 100,
    storageBucket: '',
    storagePath: '',
  },
];
