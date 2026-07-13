import { NextRequest, NextResponse } from 'next/server';
import { completion } from '@rocketnew/llm-sdk';
import fs from 'fs';
import path from 'path';
import type { CountryDataV2 } from '@/types/country';

const CACHE_DIR = path.join(process.cwd(), '.country-cache');
const CACHE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCacheFilePath(code: string) {
  return path.join(CACHE_DIR, `${code.toLowerCase()}.json`);
}

interface CacheEnvelope {
  version: 'v2';
  generated_at: string;
  valid_until: string;
  data: CountryDataV2;
}

function readFromCache(code: string): CountryDataV2 | null {
  try {
    const filePath = getCacheFilePath(code);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const envelope = JSON.parse(raw) as CacheEnvelope;
      // Support both v2 envelope and legacy flat format
      if (envelope.version === 'v2' && envelope.data) {
        const validUntil = new Date(envelope.valid_until).getTime();
        if (Date.now() < validUntil) {
          return envelope.data;
        }
        // Cache expired — delete it
        fs.unlinkSync(filePath);
        return null;
      }
      // Legacy v1 cache — ignore, will regenerate
      return null;
    }
  } catch {
    // cache miss or corrupt
  }
  return null;
}

function writeToCache(code: string, data: CountryDataV2) {
  try {
    ensureCacheDir();
    const now = new Date();
    const validUntil = new Date(now.getTime() + CACHE_TTL_MS);
    const envelope: CacheEnvelope = {
      version: 'v2',
      generated_at: now.toISOString(),
      valid_until: validUntil.toISOString(),
      data,
    };
    const filePath = getCacheFilePath(code);
    fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), 'utf-8');
  } catch {
    // non-fatal
  }
}

// ─── V2 TYPE DEFINITIONS ───────────────────────────────────────────────────

// Re-export from shared types file
export type { CountryDataV2 } from '@/types/country';

// ─── LEGACY V1 TYPE (kept for backward compat in CountryPageClient) ────────
export interface CountryAIData {
  code: string;
  nom: string;
  continent: string;
  capital: string;
  coordonnees: string;
  fuseau: string;
  monnaie: string;
  langues: string[];
  population: string;
  superficie: string;
  danger_global: number;
  danger_details: { label: string; level: 'low' | 'medium' | 'high'; note: string }[];
  calendrier: {
    month: string; short: string; status: 'good' | 'medium' | 'bad';
    temp_min: number; temp_max: number; rain_mm: number; description: string;
  }[];
  infos_pratiques: { icon: string; label: string; value: string }[];
  lieux: { nom: string; description: string }[];
  kits_recommandes: { nom: string; poids_g: number; prix_cents: number; slug: string; description: string }[];
  events: { mois: string; titre: string; type: 'festival' | 'saison' | 'eviter' }[];
  // V2 enrichment fields (optional for backward compat)
  v2?: CountryDataV2;
}

// ─── SYSTEM PROMPT ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu génères le contenu structuré d'une fiche pays pour Le Kit du Voyageur, en JSON strict.

RÈGLES NON NÉGOCIABLES :
1. SÉCURITÉ & SANTÉ : Génère des données basées sur les informations officielles connues (France Diplomatie pour la sécurité, OMS/Pasteur pour la santé). Si incertain, marque statut "non_verifie".
2. MÉTÉO : Données climatiques mensuelles réelles. Si estimation, indique-le dans source.
3. VOLS : Uniquement tendance par saison (bas/moyen/haut), jamais de prix précis. Statut toujours "indicatif".
4. CARBONE : Estimation basée sur distance Paris → destination × facteur aviation moyen (0.255 kg CO2/km/passager). Statut toujours "estimation".
5. FAQ : Questions dérivées des données réelles de la fiche (sécurité, visa, météo, budget) — jamais génériques.
6. PAYS SIMILAIRES : Basé sur similarité climatique et type d'activités, pas uniquement géographique.
7. CONTENU NON GÉNÉRIQUE : Chaque section doit contenir un détail spécifique et vérifiable à ce pays.

Réponds UNIQUEMENT avec le JSON brut, sans markdown, sans backticks, sans commentaires.`;

function buildV2Prompt(countryCode: string, nationalite = 'France'): string {
  const now = new Date().toISOString();
  const validUntil = new Date(Date.now() + CACHE_TTL_MS).toISOString();

  return `Génère la fiche pays complète pour le code ISO alpha-2 "${countryCode.toUpperCase()}" (nationalité visiteur : ${nationalite}).

