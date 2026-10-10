import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {configure} from '../setup/configure.mjs';
import {query,readConfig} from '../analysis/scripts/grafana.mjs';
test('configuration rejects parent-directory project names before writing',()=>{
 for(const project of ['..','.','../other',''])assert.throws(()=>configure({project}),/Project ID/);
});
test('no provider configuration cannot issue a query; custom attributes isolate tenants',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'devops-isolation-'));const original=globalThis.fetch;const requests=[];
 try{
 globalThis.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({traces:[]})};};
 await assert.rejects(query(undefined,'executions',{operation:'example.open'}),/config required/);assert.equal(requests.length,0);
 const credentials=path.join(dir,'credentials.json');fs.writeFileSync(credentials,JSON.stringify({token:'isolated-token'}),{mode:0o600});
 const config=path.join(dir,'connection.json');const base={queryEndpoint:'https://customer.example/tempo',queryInstanceId:'customer-tenant',credentialsFile:credentials};
 fs.writeFileSync(config,JSON.stringify(base));await query(config,'executions',{operation:'example.open'});
 assert.equal(new URL(requests[0].url).hostname,'customer.example');assert.equal(new URL(requests[0].url).searchParams.get('q'),'{span.trace.entry.id="example.open"}');
 assert.equal(requests[0].options.headers.Authorization,'Basic '+Buffer.from('customer-tenant:isolated-token').toString('base64'));
 fs.writeFileSync(config,JSON.stringify({...base,operationAttribute:'customer.operation'}));await query(config,'executions',{operation:'example.open'});
 assert.equal(new URL(requests[1].url).searchParams.get('q'),'{span.customer.operation="example.open"}');
 fs.writeFileSync(config,JSON.stringify({...base,queryEndpoint:'https://user:password@example.com'}));assert.throws(()=>readConfig(config),/HTTPS/);
 }finally{globalThis.fetch=original;fs.rmSync(dir,{recursive:true,force:true});}
});
test('a loopback provider may use HTTP without tenant or credentials; remote HTTP stays rejected',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'devops-loopback-'));const original=globalThis.fetch;const requests=[];
 try{
 globalThis.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({traces:[]})};};
 const config=path.join(dir,'connection.json');fs.writeFileSync(config,JSON.stringify({queryEndpoint:'http://127.0.0.1:3200'}));
 await query(config,'executions',{operation:'example.open'});
 assert.equal(new URL(requests[0].url).host,'127.0.0.1:3200');assert.equal(requests[0].options.headers.Authorization,undefined);
 fs.writeFileSync(config,JSON.stringify({queryEndpoint:'http://tempo.example:3200'}));assert.throws(()=>readConfig(config),/HTTPS/);
 fs.writeFileSync(config,JSON.stringify({queryEndpoint:'https://customer.example/tempo'}));assert.throws(()=>readConfig(config),/credentials required/);
 assert.throws(()=>configure({project:'remote-http',queryEndpoint:'http://tempo.example:3200'}),/HTTPS/);
 }finally{globalThis.fetch=original;fs.rmSync(dir,{recursive:true,force:true});}
});
