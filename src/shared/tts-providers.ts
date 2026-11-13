export type TTSProvider = 'edge' | 'fish' | 'qwen'
export interface CloudVoiceConfig {
  model: string
  voice: string
  perEventVoice?: Record<string, string>
}
export interface TTSProviderSettings {
  provider?: TTSProvider
  fish?: CloudVoiceConfig
  qwen?: CloudVoiceConfig & { region?: 'cn' | 'intl' }
  outputDeviceId?: string
}
export const CLOUD_DEFAULTS = {
  fish: { model: 's2-pro', voice: '', perEventVoice: {} },
  qwen: { model: 'qwen3-tts-flash', voice: 'Cherry', region: 'cn' as const, perEventVoice: {} }
}
