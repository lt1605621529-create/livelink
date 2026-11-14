const { cleanForIpc } = require('../../src/shared/ipc-dto')
const { contextBridge, ipcRenderer } = require('electron')
const invoke = ipcRenderer.invoke.bind(ipcRenderer)
ipcRenderer.invoke = (channel, ...args) => {
  if (channel === 'ai-reply:config:patch') ipcRenderer.send('ai-test:invoke')
  return invoke(channel, ...args)
}
require('./production-preload.cjs')
contextBridge.exposeInMainWorld('aiProbe', {
  invalidPreload: () => { const value = {}; value.self = value; return cleanForIpc(value) },
  stage: label => ipcRenderer.send('ai-test:stage', label),
  state: () => invoke('ai-test:state'),
  failStorage: value => invoke('ai-test:fail-storage', value),
  disk: () => invoke('ai-test:disk')
})
