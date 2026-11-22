'use client';

import React, { useEffect, useState } from 'react';
import {
  Camera,
  Check,
  Compass,
  FileText,
  Mountain,
  Package,
  Sparkles,
} from 'lucide-react';
import type { ClubCreateDrawerBodyProps } from './ClubDrawerTypes';

const OUTING_SLOT_PRESETS = ['Samedi · 06h30', 'Dimanche · 07h00', 'Week-end · Bivouac 2J'];
const GEAR_CATEGORY_PRESETS = ['Bivouac & Abri', 'Sécurité & DVA', 'Cuisine & Eau', 'Cordes & Alpi'];
const CLUB_DISCIPLINE_PRESETS = ['Rando & Trek', 'Alpinisme & Bivouac', 'Trail & Crêtes', 'Handi-Rando & Joëlette'];
const RECOMMENDED_POLE_PRESETS = [
  { id: 'pole-rando', name: 'Pôle Rando & Bivouac', specialty: 'Trekking autonomie, refuges & lacs' },
  { id: 'pole-alpi', name: 'Pôle Alpinisme & Sommets', specialty: 'Courses d’arêtes, glacier & haute montagne' },
  { id: 'pole-trail', name: 'Pôle Trail & Crêtes', specialty: 'Sorties rapides, D+ & endurance' },
  { id: 'pole-handi', name: 'Pôle Joëlette & Partage', specialty: 'Pilotage joëlette & sentiers adaptés' },
];
const PHOTO_PRESETS = [
  { label: 'Crête alpine', url: '/images/ridge-line.jpg' },
  { label: 'Panorama massif', url: '/images/mountain-vista.jpg' },
];

