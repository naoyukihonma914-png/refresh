import type { SaveStorage } from './storage';
export const CAPTURE_PREFIX='refresh.capture.';
const INDEX=CAPTURE_PREFIX+'index';
const stores=new WeakMap<SaveStorage,CaptureStore>();
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function fingerprint(raw:string):string {
  let a=2166136261,b=5381;
  for(let i=0;i<raw.length;i++){a=Math.imul(a^raw.charCodeAt(i),16777619);b=Math.imul(b,33)^raw.charCodeAt(i);}
  return `${raw.length.toString(36)}-${(a>>>0).toString(36)}-${(b>>>0).toString(36)}`;
}
/** Immutable, shared scene sections. Only newly captured sections are written. */
export class CaptureStore {
  private refs=new Map<string,string>();
  private values=new Map<string,string>();
  private keys:Set<string>;
  private added:string[]=[];
  private oldIndex:string|null=null;
  constructor(private storage:SaveStorage){
    let index:unknown;try{index=JSON.parse(storage.getItem(INDEX)??'[]');}catch{index=[];}
    this.keys=new Set(Array.isArray(index)?index.filter((v):v is string=>typeof v==='string'&&v.startsWith(CAPTURE_PREFIX)&&v!==INDEX):[]);
  }
  reload(){this.values.clear();this.refs.clear();}
  begin(){this.added=[];this.oldIndex=this.storage.getItem(INDEX);}
  private putValue(raw:string):string {
    const base=CAPTURE_PREFIX+fingerprint(raw);let key=base;
    for(let suffix=0;;suffix++){
      const previous=this.values.get(key)??this.storage.getItem(key);
      if(previous===raw){this.values.set(key,raw);return key;}
      if(previous===null||previous===undefined){this.storage.setItem(key,raw);this.values.set(key,raw);this.keys.add(key);this.added.push(key);return key;}
      key=`${base}-${suffix+1}`; // A hash collision never aliases different content.
    }
  }
  put(data:string):string {
    const cached=this.refs.get(data);if(cached)return cached;
    const scene:unknown=JSON.parse(data);if(!object(scene))throw new Error('Invalid scene');
    const sections=Object.fromEntries(Object.entries(scene).map(([key,value])=>[key,this.putValue(JSON.stringify(value))]));
    const ref=this.putValue(JSON.stringify({format:1,sections}));this.refs.set(data,ref);return ref;
  }
  get(ref:string):string {
    const read=(key:string)=>{
      if(!key.startsWith(CAPTURE_PREFIX)||key===INDEX)throw new Error('Invalid scene reference');
      const value=this.values.get(key)??this.storage.getItem(key);if(value===null||value===undefined)throw new Error('Missing scene');
      this.values.set(key,value);return value;
    };
    const root:unknown=JSON.parse(read(ref));
    if(!object(root)||root.format!==1||!object(root.sections))throw new Error('Invalid scene manifest');
    const entries=Object.entries(root.sections).map(([key,value])=>{if(typeof value!=='string')throw new Error('Invalid section reference');return [key,JSON.parse(read(value))];});
    const data=JSON.stringify(Object.fromEntries(entries));this.refs.set(data,ref);return data;
  }
  flush(){if(this.added.length)this.storage.setItem(INDEX,JSON.stringify([...this.keys]));}
  finish(){this.added=[];this.oldIndex=null;}
  rollback(){
    for(const key of this.added){try{this.storage.removeItem(key);}catch{/* Preserve the original save even if cleanup is unavailable. */}this.keys.delete(key);}
    try{if(this.oldIndex===null)this.storage.removeItem(INDEX);else this.storage.setItem(INDEX,this.oldIndex);}catch{/* Original primary and backup remain intact. */}
    this.refs.clear();this.values.clear();this.added=[];
  }
  clear(){for(const key of this.keys)this.storage.removeItem(key);this.storage.removeItem(INDEX);this.keys.clear();this.refs.clear();this.values.clear();}
}
export function captureStore(storage:SaveStorage):CaptureStore {
  let store=stores.get(storage);if(!store){store=new CaptureStore(storage);stores.set(storage,store);}return store;
}
