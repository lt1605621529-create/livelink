const path=require('node:path'),fs=require('node:fs'),{spawnSync}=require('node:child_process')
const esbuild=require('esbuild')
;(async()=>{
 const out=path.resolve('node_modules/.cache/ai-ipc')
 fs.mkdirSync(out,{recursive:true})
 for(const [entry,file] of [
  ['scripts/fixtures/ai-ipc-main.ts','main.cjs'],
  ['scripts/fixtures/ai-ipc-preload.cjs','probe-preload.cjs'],
  ['src/preload/index.ts','production-preload.cjs']
 ]) await esbuild.build({entryPoints:[entry],outfile:path.join(out,file),bundle:true,platform:'node',format:'cjs',external:['electron','./production-preload.cjs'],logLevel:'warning'})
 const {build}=await import('vite')
 const vue=(await import('@vitejs/plugin-vue')).default
 await build({configFile:false,define:{'process.env.NODE_ENV':JSON.stringify('production')},plugins:[vue()],logLevel:'warn',build:{outDir:out,emptyOutDir:false,lib:{entry:path.resolve('scripts/fixtures/ai-ipc-renderer.mjs'),formats:['iife'],name:'AiIpcRegression',fileName:()=> 'renderer.js'}}})
 fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><html><head><meta charset="UTF-8"></head><body><div id="app"></div><script src="renderer.js"></script></body></html>')
 const result=spawnSync(require('electron'),[path.join(out,'main.cjs'),...process.argv.slice(2)],{stdio:'inherit'})
 process.exit(result.status??1)
})().catch(()=>{console.error('AI IPC regression build/launch failed');process.exit(1)})
