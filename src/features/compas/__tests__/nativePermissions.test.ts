import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 5.4 : « Texte de la demande de position juste (Info.plist, Android) ».
 *
 * Lecture statique des fichiers natifs : ce qui est demandé à la personne doit
 * dire pourquoi, et rien de plus que ce que le code utilise. Ces tests ne
 * prouvent PAS ce que l'iPhone ou l'Android affichent (dialogue système,
 * traduction, choix « position approximative ») : cela demande un appareil réel.
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');

const plist = read('ios/App/App/Info.plist');
// Les commentaires du manifeste expliquent les permissions : ils ne comptent pas comme des déclarations.
const manifest = read('android/app/src/main/AndroidManifest.xml').replace(/<!--[\s\S]*?-->/g, '');
const pkg = JSON.parse(read('package.json')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

/** La valeur `<string>` qui suit une clé de l'Info.plist. */
function plistString(key: string): string | null {
  const m = plist.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`));
  return m ? m[1] : null;
}

/** Les permissions déclarées dans le manifeste Android. */
function androidPermissions(): string[] {
  return [...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map((m) => m[1]).sort();
}

describe('iOS : texte de la demande de position', () => {
  const text = plistString('NSLocationWhenInUseUsageDescription');

  it('existe, en français, avec tutoiement', () => {
    expect(text).toBeTruthy();
    expect(text).toMatch(/\bta position\b/);
    expect(text).not.toMatch(/\b(votre|vos|vous)\b/i);
  });

  it('dit pourquoi : situer le départ et le trajet du voyage', () => {
    expect(text).toMatch(/départ/);
    expect(text).toMatch(/trajet/);
    expect(text).toMatch(/voyage/);
  });

  it('dit ce qui n’est pas fait : pas d’arrière-plan, pas de suivi, pas de partage sans accord', () => {
    expect(text).toMatch(/jamais en arrière-plan/);
    expect(text).toMatch(/sans suivi/);
    expect(text).toMatch(/sans ton accord/);
  });

  it('ne promet que ce que fait le code : arrondi à environ 1 km pour préparer le trajet', () => {
    // Plan 2.10 : `autofillActions.ts` arrondit à 0,01° (~1 km) avant tout envoi.
    expect(text).toMatch(/arrondie à environ 1 km/);
    const autofill = read('src/features/compas/server/autofillActions.ts');
    expect(autofill).toMatch(/Arrondie à 0,01° \(~1 km/);
  });

  it('reste assez courte pour le dialogue système', () => {
    expect(text!.length).toBeLessThanOrEqual(360);
  });

  it('aucune autre demande de position : ni « toujours », ni mode arrière-plan', () => {
    expect(plist).not.toMatch(/NSLocationAlwaysAndWhenInUseUsageDescription/);
    expect(plist).not.toMatch(/NSLocationAlwaysUsageDescription/);
    expect(plist).not.toMatch(/<key>UIBackgroundModes<\/key>/);
    expect(plist).not.toMatch(/<string>location<\/string>/);
  });
});

describe('Android : permissions minimales', () => {
  it('seulement le réseau et la position (précise + approximative), rien en arrière-plan', () => {
    expect(androidPermissions()).toEqual([
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.INTERNET',
    ]);
    expect(manifest).not.toMatch(/ACCESS_BACKGROUND_LOCATION/);
    expect(manifest).not.toMatch(/FOREGROUND_SERVICE/);
  });

  it('la position précise est réellement utilisée par le code (sinon elle serait à retirer)', () => {
    // Le Compas ne demande que l'approximative (`enableHighAccuracy: false`)...
    for (const f of [
      'src/features/compas/components/CompasScreen.tsx',
      'src/features/compas/components/CompasOuFlows.tsx',
    ]) {
      expect(read(f)).toMatch(/enableHighAccuracy: false/);
    }
    // ... mais le suivi de randonnée, la carte Explorer et le partage de position
    // demandent la précise : retirer ACCESS_FINE_LOCATION les casserait.
    expect(read('src/features/hiking/services/GPSService.ts')).toMatch(/enableHighAccuracy: true/);
    expect(read('src/components/explorer/ExplorerMap.tsx')).toMatch(/enableHighAccuracy: true/);
    expect(read('src/features/tribu/hooks/useLivePositionSharing.ts')).toMatch(/enableHighAccuracy: true/);
  });

  it('Capacitor demande les deux ensemble : en retirer une casserait la demande sur Android 7 à 11', () => {
    const client = read('node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/BridgeWebChromeClient.java');
    expect(client).toMatch(/\{ Manifest\.permission\.ACCESS_COARSE_LOCATION, Manifest\.permission\.ACCESS_FINE_LOCATION \}/);
  });
});

describe('aucune position en arrière-plan dans le code', () => {
  it('aucun plugin de géolocalisation en arrière-plan', () => {
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => /background-geolocation|background-location|background-runner/i.test(d))).toEqual([]);
  });
});
