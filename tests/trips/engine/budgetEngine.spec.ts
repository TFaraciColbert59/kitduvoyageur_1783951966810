import { describe, it, expect } from 'vitest';
import { calculateBudgetSummary, simplifyDebts } from '@/features/trips/engine/budgetEngine';
import type { TripExpense, TripCollaborator } from '@/features/trips/types/trip.types';

describe('budgetEngine — Chantier 7', () => {
  const mockCollaborators: TripCollaborator[] = [
    {
      id: 'c-1',
      trip_id: 'trip-1',
      user_id: 'user-alice',
      role: 'owner',
      joined_at: '2026-06-01T10:00:00Z',
      invited_by: null,
      created_at: '2026-06-01T10:00:00Z',
      updated_at: '2026-06-01T10:00:00Z',
      profile: { full_name: 'Alice Alpiniste' },
    },
    {
      id: 'c-2',
      trip_id: 'trip-1',
      user_id: 'user-bob',
      role: 'editor',
      joined_at: '2026-06-02T10:00:00Z',
      invited_by: 'user-alice',
      created_at: '2026-06-02T10:00:00Z',
      updated_at: '2026-06-02T10:00:00Z',
      profile: { full_name: 'Bob Bivouac' },
    },
    {
      id: 'c-3',
      trip_id: 'trip-1',
      user_id: 'user-charlie',
      role: 'viewer',
      joined_at: '2026-06-03T10:00:00Z',
      invited_by: 'user-alice',
      created_at: '2026-06-03T10:00:00Z',
      updated_at: '2026-06-03T10:00:00Z',
      profile: { full_name: 'Charlie Campeur' },
    },
  ];

  it('calcule correctement les totaux, le reste et le pourcentage consommé', () => {
    const expenses: TripExpense[] = [
      {
        id: 'e-1',
        trip_id: 'trip-1',
        payer_id: 'user-alice',
        title: 'Refuge du Goûter',
        amount: 300,
        currency: 'EUR',
        category: 'hébergement',
        expense_date: '2026-07-10',
        split_type: 'equal',
        metadata: null,
        created_at: '2026-07-01T10:00:00Z',
        updated_at: '2026-07-01T10:00:00Z',
      },
      {
        id: 'e-2',
        trip_id: 'trip-1',
        payer_id: 'user-bob',
        title: 'Nourriture lyophilisée',
        amount: 150,
        currency: 'EUR',
        category: 'nourriture',
        expense_date: '2026-07-11',
        split_type: 'equal',
        metadata: null,
        created_at: '2026-07-01T10:00:00Z',
        updated_at: '2026-07-01T10:00:00Z',
      },
    ];

    const result = calculateBudgetSummary(
      { estimated_budget: 1000, budget_currency: 'EUR' },
      expenses,
      mockCollaborators
    );

    expect(result.totalSpent).toBe(450);
    expect(result.estimatedBudget).toBe(1000);
    expect(result.remainingBudget).toBe(550);
    expect(result.spentPercentage).toBe(45);
    expect(result.currency).toBe('EUR');
  });

  it('gère le dépassement de budget (reste négatif, pourcentage > 100%)', () => {
    const expenses: TripExpense[] = [
      {
        id: 'e-1',
        trip_id: 'trip-1',
        payer_id: 'user-alice',
        title: 'Vol Paris-Katmandou',
        amount: 1200,
        currency: 'EUR',
        category: 'transport',
        expense_date: '2026-07-10',
        split_type: 'equal',
        metadata: null,
        created_at: '2026-07-01T10:00:00Z',
        updated_at: '2026-07-01T10:00:00Z',
      },
    ];

    const result = calculateBudgetSummary(
      { estimated_budget: 1000, budget_currency: 'EUR' },
      expenses,
      mockCollaborators
    );

    expect(result.totalSpent).toBe(1200);
    expect(result.remainingBudget).toBe(-200);
    expect(result.spentPercentage).toBe(120);
    expect(result.isOverBudget).toBe(true);
  });

  it('gère un budget prévisionnel non renseigné ou nul', () => {
    const expenses: TripExpense[] = [
      {
        id: 'e-1',
        trip_id: 'trip-1',
        payer_id: 'user-alice',
        title: 'Café & barres',
        amount: 25,
        currency: 'EUR',
        category: 'nourriture',
        expense_date: '2026-07-10',
        split_type: 'equal',
        metadata: null,
        created_at: '2026-07-01T10:00:00Z',
        updated_at: '2026-07-01T10:00:00Z',
      },
    ];

    const result = calculateBudgetSummary(
      { estimated_budget: null, budget_currency: 'EUR' },
      expenses,
      mockCollaborators
    );

    expect(result.totalSpent).toBe(25);
    expect(result.estimatedBudget).toBeNull();
    expect(result.remainingBudget).toBeNull();
    expect(result.spentPercentage).toBeNull();
    expect(result.isOverBudget).toBe(false);
  });

  it('ventile fidèlement les dépenses par catégorie', () => {
    const expenses: TripExpense[] = [
      {
        id: 'e-1',
        trip_id: 'trip-1',
        payer_id: 'user-alice',
        title: 'Refuge',
        amount: 200,
        currency: 'EUR',
        category: 'hébergement',
        expense_date: '2026-07-10',
        split_type: 'equal',
        metadata: null,
        created_at: '2026-07-01T10:00:00Z',
        updated_at: '2026-07-01T10:00:00Z',
      },
      {
        id: 'e-2',
        trip_id: 'trip-1',
        payer_id: 'user-alice',
        title: 'Bivouac taxe',
        amount: 50,
        currency: 'EUR',
        category: 'hébergement',
        expense_date: '2026-07-11',
        split_type: 'equal',
        metadata: null,
        created_at: '2026-07-01T10:00:00Z',
        updated_at: '2026-07-01T10:00:00Z',
      },
      {
        id: 'e-3',
        trip_id: 'trip-1',
        payer_id: 'user-bob',
        title: 'Bus Chamonix',
        amount: 80,
        currency: 'EUR',
        category: 'transport',
        expense_date: '2026-07-12',
        split_type: 'equal',
        metadata: null,
        created_at: '2026-07-01T10:00:00Z',
        updated_at: '2026-07-01T10:00:00Z',
      },
    ];

    const result = calculateBudgetSummary(
      { estimated_budget: 500, budget_currency: 'EUR' },
      expenses,
      mockCollaborators
    );

    expect(result.categories['hébergement']).toBe(250);
    expect(result.categories['transport']).toBe(80);
  });

  it('calcule les balances individuelles et simplifie les dettes de façon optimale', () => {
    const expenses: TripExpense[] = [
      {
        id: 'e-1',
        trip_id: 'trip-1',
        payer_id: 'user-alice',
        title: 'Tente commune & réchaud',
        amount: 90,
        currency: 'EUR',
        category: 'matériel',
        expense_date: '2026-07-10',
        split_type: 'equal',
        metadata: null,
        created_at: '2026-07-01T10:00:00Z',
        updated_at: '2026-07-01T10:00:00Z',
      },
      {
        id: 'e-2',
        trip_id: 'trip-1',
        payer_id: 'user-bob',
        title: 'Ravitaillement fruits secs',
        amount: 30,
        currency: 'EUR',
        category: 'nourriture',
        expense_date: '2026-07-11',
        split_type: 'equal',
        metadata: null,
        created_at: '2026-07-01T10:00:00Z',
        updated_at: '2026-07-01T10:00:00Z',
      },
    ];

    const result = calculateBudgetSummary(
      { estimated_budget: 300, budget_currency: 'EUR' },
      expenses,
      mockCollaborators
    );

    const aliceBalance = result.balances.find(b => b.userId === 'user-alice');
    const bobBalance = result.balances.find(b => b.userId === 'user-bob');
    const charlieBalance = result.balances.find(b => b.userId === 'user-charlie');

    expect(aliceBalance?.paid).toBe(90);
    expect(aliceBalance?.share).toBe(40);
    expect(aliceBalance?.net).toBe(50);

    expect(bobBalance?.paid).toBe(30);
    expect(bobBalance?.share).toBe(40);
    expect(bobBalance?.net).toBe(-10);

    expect(charlieBalance?.paid).toBe(0);
    expect(charlieBalance?.share).toBe(40);
    expect(charlieBalance?.net).toBe(-40);

    expect(result.settlements).toHaveLength(2);
    const charlieToAlice = result.settlements.find(
      s => s.fromUserId === 'user-charlie' && s.toUserId === 'user-alice'
    );
    const bobToAlice = result.settlements.find(
      s => s.fromUserId === 'user-bob' && s.toUserId === 'user-alice'
    );

    expect(charlieToAlice?.amount).toBe(40);
    expect(bobToAlice?.amount).toBe(10);
  });

  it('traite les dépenses de type "individual" sans impacter les autres participants', () => {
    const expenses: TripExpense[] = [
      {
        id: 'e-1',
        trip_id: 'trip-1',
        payer_id: 'user-bob',
        title: 'Souvenir personnel',
        amount: 50,
        currency: 'EUR',
        category: 'divers',
        expense_date: '2026-07-10',
        split_type: 'individual',
        metadata: null,
        created_at: '2026-07-01T10:00:00Z',
        updated_at: '2026-07-01T10:00:00Z',
      },
    ];

    const result = calculateBudgetSummary(
      { estimated_budget: 200, budget_currency: 'EUR' },
      expenses,
      mockCollaborators
    );

    expect(result.totalSpent).toBe(50);
    const bobBalance = result.balances.find(b => b.userId === 'user-bob');
    const aliceBalance = result.balances.find(b => b.userId === 'user-alice');

    expect(bobBalance?.net).toBe(0);
    expect(aliceBalance?.net).toBe(0);
    expect(result.settlements).toHaveLength(0);
  });
});
