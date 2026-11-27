import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "kitduvoyageur",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-24",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: [
        "/*",
        "!/_next/static/*",
        "!/*/_next/static/*",
        "!/models/*",
        "!/draco/*",
        "!/wasm/*",
        "!/assets/*",
        "!/images/*",
        "!/icons/*",
        "!/materiel/*",
        "!/videos/*",
        "!/data/*",
        "!/maplibre/*",
        "!/account-bg.webp",
        "!/explorer-space-bg.jpg",
        "!/explorer-v2-sw.js",
      ],
    },
    env: {
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      VINEXT_KV_CACHE: bindings.kv(),
    },
  }),
});
