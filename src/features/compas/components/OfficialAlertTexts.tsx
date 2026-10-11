import type { OfficialAlertText } from '../engine/danger';

/**
 * Le texte officiel d'une alerte, dans chaque langue du message, tel que le
 * service national l'a publié (conditions de Meteoalarm, § 5 : l'information
 * mise en forme est redonnée « along with the same Information without any
 * material change » ; Style Guide v1.0 : `description` et `instruction` « must be
 * displayed exactly as provided », dans toutes les langues du message).
 *
 * Le texte vient d'un tiers : il est affiché comme du TEXTE (jamais du HTML),
 * déjà nettoyé et borné côté serveur (`cleanText`). Seule mise en forme permise
 * par le Style Guide : un texte à barres verticales « a | b » devient une liste.
 */

function Official({ text }: { text: string }) {
  const items = text
    .split('|')
    .map((t) => t.trim())
    .filter(Boolean);
  if (items.length > 1)
    return (
      <ul>
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    );
  return <p>{text}</p>;
}

/** Une étiquette de langue sûre pour l'attribut `lang` (le flux est un tiers). */
const safeLang = (lang: string) => (/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/.test(lang) ? lang : undefined);

export default function OfficialAlertTexts({
  title,
  texts,
}: {
  /** Qui est cette alerte (« Vigilance orange · vent violent (zone) »), pour distinguer plusieurs textes. */
  title?: string;
  texts: readonly OfficialAlertText[];
}) {
  const shown = texts.filter((t) => t.headline || t.description || t.instruction);
  if (shown.length === 0) return null;
  return (
    <details className="cp-official" data-testid="official-alert-texts">
      <summary>{title ? `Texte officiel : ${title}` : 'Texte officiel du service national'}</summary>
      {shown.map((t, i) => (
        <div key={i} className="cp-official__lang" lang={safeLang(t.lang)}>
          {t.headline && <p className="cp-official__title">{t.headline}</p>}
          {t.description && <Official text={t.description} />}
          {t.instruction && <Official text={t.instruction} />}
        </div>
      ))}
    </details>
  );
}
