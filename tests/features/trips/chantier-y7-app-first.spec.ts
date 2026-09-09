import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  sanitizeTripForOffline,
  saveTripOffline,
  getOfflineTrip,
  isTripAvailableOffline,
  removeOfflineTrip,
  tripDexieDB,
} from '@/features/trips/offline/tripOfflineStorage';
import {
  enqueueTripOfflineAction,
  getTripOfflineQueue,
  clearTripOfflineQueue,
  resolveTripConflict,
  getTripSyncJournal,
  tripSyncDB,
} from '@/features/trips/offline/tripOfflineSyncQueue';
import { triggerNativeHaptic } from '@/lib/native/haptics';
import { applyLKDVStatusBarTheme } from '@/lib/native/status-bar';
import type { TripFull } from '@/features/trips/types/trip.types';

describe('Chantier Y7 — App-First, Cibles Tactiles, Haptique et Offline Dexie', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const storageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, val: string) => {
        mockStorage[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
    };
    vi.stubGlobal('localStorage', storageMock);
  });

  const dummyTrip: TripFull = {
    id: 'trip-y7-test',
    slug: 'expedition-y7',
    title: 'Expédition Haute Route Y7',
    description: 'Traversée alpine haute autonomie',
    destination_country_code: 'CH',
    destination_name: 'Suisse',
    start_date: '2026-07-10',
    end_date: '2026-07-20',
    status: 'planned',
    visibility: 'private',
    difficulty: 'expert',
    primary_activity: 'trekking',
    estimated_budget: 2500,
    budget_currency: 'CHF',
    cover_image_url: null,
    user_id: 'user-lead',
    group_id: null,
    share_token: 'secret-token-12345',
    metadata: {},
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    collaborators: [],
    steps: [
      {
        id: 'step-1',
        trip_id: 'trip-y7-test',
        day_number: 1,
        order_index: 0,
        title: 'Départ Chamonix',
        description: null,
        location_name: 'Chamonix',
        latitude: 45.9237,
        longitude: 6.8694,
        accommodation_name: null,
        transport_mode: 'foot',
        elevation_gain_m: 1200,
        elevation_loss_m: 200,
        distance_km: 14,
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
      },
    ],
    items: [
      {
        id: 'item-1',
        trip_id: 'trip-y7-test',
        item_name: 'Duvet grand froid',
        category: 'sleep',
        weight_grams: 950,
        quantity: 1,
        is_packed: false,
        status: 'needed',
        packed_by: null,
        inventory_item_id: null,
        affiliate_link_id: null,
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
      },
    ],
    expenses: [
      {
        id: 'exp-1',
        trip_id: 'trip-y7-test',
        payer_id: 'user-lead',
        amount: 320,
        currency: 'CHF',
        category: 'transport',
        title: 'Billet de train',
        expense_date: '2026-07-09',
        split_type: 'equal',
        metadata: null,
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
      },
    ],
    documents: [
      {
        id: 'doc-1',
        trip_id: 'trip-y7-test',
        user_id: 'user-lead',
        title: 'Passeport biométrique',
        file_url: 'https://sensitive-storage.internal/passport.pdf',
        file_name: 'passport.pdf',
        file_size_bytes: 1024,
        mime_type: 'application/pdf',
        category: 'passport',
        expires_at: null,
        notes: null,
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
      },
    ],
    pois: [],
    safety_checkpoints: [
      {
        id: 'cp-1',
        trip_id: 'trip-y7-test',
        label: 'Col du Chardonnet',
        scheduled_at: '2026-07-12T11:00:00Z',
        checked_at: null,
        status: 'pending',
        contact_name: 'Secours Montagne',
        contact_phone: '+33450531689',
        notes: 'Passage technique avant 12h',
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
      },
    ],
    notes: [],
    permissions: {
      canEdit: true,
      canDelete: true,
      canInvite: true,
      canManageBudget: true,
      canViewDocuments: true,
    },
  };

  // ── Y7.1 : ZONES SÛRES & APPSHELL ──────────────────────────────────────────
  describe('Y7.1 — Zones Sûres via AppShell / MobilePageShell', () => {
    it('aucun fichier dans src/features/trips ne calcule manuellement env(safe-area-inset)', () => {
      const tripsDir = path.join(process.cwd(), 'src', 'features', 'trips');
      const files: string[] = [];

      function walk(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
        }
      }
      walk(tripsDir);

      const violations: string[] = [];
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        if (/env\s*\(\s*safe-area-inset/i.test(content)) {
          violations.push(path.relative(process.cwd(), file));
        }
      }

      expect(violations, `Violations de zone sûre calculée manuellement : ${violations.join(', ')}`).toEqual([]);
    });

    it('AppShell applique les 4 côtés de zone sûre pour mobile portrait et paysage', () => {
      const appShellPath = path.join(process.cwd(), 'src', 'components', 'shell', 'AppShell.tsx');
      const content = fs.readFileSync(appShellPath, 'utf8');

      expect(content).toContain('env(safe-area-inset-top');
      expect(content).toContain('env(safe-area-inset-bottom');
      expect(content).toContain('env(safe-area-inset-left');
      expect(content).toContain('env(safe-area-inset-right');
    });
  });

  // ── Y7.2 : CIBLES TACTILES ─────────────────────────────────────────────────
  describe('Y7.2 — Cibles Tactiles >= 44px (Apple HIG)', () => {
    it('HubSidebarLeft (HubSidebarActivities) et HubMobileSectionsSheet garantissent des cibles tactiles >= 44px', () => {
      // Hub V6 — la sidebar porte la liste des ACTIVITÉS (HubSidebarActivities).
      const sidebarLeftPath = path.join(process.cwd(), 'src', 'features', 'hub', 'components', 'HubSidebarActivities.tsx');
      const sheetPath = path.join(process.cwd(), 'src', 'features', 'hub', 'components', 'HubMobileSectionsSheet.tsx');

      const sidebarContent = fs.readFileSync(sidebarLeftPath, 'utf8');
      const sheetContent = fs.readFileSync(sheetPath, 'utf8');

      // Liens de sidebar et boutons de sheet
      expect(sidebarContent).toContain('min-h-[64px]');
      expect(sheetContent).toContain('min-h-[44px]');
      expect(sheetContent).toContain('min-h-[48px]');
    });

    it('OfflineToggleWidget offre des cibles tactiles d au moins 44px', () => {
      const toggleWidgetPath = path.join(
        process.cwd(),
        'src',
        'features',
        'trips',
        'components',
        'widgets',
        'OfflineToggleWidget.tsx'
      );
      const content = fs.readFileSync(toggleWidgetPath, 'utf8');

      expect(content).toContain('min-h-[44px]');
    });
  });

  // ── Y7.3 : HAPTIQUE ET REDUCED MOTION ──────────────────────────────────────
  describe('Y7.3 — Retour Haptique & Respect de prefers-reduced-motion', () => {
    it('triggerNativeHaptic ne déclenche aucune vibration si prefers-reduced-motion est actif', async () => {
      const vibrateMock = vi.fn();
      vi.stubGlobal('navigator', { vibrate: vibrateMock });
      vi.stubGlobal('window', {
        matchMedia: vi.fn((query: string) => ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
        })),
      });

      await triggerNativeHaptic('success');
      expect(vibrateMock).not.toHaveBeenCalled();
    });

    it('triggerNativeHaptic déclenche la vibration adaptée quand prefers-reduced-motion est inactif', async () => {
      const vibrateMock = vi.fn();
      vi.stubGlobal('navigator', { vibrate: vibrateMock });
      vi.stubGlobal('window', {
        matchMedia: vi.fn(() => ({
          matches: false,
          media: '',
        })),
      });

      await triggerNativeHaptic('success');
      expect(vibrateMock).toHaveBeenCalledWith([15, 50, 20]);
    });
  });

  // ── Y7.4 : CONSOLIDATION DEXIE ET RGPD ────────────────────────────────────
  describe('Y7.4 — Consolidation Dexie, RGPD et Synchronisation LWW', () => {
    it('sanitizeTripForOffline expurge strictement les documents, le share_token et les dépenses', () => {
      const safe = sanitizeTripForOffline(dummyTrip);

      expect(safe.documents).toEqual([]);
      expect(safe.share_token).toBeNull();
      expect(safe.expenses).toEqual([]);

      // Les données vitales pour le terrain restent complètes
      expect(safe.id).toBe(dummyTrip.id);
      expect(safe.slug).toBe(dummyTrip.slug);
      expect(safe.steps).toHaveLength(1);
      expect(safe.items).toHaveLength(1);
      expect(safe.safety_checkpoints).toHaveLength(1);
    });

    it('saveTripOffline sauvegarde le voyage assaini dans le stockage local et le manifeste', () => {
      const ok = saveTripOffline(dummyTrip);
      expect(ok).toBe(true);

      expect(isTripAvailableOffline(dummyTrip.slug)).toBe(true);
      const retrieved = getOfflineTrip(dummyTrip.slug);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.documents).toEqual([]);
      expect(retrieved?.share_token).toBeNull();
      expect(retrieved?.expenses).toEqual([]);
      expect(retrieved?.title).toBe(dummyTrip.title);

      removeOfflineTrip(dummyTrip.slug);
      expect(isTripAvailableOffline(dummyTrip.slug)).toBe(false);
      expect(getOfflineTrip(dummyTrip.slug)).toBeNull();
    });

    it('tripDexieDB et tripSyncDB sont configurés avec les tables et schémas requis', () => {
      expect(tripDexieDB.name).toBe('lkdv-trips');
      expect(tripDexieDB.table('trips')).toBeDefined();

      expect(tripSyncDB.name).toBe('lkdv-trip-sync');
      expect(tripSyncDB.table('queue')).toBeDefined();
      expect(tripSyncDB.table('journal')).toBeDefined();
    });

    it('enqueueTripOfflineAction et clearTripOfflineQueue gèrent correctement la file d attente', () => {
      clearTripOfflineQueue('expedition-y7');
      expect(getTripOfflineQueue('expedition-y7')).toHaveLength(0);

      const action = enqueueTripOfflineAction({
        tripSlug: 'expedition-y7',
        type: 'update_step_status',
        payload: { stepId: 'step-1', status: 'completed' },
      });

      expect(action.id).toMatch(/^act_/);
      expect(action.tripSlug).toBe('expedition-y7');

      const queue = getTripOfflineQueue('expedition-y7');
      expect(queue).toHaveLength(1);
      expect(queue[0].type).toBe('update_step_status');

      clearTripOfflineQueue('expedition-y7');
      expect(getTripOfflineQueue('expedition-y7')).toHaveLength(0);
    });

    it('resolveTripConflict applique la règle Last-Write-Wins (LWW) et enregistre dans le journal', () => {
      const localItem = { id: 'note-1', text: 'Note locale récente', updatedAt: '2026-07-12T14:00:00Z' };
      const remoteItem = { id: 'note-1', text: 'Note distante ancienne', updatedAt: '2026-07-12T12:00:00Z' };

      // Local plus récent -> local gagne
      const res1 = resolveTripConflict('expedition-y7', 'trip_note', localItem, remoteItem);
      expect(res1.winner).toBe('local');
      expect(res1.resolvedEntity.text).toBe('Note locale récente');

      // Remote plus récent -> remote gagne
      const localOlder = { id: 'note-2', text: 'Locale ancienne', updatedAt: '2026-07-10T08:00:00Z' };
      const remoteNewer = { id: 'note-2', text: 'Distante récente', updatedAt: '2026-07-10T10:00:00Z' };

      const res2 = resolveTripConflict('expedition-y7', 'trip_note', localOlder, remoteNewer);
      expect(res2.winner).toBe('remote');
      expect(res2.resolvedEntity.text).toBe('Distante récente');

      const journal = getTripSyncJournal('expedition-y7');
      expect(journal.length).toBeGreaterThanOrEqual(2);
      expect(journal[0].winner).toBe('remote');
      expect(journal[1].winner).toBe('local');
    });
  });

  // ── Y7.5 : BARRE D'ÉTAT ET SPLASH SCREEN ──────────────────────────────────
  describe('Y7.5 — Barre d État et Splash Screen Natifs', () => {
    it('applyLKDVStatusBarTheme s exécute de manière sûre et sans crash en environnement web/SSR', async () => {
      await expect(applyLKDVStatusBarTheme()).resolves.toBeUndefined();
    });

    it('capacitor.config.ts définit les couleurs de marque conformes aux tokens', () => {
      const configPath = path.join(process.cwd(), 'capacitor.config.ts');
      const content = fs.readFileSync(configPath, 'utf8');

      // Vert forêt #17402C et Blanc crème #FBFAF6
      expect(content).toContain('#17402C');
      expect(content).toContain('#FBFAF6');
      expect(content).toContain('SplashScreen');
      expect(content).toContain('StatusBar');
    });
  });
});
