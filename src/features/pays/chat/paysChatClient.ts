/**
 * POC mini-chat pays — client d'envoi vers POST /api/pays/[code]/chat.
 * La route centralise validation, quota, RAG optionnel et appel IA ;
 * ce client ne fait que le transport + la traduction d'erreurs en
 * messages clairs francophones (pur, testé).
 */

export interface PaysChatReply {
  text: string;
  degraded: boolean;
  ragUsed: boolean;
}

export async function sendPaysChatMessage(countryCode: string, question: string): Promise<PaysChatReply> {
  const code = countryCode.trim().toUpperCase();
  let res: Response;
  try {
    res = await fetch(`/api/pays/${code}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
  } catch {
    throw new Error('Connexion impossible — vérifie ta connexion puis réessaie.');
  }
  let data: { text?: string; degraded?: boolean; ragUsed?: boolean; error?: string };
  try {
    data = await res.json();
  } catch {
    throw new Error('Réponse illisible du serveur. Réessaie.');
  }
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('Trop de requêtes — réessaie dans une heure.');
    }
    throw new Error((data.error as string) || `Erreur ${res.status}`);
  }
  return {
    text: data.text ?? '',
    degraded: !!data.degraded,
    ragUsed: !!data.ragUsed,
  };
}
