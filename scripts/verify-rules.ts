import assert from 'node:assert/strict'
import mitt from 'mitt'
import { createRule, copyRule, validateRule, RULE_EVENTS } from '../src/shared/rules'
import { createBilibiliRuleHandlers, mapBlindBoxEvent } from '../src/main/platform/bilibili-events'
import { RuleEngine } from '../src/main/rules/engine'
import { ActionDispatcher } from '../src/main/actions/dispatcher'
import { buildTemplateContext, renderPick, renderTemplate } from '../src/main/rules/template'
import type { StandardEvent } from '../src/main/platform/adapter'
import type { Bus } from '../src/main/events/bus'

let checks = 0
function check(test: () => void): void { test(); checks++ }
const events: StandardEvent[] = []
const h = createBilibiliRuleHandlers(123, event => events.push(event))
const user = { uid: 42, uname: '观众甲', identity:{guard_level:3}, badge:{level:6,name:'测试牌',active:true,anchor:{room_id:123}} }
const msg = (body: object) => ({timestamp:1000,body:{user,...body}})
h.onUserAction!(msg({action:'enter'}) as never)
h.onIncomeDanmu!(msg({content:'你好 点歌'}) as never)
h.onGift!(msg({gift_id:1,gift_name:'鲜花',amount:2,price:3000,coin_type:'gold'}) as never)
h.onGuardBuy!(msg({guard_level:3,price:198,gift_name:'舰长'}) as never)
h.onUserAction!(msg({action:'follow'}) as never)
h.onIncomeSuperChat!(msg({content:'感谢主播',price:30,time:60}) as never)
const blind = mapBlindBoxEvent({uid:42,uname:'观众甲',gift_id:7,gift_name:'奖励',price:5000,num:2,blind_gift:{original_gift_id:1,original_gift_name:'心动盲盒',original_gift_price:3000}},123)!
events.push(blind)
check(()=>assert.deepEqual(new Set(events.map(e=>e.kind)), new Set(RULE_EVENTS.map(e=>e.kind))))
check(()=>assert.equal(events[2].kind === 'gift.received' && events[2].payload.price,3))
check(()=>assert.equal(blind.kind === 'blindbox.opened' && blind.payload.netGainPerBox,7))
check(()=>assert.equal(mapBlindBoxEvent({gift_id:1},123),null))
check(()=>assert.equal(events[0].user.fansMedal?.isAnchor,true))

