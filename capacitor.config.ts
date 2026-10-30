import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL;

// Capacitor CLI does not inherit Next.js build mode. Fail closed even when
// NODE_ENV is unset; local development requires an explicit opt-in.
const isDevServer = process.env.CAPACITOR_DEV_SERVER === "1";
if (isDevServer && process.env.NODE_ENV === "production") {
  throw new Error("[capacitor.config] CAPACITOR_DEV_SERVER est interdit pour une build release.");
}
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
  backgroundColor: "#17402C",
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
      // Le logo reste affiché jusqu'à ce que l'app soit prête
      // (NativeAppBootstrap masque l'écran dès la première page peinte) ;
      // 4 s au plus si la page tarde, jamais d'écran blanc entre les deux.
      launchShowDuration: 4000,
      launchAutoHide: true,
      backgroundColor: "#17402C",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      androidSpinnerStyle: "small",
      iosSpinnerStyle: "small",
      spinnerColor: "#FBFAF6",
      splashFullScreen: true,
      splashImmersive: true,
    },
    // Réglage de départ de toute l'app : vert forêt, texte clair. Sur /compas
    // (thème clair forcé, paysage éclairci sous la barre) le texte doit être
    // sombre : `NativeAppBootstrap` pose le thème « compas » à l'entrée et
    // rend celui-ci à la sortie (`src/lib/native/status-bar.ts`, plan 5.4).
    // Android 15+ (cible 36) ignore `backgroundColor` et `overlaysWebView` :
    // seul le style compte alors.
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
    backgroundColor: "#17402C",
    preferredContentMode: "mobile",
    handleApplicationNotifications: true,
    scheme: "lkdv",
  },
  android: {
    backgroundColor: "#17402C",
    allowMixedContent: allowCleartext,
    captureInput: true,
    webContentsDebuggingEnabled: isDevServer,
  },
};

export default config;
