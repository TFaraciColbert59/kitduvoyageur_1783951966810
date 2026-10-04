import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({user:{id:'owner'} as {id:string}|null,rpc:vi.fn(),deleteResult:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:mocks.user}})},rpc:mocks.rpc,from:()=>({delete:()=>({eq:()=>({eq:()=>({select:()=>({maybeSingle:mocks.deleteResult})})})})})})}));
import {POST} from '@/app/api/materiel/items/[id]/transition/route';
import {PATCH,DELETE} from '@/app/api/materiel/items/[id]/route';
const context={params:Promise.resolve({id:'item'})};
const request=(body:unknown)=>new NextRequest('http://localhost/api/materiel/items/item',{method:'POST',body:JSON.stringify(body)});
beforeEach(()=>{mocks.user={id:'owner'};mocks.rpc.mockReset();});
describe('authenticated inventory actions',()=>{
 it('requires authentication before mutation',async()=>{mocks.user=null;expect((await POST(request({}),context)).status).toBe(401);expect(mocks.rpc).not.toHaveBeenCalled();});
 it('requires expected status and rejects injected protected fields',async()=>{expect((await POST(request({status:'vendu'}),context)).status).toBe(400);expect((await PATCH(request({status:'vendu'}),context)).status).toBe(400);expect((await PATCH(request({user_id:'attacker'}),context)).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();});
 it.each([['P0002',404],['40001',409],['23514',400],['55000',409]])('maps database %s to %s',async(code,status)=>{mocks.rpc.mockResolvedValue({error:{code,message:'test'}});expect((await POST(request({status:'vendu',expected_status:'en_stock'}),context)).status).toBe(status);});
 it('sends owner-checked transactional transition RPC',async()=>{mocks.rpc.mockResolvedValue({data:{id:'item',status:'vendu'}});const result=await POST(request({status:'vendu',expected_status:'en_stock'}),context);expect(result.status).toBe(200);expect(mocks.rpc).toHaveBeenCalledWith('transition_inventory_item',{p_id:'item',p_status:'vendu',p_expected_status:'en_stock'});});
 it('patch keeps optional defaults absent',async()=>{mocks.rpc.mockResolvedValue({data:{id:'item'}});expect((await PATCH(request({name:'New'}),context)).status).toBe(200);expect(mocks.rpc).toHaveBeenCalledWith('patch_inventory_item',{p_id:'item',p_patch:{name:'New'}});});
});

describe('inventory deletion',()=>{
 it('returns 404 for missing or nonowned object',async()=>{mocks.deleteResult.mockResolvedValue({data:null,error:null});expect((await DELETE(request({}),context)).status).toBe(404);});
 it('returns conflict for active or sold object',async()=>{mocks.deleteResult.mockResolvedValue({data:null,error:{code:'55000',message:'engaged'}});expect((await DELETE(request({}),context)).status).toBe(409);});
});
