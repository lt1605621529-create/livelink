<script setup lang="ts">
import { ref } from 'vue'
import type { Rule, RuleMatch, ActionKind } from '../types'
import { RULE_EVENTS, validateRule } from '../../shared/rules'
const props = defineProps<{ rule: Rule; busy: boolean }>()
const emit = defineEmits<{ save: [rule: Rule]; cancel: [] }>()
const draft = ref<Rule>(JSON.parse(JSON.stringify(props.rule)))
const keywordText = ref(draft.value.match.kind === 'keyword' ? draft.value.match.keywords.join('、') : '')
for (const action of draft.value.actions) {
  if (action.kind === 'overlay') action.overlayPayload = { kind: draft.value.trigger, ...action.overlayPayload }
}
const error = ref('')
const ACTIONS: ActionKind[] = ['log','tts','overlay','query_blindbox','query_wallet']
function actionLabel(kind: string): string {
  return ({ log:'日志', tts:'TTS', overlay:'Overlay', query_blindbox:'盲盒查询', query_wallet:'余额查询' } as Record<string,string>)[kind] ?? kind
}
function lineCount(text: string): number { return text.split('\n').filter(line => line.trim()).length }
function addAction(kind: ActionKind): void {
  draft.value.actions.push(kind === 'overlay' ? { kind, overlayPayload:{ kind:'rule.message', text:'感谢{uname}' } } :
    kind === 'tts' || kind === 'log' ? { kind, template:{text:'感谢{uname}'} } : {kind})
}
function submit(): void {
  try { error.value = ''; emit('save', validateRule(JSON.parse(JSON.stringify(draft.value)))) }
  catch (e) { error.value = (e as Error).message }
}
function changeMatchKind(rule: Rule, kind: RuleMatch['kind']): void {
  if (kind === 'always') rule.match = { kind: 'always' }
  else if (kind === 'keyword')
    rule.match = { kind: 'keyword', keywords: keywordText.value.split(/[、,，\s]+/).filter(Boolean), mode: 'any' }
  else if (kind === 'regex') rule.match = { kind: 'regex', pattern: '' }
  else if (kind === 'fans_medal')
    rule.match = { kind: 'fans_medal', minLevel: 0, requireAnchor: true }
}

