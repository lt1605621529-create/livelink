import { app, BrowserWindow } from 'electron'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { TTSPlayer } from '../src/main/actions/tts'
import { AppConfig } from '../src/main/config/store'
import { normalizeMasterVolume } from '../src/shared/tts-volume'

app.setPath('userData', mkdtempSync(join(tmpdir(), 'livelink-tts-volume-')))
app.disableHardwareAcceleration()

void app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false })
  await window.loadURL('about:blank')
  // Capture the native media element's gain at play(), without depending on a physical output device.
  await window.webContents.executeJavaScript(`
    Audio.prototype.play = function () {
      window.playback = { gain: this.volume, muted: this.muted };
      queueMicrotask(() => this.dispatchEvent(new Event('ended')));
      return Promise.resolve();
    };
    void 0;
  `)
  const player = new TTSPlayer()
  const internal = player as unknown as { play(audio: Buffer, strict: boolean): Promise<void>; ensureAudioWindow(): Promise<BrowserWindow> }
  internal.ensureAudioWindow = async () => window
  for (const provider of ['edge', 'fish', 'qwen'] as const) {
    for (const [volume, gain] of [[0, 0], [1, .0001], [10, .01], [25, .0625], [50, .25], [100, 1]]) {
      player.setConfig({ provider, volume })
      await internal.play(Buffer.from('RIFF'), true)
      const actual = await window.webContents.executeJavaScript('window.playback')
      assert.ok(Math.abs(actual.gain - gain) < 1e-12)
      assert.equal(actual.muted, volume === 0)
    }
  }
  assert.equal(normalizeMasterVolume('-50%'), 71)
  assert.equal(normalizeMasterVolume('+50%'), 100)
  assert.equal(normalizeMasterVolume(-50), 0)
  const config = new AppConfig()
  config.patchTts({ volume: 10 })
  assert.equal(new AppConfig().getTts().volume, 10)
  config.patchTts({ volume: 0 })
  assert.equal(new AppConfig().getTts().volume, 0)
  console.log('18 playback gain/mute checks across Edge/Fish/Qwen, plus volume migration and persistence passed')
  window.destroy()
  app.exit(0)
}).catch(error => { console.error(error); app.exit(1) })
