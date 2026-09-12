/**
 * Phase 4 — Étapes 1-2 du pipeline : autorisation de téléchargement + licence.
 *
 * Règles non négociables :
 *   • une importation sans autorisation de téléchargement explicite est refusée ;
 *   • une importation sans licence ENREGISTRÉE est refusée ;
 *   • une licence révoquée, expirée ou sans redistribution est refusée.
 *
 * Aucune exception de contrôle de flux : tout est retourné dans le résultat,
 * ce qui rend la décision inspectable et testable.
 */
import type { ImportAuthorization, ImportManifest, LicenseRecord } from './types';

export interface LicenseGateResult {
  allowed: boolean;
  reasons: string[];
  warnings: string[];
}

function ok(): LicenseGateResult {
  return { allowed: true, reasons: [], warnings: [] };
}

function fail(result: LicenseGateResult, reason: string): LicenseGateResult {
  result.allowed = false;
  result.reasons.push(reason);
  return result;
}

/** Étape 1 — le téléchargement doit être autorisé et référencé. */
export function checkImportAuthorization(
  authorization: ImportAuthorization,
  sourceUrl: string
): LicenseGateResult {
  const result = ok();

  if (!authorization.downloadAuthorized) {
    fail(result, 'Téléchargement non autorisé : une autorisation humaine explicite est requise.');
  }
  if (!authorization.reference || authorization.reference.trim().length === 0) {
    fail(result, 'Autorisation sans référence : courriel, contrat ou conditions obligatoires.');
  }
  if (!sourceUrl || sourceUrl.trim().length === 0) {
    fail(result, 'URL source absente : impossible de tracer la provenance.');
  }

  return result;
}

/** Étape 2 — licence enregistrée, active, non expirée et redistribuable. */
export function checkLicense(
  licenseCode: string,
  licenses: readonly LicenseRecord[],
  now: Date
): LicenseGateResult {
  const result = ok();

  const license = licenses.find((candidate) => candidate.code === licenseCode);
  if (!license) {
    fail(
      result,
      `Licence « ${licenseCode} » introuvable : une licence enregistrée est obligatoire (registre coverage_licenses).`
    );
    return result;
  }

  if (license.status !== 'active') {
    fail(result, `Licence « ${license.code} » non active : import refusé.`);
  }

  if (!license.evidenceUrl && !license.evidenceNote) {
    fail(result, `Licence « ${license.code} » sans preuve enregistrée (URL ou note).`);
  }

  if (license.validUntil) {
    const validUntil = new Date(license.validUntil);
    if (Number.isNaN(validUntil.getTime())) {
      fail(result, `Licence « ${license.code} » : date de validité illisible.`);
    } else if (validUntil.getTime() <= now.getTime()) {
      fail(result, `Licence « ${license.code} » expirée le ${license.validUntil}.`);
    }
  }

  if (!license.allowsRedistribution) {
    fail(
      result,
      `Licence « ${license.code} » sans redistribution autorisée : import interdit dans un dataset publié.`
    );
  }

  if (!license.allowsCommercialUse) {
    result.warnings.push(
      `Licence « ${license.code} » : usage commercial non confirmé — vérification humaine requise.`
    );
  }

  return result;
}

/** Étapes 1+2 : portail complet d'import (téléchargement + licence). */
export function runImportGate(
  manifest: ImportManifest,
  licenses: readonly LicenseRecord[],
  now: Date
): LicenseGateResult {
  const auth = checkImportAuthorization(manifest.authorization, manifest.source.url);
  const license = checkLicense(manifest.source.licenseCode, licenses, now);
  return {
    allowed: auth.allowed && license.allowed,
    reasons: [...auth.reasons, ...license.reasons],
    warnings: [...auth.warnings, ...license.warnings],
  };
}
