import {NextRequest,NextResponse} from 'next/server';
import {listingActionSchema} from '@/features/marketplace/domain/validation';
import {mutate,uuidSchema} from '@/features/marketplace/server/http';
export async function POST(req:NextRequest,context:{params:Promise<{id:string}>}){const {id}=await context.params;if(!uuidSchema.safeParse(id).success)return NextResponse.json({error:'Identifiant invalide'},{status:400});return mutate(req,listingActionSchema,'marketplace_listing_action',b=>({p_id:id,p_action:b.action}),'listing')}
