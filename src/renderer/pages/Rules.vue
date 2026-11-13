<script setup lang="ts">
import { computed, ref } from 'vue'
import { rules } from '../store'
import type { Rule } from '../types'
import RuleEditor from '../components/RuleEditor.vue'
import { RULE_EVENTS, createRule, copyRule } from '../../shared/rules'

const grouped = computed(() => RULE_EVENTS.map(event => ({...event, rules: rules.value.filter(rule => rule.trigger === event.kind)})))
const draft = ref<Rule | null>(null)
const busy = ref(false)
const error = ref('')
const heading = ref('新增规则')
const editorRevision = ref(0)
function open(rule: Rule, title: string): void {
  if (draft.value && !confirm('放弃当前未保存的编辑？')) return
  editorRevision.value++
  draft.value = JSON.parse(JSON.stringify(rule))
  heading.value = title
  error.value = ''
  window.scrollTo({top:0,behavior:'smooth'})
}
async function save(rule: Rule): Promise<void> {
  busy.value = true; error.value = ''
  try { rules.value = await window.api.ruleUpsert(rule); draft.value = null }
  catch (e) { error.value = (e as Error).message }
  finally { busy.value = false }
}
async function toggle(rule: Rule): Promise<void> {
  busy.value = true; error.value = ''
  try { rules.value = await window.api.ruleUpsert(JSON.parse(JSON.stringify({...rule,enabled:!rule.enabled}))) }
  catch (e) { error.value = (e as Error).message }
  finally { busy.value = false }
}
async function remove(rule: Rule): Promise<void> {
  if (!confirm(`确定删除「${rule.name}」？此操作不会删除观众或钱包数据。`)) return
  busy.value = true; error.value = ''
  try { rules.value = await window.api.ruleDelete(rule.id); if(draft.value?.id === rule.id) draft.value = null }
  catch (e) { error.value = (e as Error).message }
  finally { busy.value = false }
}
function matchSummary(rule: Rule): string {
  const m = rule.match
  if (m.kind === 'keyword') return `关键词（${m.mode === 'all' ? '全部' : '任一'}）：${m.keywords.join('、')}`
  if (m.kind === 'regex') return `正则：${m.pattern}`
  if (m.kind === 'fans_medal') return `粉丝牌 ≥ ${m.minLevel} 级${m.requireAnchor ? '（本主播）' : ''}`
  return '总是触发'
}
</script>
<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <header class="flex items-center justify-between gap-4">
      <div><p class="ll-eyebrow-accent mb-1.5">AUTOMATION</p><h1 class="ll-title text-[26px]">规则管理</h1>
        <p class="mt-1 text-sm text-slate-400">保存后立即生效，重启仍保留。多个命中规则会分别执行。</p></div>
      <button class="rounded-lg bg-sky-500 px-5 py-3 font-medium text-white disabled:opacity-50" :disabled="busy" @click="open(createRule(), '新增规则')">＋ 新增规则</button>
    </header>
    <p v-if="error" role="alert" class="rounded border border-rose-500/40 bg-rose-500/10 p-3 text-rose-200">{{ error }}</p>
    <section v-if="draft" role="dialog" :aria-label="heading" class="rounded-2xl border border-sky-500/50 bg-slate-900 p-5">
      <h2 class="mb-4 font-medium">{{ heading }}</h2>
      <RuleEditor :key="`${draft.id}:${editorRevision}`" :rule="draft" :busy="busy" @save="save" @cancel="draft = null" />
    </section>
    <section v-for="group in grouped" :key="group.kind" class="space-y-3" :data-event="group.kind">
      <header class="flex items-center justify-between">
        <h2 class="text-sm font-medium text-slate-400">{{ group.label }} · {{ group.rules.length }} 条</h2>
        <button :disabled="busy" class="rounded border border-slate-700 px-3 py-1 text-sm text-sky-300" @click="open(createRule(group.kind), `新增${group.label}规则`)">＋ 添加规则</button>
      </header>
      <p v-if="!group.rules.length" class="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-500">暂无规则，可点击本分类的「添加规则」。</p>
      <article v-for="rule in group.rules" :key="rule.id" :data-rule-id="rule.id" class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div><h3 class="font-medium">{{ rule.name }} <span class="text-xs text-slate-500">{{ rule.enabled ? '已启用' : '已禁用' }}</span></h3>
            <p class="mt-1 text-xs text-slate-500">{{ matchSummary(rule) }} · 全局冷却 {{ rule.cooldownSec }}s · 用户冷却 {{ rule.perUserCooldownSec }}s</p>
            <p class="mt-1 text-xs text-slate-400">动作：{{ rule.actions.map(action => action.kind).join(' / ') }}</p></div>
          <div class="flex gap-2 text-sm">
            <button :disabled="busy" :aria-label="`${rule.enabled ? '禁用' : '启用'} ${rule.name}`" @click="toggle(rule)" class="rounded bg-slate-800 px-3 py-1">{{ rule.enabled ? '禁用' : '启用' }}</button>
            <button :disabled="busy" @click="open(rule, '编辑规则')" class="rounded bg-slate-700 px-3 py-1">编辑</button>
            <button :disabled="busy" @click="open(copyRule(rule), '复制规则（副本默认禁用）')" class="rounded bg-slate-700 px-3 py-1">复制</button>
            <button :disabled="busy" @click="remove(rule)" class="rounded bg-rose-600/70 px-3 py-1">删除</button>
          </div>
        </header>
      </article>
    </section>
  </div>
</template>
