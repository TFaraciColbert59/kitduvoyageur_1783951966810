import { CatalogueScreen } from '@/components/catalogue/catalogue-screen';
import { getContext } from '@/components/data/admin-rpc';
import { Workspace } from '@/components/shell/workspace';

export const dynamic = 'force-dynamic';

/** Catalogue des 144 actions (barre de commande et tiroirs génériques). */
export default async function CataloguePage({
  searchParams
}: {
  searchParams: Promise<{ pole?: string; agent?: string; cas?: string; q?: string }>;
}) {
  const query = await searchParams;
  const context = await getContext();

  return (
    <Workspace>
      <CatalogueScreen ctx={context.data} initialPole={query.pole} initialQuery={query.q} />
    </Workspace>
  );
}
