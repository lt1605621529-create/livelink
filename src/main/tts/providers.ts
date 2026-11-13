import { encode } from '@msgpack/msgpack'
import type { TTSProviderSettings } from '../../shared/tts-providers'

export type CloudProvider = 'fish' | 'qwen'
type Fetch = typeof fetch
// Never surface response bodies, request headers or network exceptions: they can contain credentials.
export async function synthesizeCloud(
  provider: CloudProvider, config: TTSProviderSettings, key: string, text: string,
  voice: string, speed: number, request: Fetch = fetch
): Promise<Buffer> {
  if (!key) throw new Error('请先配置此语音服务的 API Key')
  const signal = AbortSignal.timeout(30_000)
  try {
    let response: Response
    if (provider === 'fish') {
      response = await request('https://api.fish.audio/v1/tts', {
        method: 'POST', signal, redirect: 'error',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/msgpack', model: config.fish!.model },
        body: Buffer.from(encode({ text, ...(voice ? { reference_id: voice } : {}), format: 'mp3', prosody: { speed } }))
      })
    } else {
      const host = config.qwen?.region === 'intl' ? 'dashscope-intl.aliyuncs.com' : 'dashscope.aliyuncs.com'
      response = await request(`https://${host}/api/v1/services/aigc/multimodal-generation/generation`, {
        method: 'POST', signal, redirect: 'error',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.qwen!.model, input: { text, voice, language_type: 'Auto' } })
      })
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    if (provider === 'qwen') {
      const data = await response.json() as { output?: { audio?: { url?: string } } }
      const url = new URL(data.output?.audio?.url ?? '')
      // Signed download URLs are not API endpoints. Never forward the Bearer key to them.
      if (url.protocol !== 'https:' || !(url.hostname.endsWith('.aliyuncs.com'))) throw new Error('音频地址无效')
      response = await request(url, { signal, redirect: 'error' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
    }
    const audio = Buffer.from(await response.arrayBuffer())
    if (!audio.length || audio.length > 20 * 1024 * 1024) throw new Error('音频为空或过大')
    return audio
  } catch (error) {
    const status = /^HTTP \d{3}$/.test((error as Error).message) ? `（${(error as Error).message}）` : ''
    throw new Error(`${provider === 'fish' ? 'Fish Audio' : 'Qwen TTS'} 合成失败${status}，请检查 Key、模型、音色和网络`)
  }
}
