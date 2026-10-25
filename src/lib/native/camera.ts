import type { ImageOptions } from "@capacitor/camera";
import { isNative } from "./platform";

export interface PhotoResult {
  dataUrl?: string;
  webPath?: string;
  format: string;
}

/**
 * Capture photo ou selection galerie (Natif ou Web input fallback)
 */
export async function captureOrPickPhoto(options?: Partial<ImageOptions>): Promise<PhotoResult | null> {
  if (isNative()) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
      const defaultOpts: ImageOptions = {
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        ...options,
      };
      const image = await Camera.getPhoto(defaultOpts);
      return {
        dataUrl: image.dataUrl,
        webPath: image.webPath,
        format: image.format,
      };
    } catch {
      return null;
    }
  }

  // Web input file fallback
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          dataUrl: reader.result as string,
          format: file.type.split("/")[1] || "jpeg",
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
