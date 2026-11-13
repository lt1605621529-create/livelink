import { app } from 'electron'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AppConfig } from '../src/main/config/store'
import { createRule, copyRule, RULE_EVENTS } from '../src/shared/rules'

const directory=mkdtempSync(join(tmpdir(),'livelink-rule-crud-'))
app.setPath('userData',directory)
void app.whenReady().then(()=>{
  const config=new AppConfig()
  const originals=JSON.parse(JSON.stringify(config.getRules()))
  const tts=config.getTts()
  const ids:string[]=[]
  let checks=0
  for(const event of RULE_EVENTS) {
    const rule=createRule(event.kind)
    rule.name=`测试${event.label}`
    ids.push(rule.id)
    const saved=config.upsertRule(rule)
    assert.ok(saved.some(r=>r.id===rule.id)); checks++
    assert.deepEqual(new AppConfig().getRules().find(r=>r.id===rule.id),rule); checks++
  }
  const original=config.getRules().find(r=>r.id===ids[0])!
  const changed={...original,name:'编辑后的规则',trigger:'follow.received' as const,enabled:false,cooldownSec:5,perUserCooldownSec:30}
  config.upsertRule(changed)
  assert.deepEqual(new AppConfig().getRules().find(r=>r.id===changed.id),changed);checks++
  config.upsertRule({...changed,enabled:true})
  assert.equal(new AppConfig().getRules().find(r=>r.id===changed.id)?.enabled,true);checks++
  const copy=copyRule(changed);config.upsertRule(copy)
  assert.deepEqual(new AppConfig().getRules().find(r=>r.id===copy.id),copy);checks++
  const before=config.getRules()
  assert.throws(()=>config.upsertRule({...changed,cooldownSec:-1}));checks++
  assert.deepEqual(new AppConfig().getRules(),before);checks++
  const deleted=config.removeRule(copy.id)
  assert.ok(!deleted.some(r=>r.id===copy.id));checks++
  for(const id of ids) config.removeRule(id)
  assert.deepEqual(new AppConfig().getRules(),originals);checks++
  assert.deepEqual(new AppConfig().getTts(),tts);checks++
  console.log(`${checks}/${checks} rule CRUD/reload/data-preservation checks passed`)
  rmSync(directory,{recursive:true,force:true});app.exit(0)
}).catch(error=>{
  console.error(error)
  rmSync(directory,{recursive:true,force:true});app.exit(1)
})
