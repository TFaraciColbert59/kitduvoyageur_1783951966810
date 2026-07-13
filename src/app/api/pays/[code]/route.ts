import { NextRequest, NextResponse } from 'next/server';
import { completion } from '@rocketnew/llm-sdk';
import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), '.country-cache');

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

function readFromCache(code: string): CountryAIData | null {
  try {
    const filePath = getCacheFilePath(code);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as CountryAIData;
    }
  } catch {
    // cache miss or corrupt
  }
  return null;
}

function writeToCache(code: string, data: CountryAIData) {
  try {
    ensureCacheDir();
    const filePath = getCacheFilePath(code);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // non-fatal
  }
}

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
  danger_details: {
    label: string;
    level: 'low' | 'medium' | 'high';
    note: string;
  }[];
  calendrier: {
    month: string;
    short: string;
    status: 'good' | 'medium' | 'bad';
    temp_min: number;
    temp_max: number;
    rain_mm: number;
    description: string;
  }[];
  infos_pratiques: {
    icon: string;
    label: string;
    value: string;
  }[];
  lieux: {
    nom: string;
    description: string;
  }[];
  kits_recommandes: {
    nom: string;
    poids_g: number;
    prix_cents: number;
    slug: string;
    description: string;
  }[];
  events: {
    mois: string;
    titre: string;
    type: 'festival' | 'saison' | 'eviter';
  }[];
}

const SYSTEM_PROMPT = `Tu es un expert en voyages et géographie mondiale. Tu génères des données structurées précises et complètes sur les pays du monde pour une application de voyage française.
Tu dois TOUJOURS répondre avec un JSON valide et rien d'autre. Pas de markdown, pas de commentaires, juste le JSON brut.`;

