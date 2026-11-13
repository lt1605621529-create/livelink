import assert from 'node:assert/strict'
import { decode } from '@msgpack/msgpack'
import { synthesizeCloud } from '../src/main/tts/providers'
import { CLOUD_DEFAULTS } from '../src/shared/tts-providers'

async function main(): Promise<void> {
  let checks = 0
  const config = structuredClone(CLOUD_DEFAULTS)
  const key = 'test-credential-never-log'
  const audio = Buffer.from('ID3-test-audio')
  const fish = await synthesizeCloud('fish', config, key, '你好', 'voice-id', 1.2, async (url, init) => {
    assert.equal(url, 'https://api.fish.audio/v1/tts'); checks++
    const headers = init!.headers as Record<string,string>
    assert.equal(headers.Authorization, `Bearer ${key}`); checks++
    assert.equal(headers.model, 's2-pro'); checks++
    assert.equal(headers['Content-Type'], 'application/msgpack'); checks++
    const payload = decode(init!.body as Uint8Array) as Record<string,unknown>
    assert.deepEqual(payload, { text:'你好',reference_id:'voice-id',format:'mp3',prosody:{speed:1.2} }); checks++
    assert.equal(init!.redirect,'error'); checks++
    return new Response(audio)
  })
  assert.deepEqual(fish, audio); checks++
  let calls = 0
  const qwen = await synthesizeCloud('qwen', {...config,qwen:{...config.qwen,region:'intl'}},key,'你好','Cherry',1,async (url,init) => {
    calls++
    if (calls === 1) {
      assert.match(String(url),/^https:\/\/dashscope-intl.aliyuncs.com\//); checks++
      assert.deepEqual(JSON.parse(init!.body as string),{model:'qwen3-tts-flash',input:{text:'你好',voice:'Cherry',language_type:'Auto'}}); checks++
      return Response.json({output:{audio:{url:'https://dashscope-result.oss-cn-beijing.aliyuncs.com/a.wav?signature=temporary'}}})
    }
    assert.equal(init!.headers,undefined); checks++
    return new Response(Buffer.from('RIFF-audio'))
  })
  assert.equal(qwen.toString(),'RIFF-audio'); checks++
  await assert.rejects(synthesizeCloud('fish', config, '', 'text','',1),/API Key/); checks++
  for (const status of [401,403,429,500]) {
    await assert.rejects(synthesizeCloud('fish',config,key,'text','',1, async()=>new Response(key,{status})),error=>{
      assert.ok(!(error as Error).message.includes(key)); assert.match((error as Error).message,new RegExp(String(status))); return true
    }); checks++
  }
  await assert.rejects(synthesizeCloud('fish',config,key,'text','',1,async()=>{throw new Error(key)}),error=>!(error as Error).message.includes(key)); checks++
  await assert.rejects(synthesizeCloud('fish',config,key,'text','',1,async()=>new Response('')),/合成失败/); checks++
  for (const url of ['http://evil.test/a','https://evil.test/a','https://aliyuncs.com.evil.test/a','file:///etc/passwd']) {
    let requests=0
    await assert.rejects(synthesizeCloud('qwen',config,key,'text','Cherry',1,async()=>{ requests++; return Response.json({output:{audio:{url}}}) }),/合成失败/)
    assert.equal(requests,1); checks++
  }
  console.log(`${checks}/${checks} TTS provider checks passed`)
}
void main().catch(() => { console.error('TTS provider verification failed'); process.exitCode=1 })
