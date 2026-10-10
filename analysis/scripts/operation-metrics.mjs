import {readConfig,authHeaders} from './grafana.mjs';
export function operationLink(g,id,kind){
 if(!g.grafanaUrl||!g.datasourceUid)return null;
 const u=new URL('/a/grafana-exploretraces-app/explore',g.grafanaUrl);
 const attribute=g.operationAttribute||'trace.entry.id';
 const filters=['span.'+attribute+'|=|'+id];
 if(kind==='gui'&&g.originAttribute)filters.push('span.'+g.originAttribute+'|=|gui');
 const values={'var-ds':g.datasourceUid,from:'now-1h',to:'now',timezone:'browser','var-primarySignal':'nestedSetParent<0','var-metric':'duration','var-groupBy':'resource.service.name','var-durationPercentiles':'0.5,0.9,0.95',actionView:'traceList'};
 for(const [key,value] of Object.entries(values))u.searchParams.set(key,value);
 for(const filter of filters)u.searchParams.append('var-filters',filter);
 return u.href;
}
export function decodePercentiles(result){const data={p50Ms:null,p90Ms:null,p95Ms:null};for(const s of result.series||[]){const label=s.labels?.find(x=>x.key==='p');const p=Number(label?.value?.doubleValue??label?.value?.stringValue);const key=new Map([[.5,'p50Ms'],[.9,'p90Ms'],[.95,'p95Ms']]).get(p);const value=Number(s.value);if(key&&s.value!==undefined&&Number.isFinite(value))data[key]=value*1000;}return data;}
const cache=new Map();
export async function operationMetrics(file,o){const key=file+'\0'+o.id+'\0'+o.entry.kind,prior=cache.get(key);if(prior&&Date.now()-prior.time<60000)return prior.promise;
 const promise=(async()=>{const g=readConfig(file),now=Math.floor(Date.now()/1000);const attribute=g.operationAttribute||'trace.entry.id';if(!/^[a-zA-Z0-9._]+$/.test(attribute)||g.originAttribute&&!/^[a-zA-Z0-9._]+$/.test(g.originAttribute))throw Error('Invalid tracing attribute configuration');const selector='{nestedSetParent<0 && span.'+attribute+'='+JSON.stringify(o.id)+(o.entry.kind==='gui'&&g.originAttribute?' && span.'+g.originAttribute+'="gui"':'')+'}';const q=selector+' | quantile_over_time(duration, .5, .9, .95)';
 const r=await fetch(g.queryEndpoint.replace(/\/$/,'')+'/api/metrics/query?'+new URLSearchParams({q,start:String(now-3600),end:String(now)}),{headers:{...authHeaders(g),Accept:'application/json'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Tempo metrics HTTP '+r.status);return {operation:o.id,provider:'grafana-tempo',windowMinutes:60,scope:'matching root span duration',...decodePercentiles(await r.json()),grafanaUrl:operationLink(g,o.id,o.entry.kind)};})();cache.set(key,{time:Date.now(),promise});try{return await promise;}catch(e){cache.delete(key);throw e;}}
