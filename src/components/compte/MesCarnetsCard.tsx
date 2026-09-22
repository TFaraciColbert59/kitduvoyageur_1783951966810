'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { Badge, Card } from '@/components/ui';
import { Carnet } from '@/lib/mock/compte-marceline';

interface MesCarnetsCardProps {
  carnets: Carnet[];
}

export default function MesCarnetsCard({ carnets }: MesCarnetsCardProps) {
  const router = useRouter();
  return (
    <Card className="p-6 space-y-6 my-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[color:var(--lkv-primary)]/5 pb-4">
        <div>
          <h3 className="font-display font-bold text-2xl text-[color:var(--lkv-primary)] tracking-tight">
            Mes <span className="font-serif italic font-normal">carnets</span> publiés
          </h3>
          <p className="text-xs font-mono text-[color:var(--lkv-text-muted)] mt-0.5">
            12 récits · 3 428 lectures
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/carnets" className="text-xs font-bold text-[color:var(--lkv-forest-600)] hover:text-[color:var(--lkv-primary)] transition-colors">
            Brouillons
          </Link>
          <Link
            href="/carnets/nouveau"
            className="inline-flex items-center justify-center gap-[var(--space-2)] min-h-[var(--lkv-touch-min)] rounded-full px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold backdrop-blur-[var(--btn-blur)] border border-transparent bg-[color:var(--btn-tint)] saturate-[var(--btn-saturate)] text-[color:var(--lkv-text-primary)] shadow-elevation-1 !py-2 !px-4 !min-h-[0] text-xs font-bold"
          >
            <Icon name="PlusIcon" size={14} />
            <span>+ Nouveau</span>
          </Link>
        </div>
      </div>

      <p className="text-xs text-[color:var(--lkv-forest-600)]/70 leading-relaxed">
        Vos publications visibles par la communauté. Un carnet peut aussi rester privé, en cours d'édition.
      </p>

      {/* Grid of 3 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {carnets.map((item) => (
          <div
            key={item.id}
            onClick={() => router.push(`/carnets/${item.id || encodeURIComponent(item.title)}`)}
            className="rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)] overflow-hidden transition-all flex flex-col justify-between cursor-pointer"
          >
            <div>
              {/* Card Image Header */}
              <div className="relative h-44 w-full overflow-hidden">
                <Image
                  src={item.image_url || '/assets/images/no_image.png'}
                  alt={item.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3">
                  {item.status === 'Publié' ? (
                    <Badge className="border-transparent bg-[color:var(--btn-tint)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)] backdrop-blur-[var(--btn-blur)]">
                      Publié
                    </Badge>
                  ) : (
                    <Badge tone="warn" className="backdrop-blur-md">
                      Brouillon
                    </Badge>
                  )}
                </div>
              </div>

              {/* Title Content */}
              <div className="p-4">
                <h4 className="font-bold text-base text-[color:var(--lkv-primary)] line-clamp-2 group-hover:text-[color:var(--lkv-forest-600)] transition-colors">
                  {item.title}
                </h4>
              </div>
            </div>

            {/* Footer Stats */}
            <div className="p-4 pt-0 border-t border-[color:var(--lkv-primary)]/5 mt-2 flex items-center justify-between text-xs font-mono font-bold text-[color:var(--lkv-forest-600)]/70">
              {item.status === 'Publié' ? (
                <div className="flex items-center gap-3 w-full justify-between pt-2">
                  <span className="flex items-center gap-1"><Icon name="HeartIcon" size={14} className="text-[color:var(--lkv-secondary)]" /> {item.likes}</span>
                  <span className="flex items-center gap-1"><Icon name="EyeIcon" size={14} className="text-[color:var(--lkv-text-muted)]" /> {item.views}</span>
                  <span className="flex items-center gap-1"><Icon name="ChatBubbleLeftIcon" size={14} className="text-[color:var(--lkv-info)]" /> {item.comments}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full pt-2 text-[color:var(--lkv-forest-600)]/60">
                  <span>{item.edit_status}</span>
                  <span>{item.draft_detail}</span>
                </div>
              )}
            </div>

          </div>
        ))}
      </div>

    </Card>
  );
}
