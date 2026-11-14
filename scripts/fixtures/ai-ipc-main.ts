import { app, BrowserWindow, ipcMain, safeStorage } from 'electron'
import { mkdtempSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AppConfig } from '../../src/main/config/store'
import { registerAiReplyConfigIpc } from '../../src/main/config/ai-reply-ipc'
import { IpcChannels } from '../../src/shared/ipc-channels'

const profile=mkdtempSync(join(tmpdir(),'livelink-ai-ipc-'))
app.setPath('userData',profile)
app.disableHardwareAcceleration()
let stage='load-renderer'
ipcMain.on('ai-test:stage', (_e, label:string) => { if (/^[a-z-]+$/.test(label)) stage=label })
void app.whenReady().then(async()=>{
  const config=new AppConfig()
  const dummy='sk-fictional-storage-regression-key-0000'
  let invokes=0,handles=0,failStorage=false
  const patch=config.patchAiReply.bind(config)
  config.patchAiReply=value=>{handles++;if(failStorage)throw Error(dummy);return patch(value)}
  registerAiReplyConfigIpc(config)
  ipcMain.on('ai-test:invoke',()=>{invokes++})
  ipcMain.handle('ai-test:state',()=>({invokes,handles,secure:safeStorage.isEncryptionAvailable() && (process.platform!=='linux'||safeStorage.getSelectedStorageBackend()!=='basic_text')}))
  ipcMain.handle('ai-test:fail-storage',(_e,value:boolean)=>{failStorage=value})
  ipcMain.handle('ai-test:disk',()=>{
    const raw=readFileSync(join(profile,'livelink-config.json'),'utf8')
    return {encrypted:raw.includes('safe:'),plaintext:raw.includes(dummy),sameKey:new AppConfig().getAiReply().apiKey===dummy}
  })
  const win=new BrowserWindow({show:false,webPreferences:{preload:join(__dirname,'probe-preload.cjs'),sandbox:false,contextIsolation:true,nodeIntegration:false}})
  await win.loadFile(join(__dirname,'index.html'))
  const results=await win.webContents.executeJavaScript('window.runAiIpcTests()') as string[]
  for(const result of results)console.log(`PASS: ${result}`)
  if(invokes!==handles)throw Error('Preload and main boundary counts differ')
  // Also prove the production return handler can be serialized independently.
  if(!config.getAiReplyPublic().keywords.length)throw Error('Missing returned keywords')
  ipcMain.removeHandler(IpcChannels.AiReplyConfigGet)
  win.destroy();app.exit(0)
}).catch(error=>{
  const message=String(error?.message ?? '')
  if(message.startsWith('AI-ASSERT:')) console.error(message)
  console.error(`AI real Context Bridge/IPC/UI regression failed at ${stage} (sensitive error details withheld)`);app.exit(1)})
