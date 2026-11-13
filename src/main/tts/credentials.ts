import { safeStorage } from 'electron'
import Store from 'electron-store'
import type { CloudProvider } from './providers'

// Separate from public settings. No plaintext fallback (including Linux basic_text).
let instance: Store<Record<string, string>> | undefined
function credentialStore(): Store<Record<string, string>> {
  return instance ??= new Store<Record<string, string>>({ name: 'tts-credentials' })
}
function available(): boolean {
  return safeStorage.isEncryptionAvailable() &&
    (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text')
}
export function saveTtsKey(provider: CloudProvider, key: string): void {
  if (!['fish', 'qwen'].includes(provider) || typeof key !== 'string' || key.length > 4096) throw new Error('无效的语音凭据')
  if (!key) { credentialStore().delete(provider); return }
  if (!available()) throw new Error('系统安全存储不可用，未保存 Key；请启用系统密钥环')
  credentialStore().set(provider, safeStorage.encryptString(key.trim()).toString('base64'))
}
export function getTtsKey(provider: CloudProvider): string {
  const encrypted = credentialStore().get(provider)
  if (!encrypted || !available()) return ''
  try { return safeStorage.decryptString(Buffer.from(encrypted, 'base64')) } catch { return '' }
}
export function ttsKeyStatus(): Record<CloudProvider, boolean> {
  return { fish: Boolean(getTtsKey('fish')), qwen: Boolean(getTtsKey('qwen')) }
}

export function encryptApiKey(key: string): string {
  if (!key) return ''
  if (!available()) throw new Error('系统安全存储不可用，未保存 API Key')
  return 'safe:' + safeStorage.encryptString(key).toString('base64')
}
export function decryptApiKey(key: string): string {
  if (!key.startsWith('safe:')) return key // legacy migration is performed by AppConfig
  if (!available()) return ''
  try { return safeStorage.decryptString(Buffer.from(key.slice(5), 'base64')) } catch { return '' }
}