export function ClubCreateDrawerBody({
  activeTab,
  activeClub,
  prefillMassif,
  onCreatePost,
  onCreateOuting,
  onCreateVaultGear,
  onCreateNewClub,
  onToast,
}: ClubCreateDrawerBodyProps) {
  const [postCaption, setPostCaption] = useState('');
  const [postSpot, setPostSpot] = useState(activeClub.massif);
  const [postKind, setPostKind] = useState<'media' | 'text'>('text');
  const [postMediaUrl, setPostMediaUrl] = useState('');
  const [postPoleId, setPostPoleId] = useState<string>('');

  const [outingTitle, setOutingTitle] = useState('');
  const [outingDate, setOutingDate] = useState('Samedi · 06h30');
  const [outingMassif, setOutingMassif] = useState(activeClub.massif);
  const [outingKm, setOutingKm] = useState('22');
  const [outingDplus, setOutingDplus] = useState('1350');
  const [outingCity, setOutingCity] = useState('Grenoble / Annecy');

  const [gearName, setGearName] = useState('');
  const [gearBrand, setGearBrand] = useState('Petzl / MSR');
  const [gearWeight, setGearWeight] = useState('420');
  const [gearCat, setGearCat] = useState('Bivouac & Sécurité');

  const [newClubName, setNewClubName] = useState('');
  const [newClubMassif, setNewClubMassif] = useState(prefillMassif || 'Mont-Blanc');
  const [newClubCat, setNewClubCat] = useState('Alpinisme & Bivouac');
  const [newClubBio, setNewClubBio] = useState('');
  const [newClubVis, setNewClubVis] = useState<'public' | 'prive'>('public');
  const [newClubPoles, setNewClubPoles] = useState<Array<{ id: string; name: string; specialty: string }>>([]);

  useEffect(() => {
    if (prefillMassif) {
      setNewClubMassif(prefillMassif);
    }
  }, [prefillMassif]);

  // ============================================================================
  // D25 — C.1 CREATE-OUTING ("Proposer une sortie")
  // ============================================================================
  if (activeTab === 1) {
    const kmNum = Math.max(1, Number(outingKm) || 18);
    const dplusNum = Math.max(0, Number(outingDplus) || 1200);
    const estHours = +((kmNum / 4) + (dplusNum / 400)).toFixed(1);

    return (
      <form
        className="club-drawer-form"
        data-testid="club-create-outing-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!outingTitle.trim()) return;
          const payload = {
            title: outingTitle.trim(),
            date: outingDate.trim() || 'Samedi · 07h00',
            massif: outingMassif.trim() || activeClub.massif,
            km: kmNum,
            dplus: dplusNum,
            carpoolCity: outingCity.trim() || 'Camp de base',
          };
          onCreateOuting(payload);
          onToast?.({
            title: 'Sortie publiée dans la frise ✓',
            subtitle: `${payload.title} · ${payload.km} km · +${payload.dplus} m D+`,
          });
          setOutingTitle('');
        }}
      >
        <div className="club-sec-head">
          <div className="club-sec-head-titles">
            <span className="club-sec-eyebrow">Nouvelle sortie · {activeClub.name}</span>
            <b className="club-sec-title">Proposer une sortie de cordée</b>
          </div>
          <span className="club-badge-sage">~{estHours} h estimées</span>
        </div>

        {/* Carnet V2 Live Single-Pane Preview Card */}
        <div
          className="li nt club-glass-card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <b style={{ fontSize: 12.5 }}>{outingTitle.trim() || 'Aperçu de votre sortie…'}</b>
            <span className="club-badge-soft">{outingDate}</span>
          </div>
          <div className="s2">
            📍 {outingMassif || activeClub.massif} · {kmNum} km · +{dplusNum} m D+ · 🚐 {outingCity}
          </div>
        </div>

        <label className="club-field-label">
          <span>Objectif / Sommet</span>
          <input
            type="text"
            className="club-glass-input"
            value={outingTitle}
            onChange={(e) => setOutingTitle(e.target.value)}
            placeholder="Ex : Traversée des Arêtes & Bivouac Lacs"
            required
          />
        </label>

        <div className="club-form-pills">
          {OUTING_SLOT_PRESETS.map((slot) => (
            <button
              key={slot}
              type="button"
              className={`reseau-btn ${outingDate === slot ? 'primary' : 'active'}`}
              style={{ fontSize: 11, padding: '3px 8px' }}
              onClick={() => setOutingDate(slot)}
            >
              {slot}
            </button>
          ))}
        </div>

        <div className="club-form-grid-2">
          <label className="club-field-label">
            <span>Créneau</span>
            <input type="text" className="club-glass-input" value={outingDate} onChange={(e) => setOutingDate(e.target.value)} />
          </label>
          <label className="club-field-label">
            <span>Massif</span>
            <input type="text" className="club-glass-input" value={outingMassif} onChange={(e) => setOutingMassif(e.target.value)} />
          </label>
        </div>
        <div className="club-form-grid-2">
          <label className="club-field-label">
            <span>Distance (km)</span>
            <input type="number" className="club-glass-input" value={outingKm} onChange={(e) => setOutingKm(e.target.value)} />
          </label>
          <label className="club-field-label">
            <span>Dénivelé D+ (m)</span>
            <input type="number" className="club-glass-input" value={outingDplus} onChange={(e) => setOutingDplus(e.target.value)} />
          </label>
        </div>
        <label className="club-field-label">
          <span>Point de RDV / Covoiturage</span>
          <input type="text" className="club-glass-input" value={outingCity} onChange={(e) => setOutingCity(e.target.value)} />
        </label>
        <button
          type="submit"
          className="reseau-btn primary club-submit-pill club-icon-pill"
          aria-label="Lancer les inscriptions"
          title="Lancer les inscriptions"
        >
          <Check size={16} aria-hidden="true" />
        </button>
      </form>
    );
  }

  // ============================================================================
  // D26 — C.2 CREATE-GEAR ("Mettre un équipement au coffre")
  // ============================================================================
  if (activeTab === 2) {
    const wNum = Math.max(10, Number(gearWeight) || 350);
    const weightClass = wNum < 500 ? 'Ultraléger ✓' : wNum < 1200 ? 'Standard' : 'Portage collectif';

    return (
      <form
        className="club-drawer-form"
        data-testid="club-create-gear-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!gearName.trim()) return;
          const payload = {
            name: gearName.trim(),
            brand: gearBrand.trim() || 'LKDV',
            weightG: wNum,
            category: gearCat.trim() || 'Matériel',
          };
          onCreateVaultGear(payload);
          onToast?.({
            title: 'Équipement ajouté au coffre ✓',
            subtitle: `${payload.name} (${payload.weightG} g)`,
          });
          setGearName('');
        }}
      >
        <div className="club-sec-head">
          <div className="club-sec-head-titles">
            <span className="club-sec-eyebrow">Coffre d’entraide · {activeClub.name}</span>
            <b className="club-sec-title">Mutualiser un équipement dans le coffre</b>
          </div>
          <span className="club-badge-sage">{weightClass}</span>
        </div>

        {/* Live Gear Preview Card */}
        <div
          className="li nt club-glass-card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}
        >
          <b style={{ fontSize: 12.5 }}>{gearName.trim() || 'Aperçu de la pièce mutualisée…'}</b>
          <div className="s2">
            {gearBrand || 'Marque'} · {wNum} g · {gearCat}
          </div>
        </div>

        <label className="club-field-label">
          <span>Pièce d’équipement</span>
          <input
            type="text"
            className="club-glass-input"
            value={gearName}
            onChange={(e) => setGearName(e.target.value)}
            placeholder="Ex : Tente MSR Access 2P, DVA Barryvox…"
            required
          />
        </label>
        <div className="club-form-grid-2">
          <label className="club-field-label">
            <span>Marque</span>
            <input type="text" className="club-glass-input" value={gearBrand} onChange={(e) => setGearBrand(e.target.value)} />
          </label>
          <label className="club-field-label">
            <span>Poids (g)</span>
            <input type="number" className="club-glass-input" value={gearWeight} onChange={(e) => setGearWeight(e.target.value)} />
          </label>
        </div>

        <div className="club-form-pills">
          {GEAR_CATEGORY_PRESETS.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`reseau-btn ${gearCat === cat ? 'primary' : 'active'}`}
              style={{ fontSize: 11, padding: '3px 8px' }}
              onClick={() => setGearCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <label className="club-field-label">
          <span>Catégorie</span>
          <input type="text" className="club-glass-input" value={gearCat} onChange={(e) => setGearCat(e.target.value)} />
        </label>
        <button
          type="submit"
          className="reseau-btn primary club-submit-pill club-icon-pill"
          aria-label="Ajouter au coffre du club"
          title="Ajouter au coffre du club"
        >
          <Check size={16} aria-hidden="true" />
        </button>
      </form>
    );
  }

  // ============================================================================
  // D27 — C.3 CREATE-CLUB ("Fonder un nouveau club")
  // ============================================================================
  if (activeTab === 3) {
    const slugPreview = (newClubName.trim() || 'nouveau-club')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return (
      <form
        className="club-drawer-form"
        data-testid="club-create-new-club-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newClubName.trim()) return;
          const payload = {
            name: newClubName.trim(),
            massif: newClubMassif.trim() || 'Alpes',
            category: newClubCat.trim() || 'Trek & Bivouac',
            bio: newClubBio.trim() || 'Club outdoor local connecté aux traces réelles.',
            visibility: newClubVis,
            poles: newClubPoles.length > 0 ? newClubPoles : undefined,
          };
          onCreateNewClub(payload);
          onToast?.({
            title: 'Nouveau club fondé ✓',
            subtitle: `${payload.name} (${payload.massif})`,
          });
          setNewClubName('');
        }}
      >
        <div className="club-sec-head">
          <div className="club-sec-head-titles">
            <span className="club-sec-eyebrow">Fondation · /clubs/{slugPreview}</span>
            <b className="club-sec-title">Fonder un nouveau club LKDV</b>
          </div>
          <span className="club-badge-sage">{newClubVis === 'public' ? 'Ouvert' : 'Cooptation'}</span>
        </div>

        <label className="club-field-label">
          <span>Nom du club</span>
          <input
            type="text"
            className="club-glass-input"
            value={newClubName}
            onChange={(e) => setNewClubName(e.target.value)}
            placeholder="Ex : Cordée Écrins & Bivouac Hivernal"
            required
          />
        </label>

        <div className="club-form-pills">
          {CLUB_DISCIPLINE_PRESETS.map((disc) => (
            <button
              key={disc}
              type="button"
              className={`reseau-btn ${newClubCat === disc ? 'primary' : 'active'}`}
              style={{ fontSize: 11, padding: '3px 8px' }}
              onClick={() => setNewClubCat(disc)}
            >
              {disc}
            </button>
          ))}
        </div>

        <div className="club-form-grid-2">
          <label className="club-field-label">
            <span>Massif d’ancrage</span>
            <input type="text" className="club-glass-input" value={newClubMassif} onChange={(e) => setNewClubMassif(e.target.value)} />
          </label>
          <label className="club-field-label">
            <span>Discipline</span>
            <input type="text" className="club-glass-input" value={newClubCat} onChange={(e) => setNewClubCat(e.target.value)} />
          </label>
        </div>
        <label className="club-field-label">
          <span>Manifeste (2 lignes)</span>
          <input
            type="text"
            className="club-glass-input"
            value={newClubBio}
            onChange={(e) => setNewClubBio(e.target.value)}
            placeholder="Sorties engagées, partage de traces GPX et entraide matériel."
          />
        </label>
        <div className="club-form-pills">
          <button
            type="button"
            className={`reseau-btn ${newClubVis === 'public' ? 'primary' : 'active'}`}
            onClick={() => setNewClubVis('public')}
          >
            Club Public (Ouvert)
          </button>
          <button
            type="button"
            className={`reseau-btn ${newClubVis === 'prive' ? 'primary' : 'active'}`}
            onClick={() => setNewClubVis('prive')}
          >
            Sur Cooptation (Privé)
          </button>
        </div>

        <div className="club-field-label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Pôles & Spécialités (optionnel — recommandé pour les gros clubs)</span>
          <div className="club-form-pills">
            {RECOMMENDED_POLE_PRESETS.map((preset) => {
              const selected = newClubPoles.some((p) => p.id === preset.id);
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`reseau-btn ${selected ? 'primary' : 'active'}`}
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  title={preset.specialty}
                  onClick={() =>
                    setNewClubPoles((prev) =>
                      selected ? prev.filter((p) => p.id !== preset.id) : [...prev, preset],
                    )
                  }
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="submit"
          className="reseau-btn primary club-submit-pill club-icon-pill"
          aria-label="Fonder le club et ouvrir sa carte"
          title="Fonder le club et ouvrir sa carte"
        >
          <Check size={16} aria-hidden="true" />
        </button>
      </form>
    );
  }

  // ============================================================================
  // D24 — C.0 CREATE-POST ("Publier dans le club")
  // ============================================================================
  return (
    <form
      className="club-drawer-form"
      data-testid="club-create-post-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!postCaption.trim()) return;
        const chosenPole = (activeClub.poles || []).find((p) => p.id === postPoleId);
        const payload = {
          kind: postKind,
          caption: postCaption.trim(),
          spot: postSpot.trim() || activeClub.massif,
          mediaUrl: postKind === 'media' ? (postMediaUrl.trim() || '/images/ridge-line.jpg') : undefined,
          poleId: chosenPole?.id,
          poleName: chosenPole?.name,
        };
        onCreatePost(payload);
        onToast?.({
          title: 'Publication partagée avec le club ✓',
          subtitle: `${activeClub.name}${chosenPole ? ` · ${chosenPole.name}` : ''} · ${payload.spot}`,
        });
        setPostCaption('');
      }}
    >
      <div className="club-sec-head">
        <div className="club-sec-head-titles">
          <span className="club-sec-eyebrow">Publication · {activeClub.massif}</span>
          <b className="club-sec-title">Publier dans {activeClub.name}</b>
        </div>
        <span className="club-badge-sage">{postKind === 'media' ? 'Photo 1:1' : 'Billet'}</span>
      </div>

      {/* Carnet Post-style Live Preview Card */}
      <div
        className="li nt club-glass-card"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <b style={{ fontSize: 12 }}>📍 {postSpot || activeClub.massif}</b>
          <span className="s2">{postKind === 'media' ? '📸 Média terrain' : '✍️ Annonce cordée'}</span>
        </div>
        <div className="s2">{postCaption.trim() || 'Votre message apparaîtra dans le fil du club…'}</div>
      </div>

      <div className="club-form-pills">
        <button
          type="button"
          className={`reseau-btn ${postKind === 'text' ? 'primary' : 'active'}`}
          onClick={() => setPostKind('text')}
        >
          Annonce / Covoit / Question
        </button>
        <button
          type="button"
          className={`reseau-btn ${postKind === 'media' ? 'primary' : 'active'}`}
          onClick={() => setPostKind('media')}
        >
          Photo Terrain / Trace 1:1
        </button>
      </div>
      <label className="club-field-label">
        <span>Spot ou sommet concerné</span>
        <input
          type="text"
          className="club-glass-input"
          value={postSpot}
          onChange={(e) => setPostSpot(e.target.value)}
          placeholder="Ex : Col du Lautaret, Aiguille du Midi…"
        />
      </label>
      {activeClub.poles && activeClub.poles.length > 0 ? (
        <label className="club-field-label">
          <span>Pôle de spécialité (optionnel)</span>
          <select
            className="club-glass-input"
            value={postPoleId}
            onChange={(e) => setPostPoleId(e.target.value)}
            aria-label="Choisir un pôle de spécialité"
          >
            <option value="">Tous les pôles (Fil général du club)</option>
            {activeClub.poles.map((pole) => (
              <option key={pole.id} value={pole.id}>
                {pole.name} — {pole.specialty}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {postKind === 'media' ? (
        <>
          <div className="club-form-pills">
            {PHOTO_PRESETS.map((p) => (
              <button
                key={p.url}
                type="button"
                className={`reseau-btn ${postMediaUrl === p.url ? 'primary' : 'active'}`}
                style={{ fontSize: 11, padding: '3px 8px' }}
                onClick={() => setPostMediaUrl(p.url)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="club-field-label">
            <span>Image du spot (URL ou preset terrain)</span>
            <input
              type="text"
              className="club-glass-input"
              value={postMediaUrl}
              onChange={(e) => setPostMediaUrl(e.target.value)}
              placeholder="/images/mountain-vista.jpg"
            />
          </label>
        </>
      ) : null}
      <label className="club-field-label">
        <span>Message au club</span>
        <textarea
          rows={3}
          className="club-glass-textarea"
          value={postCaption}
          onChange={(e) => setPostCaption(e.target.value)}
          placeholder="Ex : Départ samedi 06h00 depuis Grenoble, il me reste 2 places dans le van…"
          required
        />
      </label>
      <button
        type="submit"
        className="reseau-btn primary club-submit-pill club-icon-pill"
        aria-label="Publier dans le fil du club"
        title="Publier dans le fil du club"
      >
        <Check size={16} aria-hidden="true" />
      </button>
    </form>
  );
}

export default ClubCreateDrawerBody;
