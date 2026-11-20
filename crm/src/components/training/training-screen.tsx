'use client';

import { useMemo, useState } from 'react';
import s from '../../ui/crm.module.css';
import { Banner } from '../../ui/states';
import { Button } from '../../ui/button';
import { Card, Label } from '../../ui/card';
import { Chip } from '../../ui/chip';
import { Kbd } from '../../ui/kbd';
import { useHotkeys } from '../../ui/use-hotkeys';

type Verdict = 'masquer' | 'laisser' | 'sanctionner';

type TrainingCase = {
  id: string;
  kind: string;
  title: string;
  body: string;
  author: string;
  reports: number;
  reason: string;
  expected: Verdict;
  explanation: string;
};

/**
 * 10 cas fictifs pour s'entraîner. Rien n'est envoyé : aucun appel réseau, aucune
 * écriture. Les contenus sont explicitement marqués comme fictifs.
 */
const CASES: TrainingCase[] = [
  {
    id: 'ent-01',
    kind: 'Commentaire',
    title: 'Insulte directe sous un carnet',
    body: '« Franchement faut être sacrément nul pour se perdre sur un GR balisé. Reste chez toi la prochaine fois. »',
    author: '@randonneur_alpin',
    reports: 3,
    reason: 'Harcèlement ou insulte',
    expected: 'masquer',
    explanation: 'Vise une personne, répété, sans intérêt pour le fil : masquage avec motif « harcèlement ».'
  },
  {
    id: 'ent-02',
    kind: 'Publication',
    title: 'Critique sévère mais argumentée d’un refuge',
    body: '« Accueil désagréable, dortoir sale, et le prix ne le justifie pas. À éviter en haute saison. »',
    author: '@marc.dolomites',
    reports: 1,
    reason: 'Hors sujet',
    expected: 'laisser',
    explanation: 'Avis négatif argumenté : ce n’est pas une insulte. On laisse visible ; le lieu peut répondre.'
  },
  {
    id: 'ent-03',
    kind: 'Commentaire',
    title: 'Coordonnées GPS précises d’un nid de rapaces',
    body: '« Le nid est exactement à 44.1234, 6.5678, montez par le sentier derrière la bergerie. »',
    author: '@traces_sauvages',
    reports: 2,
    reason: 'Lieu sensible ou fragile',
    expected: 'masquer',
    explanation: 'Lieu naturel fragile : masquage, motif « lieu sensible ». La règle protège l’espèce, pas l’auteur.'
  },
  {
    id: 'ent-04',
    kind: 'Annonce',
    title: 'Vente de cartouches de gaz sans mention de conformité',
    body: '« Cartouches pas chères, aucune facture, envoi rapide. »',
    author: '@bonplan.gaz',
    reports: 4,
    reason: 'Arnaque ou fraude',
    expected: 'sanctionner',
    explanation: 'Répétition, absence de conformité, plusieurs signalements : sanction graduée après masquage.'
  },
  {
    id: 'ent-05',
    kind: 'Story',
    title: 'Photo de paysage sans contenu problématique',
    body: '« Lever de soleil au col, 5 h 40. »',
    author: '@lea.montagne',
    reports: 1,
    reason: 'Hors sujet',
    expected: 'laisser',
    explanation: 'Signalement isolé sans motif solide : on laisse. Le signalement est tracé, la décision aussi.'
  },
  {
    id: 'ent-06',
    kind: 'Commentaire',
    title: 'Débat sur la difficulté d’un sentier',
    body: '« C’est quand même raide pour un sentier familial, je ne le conseillerais pas avec des enfants. »',
    author: '@papa_rando',
    reports: 2,
    reason: 'Hors sujet',
    expected: 'laisser',
    explanation: 'Désaccord technique, pas une attaque. On laisse ; c’est utile aux lecteurs.'
  },
  {
    id: 'ent-07',
    kind: 'Commentaire',
    title: 'Message menaçant envers un membre',
    body: '« Je sais où tu habites, on va se croiser. »',
    author: '@ombre_du_col',
    reports: 5,
    reason: 'Violence ou danger',
    expected: 'sanctionner',
    explanation: 'Menace personnelle : masquage immédiat puis sanction. En réel, l’escalade se fait avec le second humain.'
  },
  {
    id: 'ent-08',
    kind: 'Carnet',
    title: 'Carnet avec données personnelles d’un tiers',
    body: '« Le gardien du refuge s’appelle Jean X., voici son numéro personnel et son adresse. »',
    author: '@carnet_libre',
    reports: 2,
    reason: 'Données personnelles d’autrui',
    expected: 'masquer',
    explanation: 'Données personnelles d’un tiers : masquage, motif « données personnelles ».'
  },
  {
    id: 'ent-09',
    kind: 'Commentaire',
    title: 'Publicité pour un guide payant',
    body: '« Mon guide secret à 39 € ici : [lien], places limitées. »',
    author: '@guide.secret',
    reports: 3,
    reason: 'Spam ou publicité',
    expected: 'masquer',
    explanation: 'Publicité non autorisée : masquage. Si c’est répété, la sanction vient après.'
  },
  {
    id: 'ent-10',
    kind: 'Publication',
    title: 'Question de sécurité sur un passage délicat',
    body: '« Le passage est-il encore équipé de la main courante ? J’ai vu des photos contradictoires. »',
    author: '@claire.vercors',
    reports: 1,
    reason: 'Hors sujet',
    expected: 'laisser',
    explanation: 'Question légitime de sécurité : on laisse, et on oriente vers la fiche terrain.'
  }
];