Réponds UNIQUEMENT avec ce JSON strict (sans markdown, sans backticks) :

{
  "pays": {"nom": "", "code_iso": "${countryCode.toUpperCase()}", "continent": ""},
  "meteo": {
    "calendrier_12_mois": [
      {"mois": "Janvier", "temp_min_c": 0, "temp_max_c": 0, "precipitations_mm": 0, "niveau": "ideal|bon|moyen|deconseille", "affluence": "faible|moyenne|forte"},
      {"mois": "Février", "temp_min_c": 0, "temp_max_c": 0, "precipitations_mm": 0, "niveau": "ideal|bon|moyen|deconseille", "affluence": "faible|moyenne|forte"},
      {"mois": "Mars", "temp_min_c": 0, "temp_max_c": 0, "precipitations_mm": 0, "niveau": "ideal|bon|moyen|deconseille", "affluence": "faible|moyenne|forte"},
      {"mois": "Avril", "temp_min_c": 0, "temp_max_c": 0, "precipitations_mm": 0, "niveau": "ideal|bon|moyen|deconseille", "affluence": "faible|moyenne|forte"},
      {"mois": "Mai", "temp_min_c": 0, "temp_max_c": 0, "precipitations_mm": 0, "niveau": "ideal|bon|moyen|deconseille", "affluence": "faible|moyenne|forte"},
      {"mois": "Juin", "temp_min_c": 0, "temp_max_c": 0, "precipitations_mm": 0, "niveau": "ideal|bon|moyen|deconseille", "affluence": "faible|moyenne|forte"},
      {"mois": "Juillet", "temp_min_c": 0, "temp_max_c": 0, "precipitations_mm": 0, "niveau": "ideal|bon|moyen|deconseille", "affluence": "faible|moyenne|forte"},
      {"mois": "Août", "temp_min_c": 0, "temp_max_c": 0, "precipitations_mm": 0, "niveau": "ideal|bon|moyen|deconseille", "affluence": "faible|moyenne|forte"},
      {"mois": "Septembre", "temp_min_c": 0, "temp_max_c": 0, "precipitations_mm": 0, "niveau": "ideal|bon|moyen|deconseille", "affluence": "faible|moyenne|forte"},
      {"mois": "Octobre", "temp_min_c": 0, "temp_max_c": 0, "precipitations_mm": 0, "niveau": "ideal|bon|moyen|deconseille", "affluence": "faible|moyenne|forte"},
      {"mois": "Novembre", "temp_min_c": 0, "temp_max_c": 0, "precipitations_mm": 0, "niveau": "ideal|bon|moyen|deconseille", "affluence": "faible|moyenne|forte"},
      {"mois": "Décembre", "temp_min_c": 0, "temp_max_c": 0, "precipitations_mm": 0, "niveau": "ideal|bon|moyen|deconseille", "affluence": "faible|moyenne|forte"}
    ],
    "source": "Données climatiques officielles / estimation climatique générale",
    "derniere_maj": "${now.slice(0, 10)}"
  },
  "securite": {
    "zones": [
      {"nom_zone": "Nom de la zone ou 'Ensemble du territoire'", "niveau": "sur|vigilance|deconseille_sauf_raison_imperative|formellement_deconseille", "description": "Description précise basée sur France Diplomatie"}
    ],
    "source_officielle": {"nom": "France Diplomatie", "url": "https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/conseils-par-pays-destination/"},
    "derniere_synchronisation": "${now.slice(0, 10)}",
    "statut": "verifie|non_verifie",
    "ambassade_consulat": {"nom": "Ambassade de France à [capitale]", "telephone": "+XX X XX XX XX XX", "url": "https://..."}
  },
  "sante": {
    "risques": ["Risque 1 spécifique à ce pays", "Risque 2"],
    "vaccins_recommandes": ["Vaccin 1", "Vaccin 2"],
    "vaccins_obligatoires": [],
    "eau_potable": "oui|non|a_traiter|non_verifie",
    "source": "Institut Pasteur / OMS / Santé Voyageurs",
    "derniere_maj": "${now.slice(0, 10)}",
    "statut": "verifie|non_verifie"
  },
  "connectivite": {
    "couverture_mobile": "bonne|moyenne|faible|non_verifie",
    "wifi_disponibilite": "Description de la disponibilité WiFi dans les villes et zones touristiques",
    "statut": "verifie|estimation"
  },
  "pratique": {
    "visa": {
      "nationalite": "${nationalite}",
      "regle": "Description précise des conditions d'entrée pour ressortissants ${nationalite}",
      "duree_sejour_sans_visa": "Ex: 90 jours / visa requis / e-visa disponible"
    },
    "monnaie": "Nom complet (CODE) — ex: Euro (EUR)",
    "prise_electrique": {"type": "Type A/B/C/etc.", "voltage": "220V/110V 50Hz/60Hz"},
    "langues": ["Langue officielle 1", "Langue 2"],
    "phrases_survie": [
      {"fr": "Bonjour", "locale": "Traduction phonétique locale"},
      {"fr": "Merci", "locale": "Traduction phonétique locale"},
      {"fr": "Au revoir", "locale": "Traduction phonétique locale"},
      {"fr": "Où sont les toilettes ?", "locale": "Traduction phonétique locale"},
      {"fr": "Combien ça coûte ?", "locale": "Traduction phonétique locale"}
    ],
    "decalage_horaire_utc": "UTC+X (heure de Paris : +X ou -X heures)",
    "budget_quotidien_repere_eur": {
      "petit": {"logement": 0, "nourriture": 0, "transport": 0},
      "moyen": {"logement": 0, "nourriture": 0, "transport": 0},
      "gros": {"logement": 0, "nourriture": 0, "transport": 0}
    }
  },
  "vols": {
    "tendance_par_saison": [
      {"periode": "Haute saison (mois)", "niveau_prix": "haut"},
      {"periode": "Basse saison (mois)", "niveau_prix": "bas"},
      {"periode": "Épaule (mois)", "niveau_prix": "moyen"}
    ],
    "statut": "indicatif"
  },
  "carbone": {
    "vol_paris_kg_co2_estime": 0,
    "methodologie": "Distance Paris–[capitale] × 2 (aller-retour) × 0.255 kg CO2/km/passager (facteur ADEME aviation moyen-courrier/long-courrier)",
    "statut": "estimation"
  },
  "evenements": [
    {"nom": "Nom de l'événement", "periode": "Mois ou période", "description": "Description spécifique à ce pays"}
  ],
  "lieux_incontournables": [
    {"nom": "Lieu 1", "description": "Description spécifique et vérifiable", "lat": 0.0, "lng": 0.0},
    {"nom": "Lieu 2", "description": "Description spécifique et vérifiable", "lat": 0.0, "lng": 0.0},
    {"nom": "Lieu 3", "description": "Description spécifique et vérifiable", "lat": 0.0, "lng": 0.0},
    {"nom": "Lieu 4", "description": "Description spécifique et vérifiable", "lat": 0.0, "lng": 0.0},
    {"nom": "Lieu 5", "description": "Description spécifique et vérifiable", "lat": 0.0, "lng": 0.0}
  ],
  "coutumes": "Paragraphe court sur les coutumes locales importantes, spécifique à ce pays",
  "kits_recommandes_tags_climat": ["tag1", "tag2", "tag3"],
  "gabarit_poids_recommande": {
    "poids_total_kg": 0,
    "justification": "Justification basée sur le type de voyage et le climat de ce pays"
  },
  "pays_similaires": [
    {"code_iso": "XX", "nom": "Pays similaire 1", "raison": "Raison basée sur similarité climatique/activités"},
    {"code_iso": "XX", "nom": "Pays similaire 2", "raison": "Raison basée sur similarité climatique/activités"},
    {"code_iso": "XX", "nom": "Pays similaire 3", "raison": "Raison basée sur similarité climatique/activités"}
  ],
  "faq": [
    {"question": "Question dérivée des données visa/sécurité réelles de cette fiche", "reponse": "Réponse précise"},
    {"question": "Question dérivée des données météo/budget réelles de cette fiche", "reponse": "Réponse précise"},
    {"question": "Question dérivée des données santé/vaccins réelles de cette fiche", "reponse": "Réponse précise"},
    {"question": "Question dérivée des données pratiques réelles de cette fiche", "reponse": "Réponse précise"}
  ],
  "meta": {
    "genere_le": "${now}",
    "cache_valide_jusqu_au": "${validUntil}"
  }
}

