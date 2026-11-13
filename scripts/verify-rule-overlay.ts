import { app, BrowserWindow } from 'electron'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import mitt from 'mitt'
import { OverlayServer } from '../src/main/overlay-server/server'
import { OverlayBroadcaster } from '../src/main/actions/overlay'
import { ActionDispatcher } from '../src/main/actions/dispatcher'
import { RuleEngine } from '../src/main/rules/engine'
import { createBilibiliRuleHandlers } from '../src/main/platform/bilibili-events'
import { createRule } from '../src/shared/rules'
import type { StandardEvent } from '../src/main/platform/adapter'

app.disableHardwareAcceleration()
const server=new OverlayServer()
let win:BrowserWindow | undefined
void app.whenReady().then(async()=>{
  let connected!:()=>void
  const ready=new Promise<void>(r=>{connected=r})
  const port=await server.start({rendererDir:resolve('out/renderer'),preferredPort:38650,onSocketConnect:()=>connected()})
  const overlay=new OverlayBroadcaster();overlay.setSender(msg=>server.broadcast(msg))
  const spoken:string[]=[],logs:string[]=[]
  const dispatcher=new ActionDispatcher({tts:{enqueue:(text:string)=>spoken.push(text)},log:{writeFromRule:(_r:unknown,_e:unknown,text:string)=>logs.push(text)},overlay,blindboxStore:{},wallet:{},getCurrentRoomId:()=>123,getCurrencyName:()=>'',getInitialBalance:()=>0} as never)
  const bus=mitt<{event:StandardEvent}>()
  const engine=new RuleEngine({bus,dispatcher})
  const rule=createRule('follow.received');rule.actions=[
    {kind:'log',template:{text:'日志：感谢{uname}关注'}},
    {kind:'tts',template:{text:'朗读：感谢{uname}关注'}},
    {kind:'overlay',overlayPayload:{kind:'rule.message',text:'画面：感谢{uname}关注'}}
  ]
  engine.upsertRule(rule);engine.attach()
  win=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}})
  await win.loadURL(`http://127.0.0.1:${port}/overlay`)
  await Promise.race([ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Overlay socket timeout')),10000))])
  createBilibiliRuleHandlers(123,event=>bus.emit('event',event)).onUserAction!({timestamp:1,body:{action:'follow',user:{uid:123,uname:'测试观众'}}} as never)
  let text=''
  const deadline=Date.now()+5000
  while(Date.now()<deadline) {
    text=await win.webContents.executeJavaScript('document.body.innerText')
    if(text.includes('画面：感谢测试观众关注'))break
    await new Promise(r=>setTimeout(r,50))
  }
  assert.ok(text.includes('画面：感谢测试观众关注'),'Custom rule text must visibly render in the real OBS page')
  assert.deepEqual(spoken,['朗读：感谢测试观众关注'])
  assert.deepEqual(logs,['日志：感谢测试观众关注'])
  engine.detach();win.destroy();await server.stop()
  console.log('3/3 Bilibili → rules → TTS/log/real OBS DOM checks passed')
  app.exit(0)
}).catch(async error=>{
  console.error(error);win?.destroy();await server.stop();app.exit(1)
})
