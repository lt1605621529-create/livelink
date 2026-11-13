import { app, safeStorage } from 'electron'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { AppConfig } from '../src/main/config/store'
import { saveTtsKey, getTtsKey, ttsKeyStatus } from '../src/main/tts/credentials'

const directory = mkdtempSync(join(tmpdir(), 'livelink-settings-check-'))
app.setPath('userData', directory)
void app.whenReady().then(() => {
  const cfg = new AppConfig()
  for (const provider of ['edge', 'fish', 'qwen'] as const) {
    cfg.patchTts({provider, rate:'+20%', outputDeviceId:'test-device',
      fish:{model:'s2-pro',voice:'fish-test-voice',perEventVoice:{'gift.received':'fish-gift'}},
      qwen:{model:'qwen3-tts-flash',voice:'Cherry',region:'intl',perEventVoice:{'super.chat':'Serena'}}})
    const saved = cfg.getTts()
    assert.deepEqual(new AppConfig().getTts(), saved)
    assert.equal(saved.provider,provider)
    assert.equal(saved.outputDeviceId,'test-device')
    assert.equal(saved.fish?.perEventVoice?.['gift.received'],'fish-gift')
    assert.equal(saved.qwen?.region,'intl')
  }
  // Dummy value, not a vendor credential. Windows CI exercises DPAPI; Linux without keyring must reject.
  const dummy = 'local-storage-test-only-not-a-real-key'
  if (safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text')) {
    for (const provider of ['fish','qwen'] as const) {
      saveTtsKey(provider,dummy)
      assert.equal(getTtsKey(provider),dummy)
      assert.equal(ttsKeyStatus()[provider],true)
      assert.ok(!readFileSync(join(directory,'tts-credentials.json'),'utf8').includes(dummy))
      saveTtsKey(provider,'')
      assert.equal(ttsKeyStatus()[provider],false)
    }
    console.log('TTS secure key round trip passed')
  } else {
    assert.throws(()=>saveTtsKey('fish',dummy),/安全存储/)
    console.log('TTS unsafe-storage rejection passed; encrypted round trip requires Windows/keyring')
  }
  console.log('TTS settings save/read/reload passed for all three providers')
  rmSync(directory,{recursive:true,force:true})
  app.exit(0)
}).catch(() => {
  console.error('TTS settings verification failed')
  rmSync(directory,{recursive:true,force:true})
  app.exit(1)
})
