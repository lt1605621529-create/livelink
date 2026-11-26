<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { currentPage, ttsConfig, voices } from '../store'
import { CLOUD_DEFAULTS } from '../../shared/tts-providers'
import type { EventKind, TTSStats, TTSConfig } from '../types'

// 可分事件配音色的事件列表。和默认规则里的 TTS 触发器对齐
const TTS_EVENTS: { kind: EventKind; label: string; hint: string }[] = [
  { kind: 'viewer.enter', label: '欢迎进房', hint: '观众进入直播间' },
  { kind: 'danmu.received', label: '弹幕回复', hint: '关键词回复 / 你好等' },
  { kind: 'gift.received', label: '礼物感谢', hint: '收到礼物' },
  { kind: 'guard.bought', label: '上舰感谢', hint: '舰长 / 提督 / 总督' },
  { kind: 'super.chat', label: 'SuperChat 感谢', hint: '醒目留言' }
]

const localConfig = ref<TTSConfig>({
  provider: 'edge',
  fish: structuredClone(CLOUD_DEFAULTS.fish),
  qwen: structuredClone(CLOUD_DEFAULTS.qwen),
  enabled: true,
  voice: 'zh-CN-XiaoxiaoNeural',
  rate: '+0%',
  volume: 100,
  style: 'normal' as 'normal' | 'mambo',
  perEventVoice: {} as Partial<Record<EventKind, string>>
})
const key = ref('')
const keyStatus = ref({ fish: false, qwen: false })
const devices = ref<{deviceId: string; label: string}[]>([])
const cloud = computed(() => localConfig.value.provider === 'qwen' ? localConfig.value.qwen! : localConfig.value.fish!)
async function saveKey(clear = false): Promise<void> {
  const provider = localConfig.value.provider
  if (provider !== 'fish' && provider !== 'qwen') return
  try { keyStatus.value = await window.api.ttsKeySave(provider, clear ? '' : key.value); key.value = '' }
  catch { error.value = '保存 Key 失败：系统安全存储不可用或输入无效' }
}
async function refreshDevices(): Promise<void> {
  try { devices.value = await window.api.ttsDevices() } catch { error.value = '无法枚举音频设备，可使用系统默认输出' }
}
watch(() => localConfig.value.provider, () => { key.value = '' })
const saving = ref(false)
const error = ref<string | null>(null)
const testToast = ref<string | null>(null)
const stats = ref<TTSStats | null>(null)

// 5 分钟内合成/播放失败过才提示——让"失灵却一声不吭"变成看得见的错误
const RECENT_ERROR_MS = 5 * 60_000
const healthWarning = computed<string | null>(() => {
  const last = stats.value?.lastError
  if (!last || Date.now() - last.at >= RECENT_ERROR_MS) return null
  return `语音服务最近失败：${last.message}（本进程累计 ${stats.value?.synthFailed ?? 0} 次合成失败 / ${stats.value?.playFailed ?? 0} 次播放失败）。请检查当前服务和音频输出设备。`
})

async function refreshStats(): Promise<void> {
  try {
    stats.value = await window.api.ttsStats()
  } catch {
    // 拉不到就算了，试听失败仍会走 toast
  }
}

onMounted(async () => { await refreshStats(); keyStatus.value = await window.api.ttsKeyStatus(); await refreshDevices() })

watch(
  ttsConfig,
  (c) => {
    if (c) {
      localConfig.value = {
        ...c,
        provider: c.provider ?? 'edge',
        fish: c.fish ?? structuredClone(CLOUD_DEFAULTS.fish),
        qwen: c.qwen ?? structuredClone(CLOUD_DEFAULTS.qwen),
        style: c.style ?? 'normal',
        perEventVoice: { ...(c.perEventVoice ?? {}) }
      }
    }
  },
  { immediate: true }
)

function getEventVoice(kind: EventKind): string {
  return (localConfig.value.provider === 'edge' ? localConfig.value.perEventVoice : cloud.value.perEventVoice)?.[kind] ?? ''
}

async function setEventVoice(kind: EventKind, voice: string): Promise<void> {
  const next = { ...((localConfig.value.provider === 'edge' ? localConfig.value.perEventVoice : cloud.value.perEventVoice) ?? {}) }
  if (!voice) {
    delete next[kind]
  } else {
    next[kind] = voice
  }
  if (localConfig.value.provider === 'edge') localConfig.value.perEventVoice = next
  else cloud.value.perEventVoice = next
  await persist()
}

async function testEventVoice(kind: EventKind): Promise<void> {
  // 试听该事件实际会用的 voice：perEvent 覆盖优先，否则全局
  const voice = getEventVoice(kind) || (localConfig.value.provider === 'edge' ? localConfig.value.voice : cloud.value.voice)
  testToast.value = '正在合成…'
  try {
    await window.api.ttsTest(undefined, voice)
    testToast.value = '播放完成'
  } catch (err) {
    testToast.value = (err as Error)?.message ?? '播放失败'
  } finally {
    setTimeout(() => (testToast.value = null), 2500)
  }
}

