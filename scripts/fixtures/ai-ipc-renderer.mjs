import { createApp, reactive, isProxy } from 'vue'
import AiReply from '../../src/renderer/pages/AiReply.vue'
import { DEFAULT_AI_REPLY_CONFIG, toPublicAiReplyConfig, toAiReplyPatchDto, maskApiKey } from '../../src/shared/ai-reply'

const dummy = 'sk-fictional-storage-regression-key-0000'
const check=(value,message)=>{if(!value)throw Error('AI-ASSERT:'+message)}
const waitFor=async(fn,message)=>{const deadline=Date.now()+5000;while(Date.now()<deadline){if(await fn())return;await new Promise(r=>setTimeout(r,30))}throw Error('AI-ASSERT:'+message)}
const click=text=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);check(button,'Button exists');button.click()}
const inputKey=()=>document.querySelector('input[placeholder^="sk-"]')
const putKey=value=>{inputKey().value=value;inputKey().dispatchEvent(new Event('input',{bubbles:true}))}

window.runAiIpcTests=async()=>{
  const results=[]
  const config=reactive(toPublicAiReplyConfig(DEFAULT_AI_REPLY_CONFIG))
  window.aiProbe.stage('plain')
  let before=await window.aiProbe.state()
  const plain=await window.api.aiReplyConfigPatch({enabled:false,keywords:['普通','配置']})
  check(plain.keywords[0]==='普通','Plain save')
  check(!!structuredClone(plain) && !('apiKey' in plain),'Return serialization/public fields')
  results.push('plain request and response serialization')
  window.aiProbe.stage('proxy-boundary')
  before=await window.aiProbe.state()
  for(const payload of [config,{...config}]) {
    check(isProxy(payload.keywords),'Vue nested Proxy reproduced')
    let rejected=false;try{await window.api.aiReplyConfigPatch(payload)}catch{rejected=true}
    check(rejected,'Raw Vue Proxy must fail at contextBridge boundary')
  }
  const after=await window.aiProbe.state()
  check(before.invokes===after.invokes && before.handles===after.handles,'Proxy failure occurs before preload invoke/main handler')
  results.push('renderer-contextBridge boundary reproduced')
  window.aiProbe.stage('dto')
  const dto=toAiReplyPatchDto(config)
  check(!isProxy(dto.keywords),'DTO keywords are ordinary array')
  const saved=await window.api.aiReplyConfigPatch(dto)
  check(saved.keywords.join('|')===config.keywords.join('|'),'Reactive settings DTO saves through real bridge')
  window.aiProbe.stage('keywords')
  const nested=await window.api.aiReplyConfigPatch({keywords:[...reactive(['嵌套','关键词'])]})
  check(nested.keywords.join('|')==='嵌套|关键词','Nested array copied before bridge')
  before=await window.aiProbe.state()
  window.aiProbe.stage('preload-error')
  let badRejected=false
  try { await window.aiProbe.invalidPreload() } catch(error) {
    badRejected=error.message.includes('序列化') && !error.message.includes(dummy)
  }
  check(badRejected,'Preload rejects non-JSON data with a safe error')
  check((await window.aiProbe.state()).handles===before.handles,'Bad preload input does not reach main')
  results.push('reactive DTO/nested keywords and preload failure behavior')
  window.aiProbe.stage('mount-ui')
  createApp(AiReply).mount('#app')
  await waitFor(()=>!!inputKey(),'AI page loads')
  window.aiProbe.stage('forced-storage-failure')
  await window.aiProbe.failStorage(true)
  putKey(dummy);click('保存 Key')
  await waitFor(()=>document.body.textContent.includes('输入的 Key 已保留'),'UI reports failed save')
  check(inputKey().value===dummy,'Failed save retains input')
  check(!document.body.textContent.includes('已保存：'),'Failed save has no success toast')
  check(!document.body.textContent.includes(dummy),'Storage exception cannot expose Key in error')
  results.push('UI failure retains input and hides sensitive exception')
  window.aiProbe.stage('actual-storage')
  await window.aiProbe.failStorage(false)
  const state=await window.aiProbe.state()
  if(state.secure) {
    click('保存 Key')
    await waitFor(()=>document.body.textContent.includes('已保存 Key：'),'UI saves Key')
    check(inputKey().value==='','Success clears input')
    let publicConfig=await window.api.aiReplyConfigGet()
    check(publicConfig.hasApiKey && publicConfig.apiKeyHint===maskApiKey(dummy),'Read masked Key metadata')
    const disk=await window.aiProbe.disk()
    check(disk.encrypted && disk.sameKey && !disk.plaintext,'safeStorage encryption and disk reload')
    const cooldown=[...document.querySelectorAll('input[type="number"]')].find(input=>input.closest('label')?.textContent.includes('全局冷却秒'))
    check(cooldown,'Cooldown input exists')
    cooldown.value='29';cooldown.dispatchEvent(new Event('input',{bubbles:true}))
    click('保存')
    await waitFor(async()=> (await window.api.aiReplyConfigGet()).cooldownSec===29,'UI settings save completes')
    publicConfig=await window.api.aiReplyConfigGet()
    check(publicConfig.hasApiKey && publicConfig.apiKeyHint===maskApiKey(dummy),'Settings patch keeps Key')
    check((await window.aiProbe.disk()).sameKey,'Existing Key preserved on disk')
    results.push('Key save/encrypted reload/metadata/settings preservation')
    click('清除已保存的 Key')
    await waitFor(()=>document.body.textContent.includes('还没有 Key'),'UI clears Key')
    publicConfig=await window.api.aiReplyConfigGet()
    check(!publicConfig.hasApiKey && publicConfig.apiKeyHint==='','Clear returns empty metadata')
    check(!(await window.aiProbe.disk()).sameKey,'Cleared Key stays cleared after disk reload')
    results.push('Key clearing through actual UI/IPC')
  } else {
    click('保存 Key')
    await waitFor(()=>document.body.textContent.includes('输入的 Key 已保留'),'Unavailable secure storage fails closed')
    check(inputKey().value===dummy,'Unavailable storage preserves pending input')
    check(!(await window.api.aiReplyConfigGet()).hasApiKey,'Unavailable storage never claims Key saved')
    results.push('unsafe storage rejection; encrypted round trip requires Windows/keyring')
  }
  return results
}
