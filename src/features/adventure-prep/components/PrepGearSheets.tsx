/**
 * Les tiroirs « Équipement » et « Eau et repas ».
 *
 * Tous les deux sont batis sur le GABARIT des tiroirs (PrepDrawerTemplate) :
 * section, liste, deux lignes par ligne, etat honnete quand la base n a rien
 * donne. C'est le meme balisage que le tiroir Lieu, donc le meme reflexe.
 *
 * Deux Thierry de la checklist se ferment ici :
 *
 *  - F7 : l'onglet « Manquant » etait mort. `getGearState` sait produire
 *    `missing`, mais aucun ecran n appelait `setGearWeight` ni `assignGear` :
 *    le poids et le porteur etaient donc toujours `null`, et l'onglet etait
 *    vide en permanence. Il n'y a pas seulement une etiquette a corriger, il
 *    manquait les DEUX controles qui rendent l'etat atteignable. Ils sont la,
 *    et ils appellent les actions du store.
 *
 *  - F8 : l'eau etait comptee par journee (`waterNeeds`). On ne porte pas son
 *    eau du lever au coucher : on la porte d'un ravitaillement au suivant.
 *    `consumablesBySegment` decoupe la journee reelle en segments, et c'est ce
 *    decoupage que le tiroir affiche. Les repas restent par journee, comme
 *    ils l'ont toujours ete.
 *
 * Regle de confiance, non negociable : aucun chiffre n'est fabrique ici. Un
 * poids non saisi reste « a verifier », un litre non mesure reste « a
 * verifier », et un onglet vide dit POURQUOI il est vide au lieu de laisser
 * croire a un bug.
 */

