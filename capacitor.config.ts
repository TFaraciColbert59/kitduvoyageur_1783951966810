import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL;

// M06 — séparation dev / release : le trafic en clair (cleartext HTTP,
// mixed-content Android) n'est autorisé que pour un serveur de développement
// local. `CAPACITOR_DEV_SERVER=1` force explicitement ce mode (utile quand
// NODE_ENV n'est pas positionné) ; toute release exige HTTPS.
const isDevServer =
  process.env.NODE_ENV !== "production" || process.env.CAPACITOR_DEV_SERVER === "1";
const allowCleartext = isDevServer;

if (!isDevServer && serverUrl && !serverUrl.startsWith("https://")) {
  throw new Error(
    "[capacitor.config] CAPACITOR_SERVER_URL doit être en HTTPS pour une build release (cleartext et mixed-content sont interdits). " +
      "Utiliser un serveur https:// ou définir CAPACITOR_DEV_SERVER=1 pour un serveur de développement local."
  );
}

if (!serverUrl) {
  // Échec explicite au sync/build Capacitor : sans serveur distant, la coquille
  // native servirait `public/index.html` (placeholder) au lieu de l'app déployée.
  // Fichier exécuté uniquement par la CLI Capacitor (aucun import repo/Next —
  // vérifié par `rg "capacitor.config"` : seul un test le lit en texte brut).
  throw new Error(
    "[capacitor.config] CAPACITOR_SERVER_URL requise pour un build natif (sinon l app servira le placeholder). " +
      "[capacitor.config] CAPACITOR_SERVER_URL absente — l'app native chargera public/index.html (placeholder). Définir CAPACITOR_SERVER_URL avant `npx cap sync` (voir docs/mobile/ANDROID_RELEASE.md §5.1)."
  );
}

const config: CapacitorConfig = {
  appId: "com.lekitduvoyageur.app",
  appName: "Le Kit du Voyageur",
  webDir: "public",
  backgroundColor: "#FBFAF6",
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: allowCleartext,
        androidScheme: "https",
        iosScheme: "capacitor",
      }
    : {
        androidScheme: "https",
        iosScheme: "capacitor",
      },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#17402C",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "small",
      iosSpinnerStyle: "small",
      spinnerColor: "#FBFAF6",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK" as any,
      backgroundColor: "#17402C",
      overlaysWebView: true,
    },
    Keyboard: {
      resize: "body" as any,
      style: "DARK" as any,
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#FBFAF6",
    preferredContentMode: "mobile",
    handleApplicationNotifications: true,
    scheme: "lkdv",
  },
  android: {
    backgroundColor: "#FBFAF6",
    allowMixedContent: allowCleartext,
    captureInput: true,
    webContentsDebuggingEnabled: process.env.NODE_ENV !== "production",
  },
};

export default config;
