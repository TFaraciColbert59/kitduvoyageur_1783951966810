export async function readBoundedJson(request:Request,maxBytes=16384):Promise<unknown> {
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    throw new Error('UNSUPPORTED_MEDIA_TYPE');
  const reader=request.body?.getReader();if(!reader) throw new Error('INVALID_JSON');
  let bytes=0;const parts:Uint8Array[]=[];
  try {
    for(;;) {
      const {done,value}=await reader.read();if(done) break;
      bytes+=value.byteLength;if(bytes>maxBytes){await reader.cancel();throw new Error('BODY_TOO_LARGE');}
      parts.push(value);
    }
  } finally {reader.releaseLock();}
  const buffer=new Uint8Array(bytes);let offset=0;
  for(const part of parts){buffer.set(part,offset);offset+=part.length;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer));}
  catch{throw new Error('INVALID_JSON');}
}
