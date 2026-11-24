const mem = new Map<string,string>();
globalThis.localStorage = { getItem:(k:string)=>mem.get(k)??null, setItem:(k:string,v:string)=>void mem.set(k,String(v)), removeItem:(k:string)=>void mem.delete(k), clear:()=>mem.clear(), key:()=>null, length:0 } as any;
globalThis.window = { dispatchEvent:()=>true } as any;
globalThis.CustomEvent = class { constructor(public t:string,public i?:any){} } as any;
let blobSize = 0;
const RealURL = globalThis.URL;
(globalThis as any).URL = Object.assign(function(...a:any[]){ return new (RealURL as any)(...a); }, RealURL, {
  createObjectURL: (b:any)=>{ blobSize = b?.size ?? b?.byteLength ?? 0; return 'blob:x'; },
  revokeObjectURL: () => {},
});
(globalThis as any).document = {
  createElement: () => ({ href:'', download:'', click(){}, style:{} }),
  body: { appendChild(){}, removeChild(){} },
};
const { generateBulkRegistrationTemplate } = await import('../src/services/bulkRegistration/templateGenerator');
try {
  await generateBulkRegistrationTemplate();
  console.log('TEMPLATE GEN OK, blob bytes:', blobSize);
} catch (e:any) {
  console.log('TEMPLATE GEN FAIL', e.message);
  process.exit(1);
}
