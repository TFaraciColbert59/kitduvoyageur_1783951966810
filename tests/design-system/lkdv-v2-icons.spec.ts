import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {resolveMaskFile} from '@/components/ui/Icon/registry';
import {LKDV_ASSET_NAMES,LKDV_PRIMARY,resolveLKDVFile} from '@/components/ui/Icon/lkdv.registry';
describe('LKDV V2 single-green vector icon library',()=>{
 it('prefers LKDV SVGs for navigation and legacy icons',()=>{
  expect(resolveMaskFile('globe')).toBe('lkdv/monde.svg');
  expect(resolveMaskFile('GlobeAltIcon')).toBe('lkdv/monde.svg');
  expect(resolveMaskFile('MapPinIcon')).toBe('lkdv/point_d_interet.svg');
  expect(resolveMaskFile('compass')).toBe('lkdv/boussole.svg');
  expect(resolveMaskFile('HomeIcon')).toBe('lkdv/accueil.svg');
  expect(resolveLKDVFile('UnknownForTestingIcon')).toBeUndefined();
 });
 it('ensures all SVGs exist and have exactly one opaque green with no gradient',()=>{
  expect(LKDV_ASSET_NAMES.size).toBeGreaterThanOrEqual(238);
  for(const name of LKDV_ASSET_NAMES){const path=join(process.cwd(),'public','icons','lkdv',name+'.svg');expect(existsSync(path),path).toBe(true);const svg=readFileSync(path,'utf8');expect(svg).toContain('stroke="'+LKDV_PRIMARY+'"');expect(svg).toContain('fill="none"');expect(svg).not.toMatch(/<image|(?:linear|radial)Gradient|stroke-opacity|fill-opacity/);expect((svg.match(/#[a-fA-F0-9]{6}/g)||[]).every(x=>x.toLowerCase()===LKDV_PRIMARY.toLowerCase())).toBe(true);}
 });
});
