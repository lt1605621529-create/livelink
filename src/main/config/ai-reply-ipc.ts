import { ipcMain } from 'electron'
import type { AppConfig } from './store'
import { IpcChannels } from '../../shared/ipc-channels'
import { cleanForIpc } from '../../shared/ipc-dto'
import type { AiReplyConfig } from '../../shared/ai-reply'

export function registerAiReplyConfigIpc(config: AppConfig): void {
  ipcMain.handle(IpcChannels.AiReplyConfigGet, () => cleanForIpc(config.getAiReplyPublic()))
  ipcMain.handle(IpcChannels.AiReplyConfigPatch, (_event, patch: Partial<AiReplyConfig>) => {
    try { return cleanForIpc(config.patchAiReply(cleanForIpc(patch))) }
    catch { throw new Error('AI 配置保存失败，请检查配置格式、系统安全存储和文件写入权限。') }
  })
}
