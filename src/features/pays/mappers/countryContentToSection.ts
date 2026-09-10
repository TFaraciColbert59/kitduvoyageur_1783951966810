// src/features/pays/mappers/countryContentToSection.ts
// Repli RÉEL : construit le contenu d'une section à partir des données
// éditoriales Supabase du pays (`countries_content`), quand aucun bloc IA n'est
// disponible. Aucune donnée inventée : uniquement les champs renseignés.
import type { CountryContent } from '@/lib/supabase/types';
import type { ContentBlockType } from '@/lib/ai/country-content/contentBlocksTypes';
import type { PaysSectionId, SectionBlock } from '../types';

function clean(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function labelled(label: string, value?: string | null): string | null {
  const cleaned = clean(value);
  return cleaned ? `**${label}.** ${cleaned}` : null;
}

function joinParagraphs(parts: Array<string | null>): string {
  return parts.filter((part): part is string => Boolean(part)).join('\n\n');
}

function makeBlock(
  type: ContentBlockType,
  label: string,
  contentMd: string
): SectionBlock | null {
  if (!contentMd) return null;
  return {
    type,
    label,
    source: 'editorial',
    contentMd,
    contentJson: null,
    sources: [],
    generatedAt: null,
    reviewedAt: null,
    staleAfter: null,
  };
}

/** Construit les blocs éditoriaux d'une section depuis `countries_content`. */
export function buildEditorialSectionBlocks(
  sectionId: PaysSectionId,
  content: CountryContent | null | undefined
): SectionBlock[] {
  if (!content) return [];

  const climat = content.climat ?? {};
  const transport = content.transport ?? {};
  const outdoor = content.outdoor ?? {};
  const culture = content.culture ?? {};
  const budget = content.budget ?? {};
  const editorial = content.editorial ?? {};

  const blocks: Array<SectionBlock | null> = [];

  switch (sectionId) {
    case 'presentation':
      blocks.push(
        makeBlock(
          'vue_ensemble',
          'Vue d’ensemble',
          joinParagraphs([
            labelled('Climat', climat.climat_general),
            labelled('Meilleure période', climat.meilleure_periode_trek),
            labelled(
              'Accès',
              transport.aeroport_principal
                ? `${transport.aeroport_principal}${transport.code_iata ? ` (${transport.code_iata})` : ''}`
                : null
            ),
            labelled('Sur place', transport.transport_interieur),
            labelled('Budget indicatif', budget.budget_jour_moyen),
          ])
        )
      );
      break;

    case 'destinations':
      blocks.push(
        makeBlock(
          'spots_incontournables',
          'Sites & parcs majeurs',
          joinParagraphs([
            labelled('Parcs & espaces protégés', outdoor.parcs_nationaux),
            labelled('Faune & flore', outdoor.faune_flore_remarquable),
            labelled('Meilleure période', climat.meilleure_periode_trek),
          ])
        )
      );
      break;

    case 'activites':
      blocks.push(
        makeBlock(
          'itineraires_suggeres',
          'Treks & itinéraires',
          joinParagraphs([
            labelled('Treks phares', outdoor.treks_phares),
            labelled('Activités', outdoor.activites_phares),
          ])
        ),
        makeBlock(
          'niveau_difficulte',
          'Préparation & équipement',
          joinParagraphs([
            labelled('Équipement recommandé', outdoor.equipement_specifique_recommande),
            labelled('Vigilance météo', climat.risques_meteo),
          ])
        )
      );
      break;

    case 'culture':
      blocks.push(
        makeBlock(
          'etiquette',
          'Usages & savoir-vivre',
          joinParagraphs([
            labelled('Coutumes & étiquette', culture.coutumes_etiquette),
            labelled('Tenue', culture.dress_code),
            labelled('Religions & croyances', culture.religion_principale),
          ])
        ),
        makeBlock(
          'etiquette',
          'Fêtes & jours fériés',
          joinParagraphs([clean(culture.jours_feries_majeurs)])
        ),
        makeBlock(
          'etiquette',
          'Gastronomie locale',
          joinParagraphs([clean(editorial.plats_emblematiques)])
        )
      );
      break;
  }

  return blocks.filter((block): block is SectionBlock => block !== null);
}
