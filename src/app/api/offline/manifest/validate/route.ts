import { NextRequest, NextResponse } from 'next/server';
import {
  computeManifestSha256,
  evaluatePackCapabilitiesAndStatus,
  getTileProviderPolicy,
  normalizeResourceUri,
  validatePackManifest,
  type VerifiedResourceChunk,
} from '@/features/offline';
import { invalidBody, serverError } from '../../_lib/http';
import { manifestValidationInputSchema } from '../../_lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/offline/manifest/validate — contrôle d’intégrité d’un manifeste.
 *
 * Route pure et sans état : elle ne conserve aucun paquet. Le contrôle est
 * fail-closed (fournisseur, licences, URI sans jeton, tailles, SHA-256,
 * confidentialité). Les charges `verifiedResources` sont facultatives ; quand
 * elles sont fournies, la matrice de capacités est évaluée par le contrat.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Corps invalide', details: 'JSON attendu' },
        { status: 400 }
      );
    }

    const parsed = manifestValidationInputSchema.safeParse(body);
    if (!parsed.success) return invalidBody(parsed.error);

    const { manifest, verifiedResources } = parsed.data;
    if (verifiedResources) {
      const totalPayloadBytes = verifiedResources.reduce(
        (total, chunk) => total + chunk.payload.length,
        0
      );
      if (totalPayloadBytes > 8_000_000) {
        return NextResponse.json(
          { error: 'Charge trop volumineuse', details: '8 Mo de charges vérifiées au maximum' },
          { status: 413 }
        );
      }
    }

    const validation = validatePackManifest(manifest);
    const providerPolicy = getTileProviderPolicy(manifest.providerId);
    const computedManifestSha256 = computeManifestSha256(manifest);

    const normalizedResources = manifest.resources.map((resource) => ({
      id: resource.id,
      canonicalUri: normalizeResourceUri(resource.canonicalUri),
      expectedSha256: resource.expectedSha256.toLowerCase(),
      expectedBytes: resource.expectedBytes,
      required: resource.required,
      privacyScope: resource.privacyScope,
    }));

    let evaluation = null;
    if (verifiedResources) {
      const chunks = new Map<string, VerifiedResourceChunk>();
      for (const chunk of verifiedResources) {
        chunks.set(chunk.resourceId, {
          resourceId: chunk.resourceId,
          canonicalUri: chunk.canonicalUri,
          actualSha256: chunk.actualSha256,
          actualBytes: chunk.actualBytes,
          verifiedAtMs: chunk.verifiedAtMs,
          payload: chunk.payload,
        });
      }
      evaluation = evaluatePackCapabilitiesAndStatus(manifest, chunks);
    }

    return NextResponse.json(
      {
        valid: validation.valid,
        validation,
        providerPolicy,
        computedManifestSha256,
        manifestSha256: manifest.manifestSha256,
        normalizedResources,
        evaluation,
      },
      { status: 200 }
    );
  } catch (error) {
    return serverError('offline/manifest/validate', error);
  }
}