import React, { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { SearchField } from '@/components/ui';
import { A_VERIFIER } from '../engine/trust';
import { GEAR_CATEGORY_LABELS } from '../engine/labels';
import { buildGearNeeds } from '../engine/gear';
import { mealNeeds, uncoveredMeals } from '../engine/consumables';
import { waterSegments, type WaterSegment } from '../engine/consumablesBySegment';
import { DrawerEmpty, DrawerList, DrawerRow, DrawerSection } from './PrepDrawerTemplate';
import type { AdventurePrepStore } from '../store/useAdventurePrepStore';
import type { AdventurePrepDraft, GearCategory, GearNeed } from '../types';
import { MEAL_SLOT_LABELS } from '../types';

export interface GearSheetProps {
  draft: AdventurePrepDraft;
  actions: AdventurePrepStore;
}

type GearFilter = 'a_verifier' | 'manquant' | 'tout';

/**
 * Les trois onglets, avec la question a laquelle chacun repond.
 *
 * `a_verifier` : on ignore encore le POIDS de l'objet. Sans poids, impossible
 * de dire si le sac passe — et c'est exactement ce qu on veut qu il verifies.
 * `manquant` : le poids est connu, et personne ne porte l'objet. Ce n est plus
 * une ignorance, c'est un trou dans le groupe.
 * `tout` : l etat complet, embarkues comprises.
 */
const FILTERS: readonly { id: GearFilter; label: string; question: string }[] = [
  {
    id: 'a_verifier',
    label: 'À vérifier',
    question: "Le poids de ces objets n'est pas encore connu : le sac ne peut pas être fermé.",
  },
  {
    id: 'manquant',
    label: 'Manquant',
    question:
      "Ces objets ont un poids connu mais personne ne les porte : le groupe part sans.",
  },
  { id: 'tout', label: 'Tout', question: 'Tout le matériel dont cette aventure a besoin.' },
];

/**
 * L'etat REEL d'un objet, deduit de ce que la personne a reellement saisi.
 *
 * La cle est le poids, pas la possession : on ne « possede » pas un objet dont
 * on ignore la masse, et on ne « manque » de rien tant qu on n a pas pesé.
 * `missing` n'est donc atteignable que parce que l'ecran permet desormais de
 * saisir un poids sans designate de porteur — c'est le trou dans le groupe.
 */
type GearState = 'poids-inconnu' | 'manquant' | 'porte' | 'partage-a-confirmer';

export function getGearState(item: GearNeed): GearState {
  if (item.weightGrams === null) return 'poids-inconnu';
  if (item.ownerId !== null) return item.quantity > 1 ? 'partage-a-confirmer' : 'porte';
  return 'manquant';
}

const GEAR_STATE_LABELS: Readonly<Record<GearState, string>> = {
  'poids-inconnu': 'Poids à vérifier',
  manquant: 'Personne ne le porte',
  porte: 'Embarqué',
  'partage-a-confirmer': 'Partagé · à confirmer',
};

const GEAR_STATE_BADGE: Readonly<Record<GearState, string>> = {
  'poids-inconnu': 'prep-gear-row__badge--check',
  manquant: 'prep-gear-row__badge--missing',
  porte: 'prep-gear-row__badge--shared',
  'partage-a-confirmer': 'prep-gear-row__badge--shared',
};

/** Le nombre d'objets relevant de chaque onglet, pour l'annoncer sur l'onglet. */
function filterCount(filter: GearFilter, gear: readonly GearNeed[]): number {
  if (filter === 'a_verifier') {
    return gear.filter((item) => getGearState(item) === 'poids-inconnu').length;
  }
  if (filter === 'manquant') {
    return gear.filter((item) => getGearState(item) === 'manquant').length;
  }
  return gear.length;
}

/** Un poids saisi est-il plausible ? Un nombre negatif n est pas un poids. */
function parseWeight(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

export function GearSheet({ draft, actions }: GearSheetProps) {
  const [filter, setFilter] = useState<GearFilter>('a_verifier');
  const [query, setQuery] = useState('');

  // `buildGearNeeds` deduit les besoins de l'activite ; ce que la personne a
  // saisi sur ces besoins vit dans `draft.gear`. On recolle les deux sans
  // muter aucun des deux.
  const gear = useMemo(() => {
    const needs = buildGearNeeds(draft);
    return needs.map((item) => {
      const saved = draft.gear.find((existing) => existing.id === item.id);
      return saved
        ? { ...item, ownerId: saved.ownerId, weightGrams: saved.weightGrams }
        : item;
    });
  }, [draft]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return gear.filter((item) => {
      const state = getGearState(item);
      if (filter === 'a_verifier' && state !== 'poids-inconnu') return false;
      if (filter === 'manquant' && state !== 'manquant') return false;
      if (needle && !item.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [gear, filter, query]);

  const categories = useMemo(
    () => Array.from(new Set(visible.map((item) => item.category))),
    [visible],
  );

  const question = FILTERS.find((option) => option.id === filter)?.question ?? '';

  return (
    <div className="prep-gear">
      <div className="prep-gear__tabs" role="tablist" aria-label="Filtrer le matériel">
        {FILTERS.map((option) => {
          const count = filterCount(option.id, gear);
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
              <span className="prep-gear__tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      <SearchField
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filtrer le matériel"
        aria-label="Filtrer le matériel"
      />

      {visible.length === 0 ? (
        <DrawerEmpty>
          {query.trim().length > 0
            ? `Aucun matériel ne correspond à « ${query.trim()} » dans cet onglet.`
            : question}
        </DrawerEmpty>
      ) : (
        categories.map((category) => (
          <DrawerSection key={category} title={GEAR_CATEGORY_LABELS[category]}>
            <DrawerList>
              {visible
                .filter((item) => item.category === category)
                .map((item) => {
                  const state = getGearState(item);
                  const packed = draft.packedGearIds.includes(item.id);
                  return (
                    <DrawerRow
                      key={item.id}
                      data-prep-row="gear"
                      title={item.name}
                      detail={
                        <>
                          {item.quantity} × {item.ownerId ?? 'personne non désignée'} ·{' '}
                          {item.weightGrams === null
                            ? `poids ${A_VERIFIER}`
                            : `${item.weightGrams} g`}
                        </>
                      }
                      trailing={
                        <span
                          className={`prep-gear-row__badge ${GEAR_STATE_BADGE[state]}`}
                        >
                          {packed ? 'Dans le sac' : GEAR_STATE_LABELS[state]}
                        </span>
                      }
                    >
                      <GearControls
                        item={item}
                        members={draft.group.knownMembers}
                        actions={actions}
                        packed={packed}
                      />
                    </DrawerRow>
                  );
                })}
            </DrawerList>
          </DrawerSection>
        ))
      )}
    </div>
  );
}

/**
 * Les deux controles qui rendaient l onglet « Manquant » mort.
 *
 * `setGearWeight` et `assignGear` existaient dans le store depuis le debut et
 * n etaient appeles par PERSONNE. Sans eux, `weightGrams` restait `null` pour
 * toujours, `getGearState` ne pouvait jamais rendre `manquant`, et l onglet
 * etait structurellement vide. Ils sont ici, ils appellent reellement le
 * store, et l onglet se remplit de ce que la personne saisit.
 */
function GearControls({
  item,
  members,
  actions,
  packed,
}: {
  item: GearNeed;
  members: readonly string[];
  actions: AdventurePrepStore;
  packed: boolean;
}) {
  return (
    <div className="prep-gear__controls">
      <label className="prep-gear__field">
        <span>Poids (g)</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={item.weightGrams === null ? '' : String(item.weightGrams)}
          placeholder={A_VERIFIER}
          aria-label={`Poids en grammes pour ${item.name}`}
          onChange={(event) =>
            actions.setGearWeight(item.id, parseWeight(event.target.value))
          }
        />
      </label>

      <label className="prep-gear__field">
        <span>Porteur</span>
        <select
          value={item.ownerId ?? ''}
          aria-label={`Qui porte ${item.name}`}
          onChange={(event) => actions.assignGear(item.id, event.target.value || null)}
        >
          <option value="">Personne</option>
          {members.map((member) => (
            <option key={member} value={member}>
              {member}
            </option>
          ))}
        </select>
      </label>

      <label className="prep-gear__check">
        <input
          type="checkbox"
          checked={packed}
          onChange={(event) => actions.setPacked(item.id, event.target.checked)}
          aria-label={`Dans le sac pour ${item.name}`}
        />
        <span>Dans le sac</span>
      </label>
    </div>
  );
}

/** Un segment d eau, et ce qui permet de le lire d un coup d oeil. */
function SegmentRow({ segment }: { segment: WaterSegment }) {
  return (
    <DrawerRow
      data-prep-row="eau"
      title={`Segment ${segment.stepIds.length} étape${segment.stepIds.length > 1 ? 's' : ''}`}
      detail={
        segment.closedByPlaceName
          ? `Rempli à ${segment.closedByPlaceName}`
          : `Aucun ravitaillement identifié avant la fin de la journée — ${A_VERIFIER}`
      }
      trailing={
        <span className={`prep-gear-row__badge ${segment.confidence === 'fiable' ? 'prep-gear-row__badge--shared' : 'prep-gear-row__badge--check'}`}>
          {segment.litersPerPerson === null ? `${A_VERIFIER} L/pers.` : `${segment.litersPerPerson} L/pers.`}
        </span>
      }
    />
  );
}

export function ConsumablesSheet({ draft }: GearSheetProps) {
  const segments = useMemo(() => waterSegments(draft.itinerary), [draft.itinerary]);
  const meals = useMemo(
    () => uncoveredMeals(mealNeeds(draft.itinerary)),
    [draft.itinerary],
  );

  const byDay = useMemo(() => {
    const groups = new Map<number, WaterSegment[]>();
    for (const segment of segments) {
      const bucket = groups.get(segment.day);
      if (bucket) bucket.push(segment);
      else groups.set(segment.day, [segment]);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [segments]);

  return (
    <div className="prep-consumables">
      <DrawerSection title="Eau, par segment">
        {byDay.length === 0 ? (
          <DrawerEmpty>
            Aucun programme n est encore mesure : les segments d&apos;eau apparaissent des que
            le parcours existe.
          </DrawerEmpty>
        ) : (
          byDay.map(([day, daySegments]) => (
            <React.Fragment key={day}>
              <h4 className="prep-consumables__day">Jour {day}</h4>
              <DrawerList>
                {daySegments.map((segment) => (
                  <SegmentRow key={segment.id} segment={segment} />
                ))}
              </DrawerList>
            </React.Fragment>
          ))
        )}
        <p className="prep-drawer__note">
          Le volume par segment reste « {A_VERIFIER} » : le depot ne publie ni debit, ni portee.
          L&apos;application n&apos;invente pas de litres.
        </p>
      </DrawerSection>

      <DrawerSection title="Repas, par journée">
        {meals.length === 0 ? (
          <DrawerEmpty>
            Tous les repas sont couverts par le programme retenu.
          </DrawerEmpty>
        ) : (
          <DrawerList>
            {meals.map((need) => (
              <DrawerRow
                key={`${need.day}-${need.slot}`}
                data-prep-row="repas"
                title={`Jour ${need.day} · ${MEAL_SLOT_LABELS[need.slot]}`}
                detail="À prévoir"
                trailing={<Icon name="flame" size={20} style={{ color: 'var(--amber-ink)' }} />}
              />
            ))}
          </DrawerList>
        )}
      </DrawerSection>
    </div>
  );
}