function buildCountryPrompt(countryCode: string): string {
  return `Génère les données complètes pour le pays avec le code ISO alpha-2 "${countryCode.toUpperCase()}" au format JSON strict suivant.

Réponds UNIQUEMENT avec ce JSON (sans markdown, sans backticks, sans commentaires) :

{
  "code": "${countryCode.toUpperCase()}",
  "nom": "Nom officiel du pays en français",
  "continent": "Un de : Europe, Asie, Afrique, Amérique du Nord, Amérique du Sud, Océanie, Antarctique",
  "capital": "Nom de la capitale",
  "coordonnees": "Coordonnées GPS du centre du pays ex: 48.8566° N, 2.3522° E",
  "fuseau": "Fuseau horaire principal ex: UTC+1 (CET)",
  "monnaie": "Nom complet et code ex: Euro (EUR)",
  "langues": ["langue1", "langue2"],
  "population": "Population approximative ex: 67 millions hab.",
  "superficie": "Superficie ex: 551 695 km²",
  "danger_global": 3,
  "danger_details": [
    {"label": "Sécurité générale", "level": "low", "note": "Description courte"},
    {"label": "Risques naturels", "level": "medium", "note": "Description courte"},
    {"label": "Santé", "level": "low", "note": "Description courte"},
    {"label": "Zones à éviter", "level": "low", "note": "Description courte"}
  ],
  "calendrier": [
    {"month": "Janvier", "short": "Jan", "status": "bad", "temp_min": -2, "temp_max": 5, "rain_mm": 50, "description": "Froid et pluvieux"},
    {"month": "Février", "short": "Fév", "status": "bad", "temp_min": -1, "temp_max": 6, "rain_mm": 45, "description": "Encore froid"},
    {"month": "Mars", "short": "Mar", "status": "medium", "temp_min": 3, "temp_max": 11, "rain_mm": 48, "description": "Début du printemps"},
    {"month": "Avril", "short": "Avr", "status": "good", "temp_min": 6, "temp_max": 15, "rain_mm": 52, "description": "Agréable"},
    {"month": "Mai", "short": "Mai", "status": "good", "temp_min": 10, "temp_max": 19, "rain_mm": 55, "description": "Très agréable"},
    {"month": "Juin", "short": "Jun", "status": "good", "temp_min": 13, "temp_max": 23, "rain_mm": 54, "description": "Beau temps"},
    {"month": "Juillet", "short": "Jul", "status": "good", "temp_min": 15, "temp_max": 25, "rain_mm": 59, "description": "Haute saison"},
    {"month": "Août", "short": "Aoû", "status": "good", "temp_min": 15, "temp_max": 25, "rain_mm": 64, "description": "Haute saison"},
    {"month": "Septembre", "short": "Sep", "status": "good", "temp_min": 11, "temp_max": 21, "rain_mm": 55, "description": "Agréable"},
    {"month": "Octobre", "short": "Oct", "status": "medium", "temp_min": 8, "temp_max": 16, "rain_mm": 62, "description": "Automne"},
    {"month": "Novembre", "short": "Nov", "status": "bad", "temp_min": 3, "temp_max": 10, "rain_mm": 51, "description": "Froid et gris"},
    {"month": "Décembre", "short": "Déc", "status": "bad", "temp_min": 0, "temp_max": 6, "rain_mm": 50, "description": "Hivernal"}
  ],
  "infos_pratiques": [
    {"icon": "IdentificationIcon", "label": "Visa", "value": "Conditions d'entrée détaillées pour les ressortissants français"},
    {"icon": "HeartIcon", "label": "Vaccins", "value": "Vaccins recommandés ou obligatoires"},
    {"icon": "CurrencyEuroIcon", "label": "Monnaie", "value": "Taux de change approximatif et conseils"},
    {"icon": "BoltIcon", "label": "Prises", "value": "Type de prises électriques et voltage"},
    {"icon": "BeakerIcon", "label": "Eau", "value": "Eau du robinet potable ou non"},
    {"icon": "PhoneIcon", "label": "Urgences", "value": "Numéros d'urgence locaux"}
  ],
  "lieux": [
    {"nom": "Nom du lieu 1", "description": "Description détaillée du lieu incontournable"},
    {"nom": "Nom du lieu 2", "description": "Description détaillée du lieu incontournable"},
    {"nom": "Nom du lieu 3", "description": "Description détaillée du lieu incontournable"},
    {"nom": "Nom du lieu 4", "description": "Description détaillée du lieu incontournable"},
    {"nom": "Nom du lieu 5", "description": "Description détaillée du lieu incontournable"}
  ],
  "kits_recommandes": [
    {"nom": "Kit adapté à ce pays", "poids_g": 8500, "prix_cents": 29900, "slug": "kit-pays-activite", "description": "Description du kit"},
    {"nom": "Kit secondaire", "poids_g": 5200, "prix_cents": 18900, "slug": "kit-pays-2", "description": "Description du kit"},
    {"nom": "Kit essentiel", "poids_g": 3100, "prix_cents": 12900, "slug": "kit-pays-3", "description": "Description du kit"}
  ],
  "events": [
    {"mois": "Mois", "titre": "Événement ou festival important", "type": "festival"},
    {"mois": "Mois", "titre": "Haute saison touristique", "type": "saison"},
    {"mois": "Mois", "titre": "Période à éviter si possible", "type": "eviter"},
    {"mois": "Mois", "titre": "Autre événement notable", "type": "festival"}
  ]
}

IMPORTANT : 
- danger_global doit être un entier entre 1 et 10
- status dans calendrier doit être exactement "good", "medium" ou "bad"
- level dans danger_details doit être exactement "low", "medium" ou "high"
- type dans events doit être exactement "festival", "saison" ou "eviter"
- Adapte TOUTES les données au pays réel "${countryCode.toUpperCase()}"
- Les températures, précipitations et saisons doivent être réalistes pour ce pays
- Réponds UNIQUEMENT avec le JSON, sans aucun texte avant ou après`;
}

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

  // Validate country code format (2 letters)
  if (!/^[a-z]{2}$/.test(code)) {
    return NextResponse.json({ error: 'Code pays invalide' }, { status: 400 });
  }

  // Check cache first
  const cached = readFromCache(code);
  if (cached) {
    return NextResponse.json(
      { data: cached, cached: true },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Service temporairement indisponible' },
      { status: 503 }
    );
  }

  // Generate via Gemini directly (no HTTP round-trip to another API route)
  try {
    const response = await completion({
      model: 'gemini/gemini-2.5-flash',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildCountryPrompt(code) },
      ],
      stream: false,
      api_key: apiKey,
      temperature: 0.3,
      max_tokens: 4000,
    });

    interface CompletionResponse {
      choices?: { message?: { content?: string } }[];
    }
    const content = (response as CompletionResponse).choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'Données indisponibles' }, { status: 500 });
    }

    // Clean and parse JSON
    let jsonStr = content.trim();
    // Remove markdown code blocks if present
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

    const countryData: CountryAIData = JSON.parse(jsonStr) as CountryAIData;

    // Ensure code is set correctly
    countryData.code = code.toUpperCase();

    // Save to cache
    writeToCache(code, countryData);

    return NextResponse.json(
      { data: countryData, cached: false },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch (_error) {
    // Log only error type, not full error details
    console.error('[Country Route] Generation failed for code:', code.substring(0, 2));
    return NextResponse.json(
      { error: 'Impossible de générer les données pour ce pays' },
      { status: 500 }
    );
  }
}
