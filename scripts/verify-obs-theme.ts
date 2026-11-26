import { app, BrowserWindow } from 'electron'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { AppConfig } from '../src/main/config/store'
import { OverlayController } from '../src/main/overlay-controller'
import { OverlayServer } from '../src/main/overlay-server/server'
import { OverlayBroadcaster } from '../src/main/actions/overlay'
import type { OverlayThemeId } from '../src/shared/overlay-theme'

app.setPath('userData', mkdtempSync(join(tmpdir(), 'livelink-obs-theme-')))
app.disableHardwareAcceleration()
const server = new OverlayServer()
const windows: BrowserWindow[] = []

async function until<T>(read: () => Promise<T>, ready: (result: T) => boolean): Promise<T> {
  for (let i = 0; i < 100; i++) {
    const result = await read()
    if (ready(result)) return result
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error('OBS page did not update')
}

void app.whenReady().then(async () => {
  const config = new AppConfig()
  config.patchDanmuBoard({
    enabled: true, followTheme: false, backgroundColor: '#123456', backgroundOpacity: 1,
    textColor: '#f1e2d3', usernameColor: '#a1b2c3', textOpacity: 1, showUsername: true
  })
  const controller = new OverlayController(server, new OverlayBroadcaster(), config, resolve('out/renderer'))
  await controller.start()
  const liveUrl = server.getOverlayUrl()
  const previewUrl = liveUrl + '?theme-preview=1'
  for (const url of [previewUrl, liveUrl]) {
    const window = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false } })
    windows.push(window)
    await window.loadURL(url)
  }
  const [preview, live] = windows
  const read = (window: BrowserWindow) => window.webContents.executeJavaScript(`(() => {
    const style = (selector, property) => {
      const el = document.querySelector(selector);
      return el ? getComputedStyle(el)[property] : '';
    };
    return {
      background: style('.board','backgroundColor'),
      border: style('.board','borderTopColor'),
      text: style('.board','color'),
      username: style('.board .uname','color'),
      gift: style('.board .num','color'),
      welcome: style('.enter-banner','backgroundImage'),
      welcomeEdge: style('.enter-banner','borderLeftColor'),
      welcomeOpacity: style('.enter-banner','opacity'),
      lottery: style('.lottery-card','backgroundImage'),
      voting: style('.voting-card','borderTopColor'),
      voteBar: style('.vc-bar-fill','backgroundImage'),
      sc: style('.sc-card','backgroundImage'),
      preview: !!document.querySelector('.theme-preview')
    };
  })()`)
  const custom = await until(() => read(preview), s => s.background === 'rgb(18, 52, 86)')
  assert.equal(custom.username, 'rgb(161, 178, 195)')
  assert.equal(custom.text, 'rgb(241, 226, 211)')
  assert.equal(custom.welcomeOpacity, '1')
  assert.equal(custom.preview, true)
  assert.equal((await read(live)).preview, false)

  config.patchDanmuBoard({ followTheme: true })
  controller.notifyBoardConfigChanged()
  const colors: [OverlayThemeId, string, string][] = [
    ['classic', 'rgba(15, 23, 42, 0.78)', 'rgb(56, 189, 248)'],
    ['sakura', 'rgba(76, 29, 60, 0.9)', 'rgb(253, 164, 175)'],
    ['candy', 'rgba(20, 62, 68, 0.9)', 'rgb(94, 234, 212)'],
    ['neon', 'rgba(24, 13, 49, 0.94)', 'rgb(216, 180, 254)']
  ]
  const samples: Record<string, string>[] = []
  for (const [id, background, accent] of colors) {
    config.patchOverlayTheme({ id })
    controller.notifyThemeChanged()
    const s = await until(() => read(preview), s => s.background === background)
    assert.equal(s.username, accent)
    assert.equal(s.welcomeEdge, accent)
    assert.equal((await until(() => read(live), s => s.background === background)).background, background)
    assert.equal(preview.webContents.getURL(), previewUrl)
    assert.equal(live.webContents.getURL(), liveUrl)
    samples.push(s)
    assert.equal(new AppConfig().getOverlayTheme().id, id)
  }
  for (const key of ['border', 'text', 'gift', 'welcome', 'lottery', 'voting', 'voteBar', 'sc']) {
    assert.ok(samples.every(s => s[key]), `Missing rendered ${key}`)
    assert.ok(new Set(samples.map(s => s[key])).size >= 3, `Theme styles did not visibly vary for ${key}`)
  }
  assert.equal(new AppConfig().getDanmuBoard().followTheme, true)
  config.patchDanmuBoard({ followTheme: false })
  controller.notifyBoardConfigChanged()
  const restored = await until(() => read(preview), s => s.background === custom.background)
  assert.equal(restored.username, custom.username)
  assert.equal(restored.text, custom.text)
  assert.equal(new AppConfig().getDanmuBoard().backgroundColor, '#123456')
  console.log('OBS classic/sakura/candy/neon computed styles, live update, preview isolation and custom color persistence passed')
}).then(() => finish(0), error => { console.error(error); return finish(1) })

async function finish(code: number): Promise<void> {
  for (const window of windows) window.destroy()
  await server.stop()
  app.exit(code)
}
