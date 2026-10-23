import {createHash} from 'node:crypto';
export function canonicalJson(value:unknown):string {
  if(value===null||typeof value!=='object') {
    const result=JSON.stringify(value);
    if(result===undefined) throw new Error('JSON_NON_SERIALISABLE');
    return result;
  }
  if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;
  const o=value as Record<string,unknown>;
  return `{${Object.keys(o).sort().map(k=>`${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
}
export function fingerprint(value:unknown):string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}
