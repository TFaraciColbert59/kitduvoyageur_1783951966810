import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

function toICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** GET /api/materiel/calendar — export ICS des retours de prêts à venir. */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { data: loans, error } = await supabase
      .from('materiel_loans')
      .select('*')
      .eq('lender_id', user.id)
      .eq('status', 'en_cours')
      .not('due_date', 'is', null);
    if (error) throw error;

    const now = new Date();
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LKDV//Materiel//FR',
    ];

    for (const loan of loans ?? []) {
      const due = new Date(`${loan.due_date}T09:00:00Z`);
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:loan-${loan.id}@lkdv`);
      lines.push(`DTSTAMP:${toICSDate(now)}`);
      lines.push(`DTSTART:${toICSDate(due)}`);
      lines.push('SUMMARY:Retour de prêt (Mon Matériel)');
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');

    return new NextResponse(lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="retours-prets.ics"',
      },
    });
  } catch (err) {
    console.error('GET /api/materiel/calendar', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
