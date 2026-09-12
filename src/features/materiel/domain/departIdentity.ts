export interface DepartIdentityInput { destination?: string | null; trailName?: string | null; }
export interface DepartIdentity { title: string; subtitle: string | null; fromTrail: boolean; }

export function resolveDepartIdentity(input: DepartIdentityInput): DepartIdentity {
  const destination = input.destination?.trim() || null;
  const trailName = input.trailName?.trim() || null;
  if (trailName) {
    return { title: trailName, subtitle: destination && destination !== trailName ? destination : null, fromTrail: true };
  }
  return { title: destination ?? 'Prochain départ', subtitle: null, fromTrail: false };
}