CONTRAINTES STRICTES :
- niveau dans calendrier_12_mois : exactement "ideal", "bon", "moyen" ou "deconseille" - affluence : exactement"faible", "moyenne" ou "forte"
- niveau dans securite.zones : exactement "sur", "vigilance", "deconseille_sauf_raison_imperative" ou "formellement_deconseille"
- statut securite/sante : exactement "verifie" ou "non_verifie"
- eau_potable : exactement "oui", "non", "a_traiter" ou "non_verifie"
- couverture_mobile : exactement "bonne", "moyenne", "faible" ou "non_verifie"
- niveau_prix vols : exactement "bas", "moyen" ou "haut" - vols.statut : toujours"indicatif" - carbone.statut : toujours"estimation"
- carbone.vol_paris_kg_co2_estime : nombre entier (kg CO2 aller-retour)
- budget en EUR (entiers)
- lat/lng : coordonnées GPS réelles (décimales)
- Adapte TOUTES les données au pays réel "${countryCode.toUpperCase()}"
- Réponds UNIQUEMENT avec le JSON, sans aucun texte avant ou après`;
}

// ─── SUPABASE SYNC LOG ─────────────────────────────────────────────────────

async function upsertSyncLog(
  code: string,
  status: 'ok' | 'error' | 'pending',
  validUntil: string,
  payloadSize?: number,
  errorMessage?: string
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return;

    await fetch(`${supabaseUrl}/rest/v1/country_sync_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        code_iso: code.toUpperCase(),
        synced_at: new Date().toISOString(),
        cache_valid_until: validUntil,
        status,
        schema_version: 'v2',
        generated_by: 'gemini/gemini-2.5-flash',
        nationalite: 'France',
        payload_size_bytes: payloadSize,
        error_message: errorMessage || null,
      }),
    });
  } catch {
    // non-fatal — sync log failure should not break the response
  }
}

