import assert from 'node:assert/strict'
import { reactive, isProxy } from 'vue'
import { DEFAULT_AI_REPLY_CONFIG, toPublicAiReplyConfig, toAiReplyPatchDto } from '../src/shared/ai-reply'
import { cleanForIpc } from '../src/shared/ipc-dto'

const original=reactive(toPublicAiReplyConfig(DEFAULT_AI_REPLY_CONFIG))
const dto=toAiReplyPatchDto(original)
assert.ok(isProxy(original.keywords))
assert.ok(!isProxy(dto) && !isProxy(dto.keywords))
assert.notEqual(dto.keywords,original.keywords)
assert.deepEqual(structuredClone(dto).keywords,['小助手','问一下'])
assert.ok(!('hasApiKey' in dto) && !('apiKeyHint' in dto) && !('apiKey' in dto))
assert.equal(toAiReplyPatchDto(original,'  dummy-test-key  ').apiKey,'dummy-test-key')
assert.deepEqual(cleanForIpc({list:[{keywords:['a','b']}]}),{list:[{keywords:['a','b']}]})
const circle:Record<string,unknown>={};circle.self=circle
const secret='dummy-secret-must-not-appear'
const getter={get broken():never{throw Error(secret)}}
for(const invalid of [circle,getter,{fn:()=>{}},{symbol:Symbol()},{big:BigInt(1)},{date:new Date()},{map:new Map()},{n:Infinity},()=>{}]) {
  assert.throws(()=>cleanForIpc(invalid),error=>error instanceof Error && !error.message.includes(secret) && error.message.includes('序列化'))
}
assert.equal(cleanForIpc(undefined),undefined)
assert.deepEqual(cleanForIpc({optional:undefined}),{})
console.log('AI JSON DTO copying and strict serialization checks passed')
