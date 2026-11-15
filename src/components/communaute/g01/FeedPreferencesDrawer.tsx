'use client';

import React from 'react';
import { Chip, Sheet, Switch } from '@/components/ui';
import { SPORT_KEYS, sportLabel, type SportKey } from '@/features/community/g01/contracts';
import {
  normalizeFeedPreferences,
  type FeedPreferencesPatch,
} from '@/features/community/g01/feedPreferences';
import styles from './g01.module.css';

export interface FeedPreferencesAuthor {
  id: string;
  name: string;
}

export interface FeedPreferencesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: unknown;
  onChange: (patch: FeedPreferencesPatch) => void;
  onReset?: () => void;
  sports?: readonly SportKey[];
  authors?: readonly FeedPreferencesAuthor[];
  title?: string;
}

const ALL_SPORTS = SPORT_KEYS.filter((sport) => sport !== 'autre');

/**
 * Drawer G01 des préférences de fil. Il réutilise le `Sheet` canonique du
 * dépôt (focus trap, Échap, retour du focus) et ne propose que des réglages
 * locaux : masquer un contenu ou choisir la lecture vidéo ne modifie jamais la
 * visibilité serveur.
 */
export function FeedPreferencesDrawer({
  open,
  onOpenChange,
  preferences,
  onChange,
  onReset,
  sports = ALL_SPORTS,
  authors = [],
  title = 'Préférences du fil',
}: FeedPreferencesDrawerProps) {
  const prefs = normalizeFeedPreferences(preferences);
  const mutedSports = new Set(prefs.muted_sports);
  const mutedAuthors = new Set(prefs.muted_authors);

  const toggleSport = (sport: SportKey) => {
    const next = new Set(mutedSports);
    if (next.has(sport)) next.delete(sport);
    else next.add(sport);
    onChange({ muted_sports: Array.from(next) });
  };

  const toggleAuthor = (authorId: string, muted: boolean) => {
    const next = new Set(mutedAuthors);
    if (muted) next.add(authorId);
    else next.delete(authorId);
    onChange({ muted_authors: Array.from(next) });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Choisis ce que tu vois dans le fil et comment les vidéos se lancent."
      detent="large"
    >
      <div className={styles.drawer}>
        <section className={styles.drawerSection} aria-label="Contenu du fil">
          <h3 className={styles.sectionTitle}>Contenu</h3>
          <Switch
            checked={prefs.show_activity}
            onCheckedChange={(checked) => onChange({ show_activity: checked })}
            label="Afficher les activités sportives"
          />
          <p className={styles.hint}>
            Les publications privées, bloquées ou retirées restent invisibles, quel que soit ce
            réglage.
          </p>
        </section>

        <section className={styles.drawerSection} aria-label="Sports masqués">
          <h3 className={styles.sectionTitle}>Sports à masquer</h3>
          <div className={styles.sportChips}>
            {sports.map((sport) => (
              <Chip
                key={sport}
                selected={mutedSports.has(sport)}
                onClick={() => toggleSport(sport)}
              >
                {sportLabel(sport)}
              </Chip>
            ))}
          </div>
          <p className={styles.hint}>Un sport sélectionné ne montre plus ses cartes.</p>
        </section>

        {authors.length > 0 ? (
          <section className={styles.drawerSection} aria-label="Sportifs masqués">
            <h3 className={styles.sectionTitle}>Sportifs</h3>
            <div className={styles.mutedList}>
              {authors.map((author) => (
                <div key={author.id} className={styles.mutedItem}>
                  <span>{author.name}</span>
                  <Switch
                    checked={mutedAuthors.has(author.id)}
                    onCheckedChange={(checked) => toggleAuthor(author.id, checked)}
                    label={`Masquer ${author.name}`}
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.drawerSection} aria-label="Lecture vidéo">
          <h3 className={styles.sectionTitle}>Lecture vidéo</h3>
          <Switch
            checked={prefs.video.autoplay}
            onCheckedChange={(checked) => onChange({ video: { autoplay: checked } })}
            label="Lire les vidéos automatiquement (sans son)"
          />
          <Switch
            checked={prefs.video.sound}
            onCheckedChange={(checked) => onChange({ video: { sound: checked } })}
            label="Autoriser le son après un geste"
          />
          <Switch
            checked={prefs.video.loop}
            onCheckedChange={(checked) => onChange({ video: { loop: checked } })}
            label="Lire en boucle"
          />
          <Switch
            checked={prefs.video.data_saver}
            onCheckedChange={(checked) => onChange({ video: { data_saver: checked } })}
            label="Économiser les données"
          />
          <p className={styles.hint}>
            Le mouvement réduit du système désactive toujours l’autoplay et la boucle. Une vidéo
            hors écran ou dans un onglet masqué est mise en pause.
          </p>
        </section>

        {onReset ? (
          <div className={styles.drawerActions}>
            <button type="button" className={styles.openLink} onClick={onReset}>
              Réinitialiser les préférences
            </button>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

export default FeedPreferencesDrawer;
