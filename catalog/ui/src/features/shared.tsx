import {casePerformanceP90} from '../../../../regression_test/record_store/performance.mjs';
import {recordedStepView} from '../../../../regression_test/record_store/step-view.mjs';
import {CheckCircle2,XCircle,Clock,MinusCircle,TriangleAlert,LoaderCircle,FileCode2} from 'lucide-react';
import {Badge} from '@/components/ui/badge';import {Button} from '@/components/ui/button';import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import {Alert,AlertTitle,AlertDescription} from '@/components/ui/alert';
import {TestCase,label,duration} from '@/lib/api';
export function Outcome({status}:{status:string}){
 const icons:Record<string,any>={passed:CheckCircle2,failed:XCircle,error:TriangleAlert,blocked:TriangleAlert,interrupted:TriangleAlert,excluded:MinusCircle,cancelled:MinusCircle,running:LoaderCircle,pending:Clock};
 const Icon=icons[status]||MinusCircle;
 const variant=['failed','error'].includes(status)?'failure':status==='passed'?'success':status==='running'?'progress':['blocked','interrupted'].includes(status)?'warning':'secondary';
 return <Badge variant={variant}><Icon data-icon="inline-start" className={status==='running'?'animate-spin motion-reduce:animate-none':undefined}/>{status==='excluded'?'Not run':status[0].toUpperCase()+status.slice(1)}</Badge>;
}
export {ScriptLink} from './script';
import {ScriptLink} from './script';
export function MetaValue({field,value}:{field:string;value:any}){return <Badge variant={field==='status'?(value==='active'?'success':value==='trial'?'progress':value==='rotten'?'warning':'secondary'):'secondary'}>{label(field,String(value))}</Badge>;}
export function ErrorNotice({error}:{error:string|null}){return error?<Alert variant="destructive"><TriangleAlert/><AlertTitle>Unable to complete the request</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>:null;}
const value=(v:any)=>v===undefined?'—':typeof v==='string'?v:JSON.stringify(v);
export function RecordedPerformance({item,compact=false}:{item:TestCase;compact?:boolean}){
 const traces=(item.traces||[]).filter(t=>Number.isFinite(t.durationMs)),timings=(item.measurements||[]).filter(t=>Number.isFinite(t.durationMs));
 if(compact){const summary=casePerformanceP90(item);return <span className="whitespace-nowrap text-xs tabular-nums">{summary?`P90 ${Math.round(summary.durationMs)} ms`:'—'}</span>;}


 return <div className="flex flex-col gap-1 text-xs text-muted-foreground">{traces.length?traces.map((t,i)=><div key={i}>{t.boundary==='operation-end-to-end'?'End-to-end trace':'Trace boundary unverified'} · {t.name||t.traceId}: {duration(t.durationMs)}{!compact&&t.grafanaUrl&&<a className="ml-2 underline" href={t.grafanaUrl} target="_blank" rel="noreferrer">Grafana</a>}</div>):<span>Trace performance: not collected</span>}{(item.telemetryDiagnostics||[]).filter(d=>d.state==='unavailable').map((d,i)=><div key={'missing-'+i}>Trace unavailable · {d.reason}</div>)}{timings.map((t,i)=><div key={'timing-'+i}>Runner diagnostics · {t.name}: {duration(t.durationMs)}</div>)}</div>;
}
export function CaseSheet({item,onClose,result=false}:{item:TestCase|null;onClose:()=>void;result?:boolean}){
 const steps=item?recordedStepView(item):[];
 return <Sheet open={!!item} onOpenChange={open=>{if(!open)onClose();}}><SheetContent className="w-full overflow-y-auto sm:max-w-2xl"><SheetHeader><SheetTitle>{item?.name}</SheetTitle><SheetDescription>{result?'Execution evidence and evaluated assertions':'Test case description and classification'}</SheetDescription></SheetHeader>{item&&<div className="flex flex-col gap-6 px-6 pb-8">
 <div className="flex items-center justify-between gap-4"><span className="font-mono text-xs text-muted-foreground">{item.id}</span><ScriptLink id={item.id} caseOnly={item.runnable===false}/></div>
 {result&&item.preflight&&<section><h3 className="mb-3 text-sm font-medium">Environment preflight</h3><p className="text-sm text-muted-foreground">Profile: {item.preflight.profile||'None'}</p>{Object.entries(item.preflight.resources||{}).map(([key,v]:[string,any])=><p key={key} className="mt-2 break-all font-mono text-xs">{key}: {v.name||v.id} {v.name&&v.id?'('+v.id+')':''}</p>)}{item.preflight.checks?.map((c:any,i:number)=><div key={i} className="mt-2"><Badge variant={c.ready?'success':'warning'}>{c.reason}</Badge></div>)}</section>}
 {result&&<div className="flex items-center gap-3"><Outcome status={item.status||'pending'}/><span className="text-sm text-muted-foreground">Script execution: {duration(item.durationMs)}</span></div>}
 {result&&<section><h3 className="mb-3 text-sm font-medium">Recorded performance</h3><RecordedPerformance item={item}/></section>}
 <section><h3 className="mb-3 text-sm font-medium">Use case</h3><p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{item.description}</p></section>
 {!result&&<dl className="grid grid-cols-2 gap-x-8 gap-y-5">{Object.keys(item.meta).map(key=><div key={key}><dt className="text-xs text-muted-foreground">{({module:'Module',surface:'Entry',priority:'Priority',origin:'Added for',cost:'Duration class',status:'Status',effects:'Effects',covers:'Coverage',requires:'Prerequisites',affectedPaths:'Affected paths',id:'Case ID',statusReason:'Status reason'} as Record<string,string>)[key]||key}</dt><dd className="mt-1 text-sm"><div className="flex flex-wrap gap-2">{(Array.isArray(item.meta[key])?(item.meta[key].length?item.meta[key]:['None']):[item.meta[key]]).map((v:any,i:number)=><MetaValue key={i} field={key} value={v}/>)}</div></dd></div>)}</dl>}
 {result&&<>{item.error&&<Alert variant="destructive"><AlertTitle>Failure</AlertTitle><AlertDescription>{item.error}</AlertDescription></Alert>}
 <section><h3 className="mb-3 text-sm font-medium">Assertions</h3><Table><TableHeader><TableRow><TableHead>Assertion</TableHead><TableHead>Result</TableHead><TableHead>Actual</TableHead><TableHead>Expected / Limit</TableHead></TableRow></TableHeader><TableBody>{(item.assertions||[]).map((a,i)=><TableRow key={i}><TableCell><div>{a.name}</div><div className="mt-1 text-xs text-muted-foreground">{a.kind==='performance'?(a.boundary==='provider trace'?'Performance · trace':'Timing · runner scope'):'Functional'}</div></TableCell><TableCell><Outcome status={a.passed?'passed':a.state==='inconclusive'?'blocked':'failed'}/></TableCell><TableCell className="max-w-40 whitespace-normal break-words font-mono text-xs">{value(a.unit&&typeof a.actual==='number'?Number(a.actual.toFixed(2)):a.actual)}{a.unit?' '+a.unit:''}</TableCell><TableCell className="max-w-40 whitespace-normal break-words font-mono text-xs">{value(a.expected??a.maximumMs)}{a.unit?' '+a.unit:''}</TableCell></TableRow>)}</TableBody></Table></section>
 {!!steps.length&&<section><h3 className="mb-3 text-sm font-medium">Execution steps</h3>{steps.some(s=>s.recordedStatus==='running')&&<p className="mb-3 text-sm text-muted-foreground">The case has ended. Steps last recorded as running were interrupted; their completion and cleanup results are unknown. Original execution evidence is preserved.</p>}<Table><TableHeader><TableRow><TableHead>Step</TableHead><TableHead>Result</TableHead><TableHead>Duration</TableHead></TableRow></TableHeader><TableBody>{steps.map((s,i)=><TableRow key={i}><TableCell>{s.name}</TableCell><TableCell><Outcome status={s.status}/></TableCell><TableCell className="tabular-nums">{duration(s.durationMs)}</TableCell></TableRow>)}</TableBody></Table></section>}
 {(item.outputs||[]).map((o,i)=><section key={i}><h3 className="mb-3 text-sm font-medium">Command output · {o.name}</h3><pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-6">{o.stdout||o.stderr||'No output'}</pre></section>)}
 {!!item.diagnostics?.length&&<section><h3 className="mb-3 text-sm font-medium">Browser diagnostics</h3><ul className="flex flex-col gap-2 text-sm text-muted-foreground">{item.diagnostics.map((d,i)=><li key={i}>{d.kind} · {d.path||d.message} {d.status||d.error||''}</li>)}</ul></section>}
 {(item.evidence||[]).map((e,i)=><figure key={i}><figcaption className="mb-3 text-sm font-medium">{e.name}</figcaption><a href={'/evidence?path='+encodeURIComponent(e.path)} target="_blank" rel="noreferrer"><img className="w-full rounded-md border" src={'/evidence?path='+encodeURIComponent(e.path)} alt={e.name}/></a></figure>)}
 </>}
 <p className="break-all font-mono text-xs text-muted-foreground">{item.file}</p>
 </div>}</SheetContent></Sheet>;
}