// ─── ROUTE HANDLER ─────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  if (!checkRateLimit(ip, 30, 60_000)) {
    return NextResponse.json({ error: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429 });
  }

  const { code: rawCode } = await params;
  const code = rawCode.toLowerCase();

  if (!/^[a-z]{2}$/.test(code)) {
    return NextResponse.json({ error: 'Code pays invalide' }, { status: 400 });
  }

  // Check force-refresh param (admin use)
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1';

  // Check cache first (unless force-refresh)
  if (!forceRefresh) {
    const cached = readFromCache(code);
    if (cached) {
      return NextResponse.json(
        { data: cached, cached: true, schema: 'v2' },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
          },
        }
      );
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Service temporairement indisponible' },
      { status: 503 }
    );
  }

  try {
    const response = await completion({
      model: 'gemini/gemini-2.5-flash',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildV2Prompt(code) },
      ],
      stream: false,
      api_key: apiKey,
      temperature: 0.2,
      max_tokens: 8000,
    });

    interface CompletionResponse {
      choices?: { message?: { content?: string } }[];
    }
    const content = (response as CompletionResponse).choices?.[0]?.message?.content;
    if (!content) {
      await upsertSyncLog(code, 'error', new Date().toISOString(), 0, 'Empty response from Gemini');
      return NextResponse.json({ error: 'Données indisponibles' }, { status: 500 });
    }

    // Clean and parse JSON
    let jsonStr = content.trim();
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

    const countryData: CountryDataV2 = JSON.parse(jsonStr) as CountryDataV2;

    // Ensure code is set correctly
    countryData.pays.code_iso = code.toUpperCase();

    // Save to cache
    writeToCache(code, countryData);

    // Update sync log
    const payloadSize = Buffer.byteLength(jsonStr, 'utf-8');
    const validUntil = new Date(Date.now() + CACHE_TTL_MS).toISOString();
    await upsertSyncLog(code, 'ok', validUntil, payloadSize);

    return NextResponse.json(
      { data: countryData, cached: false, schema: 'v2' },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch (_error) {
    console.error('[Country Route v2] Generation failed for code:', code.substring(0, 2));
    await upsertSyncLog(code, 'error', new Date().toISOString(), 0, 'Parse or generation error');
    return NextResponse.json(
      { error: 'Impossible de générer les données pour ce pays' },
      { status: 500 }
    );
  }
}