const ratePct = computed({
  get: () => parsePct(localConfig.value.rate),
  set: (v: number) => (localConfig.value.rate = formatPct(v))
})
function parsePct(s: string): number {
  const m = /([-+]?\d+)/.exec(s ?? '')
  return m ? Number(m[1]) : 0
}
function formatPct(n: number): string {
  const clamped = Math.max(-50, Math.min(50, Math.round(n)))
  return clamped >= 0 ? `+${clamped}%` : `${clamped}%`
}

async function persist(): Promise<void> {
  saving.value = true
  error.value = null
  // localConfig 是 ref()，.value 是 Vue reactive Proxy。preload 已经 cleanForIpc 兜底，
  // 这里再深拷贝一层避免任何边缘情况 (Vue 版本差异 / preload 装载顺序问题等)
  const payload = JSON.parse(JSON.stringify(localConfig.value))
  try {
    const next = await window.api.patchTts(payload)
    ttsConfig.value = next
  } catch (err) {
    error.value = (err as Error)?.message ?? '保存失败'
  } finally {
    saving.value = false
  }
}

function goReader(): void {
  currentPage.value = 'reader'
}

async function test(): Promise<void> {
  // 先 persist 再测试，避免设了新音色却测旧的
  await persist()
  testToast.value = '正在合成…'
  try {
    await window.api.ttsTest()
    testToast.value = '播放完成'
  } catch (err) {
    testToast.value = (err as Error)?.message ?? '播放失败'
  } finally {
    await refreshStats()
    setTimeout(() => (testToast.value = null), 2500)
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <header>
      <p class="ll-eyebrow-accent mb-1.5">VOICE</p>
      <h1 class="ll-title text-[26px]">TTS 设置</h1>
      <p class="mt-1 text-sm text-slate-400">调音色、调语速。改了立即保存。</p>
    </header>

    <p
      v-if="error"
      class="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
    >{{ error }}</p>

    <p
      v-if="healthWarning"
      class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
    >⚠ {{ healthWarning }}</p>

    <section class="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <header class="text-xs uppercase tracking-wide text-slate-500">全局设置</header>

      <!-- 启用 -->
      <div class="flex items-center justify-between">
        <div>
          <div class="font-medium">TTS 语音播报</div>
          <div class="text-xs text-slate-500">关掉后所有规则的"念出"动作都不生效</div>
        </div>
        <button
          class="relative h-6 w-11 rounded-full transition"
          :class="localConfig.enabled ? 'bg-emerald-500' : 'bg-slate-600'"
          @click="(localConfig.enabled = !localConfig.enabled), persist()"
        >
          <span
            class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition"
            :class="localConfig.enabled ? 'translate-x-5' : 'translate-x-0'"
          ></span>
        </button>
      </div>

      <label class="block">语音服务
        <select v-model="localConfig.provider" @change="persist" class="w-full bg-slate-950 p-2">
          <option value="edge">Edge TTS</option><option value="fish">Fish Audio</option><option value="qwen">百炼 Qwen TTS</option>
        </select>
      </label>
      <div v-if="localConfig.provider !== 'edge'" class="space-y-3">
        <p class="text-sm">Key 状态：{{ keyStatus[localConfig.provider === 'qwen' ? 'qwen' : 'fish'] ? '已配置' : '未配置' }}（系统加密存储，不回显）</p>
        <input v-model="key" type="password" autocomplete="new-password" placeholder="API Key" aria-label="API Key" class="w-full bg-slate-950 p-2" />
        <button @click="saveKey(false)" :disabled="!key.trim()" class="mr-4">保存 Key</button><button @click="saveKey(true)">清除 Key</button>
        <label class="block">模型<input v-model="cloud.model" @change="persist" class="w-full bg-slate-950 p-2" /></label>
        <label class="block">音色 ID / 名称<input v-model="cloud.voice" @change="persist" class="w-full bg-slate-950 p-2" /></label>
        <label v-if="localConfig.provider === 'qwen'" class="block">百炼地域
          <select v-model="localConfig.qwen!.region" @change="persist" class="bg-slate-950 p-2"><option value="cn">中国北京</option><option value="intl">国际（新加坡）</option></select>
        </label>
        <p class="text-xs text-slate-400">Fish 使用 reference_id 音色与服务端语速。Qwen 使用模型支持的音色名称，语速在本地播放时调整。Key 与模型必须属于所选地域。</p>
      </div>
      <label class="block">音频输出设备
        <select v-model="localConfig.outputDeviceId" @change="persist" class="w-full bg-slate-950 p-2">
          <option value="">系统默认</option><option v-for="device in devices" :key="device.deviceId" :value="device.deviceId">{{ device.label }}</option>
        </select>
        <button @click="refreshDevices">刷新设备</button>
        <p class="text-xs text-slate-400">可选择 CABLE Input 供 OBS 采集 CABLE Output。设备失效时会报告播放失败，请重新选择。</p>
      </label>
      <!-- 音色 -->
      <label v-if="localConfig.provider === 'edge'" class="block">
        <span class="mb-1 block text-sm text-slate-300">音色</span>
        <select
          v-model="localConfig.voice"
          @change="persist"
          class="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        >
          <option v-for="v in voices" :key="v.value" :value="v.value">{{ v.label }}</option>
        </select>
      </label>

      <label class="block">
        <span class="mb-1 block text-sm text-slate-300">播报风格</span>
        <select
          v-model="localConfig.style"
          @change="
            () => {
              if (localConfig.style === 'mambo' && localConfig.provider === 'edge') {
                localConfig.voice = 'zh-CN-YunxiaNeural'
                localConfig.rate = '+15%'
              }
              persist()
            }
          "
          class="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        >
          <option value="normal">标准播报</option>
          <option value="mambo">曼波播报 · 轻快抽象</option>
        </select>
        <p class="mt-1 text-xs text-slate-500">
          曼波播报是节奏和口癖预设，不克隆具体人物声线；会推荐云夏音色和较快语速。
        </p>
      </label>

      <!-- 语速 -->
      <label class="block">
        <span class="mb-1 flex items-center justify-between text-sm text-slate-300">
          语速 <span class="text-xs text-slate-500">{{ localConfig.rate }}</span>
        </span>
        <input
          type="range" :min="-50" :max="50" :step="5"
          :value="ratePct"
          @input="(ratePct = Number(($event.target as HTMLInputElement).value))"
          @change="persist"
          class="w-full accent-sky-500"
        />
      </label>

      <!-- 音量 -->
      <label class="block">
        <span class="mb-1 flex items-center justify-between text-sm text-slate-300">
          主音量 <span class="text-xs text-slate-500">{{ localConfig.volume }}%</span>
        </span>
        <input
          type="range" :min="0" :max="100" :step="1"
          v-model.number="localConfig.volume"
          @change="persist"
          class="w-full accent-sky-500"
        />
        <span class="text-xs text-slate-500">0% 静音。松开滑块后保存，从下一条播放起生效。</span>
      </label>

      <!-- 测试 -->
      <div class="flex items-center gap-3">
        <button
          @click="test"
          :disabled="saving || !localConfig.enabled"
          class="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
        >测试声音</button>
        <span v-if="testToast" class="text-xs text-slate-400">{{ testToast }}</span>
      </div>
      <p class="text-xs text-slate-500">
        提示：edge-tts 走微软在线服务，需要联网。第一次测试可能稍慢。
      </p>

      <!-- 这页管的是"念什么话术"，念观众原话是另一套设置，容易找不到，给条明路 -->
      <p class="text-xs text-slate-500">
        想把观众发的弹幕原文念出来？去
        <button class="text-sky-400 underline-offset-2 hover:underline" @click="goReader">
          「弹幕朗读」
        </button>
        页开。
      </p>
    </section>

    <!-- 多角色：分事件音色 -->
    <section class="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <header>
        <div class="text-xs uppercase tracking-wide text-slate-500">分事件音色</div>
        <p class="mt-1 text-xs text-slate-500">
          不同事件用不同音色（欢迎用萌妹、礼物用甜美、SC 用沉稳）。
          选"使用全局"即沿用上面的全局音色。语速 / 音量仍走全局。
        </p>
      </header>

      <div class="space-y-2">
        <div
          v-for="ev in TTS_EVENTS"
          :key="ev.kind"
          class="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-lg bg-slate-950/40 px-3 py-2"
        >
          <div class="min-w-0">
            <div class="text-sm text-slate-200">{{ ev.label }}</div>
            <div class="text-xs text-slate-500">{{ ev.hint }}</div>
          </div>
          <input v-if="localConfig.provider !== 'edge'" :value="getEventVoice(ev.kind)" @change="setEventVoice(ev.kind, ($event.target as HTMLInputElement).value)" placeholder="留空使用全局音色" class="w-44 bg-slate-950 p-2" />
          <select v-else
            :value="getEventVoice(ev.kind)"
            @change="setEventVoice(ev.kind, ($event.target as HTMLSelectElement).value)"
            class="w-44 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
          >
            <option value="">使用全局</option>
            <option v-for="v in voices" :key="v.value" :value="v.value">{{ v.label }}</option>
          </select>
          <button
            @click="testEventVoice(ev.kind)"
            :disabled="saving || !localConfig.enabled"
            class="rounded bg-slate-700 px-3 py-1 text-xs text-slate-100 hover:bg-slate-600 disabled:opacity-50"
          >试听</button>
        </div>
      </div>
    </section>
  </div>
</template>