async function main(): Promise<void> {
  const bus = mitt<{event:StandardEvent}>() as Bus
  const spoken: {text:string;options:{eventKind:string;priority:string}}[] = []
  const overlays: {kind:string;text?:string}[] = []
  const logs: string[] = []
  const dispatcher = new ActionDispatcher({
    tts:{enqueue:(text:string,options:never)=>spoken.push({text,options})},
    overlay:{broadcast:(data:never)=>overlays.push(data)},
    log:{writeFromRule:(_r:unknown,_e:unknown,text:string)=>logs.push(text)},
    blindboxStore:{},wallet:{},getCurrentRoomId:()=>123,getCurrencyName:()=> '哈松币',getInitialBalance:()=>1000
  } as never)
  const engine = new RuleEngine({bus,dispatcher}); engine.attach()
  const settle = async () => { for(let i=0;i<10;i++) await Promise.resolve() }
  for(const event of events) {
    const rule = createRule(event.kind as ReturnType<typeof createRule>['trigger'])
    rule.perUserCooldownSec=0
    rule.actions=[{kind:'log',template:{text:'记录{uname}'}},{kind:'tts',template:{text:'感谢{uname}'}},{kind:'overlay',overlayPayload:{kind:'rule.message',text:'显示{uname}'}}]
    engine.setRules([validateRule(rule)])
    const before=spoken.length
    bus.emit('event',event); await settle()
    check(()=>assert.equal(spoken.length,before+1))
    check(()=>assert.equal(spoken.at(-1)?.text,'感谢观众甲'))
    check(()=>assert.equal(spoken.at(-1)?.options.eventKind,event.kind))
    check(()=>assert.equal(logs.at(-1),'记录观众甲'))
    check(()=>assert.deepEqual(overlays.at(-1),{kind:'rule.message',text:'显示观众甲',event,extra:{kind:'rule.message',text:'显示观众甲'}}))
    check(()=>assert.equal(spoken.at(-1)?.options.priority,['gift.received','guard.bought','super.chat','blindbox.opened'].includes(event.kind)?'high':'normal'))
  }
  const rule = createRule('danmu.received')
  rule.perUserCooldownSec=0; rule.actions=[{kind:'tts',template:{text:'{content}'}}]
  const fire=async()=>{const n=spoken.length;bus.emit('event',events[1]);await settle();return spoken.length-n}
  engine.setRules([rule]); rule.enabled=false; check(()=>assert.equal(engine.listRules()[0].enabled,false))
  assert.equal(await fire(),0);checks++
  rule.enabled=true
  rule.match={kind:'keyword',mode:'all',keywords:['你好','点歌']}; assert.equal(await fire(),1);checks++
  rule.match={kind:'keyword',mode:'all',keywords:['你好','不存在']};assert.equal(await fire(),0);checks++
  rule.match={kind:'keyword',mode:'any',keywords:['不存在','点歌']};assert.equal(await fire(),1);checks++
  rule.match={kind:'regex',pattern:'^你好'};assert.equal(await fire(),1);checks++
  rule.match={kind:'regex',pattern:'['};assert.equal(await fire(),0);checks++
  rule.match={kind:'fans_medal',minLevel:6,requireAnchor:true};assert.equal(await fire(),1);checks++
  rule.match={kind:'fans_medal',minLevel:7,requireAnchor:true};assert.equal(await fire(),0);checks++
  rule.match={kind:'always'};rule.cooldownSec=2;rule.perUserCooldownSec=10
  const originalNow=Date.now;let now=100000;Date.now=()=>now
  try {
    assert.equal(await fire(),1);checks++
    now+=1000;assert.equal(await fire(),0);checks++
    now+=2000;assert.equal(await fire(),0);checks++ // global expired, user still cooling
    const other={...events[1],user:{...events[1].user,uid:'99'}} as StandardEvent
    const n=spoken.length;bus.emit('event',other);await settle();check(()=>assert.equal(spoken.length,n+1))
    now+=10000;assert.equal(await fire(),1);checks++
    engine.removeRule(rule.id);engine.upsertRule(rule);assert.equal(await fire(),1);checks++ // deletion clears cooldown
  } finally {Date.now=originalNow}
  engine.setRules([]);assert.equal(await fire(),0);checks++
  const copy=copyRule(rule)
  check(()=>assert.notEqual(copy.id,rule.id));check(()=>assert.equal(copy.enabled,false))
  copy.actions[0].template!.text='不同';check(()=>assert.equal(rule.actions[0].template!.text,'{content}'))
  const context=buildTemplateContext(events[2]);check(()=>assert.equal(renderTemplate('{uname} {giftName} {num} {price} {missing}',context),'观众甲 鲜花 2 3 '))
  check(()=>assert.equal(renderPick('A{uname}\nB{uname}',context,0.9),'B观众甲'))
  check(()=>assert.equal(buildTemplateContext(blind).gain,'7.00'))
  for(const match of [{kind:'keyword',keywords:[],mode:'any'},{kind:'regex',pattern:'['}]) check(()=>assert.throws(()=>validateRule({...rule,match})))
  for(const patch of [{name:''},{cooldownSec:-1},{perUserCooldownSec:Infinity},{trigger:'room.stats'},{actions:[]},{actions:[{kind:'unknown'}]}]) check(()=>assert.throws(()=>validateRule({...rule,...patch})))
  check(()=>assert.throws(()=>validateRule({...createRule('viewer.enter'),match:{kind:'keyword',keywords:['a'],mode:'any'}})))
  engine.detach()
  console.log(`${checks}/${checks} rule mapping/engine/template/validation checks passed`)
}
void main().catch(error=>{console.error(error);process.exitCode=1})
