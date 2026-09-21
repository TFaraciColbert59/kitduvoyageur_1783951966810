import React from 'react';
import Link from 'next/link';
import type { CarnetRandonnee } from '@/lib/mock/carnet-chartreuse';
import { Button, Card, ListItem } from '@/components/ui';

interface RandonneesSouvenirCardProps {
  randonnees: CarnetRandonnee[];
}

function handleDownloadGPX(title: string) {
  const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1"><metadata><name>${title}</name></metadata><trk><name>${title}</name><trkseg></trkseg></trk></gpx>`;
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.gpx`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RandonneesSouvenirCard({ randonnees }: RandonneesSouvenirCardProps) {
  return (
    <Card className="p-[var(--space-6)] transition-transform duration-150 active:scale-[0.99] md:p-[var(--space-8)]">
      <div className="mb-[var(--space-2)] flex items-start justify-between">
        <h3 className="font-display text-[length:var(--lkv-text-subheadline)] text-[color:var(--lkv-text-primary)]">
          Randonnées <em className="font-serif italic">parcourues</em>
        </h3>
        <Link href="/carnets" className="whitespace-nowrap text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] hover:underline">Tout →</Link>
      </div>
      <p className="mb-[var(--space-6)] font-sans text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)]/60">Trois traces enregistrées, trois exportables au format GPX pour la fois prochaine.</p>
      <div className="space-y-[var(--space-2)]">
        {randonnees.map(r => (
          <ListItem
            key={r.id}
            as="div"
            className="group/rando -mx-[var(--space-3)] hover:bg-[color:var(--lkv-hover-surface)]"
            leading={
              <span className="flex h-8 w-8 items-center justify-center rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-forest-600)]/10" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--lkv-forest-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </span>
            }
            title={<span className="text-[length:var(--lkv-text-caption)] font-semibold">{r.title}</span>}
            subtitle={<span className="font-mono text-[length:var(--lkv-text-caption-2)]">{r.stats}</span>}
            trailing={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleDownloadGPX(r.title)}
                className="shrink-0 font-mono uppercase tracking-widest"
                aria-label={`Télécharger le GPX de ${r.title}`}
              >
                GPX ↓
              </Button>
            }
          />
        ))}
      </div>
    </Card>
  );
}
