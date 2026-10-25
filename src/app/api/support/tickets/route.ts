import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supportTicketSchema } from '@/features/support/validation';
import { inventoryErrorStatus } from '@/features/materiel/domain/apiErrors';
export async function POST(req: NextRequest) {
  try {
    const db = await createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return NextResponse.json(
        { error: 'Connectez-vous pour enregistrer votre demande' },
        { status: 401 }
      );
    const parsed = supportTicketSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: 'Sujet ou message invalide (10 à 5000 caractères)' },
        { status: 400 }
      );
    const { data, error } = await db.rpc('create_support_ticket', {
      p_subject: parsed.data.subject,
      p_message: parsed.data.message,
    });
    if (error)
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'PT429' ? 429 : inventoryErrorStatus(error) }
      );
    return NextResponse.json({ ticket: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Enregistrement impossible' },
      { status: error instanceof SyntaxError ? 400 : 500 }
    );
  }
}
export async function GET() {
  try {
    const db = await createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const { data, error } = await db
      .from('support_tickets')
      .select('id,subject,message,status,response,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    const { data: admin } = await db.rpc('is_admin');
    return NextResponse.json({ tickets: data ?? [], canManage: admin === true });
  } catch (error) {
    return NextResponse.json({ error: 'Lecture impossible' }, { status: 503 });
  }
}
