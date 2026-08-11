// src/components/mon-materiel/ImageGallery.tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface ImageGalleryProps {
  images: string[];
}

export default function ImageGallery({ images }: ImageGalleryProps) {
  const [current, setCurrent] = useState(0);
  const total = images.length;

  if (total === 0) return null;

  const prev = () => setCurrent((c) => (c - 1 + total) % total);
  const next = () => setCurrent((c) => (c + 1) % total);

  return (
    <section className="relative rounded-2xl overflow-hidden shadow-lg mt-6">
      <div className="relative aspect-w-16 aspect-h-9">
        <Image
          src={images[current] || '/assets/images/no_image.png'}
          alt={`Photo ${current + 1}`}
          fill
          className="object-cover transition-opacity duration-500"
          priority={true}
        />
      </div>
      {total > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/70 rounded-full p-1 hover:bg-white transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeftIcon className="h-5 w-5 text-[#132219]" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/70 rounded-full p-1 hover:bg-white transition-colors"
            aria-label="Next image"
          >
            <ChevronRightIcon className="h-5 w-5 text-[#132219]" />
          </button>
        </>
      )}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1">
        {images.map((_, i) => (
          <span
            key={i}
            className={`block h-1 w-4 rounded-full ${i === current ? 'bg-[#132219]' : 'bg-white/60'}`}
          />
        ))}
      </div>
    </section>
  );
}
