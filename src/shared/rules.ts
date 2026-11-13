import type { EventKind } from '../main/platform/adapter'
import type { ActionKind, Rule, RuleMatch } from '../main/rules/types'

// room.stats is telemetry, not a viewer interaction; it intentionally has no rules.
export const RULE_EVENTS = [
  { kind: 'viewer.enter', label: '进房欢迎' },
  { kind: 'danmu.received', label: '弹幕回复' },
  { kind: 'gift.received', label: '礼物感谢' },
  { kind: 'guard.bought', label: '上舰感谢' },
  { kind: 'follow.received', label: '关注感谢' },
  { kind: 'super.chat', label: 'SC 感谢' },
  { kind: 'blindbox.opened', label: '盲盒开盒' }
] satisfies { kind: EventKind; label: string }[]

export function createRule(trigger: Rule['trigger'] = 'viewer.enter', id = crypto.randomUUID()): Rule {
  return {
    id, name: '自定义规则', enabled: true, trigger, match: { kind: 'always' },
    cooldownSec: 0, perUserCooldownSec: 30,
    actions: [
      { kind: 'log', template: { text: '{uname} 触发了自定义规则' } },
      { kind: 'tts', template: { text: '感谢{uname}' } },
      { kind: 'overlay', overlayPayload: { kind: 'rule.message', text: '感谢{uname}' } }
    ]
  }
}
export function copyRule(source: Rule, id = crypto.randomUUID()): Rule {
  return { ...JSON.parse(JSON.stringify(source)), id, name: `${source.name}（副本）`, enabled: false }
}

export function validateRule(value: unknown): Rule {
  function require(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message) }
  require(value && typeof value === 'object' && !Array.isArray(value), '规则格式无效')
  const r = value as Rule
  require(typeof r.id === 'string' && /^[\w.-]{1,128}$/.test(r.id), '规则 ID 无效')
  require(typeof r.name === 'string' && r.name.trim() && r.name.length <= 100, '规则名称必须为 1-100 个字符')
  require(typeof r.enabled === 'boolean', '启用状态无效')
  require(RULE_EVENTS.some(e => e.kind === r.trigger), '不支持的规则事件类型')
  for (const seconds of [r.cooldownSec, r.perUserCooldownSec]) {
    require(typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0 && seconds <= 86400, '冷却时间必须为 0-86400 秒')
  }
  const m: RuleMatch = r.match
  require(m && typeof m === 'object', '请选择匹配方式')
  if (m.kind === 'keyword' || m.kind === 'regex') {
    require(['danmu.received','super.chat','gift.received','guard.bought','blindbox.opened'].includes(r.trigger), '该事件没有可匹配文本，请使用总是触发或粉丝牌条件')
  }
  if (m.kind === 'keyword') {
    require(Array.isArray(m.keywords) && m.keywords.length > 0 && m.keywords.length <= 100 && m.keywords.every(k => typeof k === 'string' && k.trim() && k.length <= 128), '请填写有效关键词（最多 100 个，每个不超过 128 字）')
    require(['any','all'].includes(m.mode), '关键词模式无效')
  } else if (m.kind === 'regex') {
    require(typeof m.pattern === 'string' && m.pattern.length > 0 && m.pattern.length <= 256, '正则必须为 1-256 个字符')
    try { new RegExp(m.pattern) } catch { throw new Error('正则表达式语法无效') }
  } else if (m.kind === 'fans_medal') {
    require(Number.isInteger(m.minLevel) && m.minLevel >= 0 && m.minLevel <= 40 && typeof m.requireAnchor === 'boolean', '粉丝牌条件无效')
  } else require(m.kind === 'always', '不支持的匹配方式')
  require(Array.isArray(r.actions) && r.actions.length > 0 && r.actions.length <= 20, '请至少添加一个动作（最多 20 个）')
  const kinds: ActionKind[] = ['log','tts','overlay','query_blindbox','query_wallet']
  for (const a of r.actions) {
    require(a && kinds.includes(a.kind), '不支持的规则动作')
    if (a.template !== undefined) require(typeof a.template?.text === 'string' && a.template.text.length <= 10000, '模板必须为文本，最多 10000 字')
    if (a.kind === 'tts') require(a.template?.text.trim(), 'TTS 模板不能为空')
    if (a.overlayPayload !== undefined) {
      require(a.overlayPayload && typeof a.overlayPayload === 'object' && !Array.isArray(a.overlayPayload), 'Overlay 配置必须是对象')
      require(a.overlayPayload.text === undefined || typeof a.overlayPayload.text === 'string', 'Overlay 文本必须是字符串')
    }
  }
  return JSON.parse(JSON.stringify(r)) as Rule
}
