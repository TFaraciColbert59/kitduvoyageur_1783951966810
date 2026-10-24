/* eslint-disable */
// Runtime iOS 27 Liquid Glass v15 — Page Club (/clubs/[id])
// Calqué à l'identique sur Compte iOS 27 v15 (1 scroll unique, sélecteur flottant verre 0.65, drawers card, post modal minimal, carte 3D MapLibre)

export function initClubLiquidGlassRuntime(rootContainer) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  let cleanupFns = [];
  let mapInstance = null;

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const CLUB_PRESETS = {
    cl1: {
      id: 'cl1',
      slug: 'club-alpin-pyrenees',
      name: 'Club Alpin Pyrénées',
      handle: 'alpin.pyrenees',
      category: 'Alpinisme & Haute Route',
      massif: 'Massif des Pyrénées',
      avatar: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&auto=format&fit=crop&q=80',
      verified: true,
      isPrivate: false,
      isMember: true,
      isPending: false,
      isModerator: false,
      memberCount: 342,
      postsCount: 6,
      outingsCount: 4,
      footprintLine: '🏔️ Pyrénées · 48 sorties · Traces GPX certifiées · 3 298 m max',
      bio: 'Le camp de base des cordées pyrénéennes : courses d’arêtes, traversées HRP en autonomie, nivologie et partage de traces GPX vérifiées.',
      charter: 'Respect strict du bivouac léger (19h–9h), entraide en cordée, partage systématique des conditions nivologiques et traces GPX vérifiées.',
      coords: [-0.045, 42.785],
      zoom: 10.6,
    },
    cl2: {
      id: 'cl2',
      slug: 'torino-chamonix-alpi',
      name: 'Torino & Chamonix Alpi',
      handle: 'chamonix.torino.alpi',
      category: 'Haute Montagne & Mixte',
      massif: 'Massif du Mont-Blanc',
      avatar: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=400&auto=format&fit=crop&q=80',
      verified: true,
      isPrivate: true,
      isMember: false,
      isPending: false,
      isModerator: false,
      memberCount: 218,
      postsCount: 6,
      outingsCount: 3,
      footprintLine: '⛏️ Mont-Blanc & Val d’Aoste · Courses glaciaires · 4 808 m',
      bio: 'Collectif franco-italien dédié aux courses d’arêtes, goulottes et raids glaciaires entre Chamonix, Courmayeur et le Grand Paradis.',
      charter: 'Validation du carnet de courses requise. Autonomie en progression sur glacier (moufflage, encordement long/court) et matériel DVA/pelle/sonde obligatoire.',
      coords: [6.8694, 45.8326],
      zoom: 10.8,
    },
    cl3: {
      id: 'cl3',
      slug: 'bivouac-4-saisons-trek-leger',
      name: 'Bivouac 4 Saisons & MUL',
      handle: 'bivouac.mul.france',
      category: 'Marche Ultra-Légère & Bivouac',
      massif: 'Alpes, Vercors & Cévennes',
      avatar: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&auto=format&fit=crop&q=80',
      verified: true,
      isPrivate: false,
      isMember: true,
      isPending: false,
      isModerator: false,
      memberCount: 512,
      postsCount: 6,
      outingsCount: 4,
      footprintLine: '⛺ Packraft & Trek MUL · Baseweight < 4,5 kg · 4 saisons',
      bio: 'Optimisation thermique, tarps DCF, réchauds multi-combustibles et traversées au long cours sans laisser de trace.',
      charter: 'Charte Leave No Trace intégrale. Pesée vérifiée des sacs et retours terrain après chaque bivouac hivernal.',
      coords: [5.535, 44.822],
      zoom: 10.5,
    }
  };

  let CLUB_POSTS = [
    {
      id: 'cp1',
      url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80',
      location: 'Brèche de Roland · Gavarnie (2 807 m)',
      date: 'Il y a 3 h',
      likes: 128,
      comments: 14,
      caption: 'Conditions idéales ce matin sous la Brèche de Roland. Neige portante dès 2 200 m, crampons indispensables sur le dernier ressaut.',
      aspect: '4/5',
      tag: 'sorties',
      authorName: 'Camille Verdier',
      authorHandle: 'camille.v',
      authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80',
      coords: [-0.0089, 42.6912],
      elevation: '2 807 m',
    },
    {
      id: 'cp2',
      url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&auto=format&fit=crop&q=80',
      location: 'Pic du Midi d’Ossau · Tour intégral',
      date: 'Hier',
      likes: 214,
      comments: 23,
      caption: 'Trace GPX mise à jour pour le tour de l’Ossau par les lacs d’Ayous. Bivouac face au Jean-Pierre à 2 080 m.',
      aspect: '1/1',
      tag: 'gpx',
      authorName: 'Romain Pyrénées',
      authorHandle: 'romain.hrp',
      authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80',
      coords: [-0.4375, 42.8427],
      elevation: '2 884 m',
    },
    {
      id: 'cp3',
      url: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&auto=format&fit=crop&q=80',
      location: 'Refuge des Oulettes de Gaube · Vignemale',
      date: 'Il y a 2 j',
      likes: 176,
      comments: 19,
      caption: 'Briefing matériel collectif avant l’ascension du Couloir de Gaube et de la Pique Longue (3 298 m).',
      aspect: '4/5',
      tag: 'matos',
      authorName: 'Théo Montagne',
      authorHandle: 'theo.alpi',
      authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&auto=format&fit=crop&q=80',
      coords: [-0.1462, 42.7739],
      elevation: '3 298 m',
    },
    {
      id: 'cp4',
      url: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800&auto=format&fit=crop&q=80',
      location: 'Réserve du Néouvielle · Lac d’Aubert',
      date: 'Il y a 4 j',
      likes: 162,
      comments: 11,
      caption: 'Rappel de la charte bivouac dans la réserve du Néouvielle : aires réglementées autour d’Aubert et Orédon uniquement.',
      aspect: '3/4',
      tag: 'charte',
      authorName: 'Léa Guide',
      authorHandle: 'lea.uiagm',
      authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=240&auto=format&fit=crop&q=80',
      coords: [0.1194, 42.8392],
      elevation: '2 150 m',
    },
    {
      id: 'cp5',
      url: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800&auto=format&fit=crop&q=80',
      location: 'Arête des Cosmiques · Aiguille du Midi',
      date: 'Il y a 5 j',
      likes: 289,
      comments: 31,
      caption: 'Sortie inter-clubs Alpes & Pyrénées sur l’arête des Cosmiques. 3 cordées autonomes, rocher sec et passages mixtes en parfaite condition.',
      aspect: '1/1',
      tag: 'sorties',
      authorName: 'Marc Cordée',
      authorHandle: 'marc.mixte',
      authorAvatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=240&auto=format&fit=crop&q=80',
      coords: [6.8874, 45.8789],
      elevation: '3 842 m',
    },
    {
      id: 'cp6',
      url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&auto=format&fit=crop&q=80',
      location: 'Balaïtous · Grande Diagonale',
      date: 'Semaine dernière',
      likes: 198,
      comments: 16,
      caption: 'Levée du jour à 3 144 m au sommet du Balaïtous. Trace GPX nettoyée avec les passages clés de la Grande Diagonale.',
      aspect: '4/5',
      tag: 'gpx',
      authorName: 'Camille Verdier',
      authorHandle: 'camille.v',
      authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80',
      coords: [-0.2839, 42.8386],
      elevation: '3 144 m',
    }
  ];

  let CLUB_OUTINGS = [
    {
      id: 'out1',
      title: 'Traversée Gavarnie – Vignemale (3 jours)',
      dateLabel: 'Sam. 14 – Lun. 16 Nov.',
      location: 'Cirque de Gavarnie → Refuge de Bayssellance',
      stats: '42 km · 3 150 m D+ · Alpinisme PD+',
      spots: '6 / 8 inscrits',
      cover: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=80',
      leader: 'Camille Verdier',
      coords: [-0.1462, 42.7739],
      joined: true,
    },
    {
      id: 'out2',
      title: 'Bivouac Hivernal & Nivologie au Néouvielle',
      dateLabel: 'Sam. 22 – Dim. 23 Nov.',
      location: 'Lac d’Aubert · Pic du Néouvielle (3 091 m)',
      stats: '19 km · 1 420 m D+ · Atelier DVA & Igloo',
      spots: '9 / 12 inscrits',
      cover: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=600&auto=format&fit=crop&q=80',
      leader: 'Léa Guide',
      coords: [0.1194, 42.8392],
      joined: false,
    },
    {
      id: 'out3',
      title: 'Tour de l’Ossau en Marche Ultra-Légère',
      dateLabel: 'Sam. 29 – Dim. 30 Nov.',
      location: 'Bious-Artigues · Col d’Ayous',
      stats: '26 km · 1 680 m D+ · Baseweight < 5 kg',
      spots: '11 / 12 inscrits',
      cover: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&auto=format&fit=crop&q=80',
      leader: 'Romain Pyrénées',
      coords: [-0.4375, 42.8427],
      joined: false,
    },
    {
      id: 'out4',
      title: 'Grande Diagonale du Balaïtous & Crêtes',
      dateLabel: 'Sam. 6 – Dim. 7 Déc.',
      location: 'Plan d’Aste · Refuge Larribet',
      stats: '24 km · 2 100 m D+ · Casque & Crampons',
      spots: '5 / 6 inscrits',
      cover: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&auto=format&fit=crop&q=80',
      leader: 'Théo Montagne',
      coords: [-0.2839, 42.8386],
      joined: false,
    }
  ];

  let CLUB_MEMBERS = [
    {
      id: 'm1',
      name: 'Camille Verdier',
      handle: 'camille.v',
      role: 'Fondatrice · Guide Haute Montagne',
      isTeam: true,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      badge: '🏔️ 48 sorties club',
    },
    {
      id: 'm2',
      name: 'Léa Guide',
      handle: 'lea.uiagm',
      role: 'Modératrice · Référente Nivologie',
      isTeam: true,
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
      badge: '❄️ Formatrice DVA',
    },
    {
      id: 'm3',
      name: 'Romain Pyrénées',
      handle: 'romain.hrp',
      role: 'Modérateur · Cartographe GPX',
      isTeam: true,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
      badge: '🧭 32 traces certifiées',
    },
    {
      id: 'm4',
      name: 'Théo Montagne',
      handle: 'theo.alpi',
      role: 'Membre actif · Cordée Pyrénées',
      isTeam: false,
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
      badge: '⛺ 19 bivouacs',
    },
    {
      id: 'm5',
      name: 'Marc Cordée',
      handle: 'marc.mixte',
      role: 'Membre actif · Alpinisme Mixte',
      isTeam: false,
      avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&auto=format&fit=crop&q=80',
      badge: '⛏️ 14 courses d’arête',
    },
    {
      id: 'm6',
      name: 'Clara Bivouac',
      handle: 'clara.mul',
      role: 'Membre active · Marche Ultra-Légère',
      isTeam: false,
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
      badge: '🎒 3,8 kg baseweight',
    }
  ];

  let CLUB_GROUPS = [
    {
      id: 'grp1',
      name: 'Expédition HRP Intégrale — Été',
      destination: 'Hendaye → Banyuls (41 jours)',
      membersCount: 6,
      maxMembers: 8,
      status: 'Préparation logistique',
    },
    {
      id: 'grp2',
      name: 'Cordée 3 000 Pyrénéens — Hiver',
      destination: 'Vignemale, Balaïtous & Perdiguère',
      membersCount: 4,
      maxMembers: 6,
      status: 'Liste matériel ouverte',
    }
  ];

  const S = {
    club: { ...CLUB_PRESETS.cl1 },
    igTab: 0,
    clubDrawerTab: 'infos',
    membersTab: 'actifs',
    activeHighlight: 'all',
    sheet: null,
    sheetIdx: 0,
    sheetDet: 'card',
    sheetPayload: null,
    sheetHistory: [],
    activePostId: 'cp1',
    likedPosts: { cp1: true, cp3: true },
    savedPosts: { cp2: true },
    joinedOutings: { out1: true },
    postComments: {
      cp1: [
        { user: 'romain.hrp', text: 'Merci pour le retour nivologique ! On y monte demain à l’aube.', time: '2 h' },
        { user: 'lea.uiagm', text: 'Trace GPX validée, attention aux plaques à vent sous le col.', time: '1 h' },
      ],
      cp2: [
        { user: 'camille.v', text: 'Le bivouac face au Jean-Pierre reste imbattable.', time: '14 h' },
      ],
      cp3: [
        { user: 'marc.mixte', text: 'On prend 2 brins de 50 m à double pour la cordée 2.', time: '1 j' },
      ]
    },
    map3d: true,
    mapScale: 'region',
  };

  function q(sel) {
    return (rootContainer || document).querySelector(sel);
  }

  function qa(sel) {
    return Array.from((rootContainer || document).querySelectorAll(sel));
  }

  function showIsland(msg, dur = 2400) {
    const di = q('#di');
    const dt = q('#dit');
    if (!di || !dt) return;
    dt.textContent = msg;
    di.classList.add('on');
    clearTimeout(di._t);
    di._t = setTimeout(() => di.classList.remove('on'), dur);
  }

  function syncCardBounds() {
    const phone = q('#phone');
    const cardEl = q('#card');
    if (!phone || !cardEl) return;
    const pr = phone.getBoundingClientRect();
    const cr = cardEl.getBoundingClientRect();
    if (!pr.width || !cr.width) return;
    phone.style.setProperty('--card-top', Math.max(0, Math.round(cr.top - pr.top)) + 'px');
    phone.style.setProperty('--card-left', Math.max(0, Math.round(cr.left - pr.left)) + 'px');
    phone.style.setProperty('--card-right', Math.max(0, Math.round(pr.right - cr.right)) + 'px');
    phone.style.setProperty('--card-bottom', Math.max(0, Math.round(pr.bottom - cr.bottom)) + 'px');
    phone.style.setProperty('--card-radius', getComputedStyle(cardEl).borderRadius || '28px');
    positionIgTabsFloat();
  }

  function positionIgTabsFloat() {
    const cardEl = q('#card');
    const floatEl = q('#card > .ig-tabs-float');
    if (!cardEl || !floatEl) return;
    const activePanel = cardEl.querySelector('#ig-panel-0, #ig-panel-1');
    const targetEl = activePanel ? (activePanel.querySelector('.ig-grid, .ig-carnets') || activePanel) : null;
    if (!targetEl) {
      floatEl.style.bottom = '10px';
      return;
    }
    const cr = cardEl.getBoundingClientRect();
    const tr = targetEl.getBoundingClientRect();
    if (!cr.height || !tr.height) {
      floatEl.style.bottom = '10px';
      return;
    }
    const distFromBottom = Math.round(cr.bottom - tr.bottom);
    floatEl.style.bottom = Math.max(10, distFromBottom + 10) + 'px';
  }

  function card() {
    const D = S;
    const c = D.club;

    const topBar = renderTop(D);

    const joinLabel = c.isMember
      ? 'Membre du club ✓'
      : c.isPending
        ? 'Demande envoyée ⏳'
        : c.isPrivate
          ? 'Demander à rejoindre'
          : 'Rejoindre le club';

    const highlights = [
      { id: 'all', label: 'Tout le flux', icon: '✨' },
      { id: 'sorties', label: 'Sorties', icon: '🏔️' },
      { id: 'gpx', label: 'Traces GPX', icon: '🧭' },
      { id: 'matos', label: 'Matos club', icon: '⛺' },
      { id: 'charte', label: 'Charte', icon: '📜' },
    ];

    const hlHtml = highlights.map((h) => `
      <button class="ig-hl-item ${D.activeHighlight === h.id ? 'active' : ''}" data-a="filterHighlight" data-id="${esc(h.id)}">
        <div class="ig-hl-ring">
          <div class="ig-hl-inner">${h.icon}</div>
        </div>
        <span class="ig-hl-lbl">${esc(h.label)}</span>
      </button>
    `).join('') + `
      <button class="ig-hl-item" data-a="openCreate">
        <div class="ig-hl-ring add">
          <div class="ig-hl-inner">+</div>
        </div>
        <span class="ig-hl-lbl">Publier</span>
      </button>
    `;

    const igTabs = `<div class="ig-tabs" role="tablist" aria-label="Vue du club">
      <div class="ig-th" style="transform:translateX(${D.igTab === 0 ? '0%' : '100%'})"></div>
      <button class="ig-tab ${D.igTab === 0 ? 'on' : ''}" role="tab" aria-selected="${D.igTab === 0}" aria-label="Publications du club" data-a="igtab" data-i="0">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
      </button>
      <button class="ig-tab ${D.igTab === 1 ? 'on' : ''}" role="tab" aria-selected="${D.igTab === 1}" aria-label="Sorties et expéditions du club" data-a="igtab" data-i="1">
        <svg viewBox="0 0 24 24"><path d="M8 3l4 8 5-5 5 15H2L8 3z"/></svg>
      </button>
    </div>`;

    return `<div class="card-scroll">
      ${topBar}
      <div class="ig-header">
        <div class="ig-avi-wrap" data-a="sealzoom" title="Emblème & Empreinte collective certifiée">
          <div class="ig-avi-ring">
            <img class="ig-avi" src="${esc(c.avatar)}" alt="${esc(c.name)}" />
          </div>
          <div class="seal-mini" id="seal_badge" title="Club Vérifié LKDV">
            <svg viewBox="0 0 24 24"><path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.8-3.7 5.3-.8L12 2z"/></svg>
          </div>
        </div>
        <div class="ig-stats">
          <button class="ig-stat" data-a="igtab" data-i="0">
            <span class="ig-stat-v">${esc(CLUB_POSTS.length)}</span>
            <span class="ig-stat-l">publications</span>
          </button>
          <button class="ig-stat" data-a="openMembers">
            <span class="ig-stat-v">${esc(c.memberCount)}</span>
            <span class="ig-stat-l">membres</span>
          </button>
          <button class="ig-stat" data-a="igtab" data-i="1">
            <span class="ig-stat-v">${esc(CLUB_OUTINGS.length)}</span>
            <span class="ig-stat-l">sorties</span>
          </button>
        </div>
      </div>

      <div class="ig-bio">
        <div class="ig-name-row">
          <span class="ig-name">${esc(c.name)}</span>
          <span class="ig-role-pill">${esc(c.category)}</span>
        </div>
        <div class="ig-footprint-line" data-a="sealzoom">${esc(c.footprintLine)}</div>
        <div class="ig-bio-text">${esc(c.bio)}</div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
          <button class="reseau-btn ${c.isMember ? 'active' : 'primary'}" style="height:32px;padding:0 14px;font-size:12px;border-radius:999px;" data-a="toggleJoinClub">
            ${esc(joinLabel)}
          </button>
          <button class="reseau-btn" style="height:32px;padding:0 12px;font-size:12px;border-radius:999px;" data-a="openClubGroups">
            ⛺ Groupes (${esc(CLUB_GROUPS.length)})
          </button>
          <button class="reseau-btn" style="height:32px;padding:0 12px;font-size:12px;border-radius:999px;" data-a="shareClub">
            Partager
          </button>
        </div>
      </div>

      <div class="ig-hl-row">
        ${hlHtml}
      </div>

      ${renderIgTabContent(D)}
    </div><div class="ig-tabs-float">${igTabs}</div>`;
  }

  function renderTop(D) {
    const c = D.club;
    const statusLabel = c.isPrivate ? 'Club privé' : 'Club officiel';
    const memberBadge = c.isMember ? ' · Membre ✓' : c.isPending ? ' · En attente' : '';
    const pillHtml = `<span class="v-dot"></span><span>@${esc(c.handle)} · ${esc(statusLabel)}${esc(memberBadge)}</span>`;
    const rpvis = q('#rpvis');
    if (rpvis) rpvis.innerHTML = pillHtml;

    return `<div class="ig-top">
      <div class="ig-top-left">
        <button class="ibtn" data-a="goBack" aria-label="Retour aux clubs" title="Retour">
          <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button class="vpill" id="rpvis" data-a="openClubDrawer">
          <span class="v-dot"></span>
          <span>@${esc(c.handle)} · ${esc(statusLabel)}${esc(memberBadge)}</span>
        </button>
      </div>
      <div class="ig-top-actions">
        <button class="ibtn" data-a="openCreate" aria-label="Créer dans le club" title="Publier ou proposer une sortie">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <button class="ibtn" id="bdisplay" data-a="popv" aria-label="Réglages du verre" title="Apparence Liquid Glass">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
        </button>
        <button class="ibtn" data-a="openClubDrawer" aria-label="Infos, Groupes et Charte du club" title="Infos & Groupes du club">
          <svg viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></svg>
        </button>
      </div>
    </div>`;
  }

  function renderIgTabContent(D) {
    if (D.igTab === 0) {
      const posts = D.activeHighlight === 'all'
        ? CLUB_POSTS
        : CLUB_POSTS.filter((p) => p.tag === D.activeHighlight);

      const cells = posts.map((p) => `
        <div class="ig-cell" data-a="openPostModal" data-id="${esc(p.id)}">
          <img src="${esc(p.url)}" alt="${esc(p.location)}" loading="lazy" />
          <div class="ig-cell-badge">
            <span>📍 ${esc(p.elevation || p.location.split('·')[0].trim())}</span>
          </div>
          <div class="ig-cell-meta">
            <span>♥ ${esc(p.likes + (S.likedPosts[p.id] ? 1 : 0))}</span>
            <span>💬 ${esc((S.postComments[p.id] || []).length || p.comments)}</span>
          </div>
        </div>
      `).join('');

      return `<div class="ig-tab-panel" id="ig-panel-0">
        <div class="ig-grid">${cells || `<div style="grid-column:1/-1;padding:28px 16px;text-align:center;color:var(--t2);font-size:13px;font-weight:600;">Aucune publication dans cette rubrique pour le moment.</div>`}</div>
      </div>`;
    }

    const outingsHtml = CLUB_OUTINGS.map((o) => {
      const isJoined = !!S.joinedOutings[o.id];
      return `<div class="ig-carnet-card" data-a="focusOutingMap" data-id="${esc(o.id)}">
        <img class="ig-carnet-cov" src="${esc(o.cover)}" alt="${esc(o.title)}" loading="lazy" />
        <div class="ig-carnet-body">
          <div class="ig-carnet-kicker">${esc(o.dateLabel)} · Guide : ${esc(o.leader)}</div>
          <div class="ig-carnet-title">${esc(o.title)}</div>
          <div class="ig-carnet-sub">📍 ${esc(o.location)}</div>
          <div class="ig-carnet-stats">
            <span>${esc(o.stats)}</span>
            <span>👥 ${esc(o.spots)}</span>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="reseau-btn ${isJoined ? 'active' : 'primary'}" style="height:30px;padding:0 12px;font-size:11.5px;border-radius:999px;" data-a="toggleJoinOuting" data-id="${esc(o.id)}">
              ${isJoined ? 'Inscrit à la sortie ✓' : 'Participer à la sortie'}
            </button>
            <button class="reseau-btn" style="height:30px;padding:0 10px;font-size:11.5px;border-radius:999px;" data-a="focusOutingMap" data-id="${esc(o.id)}">
              Voir sur la carte 3D
            </button>
          </div>
        </div>
      </div>`;
    }).join('');

    return `<div class="ig-tab-panel" id="ig-panel-1">
      <div class="ig-carnets">
        ${outingsHtml}
      </div>
    </div>`;
  }

  const EXK = {
    club_drawer:()=> {
      const c = S.club;
      const tab = S.clubDrawerTab || 'infos';
      const idx = tab === 'infos' ? 0 : tab === 'groupes' ? 1 : 2;
      const grab = `<div class="sh-g" data-a="closeSheet"></div>`;
      const head = `<div class="sh-h">
        <div>
          <div class="sh-t">${esc(c.name)}</div>
          <div class="sh-s">@${esc(c.handle)} · ${esc(c.massif)}</div>
        </div>
        <button class="sh-x" data-a="closeSheet" aria-label="Fermer">✕</button>
      </div>`;

      const tabHeader = `<div class="segc lg-tabs" role="tablist" aria-label="Sections du club">
        <div class="sel-lens" style="width:calc((100% - 8px)/3);transform:translateX(${idx * 100}%)"></div>
        <button class="segb ${tab === 'infos' ? 'on' : ''}" role="tab" aria-selected="${tab === 'infos'}" aria-label="Infos et Charte" data-a="setClubDrawerTab" data-tab="infos">
          <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </button>
        <button class="segb ${tab === 'groupes' ? 'on' : ''}" role="tab" aria-selected="${tab === 'groupes'}" aria-label="Groupes et Logistique" data-a="setClubDrawerTab" data-tab="groupes">
          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </button>
        <button class="segb ${tab === 'moderation' ? 'on' : ''}" role="tab" aria-selected="${tab === 'moderation'}" aria-label="Modération et Paramètres" data-a="setClubDrawerTab" data-tab="moderation">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </div>`;

      const joinLabel = c.isMember ? 'Membre du club ✓' : c.isPending ? 'Demande en attente' : 'Rejoindre le club';
      const clubActions = `<div style="display:flex;gap:8px;margin:8px 0 12px;">
        <button class="reseau-btn ${c.isMember ? 'active' : 'primary'}" style="flex:1;height:36px;border-radius:12px;font-weight:700;" data-a="toggleJoinClub">
          ${esc(joinLabel)}
        </button>
        <button class="reseau-btn" style="height:36px;padding:0 14px;border-radius:12px;font-weight:600;" data-a="shareClub">
          Partager le club
        </button>
      </div>`;

      let body = '';
      if (tab === 'infos') {
        body = `<div class="sh-b">
          <div class="li nt" style="margin-bottom:10px;">
            <div class="li-t">📜 Charte & Esprit de Cordée</div>
            <div class="li-s" style="margin-top:4px;line-height:1.45;">${esc(c.charter)}</div>
          </div>
          <div class="li nt" style="margin-bottom:10px;">
            <div class="li-t">🏔️ Territoire & Massif principal</div>
            <div class="li-s" style="margin-top:4px;">${esc(c.massif)} · ${esc(c.footprintLine)}</div>
          </div>
          <div class="li nt" data-a="openMembers" style="cursor:pointer;margin-bottom:10px;">
            <div class="li-t">👥 Voir les ${esc(c.memberCount)} membres et l’équipe</div>
            <div class="li-s">Guides, modérateurs et cordées actives</div>
          </div>
          <div class="li nt">
            <div class="li-t" style="margin-bottom:6px;">🧭 Explorer les autres clubs officiels</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="reseau-btn ${c.id === 'cl1' ? 'active' : ''}" style="height:28px;padding:0 10px;border-radius:999px;font-size:11px;" data-a="switchClub" data-id="cl1">🏔️ Pyrénées</button>
              <button class="reseau-btn ${c.id === 'cl2' ? 'active' : ''}" style="height:28px;padding:0 10px;border-radius:999px;font-size:11px;" data-a="switchClub" data-id="cl2">⛏️ Chamonix Alpi</button>
              <button class="reseau-btn ${c.id === 'cl3' ? 'active' : ''}" style="height:28px;padding:0 10px;border-radius:999px;font-size:11px;" data-a="switchClub" data-id="cl3">⛺ Bivouac MUL</button>
            </div>
          </div>
        </div>`;
      } else if (tab === 'groupes') {
        const groupsList = CLUB_GROUPS.map((g) => `
          <div class="li nt" style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div class="li-t">⛺ ${esc(g.name)}</div>
              <span style="font-size:11px;font-weight:700;color:#17402C;">${esc(g.membersCount)}/${esc(g.maxMembers)} places</span>
            </div>
            <div class="li-s" style="margin-top:3px;">📍 ${esc(g.destination)} · ${esc(g.status)}</div>
          </div>
        `).join('');

        body = `<div class="sh-b">
          <div style="margin-bottom:10px;">
            <button class="reseau-btn primary" style="width:100%;height:38px;border-radius:12px;font-weight:700;" data-a="openCreateGroupModal">
              + Lancer un groupe de voyage depuis ce club
            </button>
          </div>
          ${groupsList}
        </div>`;
      } else {
        body = `<div class="sh-b">
          <div class="li nt" style="margin-bottom:10px;">
            <div class="li-t">🔔 Notifications des sorties & traces GPX</div>
            <div class="li-s">Alertes activées pour les nouvelles sorties du club</div>
          </div>
          <div class="li nt" style="margin-bottom:10px;">
            <div class="li-t">🛡️ Statut d’accès : ${c.isPrivate ? 'Sur validation des modérateurs' : 'Ouvert aux membres LKDV'}</div>
            <div class="li-s">Respect de la charte Leave No Trace et sécurité montagne</div>
          </div>
        </div>`;
      }

      return grab+head+tabHeader+clubActions+body;
    },

    members_sheet:()=> {
      const tab = S.membersTab || 'actifs';
      const idx = tab === 'actifs' ? 0 : 1;
      const list = tab === 'actifs' ? CLUB_MEMBERS : CLUB_MEMBERS.filter((m) => m.isTeam);

      const rows = list.map((m) => `
        <div class="li nt" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;cursor:pointer;" data-a="visitMember" data-handle="${esc(m.handle)}">
            <img src="${esc(m.avatar)}" alt="${esc(m.name)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;" />
            <div style="min-width:0;">
              <div class="li-t" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(m.name)}</div>
              <div class="li-s">@${esc(m.handle)} · ${esc(m.role)}</div>
            </div>
          </div>
          <span style="font-size:11px;font-weight:700;color:#17402C;white-space:nowrap;">${esc(m.badge)}</span>
        </div>
      `).join('');

      return `<div class="sh-g" data-a="closeSheet"></div>
        <div class="sh-h">
          <div>
            <div class="sh-t">Membres du Club (${esc(S.club.memberCount)})</div>
            <div class="sh-s">${esc(S.club.name)}</div>
          </div>
          <button class="sh-x" data-a="closeSheet" aria-label="Fermer">✕</button>
        </div>
        <div class="reseau-toggle" role="tablist" aria-label="Filtrer les membres">
          <div class="sel-lens" style="width:calc((100% - 8px)/2);transform:translateX(${idx * 100}%)"></div>
          <button class="segb ${tab === 'actifs' ? 'on' : ''}" role="tab" aria-selected="${tab === 'actifs'}" aria-label="Membres actifs" data-a="setMembersTab" data-tab="actifs">
            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </button>
          <button class="segb ${tab === 'equipe' ? 'on' : ''}" role="tab" aria-selected="${tab === 'equipe'}" aria-label="Équipe et Modérateurs" data-a="setMembersTab" data-tab="equipe">
            <svg viewBox="0 0 24 24"><path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.8-3.7 5.3-.8L12 2z"/></svg>
          </button>
        </div>
        <div class="sh-b" style="margin-top:10px;">
          ${rows}
        </div>`;
    },

    post_comments:()=> {
      const postId = (S.sheetPayload && S.sheetPayload.postId) || S.activePostId || 'cp1';
      const post = CLUB_POSTS.find((p) => p.id === postId) || CLUB_POSTS[0];
      const comments = S.postComments[post.id] || [];

      const items = comments.map((cm) => `
        <div class="li nt" style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="li-t">@${esc(cm.user)}</span>
            <span style="font-size:11px;color:var(--t3);">${esc(cm.time)}</span>
          </div>
          <div class="li-s" style="margin-top:4px;color:var(--t1);">${esc(cm.text)}</div>
        </div>
      `).join('');

      return `<div class="sh-g" data-a="closeSheet"></div>
        <div class="sh-h">
          <div style="display:flex;align-items:center;gap:10px;">
            <img src="${esc(post.url)}" alt="" style="width:36px;height:36px;border-radius:10px;object-fit:cover;" />
            <div>
              <div class="sh-t">Commentaires (${esc(comments.length)})</div>
              <div class="sh-s">${esc(post.location)}</div>
            </div>
          </div>
          <button class="sh-x" data-a="closeSheet" aria-label="Fermer">✕</button>
        </div>
        <div class="sh-b" style="display:flex;flex-direction:column;gap:8px;">
          ${items || `<div class="li nt"><div class="li-s">Soyez le premier membre à commenter cette publication.</div></div>`}
          <div style="display:flex;gap:8px;margin-top:8px;">
            <input id="sheet_comment_input" type="text" placeholder="Ajouter un commentaire au club…" style="flex:1;height:38px;border-radius:999px;border:1px solid rgba(255,255,255,0.85);background:rgba(255,255,255,0.75);padding:0 14px;font-size:13px;color:var(--t1);outline:none;" />
            <button class="reseau-btn primary" style="height:38px;padding:0 16px;border-radius:999px;" data-a="submitPostComment" data-id="${esc(post.id)}">Publier</button>
          </div>
        </div>`;
    },

    create_menu: () => {
      return `<div class="sh-g" data-a="closeSheet"></div>
        <div class="sh-h">
          <div>
            <div class="sh-t">Contribuer au Club</div>
            <div class="sh-s">${esc(S.club.name)}</div>
          </div>
          <button class="sh-x" data-a="closeSheet" aria-label="Fermer">✕</button>
        </div>
        <div class="sh-b" style="display:flex;flex-direction:column;gap:10px;">
          <div class="li nt" style="cursor:pointer;" data-a="createAction" data-type="post">
            <div class="li-t">📸 Publier une photo ou retour de course</div>
            <div class="li-s">Partager les conditions terrain et photos géolocalisées sur la carte 3D</div>
          </div>
          <div class="li nt" style="cursor:pointer;" data-a="createAction" data-type="outing">
            <div class="li-t">🏔️ Proposer une sortie club</div>
            <div class="li-s">Définir une date, un itinéraire GPX et ouvrir les inscriptions</div>
          </div>
          <div class="li nt" style="cursor:pointer;" data-a="openCreateGroupModal">
            <div class="li-t">⛺ Lancer un groupe d’expédition depuis le club</div>
            <div class="li-s">Créer une tribu de voyage liée avec matériel et logistique partagés</div>
          </div>
          <div class="li nt" style="cursor:pointer;" data-a="createAction" data-type="gpx">
            <div class="li-t">🧭 Déposer une trace GPX certifiée</div>
            <div class="li-s">Enrichir la cartothèque 3D du massif (${esc(S.club.massif)})</div>
          </div>
        </div>`;
    }
  };

  function openSheet(key, idx = 0, det = 'card', payload = null) {
    S.sheet = key;
    S.sheetIdx = idx;
    S.sheetDet = det || 'card';
    S.sheetPayload = payload;
    renderSheet();
    syncCardBounds();
  }

  function closeSheet() {
    S.sheet = null;
    S.sheetPayload = null;
    const sh = q('#sheet');
    if (sh) {
      sh.classList.remove('open');
      sh.removeAttribute('data-det');
    }
  }

  function renderSheet() {
    const sh = q('#sheet');
    if (!sh) return;
    if (!S.sheet || !EXK[S.sheet]) {
      sh.classList.remove('open');
      return;
    }
    sh.setAttribute('data-det', S.sheetDet || 'card');
    sh.innerHTML = EXK[S.sheet]();
    sh.classList.add('open');
  }

  function renderPostModal(postId) {
    const post = CLUB_POSTS.find((p) => p.id === postId) || CLUB_POSTS[0];
    if (!post) return '';
    const isLiked = !!S.likedPosts[post.id];
    const isSaved = !!S.savedPosts[post.id];
    const commentsCount = (S.postComments[post.id] || []).length || post.comments || 0;

    return `<div class="pmi-dialog" role="dialog" aria-modal="true" aria-label="Publication du club">
      <div class="pmi-grabber" data-a="closePostModal"></div>
      <div class="pmi-header pmi-topbar">
        <div class="pmi-profile-pill" data-a="visitMember" data-handle="${esc(post.authorHandle || S.club.handle)}">
          <img class="pmi-avatar" src="${esc(post.authorAvatar || S.club.avatar)}" alt="${esc(post.authorName || S.club.name)}" />
          <div class="pmi-user-meta">
            <div class="pmi-username">${esc(post.authorName || S.club.name)}</div>
            <div class="pmi-location">📍 ${esc(post.location)}</div>
          </div>
        </div>
        <button class="pmi-more-pill" data-a="closePostModal" aria-label="Fermer la publication">✕</button>
      </div>
      <div class="pmi-scroll-area">
        <div class="pmi-media">
          <img class="pmi-img" src="${esc(post.url)}" alt="${esc(post.location)}" />
          <div class="pmi-action-pill pmi-actions">
            <button class="pmi-act-btn ${isLiked ? 'liked' : ''}" data-a="likePost" data-id="${esc(post.id)}" aria-label="Aimer">
              <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
            <button class="pmi-act-btn" data-a="openPostComments" data-id="${esc(post.id)}" aria-label="Commentaires (${esc(commentsCount)})">
              <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            </button>
            <button class="pmi-act-btn" data-a="sharePost" data-id="${esc(post.id)}" aria-label="Partager">
              <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
            <button class="pmi-act-btn ${isSaved ? 'saved' : ''}" data-a="savePost" data-id="${esc(post.id)}" aria-label="Enregistrer">
              <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
          </div>
          <div class="pmi-caption-pill">
            <strong>@${esc(post.authorHandle || S.club.handle)}</strong> ${esc(post.caption)}
          </div>
        </div>
      </div>
      <div class="pmi-comment-bar">
        <input id="pmi_comment_input" class="pmi-comment-input" type="text" placeholder="Commenter dans ${esc(S.club.name)}…" />
        <button class="pmi-comment-send" data-a="submitPostComment" data-id="${esc(post.id)}">Publier</button>
      </div>
    </div>`;
  }

  function render() {
    const cardEl = q('#card');
    if (cardEl) {
      cardEl.innerHTML = card();
    }
    if (S.sheet) {
      renderSheet();
    }
    syncCardBounds();
  }

  function flyToCoords(coords, label) {
    if (mapInstance && Array.isArray(coords) && coords.length === 2) {
      try {
        mapInstance.flyTo({
          center: coords,
          zoom: 12.4,
          pitch: S.map3d ? 62 : 0,
          bearing: -18,
          duration: 1200,
        });
      } catch (_e) {}
    }
    if (label) {
      showIsland(`🧭 ${label}`);
    }
  }

  const EXA = {
    goBack: () => {
      if (window.__lkdvClubNavigateBack) {
        window.__lkdvClubNavigateBack();
      } else if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/communaute';
      }
    },
    igtab: (_el, ds) => {
      S.igTab = Number(ds.i || 0);
      render();
    },
    filterHighlight: (_el, ds) => {
      S.activeHighlight = ds.id || 'all';
      S.igTab = 0;
      render();
      showIsland(S.activeHighlight === 'all' ? 'Flux complet du club' : `Filtre : ${S.activeHighlight}`);
    },
    openClubDrawer: () => {
      S.clubDrawerTab = 'infos';
      openSheet('club_drawer', 0, 'card');
    },
    switchClub: (_el, ds) => {
      const targetId = ds.id || 'cl1';
      if (CLUB_PRESETS[targetId]) {
        S.club = { ...CLUB_PRESETS[targetId] };
        closeSheet();
        render();
        flyToCoords(S.club.coords, S.club.name);
      }
    },
    openClubGroups: () => {
      S.clubDrawerTab = 'groupes';
      openSheet('club_drawer', 1, 'card');
    },
    setClubDrawerTab: (_el, ds) => {
      S.clubDrawerTab = ds.tab || 'infos';
      renderSheet();
    },
    openMembers: () => {
      S.membersTab = 'actifs';
      openSheet('members_sheet', 0, 'card');
    },
    setMembersTab: (_el, ds) => {
      S.membersTab = ds.tab || 'actifs';
      renderSheet();
    },
    openCreate: () => {
      openSheet('create_menu', 0, 'card');
    },
    closeSheet: () => {
      closeSheet();
    },
    sealzoom: () => {
      const m = q('#seal_modal');
      if (m) m.classList.add('open');
    },
    closeseal: () => {
      const m = q('#seal_modal');
      if (m) m.classList.remove('open');
    },
    popv: () => {
      const vp = q('#vpop');
      if (vp) vp.classList.toggle('open');
    },
    toggleJoinClub: async () => {
      if (typeof window.__lkdvMutateClubMembership === 'function') {
        await window.__lkdvMutateClubMembership(S.club);
        return;
      }
      if (S.club.isMember) {
        S.club.isMember = false;
        S.club.memberCount = Math.max(1, (S.club.memberCount || 1) - 1);
        showIsland(`Vous avez quitté ${S.club.name}`);
      } else if (S.club.isPrivate) {
        S.club.isPending = !S.club.isPending;
        showIsland(S.club.isPending ? 'Demande d’adhésion envoyée aux modérateurs' : 'Demande annulée');
      } else {
        S.club.isMember = true;
        S.club.memberCount = (S.club.memberCount || 0) + 1;
        showIsland(`Bienvenue dans ${S.club.name} ✓`);
      }
      render();
    },
    shareClub: async () => {
      const url = window.location.href;
      if (navigator.share) {
        try {
          await navigator.share({ title: S.club.name, text: S.club.bio, url });
          return;
        } catch (_e) {}
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(url);
        } catch (_e) {}
      }
      showIsland('Lien du club copié dans le presse-papiers ✓');
    },
    toggleJoinOuting: async (_el, ds) => {
      const id = ds.id;
      if (!id) return;
      const out = CLUB_OUTINGS.find((o) => o.id === id);
      if (typeof window.__lkdvMutateClubOuting === 'function') {
        await window.__lkdvMutateClubOuting(id, !S.joinedOutings[id]);
      }
      S.joinedOutings[id] = !S.joinedOutings[id];
      render();
      if (out) {
        showIsland(S.joinedOutings[id] ? `Inscrit : ${out.title} ✓` : `Inscription retirée : ${out.title}`);
        if (out.coords) flyToCoords(out.coords, out.location);
      }
    },
    focusOutingMap: (_el, ds) => {
      const out = CLUB_OUTINGS.find((o) => o.id === ds.id);
      if (out && out.coords) {
        flyToCoords(out.coords, out.title);
      }
    },
    openPostModal: (_el, ds) => {
      const id = ds.id || 'cp1';
      S.activePostId = id;
      const pm = q('#post_modal_instagram');
      if (!pm) return;
      syncCardBounds();
      pm.innerHTML = renderPostModal(id);
      pm.classList.add('open');
      const post = CLUB_POSTS.find((p) => p.id === id);
      if (post && post.coords) {
        flyToCoords(post.coords, post.location);
      }
    },
    closePostModal: () => {
      const pm = q('#post_modal_instagram');
      if (pm) pm.classList.remove('open');
    },
    likePost: async (_el, ds) => {
      const id = ds.id || S.activePostId;
      S.likedPosts[id] = !S.likedPosts[id];
      if (typeof window.__lkdvMutateClubLike === 'function') {
        window.__lkdvMutateClubLike(id, S.likedPosts[id]);
      }
      const pm = q('#post_modal_instagram');
      if (pm && pm.classList.contains('open')) {
        pm.innerHTML = renderPostModal(id);
      }
      render();
    },
    savePost: (_el, ds) => {
      const id = ds.id || S.activePostId;
      S.savedPosts[id] = !S.savedPosts[id];
      const pm = q('#post_modal_instagram');
      if (pm && pm.classList.contains('open')) {
        pm.innerHTML = renderPostModal(id);
      }
      showIsland(S.savedPosts[id] ? 'Publication enregistrée dans vos favoris' : 'Retirée des favoris');
    },
    sharePost: async (_el, ds) => {
      const id = ds.id || S.activePostId;
      const post = CLUB_POSTS.find((p) => p.id === id);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(window.location.href);
        } catch (_e) {}
      }
      showIsland(`Lien de "${post ? post.location : 'la publication'}" copié ✓`);
    },
    openPostComments:(id)=> {
      const resolvedId = typeof id === 'string' ? id : (id && id.dataset && id.dataset.id) || S.activePostId || 'cp1';
      const pm = q('#post_modal_instagram');
      if (pm) pm.classList.remove('open');
      openSheet('post_comments',0,'card',{postId:id});
      S.sheetPayload = { postId: resolvedId };
      renderSheet();
    },
    submitPostComment:(id)=> {
      const postId = typeof id === 'string' ? id : (id && id.dataset && id.dataset.id) || S.activePostId || 'cp1';
      const inputEl = q('#sheet_comment_input') || q('#pmi_comment_input');
      const text = inputEl ? inputEl.value.trim() : '';
      if (!text) return;
      if (!S.postComments[postId]) S.postComments[postId] = [];
      S.postComments[postId].push({ user: 'vous', text, time: 'À l’instant' });
      if (inputEl) inputEl.value = '';
      if (typeof window.__lkdvMutateClubComment === 'function') {
        window.__lkdvMutateClubComment(postId, text);
      }
      if (S.sheet === 'post_comments') {
        renderSheet();
      } else {
        openSheet('post_comments',0,'card',{postId:postId});
      }
      render();
      showIsland('Commentaire publié dans le club ✓');
    },
    visitMember: (_el, ds) => {
      const h = ds.handle;
      if (h && typeof window.__lkdvVisitProfile === 'function') {
        window.__lkdvVisitProfile(h);
      } else if (h) {
        window.location.href = `/profil/${ encodeURIComponent(h) }`;
      }
    },
    openCreateGroupModal: () => {
      closeSheet();
      if (typeof window.__lkdvOpenCreateGroupModal === 'function') {
        window.__lkdvOpenCreateGroupModal(S.club);
      } else {
        showIsland('Ouverture de la création de groupe d’expédition…');
      }
    },
    createAction: (_el, ds) => {
      const type = ds.type || 'post';
      closeSheet();
      if (typeof window.__lkdvOpenClubCreateModal === 'function') {
        window.__lkdvOpenClubCreateModal(type, S.club);
      } else {
        showIsland(`Nouvelle contribution : ${type}`);
      }
    },
    mcenter: () => {
      flyToCoords(S.club.coords || [-0.045, 42.785], S.club.massif || S.club.name);
    },
    m3d: () => {
      S.map3d = !S.map3d;
      const btn = q('#b3d');
      if (btn) btn.classList.toggle('active', S.map3d);
      if (mapInstance) {
        try {
          mapInstance.easeTo({ pitch: S.map3d ? 60 : 0, duration: 600 });
        } catch (_e) {}
      }
      showIsland(S.map3d ? 'Relief 3D activé' : 'Vue 2D zénithale');
    },
    setscale: (_el, ds) => {
      const sc = ds.scale || 'region';
      S.mapScale = sc;
      qa('.map-scale-btn').forEach((b) => b.classList.toggle('active', b.getAttribute('data-scale') === sc));
      const zoomMap = { local: 12.8, region: 10.6, pays: 5.8, monde: 2.4 };
      if (mapInstance) {
        try {
          mapInstance.flyTo({
            center: S.club.coords || [-0.045, 42.785],
            zoom: zoomMap[sc] || 10.6,
            duration: 900,
          });
        } catch (_e) {}
      }
    }
  };

  function setup3DMap() {
    const container = q('#maplibre-compte-canvas');
    if (!container || typeof window.maplibregl === 'undefined') return;
    try {
      const center = S.club.coords || [-0.045, 42.785];
      mapInstance = new window.maplibregl.Map({
        container,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center,
        zoom: S.club.zoom || 10.6,
        pitch: 58,
        bearing: -12,
        attributionControl: false,
      });
    } catch (_e) {}
  }

  function handleDocClick(e) {
    const target = e.target.closest('[data-a]');
    if (!target) return;
    const action = target.getAttribute('data-a');
    if (!action) return;
    e.stopPropagation();
    const fn = EXA[action];
    if (typeof fn === 'function') {
      fn(target, target.dataset || {});
    }
  }

  window.__lkdvHydrateClub = function (payload) {
    if (!payload) return;
    if (payload.presetKey && CLUB_PRESETS[payload.presetKey]) {
      S.club = { ...CLUB_PRESETS[payload.presetKey], ...(payload.club || {}) };
    } else if (payload.club) {
      S.club = { ...S.club, ...payload.club };
    }
    if (Array.isArray(payload.posts) && payload.posts.length > 0) {
      CLUB_POSTS = payload.posts;
    }
    if (Array.isArray(payload.outings) && payload.outings.length > 0) {
      CLUB_OUTINGS = payload.outings;
    }
    if (Array.isArray(payload.members) && payload.members.length > 0) {
      CLUB_MEMBERS = payload.members;
    }
    if (Array.isArray(payload.groups)) {
      CLUB_GROUPS = payload.groups;
    }
    if (typeof payload.initialTab === 'number') {
      S.igTab = payload.initialTab;
    }
    if (payload.openGroupsDrawer) {
      S.clubDrawerTab = 'groupes';
      openSheet('club_drawer', 1, 'card');
    }
    render();
    if (S.club.coords) {
      flyToCoords(S.club.coords);
    }
  };

  const root = rootContainer || document;
  root.addEventListener('click', handleDocClick);
  cleanupFns.push(() => root.removeEventListener('click', handleDocClick));

  const onResize = () => syncCardBounds();
  window.addEventListener('resize', onResize);
  cleanupFns.push(() => window.removeEventListener('resize', onResize));

  render();
  setTimeout(() => {
    syncCardBounds();
    setup3DMap();
  }, 60);

  return () => {
    cleanupFns.forEach((fn) => {
      try {
        fn();
      } catch (_e) {}
    });
    if (mapInstance) {
      try {
        mapInstance.remove();
      } catch (_e) {}
      mapInstance = null;
    }
  };
}
