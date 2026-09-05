import { describe, it, expect } from 'vitest';
import { generateTripGpx, checkDocumentExpiry } from '@/features/trips/engine/exportEngine';
import type { TripFull, TripDocument } from '@/features/trips/types/trip.types';

describe('exportEngine — Chantier 7', () => {
  const baseTrip: TripFull = {
    id: 'trip-1',
    slug: 'tour-du-mont-blanc',
    title: 'Tour du Mont-Blanc & Vallées Alpines',
    description: 'Trek mythique autour du toit de l\'Europe avec <panoramas> & bivouacs.',
    destination_country_code: 'FR',
    destination_name: 'France & Italie',
    start_date: '2026-07-01',
    end_date: '2026-07-10',
    status: 'planned',
    visibility: 'public',
    difficulty: 'hard',
    primary_activity: 'trekking',
    estimated_budget: 800,
    budget_currency: 'EUR',
    cover_image_url: null,
    user_id: 'user-1',
    group_id: null,
    share_token: 'secret-token-123456',
    metadata: {},
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
    collaborators: [],
    steps: [
      {
        id: 'step-1',
        trip_id: 'trip-1',
        day_number: 1,
        order_index: 0,
        title: 'Les Houches -> Refuge de Miage',
        description: 'Départ depuis Les Houches par le Col de Voza',
        location_name: 'Refuge de Miage',
        latitude: 45.8541,
        longitude: 6.7412,
        accommodation_name: 'Refuge de Miage',
        transport_mode: 'foot',
        distance_km: 12.5,
        elevation_gain_m: 850,
        elevation_loss_m: 320,
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      },
      {
        id: 'step-2',
        trip_id: 'trip-1',
        day_number: 2,
        order_index: 0,
        title: 'Refuge de Miage -> Refuge de la Croix du Bonhomme',
        description: 'Passage par Notre-Dame de la Gorge',
        location_name: 'Croix du Bonhomme',
        latitude: 45.7369,
        longitude: 6.7175,
        accommodation_name: 'Refuge Croix du Bonhomme',
        transport_mode: 'foot',
        distance_km: 16.0,
        elevation_gain_m: 1300,
        elevation_loss_m: 450,
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      },
      {
        id: 'step-3-no-coords',
        trip_id: 'trip-1',
        day_number: 3,
        order_index: 0,
        title: 'Repos et ravitaillement',
        description: null,
        location_name: null,
        latitude: null,
        longitude: null,
        accommodation_name: null,
        transport_mode: null,
        distance_km: null,
        elevation_gain_m: null,
        elevation_loss_m: null,
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      },
    ],
    items: [],
    expenses: [],
    documents: [],
    pois: [
      {
        id: 'poi-1',
        trip_id: 'trip-1',
        step_id: 'step-1',
        name: 'Point de vue Glacier de Bionnassay',
        category: 'viewpoint',
        latitude: 45.845,
        longitude: 6.755,
        notes: 'Magnifique sérac suspendu',
        visited: false,
        osm_id: null,
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      },
    ],
    safety_checkpoints: [],
    notes: [],
    permissions: {
      canEdit: true,
      canDelete: true,
      canInvite: true,
      canManageBudget: true,
      canViewDocuments: true,
    },
  };

  describe('generateTripGpx', () => {
    it('génère un XML GPX 1.1 valide avec en-têtes et métadonnées échappées', () => {
      const gpx = generateTripGpx(baseTrip);

      expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(gpx).toContain('<gpx version="1.1"');
      expect(gpx).toContain('creator="Le Kit du Voyageur - https://lekitduvoyageur.fr"');
      expect(gpx).toContain('<name>Tour du Mont-Blanc &amp; Vallées Alpines</name>');
      expect(gpx).toContain('&lt;panoramas&gt; &amp; bivouacs.');
    });

    it('inclut des waypoints pour les étapes et POIs ayant des coordonnées', () => {
      const gpx = generateTripGpx(baseTrip);

      expect(gpx).toContain('<wpt lat="45.8541" lon="6.7412">');
      expect(gpx).toContain('<name>Les Houches -&gt; Refuge de Miage</name>');
      expect(gpx).toContain('<wpt lat="45.845" lon="6.755">');
      expect(gpx).toContain('<name>Point de vue Glacier de Bionnassay</name>');
    });

    it('inclut le tracé (trk) ordonné avec trkpt pour les étapes géolocalisées', () => {
      const gpx = generateTripGpx(baseTrip);

      expect(gpx).toContain('<trk>');
      expect(gpx).toContain('<trkseg>');
      expect(gpx).toContain('<trkpt lat="45.8541" lon="6.7412"');
      expect(gpx).toContain('<trkpt lat="45.7369" lon="6.7175"');
    });

    it('gère gracieusement un voyage sans aucune coordonnée sans planter', () => {
      const emptyTrip: TripFull = {
        ...baseTrip,
        steps: [],
        pois: [],
      };

      const gpx = generateTripGpx(emptyTrip);
      expect(gpx).toContain('<gpx version="1.1"');
      expect(gpx).not.toContain('<wpt');
      expect(gpx).not.toContain('<trkpt');
    });
  });

  describe('checkDocumentExpiry', () => {
    const refDate = new Date('2026-06-01T12:00:00Z');

    it('retourne "none" si aucune date d\'expiration n\'est renseignée', () => {
      const doc: TripDocument = {
        id: 'd-1',
        trip_id: 'trip-1',
        user_id: 'user-1',
        title: 'Assurance carte bancaire',
        category: 'insurance',
        file_url: 'https://example.com/doc.pdf',
        file_name: 'doc.pdf',
        file_size_bytes: 1024,
        mime_type: 'application/pdf',
        expires_at: null,
        notes: null,
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      };

      const res = checkDocumentExpiry(doc, refDate);
      expect(res.status).toBe('none');
      expect(res.daysRemaining).toBeNull();
    });

    it('détecte un document expiré', () => {
      const doc: TripDocument = {
        id: 'd-1',
        trip_id: 'trip-1',
        user_id: 'user-1',
        title: 'Ancien passeport',
        category: 'passport',
        file_url: 'https://example.com/doc.pdf',
        file_name: 'doc.pdf',
        file_size_bytes: 1024,
        mime_type: 'application/pdf',
        expires_at: '2026-05-15',
        notes: null,
        created_at: '2026-05-01T10:00:00Z',
        updated_at: '2026-05-01T10:00:00Z',
      };

      const res = checkDocumentExpiry(doc, refDate);
      expect(res.status).toBe('expired');
      expect(res.daysRemaining).toBeLessThan(0);
      expect(res.label).toContain('Expiré');
    });

    it('déclenche un avertissement si le passeport expire dans moins de 6 mois (180 jours)', () => {
      const doc: TripDocument = {
        id: 'd-1',
        trip_id: 'trip-1',
        user_id: 'user-1',
        title: 'Passeport biométrique',
        category: 'passport',
        file_url: 'https://example.com/doc.pdf',
        file_name: 'doc.pdf',
        file_size_bytes: 1024,
        mime_type: 'application/pdf',
        expires_at: '2026-09-01', // Dans ~92 jours (< 180j)
        notes: null,
        created_at: '2026-05-01T10:00:00Z',
        updated_at: '2026-05-01T10:00:00Z',
      };

      const res = checkDocumentExpiry(doc, refDate);
      expect(res.status).toBe('warning');
      expect(res.daysRemaining).toBeGreaterThan(0);
      expect(res.daysRemaining).toBeLessThan(180);
      expect(res.label).toContain('Expire dans');
    });

    it('confirme la validité si le document est valable au-delà de 6 mois', () => {
      const doc: TripDocument = {
        id: 'd-1',
        trip_id: 'trip-1',
        user_id: 'user-1',
        title: 'Passeport biométrique récent',
        category: 'passport',
        file_url: 'https://example.com/doc.pdf',
        file_name: 'doc.pdf',
        file_size_bytes: 1024,
        mime_type: 'application/pdf',
        expires_at: '2029-01-01',
        notes: null,
        created_at: '2026-05-01T10:00:00Z',
        updated_at: '2026-05-01T10:00:00Z',
      };

      const res = checkDocumentExpiry(doc, refDate);
      expect(res.status).toBe('valid');
      expect(res.daysRemaining).toBeGreaterThan(180);
      expect(res.label).toContain('Valide');
    });
  });
});