// keyword.keywords 在表单里用逗号 / 顿号分隔输入，转回数组存
function keywordsToText(): string {
  return keywordText.value
}
function setKeywordsFromText(rule: Rule, text: string): void {
  if (rule.match.kind !== 'keyword') return
  keywordText.value = text
  rule.match.keywords = text
    .split(/[、,，\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}
</script>
<template>

        <form class="space-y-4" @submit.prevent="submit">
          <p v-if="error" role="alert" class="text-rose-300">{{ error }}</p>
          <label class="block">规则名称<input v-model="draft.name" required maxlength="100" class="field" /></label>
          <label class="block">事件类型
            <select v-model="draft.trigger" class="field">
              <option v-for="event in RULE_EVENTS" :key="event.kind" :value="event.kind">{{ event.label }}</option>
            </select>
          </label>
          <label class="flex gap-2"><input v-model="draft.enabled" type="checkbox" />启用此规则</label>
          <p class="text-xs text-slate-400">关键词/正则匹配弹幕或 SC 内容、礼物/上舰礼物名、盲盒及奖励名。进房与关注事件请使用总是触发或粉丝牌条件。</p>
          <div class="grid grid-cols-2 gap-3">
            <label class="text-xs text-slate-400">
              全局冷却（秒）
              <input
                v-model.number="draft.cooldownSec"
                type="number" min="0"
                class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              />
            </label>
            <label class="text-xs text-slate-400">
              同人冷却（秒）
              <input
                v-model.number="draft.perUserCooldownSec"
                type="number" min="0"
                class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              />
            </label>
          </div>

          <!-- 匹配方式 -->
          <div class="rounded border border-slate-800 bg-slate-950/60 p-3 space-y-2">
            <label class="text-xs text-slate-400">
              匹配方式
              <select
                :value="draft.match.kind"
                @change="changeMatchKind(draft, ($event.target as HTMLSelectElement).value as RuleMatch['kind'])"
                class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              >
                <option value="always">总是触发</option>
                <option value="keyword">关键词</option>
                <option value="regex">正则</option>
                <option value="fans_medal">粉丝牌等级</option>
              </select>
            </label>

            <!-- always: 无需配置 -->
            <p v-if="draft.match.kind === 'always'" class="text-xs text-slate-500">
              每次事件都触发（适合"所有人进房都欢迎"这种规则）
            </p>

            <!-- keyword -->
            <template v-if="draft.match.kind === 'keyword'">
              <label class="block text-xs text-slate-400">
                关键词（顿号 / 逗号 / 空格分隔）
                <input
                  :value="keywordsToText()"
                  @input="setKeywordsFromText(draft, ($event.target as HTMLInputElement).value)"
                  type="text"
                  placeholder="你好、哈喽、hi"
                  class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                />
              </label>
              <label class="block text-xs text-slate-400">
                匹配模式
                <select
                  v-model="(draft.match as Extract<RuleMatch, { kind: 'keyword' }>).mode"
                  class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                >
                  <option value="any">任一关键词命中</option>
                  <option value="all">全部关键词命中</option>
                </select>
              </label>
            </template>

            <!-- regex -->
            <template v-if="draft.match.kind === 'regex'">
              <label class="block text-xs text-slate-400">
                正则表达式
                <input
                  v-model="(draft.match as Extract<RuleMatch, { kind: 'regex' }>).pattern"
                  type="text"
                  placeholder="例如 ^(求|想)分享"
                  class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 font-mono"
                />
              </label>
            </template>

            <!-- fans_medal -->
            <template v-if="draft.match.kind === 'fans_medal'">
              <label class="block text-xs text-slate-400">
                最低粉丝牌等级（0-40）
                <input
                  v-model.number="(draft.match as Extract<RuleMatch, { kind: 'fans_medal' }>).minLevel"
                  type="number" min="0" max="40"
                  class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                />
              </label>
              <label class="flex items-center gap-2 text-xs text-slate-400">
                <input
                  v-model="(draft.match as Extract<RuleMatch, { kind: 'fans_medal' }>).requireAnchor"
                  type="checkbox"
                  class="rounded border-slate-700 bg-slate-950"
                />
                必须是本主播的粉丝牌
              </label>
              <p v-if="draft.trigger === 'viewer.enter'" class="text-[11px] text-amber-300/80">
                注意：B 站协议层进房事件常不带粉丝牌信息，本规则在送过礼物 / 发过弹幕的老粉进房时才能命中
              </p>
            </template>
          </div>

          <div
            v-for="(action, idx) in draft.actions"
            :key="idx"
            class="rounded border border-slate-800 bg-slate-950/60 p-3"
          >
            <div class="mb-1 flex items-baseline justify-between gap-2 text-xs text-slate-400">
              <button type="button" @click="draft.actions.splice(idx, 1)" class="text-rose-300">移除动作</button>
              <span>
                {{ actionLabel(action.kind) }} 模板
                <span class="text-slate-600">（占位符 {uname} {guardName} {medalLevel} {giftName} {num} {content} 等）</span>
              </span>
              <span v-if="action.template" class="shrink-0 text-[10px] text-slate-500">
                {{ lineCount(action.template.text) }} 句
              </span>
            </div>
            <div v-if="action.kind === 'overlay'" class="space-y-2">
              <label class="block text-xs">Overlay 显示方式
                <select v-model="action.overlayPayload!.kind" class="field">
                  <option value="rule.message">自定义文字横幅（所有事件可用）</option>
                  <option :value="draft.trigger">事件原生效果（仅部分事件有专用动画）</option>
                  <option v-if="action.overlayPayload!.kind && !['rule.message', draft.trigger].includes(String(action.overlayPayload!.kind))" :value="action.overlayPayload!.kind">保留原效果：{{ action.overlayPayload!.kind }}</option>
                </select>
              </label>
              <label class="block text-xs">Overlay 文本模板
                <textarea :value="String(action.overlayPayload!.text ?? '')" @input="action.overlayPayload!.text = ($event.target as HTMLTextAreaElement).value" rows="3" class="field" />
              </label>
              <p class="text-xs text-slate-500">自定义横幅支持所有规则事件；原生效果保留礼物动画等既有行为。多个同事件规则可能同时显示。</p>
            </div>
            <textarea
              v-if="action.template"
              v-model="action.template.text"
              rows="5"
              class="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 font-mono"
            />
            <p v-if="action.template" class="mt-1 text-[11px] text-slate-500">
              一行一句，每次随机挑一句说 —— 只有一句的话，观众看三次就知道那是台机器。
              同一条规则的 TTS 和 Overlay 会挑到对应的那一句，不会出现"听到一句、画面上写着另一句"。
              <span class="text-slate-600">{guardName} 对普通观众是空的、对舰长是"舰长"，所以「{guardName}{uname}到了」一句话能照顾两种人。</span>
            </p>
            <div v-else-if="action.kind !== 'overlay'" class="text-xs text-slate-600">此动作无模板（{{ action.kind }}）</div>
          </div>

          <div class="flex flex-wrap gap-2">
            <button v-for="kind in ACTIONS" :key="kind" type="button" @click="addAction(kind)" class="rounded bg-slate-800 px-3 py-2 text-sm">添加{{ actionLabel(kind) }}动作</button>
          </div>
          <p class="text-xs text-slate-400">模板变量：{uname} {uid} {guardName} {medalLevel} {content} {giftName} {num} {price} {message} {blindBoxName} {rewardName} {gain}。日志/TTS/Overlay 一行一句随机选择；查询动作保留原逻辑。</p>
          <div class="flex justify-end gap-2">
            <button type="button"
              class="rounded bg-slate-700 px-3 py-1 text-xs text-slate-100 hover:bg-slate-600"
              @click="$emit('cancel')"
            >取消</button>
            <button type="submit"
              class="rounded bg-sky-500 px-4 py-1 text-xs font-medium text-white hover:bg-sky-400 disabled:opacity-50"
              :disabled="busy"
            >{{ busy ? '保存中…' : '保存' }}</button>
          </div>
        </form>

</template>
<style scoped>
.field { @apply mt-1 block w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100; }
</style>