const LABEL: Record<Verdict, string> = { masquer: 'Masquer', laisser: 'Laisser visible', sanctionner: 'Sanctionner' };

export function TrainingScreen() {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Verdict>>({});
  const [reason, setReason] = useState('');

  const current = CASES[index];
  const answer = current ? answers[current.id] : undefined;
  const done = Object.keys(answers).length;
  const correct = useMemo(
    () => CASES.filter((item) => answers[item.id] === item.expected).length,
    [answers]
  );

  const decide = (verdict: Verdict) => {
    if (!current || answers[current.id]) return;
    setAnswers((prev) => ({ ...prev, [current.id]: verdict }));
  };

  useHotkeys({
    m: () => decide('masquer'),
    l: () => decide('laisser'),
    s: () => decide('sanctionner')
  });

  if (!current) {
    return (
      <Card className={s.padLg}>
        <div className={s.colGap}>
          <Label>Bac à sable terminé</Label>
          <span className={s.subtitle}>
            {correct} décision{correct > 1 ? 's' : ''} cohérente{correct > 1 ? 's' : ''} sur {CASES.length}.
          </span>
          <Button
            tone="pg"
            onClick={() => {
              setAnswers({});
              setIndex(0);
              setReason('');
            }}
          >
            Recommencer l’entraînement
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className={s.col} style={{ gap: 4 }}>
        <h1 className={s.title}>Bac à sable</h1>
        <span className={s.subtitle}>
          Cas {index + 1} sur {CASES.length} · {done} traité{done > 1 ? 's' : ''} · {correct} cohérent{correct > 1 ? 's' : ''}
        </span>
      </div>

      <Banner tone="info" title="Aucune action réelle">
        Ces 10 cas sont <strong>fictifs</strong>. Rien n’est envoyé, rien n’est écrit, aucune donnée réelle n’est utilisée.
      </Banner>

      <div className={s.facts}>
        <div className={s.fact}>
          <span className={s.label}>Quoi</span>
          <span className={s.factValue}>{current.kind}</span>
          <span className={s.muted} style={{ fontSize: 12.5 }}>{current.title}</span>
        </div>
        <div className={s.fact}>
          <span className={s.label}>Qui</span>
          <span className={s.factValue}>{current.author}</span>
          <span className={s.muted} style={{ fontSize: 12.5 }}>Fictif</span>
        </div>
        <div className={s.fact}>
          <span className={s.label}>Signalements</span>
          <span className={s.factValue}>{current.reports} membres</span>
          <span className={s.muted} style={{ fontSize: 12.5 }}>{current.reason}</span>
        </div>
        <div className={s.fact}>
          <span className={s.label}>Attendu</span>
          <span className={s.factValue}>{answer ? (answer === current.expected ? 'Cohérent' : 'À revoir') : 'À vous'}</span>
          <span className={s.muted} style={{ fontSize: 12.5 }}>Le corrigé s’affiche après votre décision</span>
        </div>
      </div>

      <section className={`${s.card} ${s.padLg}`} aria-label="Contenu du cas fictif">
        <div className={s.colGap}>
          <Label>Contenu</Label>
          <blockquote className={s.quote}>{current.body}</blockquote>
        </div>
      </section>

      <section className={`${s.card} ${s.padLg}`} aria-label="Votre décision">
        <div className={s.colGap}>
          <Label>Votre décision</Label>
          <div className={s.rowFlexWrap}>
            <Button tone="pg" shortcut="M" disabled={Boolean(answer)} onClick={() => decide('masquer')}>
              Masquer
            </Button>
            <Button tone="soft" shortcut="L" disabled={Boolean(answer)} onClick={() => decide('laisser')}>
              Laisser visible
            </Button>
            <Button tone="bad" shortcut="S" disabled={Boolean(answer)} onClick={() => decide('sanctionner')}>
              Sanctionner
            </Button>
          </div>

          {answer ? (
            <Banner tone={answer === current.expected ? 'info' : 'warn'} title={answer === current.expected ? 'Cohérent' : 'À revoir'}>
              Vous avez choisi « {LABEL[answer]} ». Le corrigé : « {LABEL[current.expected]} ». {current.explanation}
            </Banner>
          ) : (
            <span className={s.muted} style={{ fontSize: 12.5 }}>
              Motif suggéré : {current.reason}. En réel, le motif est obligatoire et part dans le message au membre.
            </span>
          )}

          <div className={s.rowFlexWrap}>
            <Button
              tone="soft"
              disabled={index >= CASES.length - 1}
              onClick={() => {
                setIndex((value) => Math.min(CASES.length - 1, value + 1));
                setReason('');
              }}
            >
              Cas suivant
            </Button>
            <Button tone="soft" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}>
              Cas précédent
            </Button>
            <Chip tone="stone">{Object.keys(answers).length} / {CASES.length}</Chip>
            <span
              aria-hidden="true"
              style={{ flex: 1, minWidth: 80, height: 6, borderRadius: 999, background: 'var(--lkv-surface-muted)', overflow: 'hidden' }}
            >
              <span
                style={{
                  display: 'block',
                  height: '100%',
                  width: `${Math.round((Object.keys(answers).length / CASES.length) * 100)}%`,
                  background: 'var(--lkv-action)'
                }}
              />
            </span>
          </div>
        </div>
      </section>

      <span className={s.muted} style={{ fontSize: 12.5 }}>
        <Kbd>M</Kbd> <Kbd>L</Kbd> <Kbd>S</Kbd> répondent au clavier. La saisie du motif n’est pas demandée ici : cet
        écran n’écrit rien.
        {reason ? ` (${reason})` : ''}
      </span>
    </>
  );
}
