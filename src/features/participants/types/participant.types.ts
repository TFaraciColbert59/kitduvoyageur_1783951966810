export interface HumanPublicData {
  id: string;
  firstName: string;
  avatarUrl?: string;
  packWeightKg: number;
  fitnessScore: number; // 0 to 100
  role: 'guide' | 'member' | 'medic';
}

export interface HumanPrivateData {
  bloodType: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'UNKNOWN';
  allergies: string[];
  iceContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  medications?: string[];
  medicalNotes?: string;
}

export interface HumanParticipant {
  id: string;
  type: 'human';
  publicData: HumanPublicData;
  privateData: HumanPrivateData;
  isUnlocked: boolean;
  unlockedAt?: number;
}

export interface DogParticipant {
  id: string;
  type: 'dog';
  name: string;
  breed: string;
  weightKg: number;
  isCarryingPack: boolean;
  packWeightKg: number;
  maxCarryingCapacityKg: number; // calculated: weightKg * carryingCapacityRatio
  waterRationLitersPerDay: number;
  foodRationGramsPerDay: number;
  avatarUrl?: string;
}

export type Participant = HumanParticipant | DogParticipant;

export interface ParticipantsGroupStats {
  totalHumans: number;
  totalDogs: number;
  totalGroupWeightKg: number;
  totalPackWeightKg: number;
  totalWaterDailyLiters: number;
}
