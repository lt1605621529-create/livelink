const { spawnSync } = require('node:child_process')
const cli = require('node:path').resolve(require('node:path').dirname(require.resolve('electron-vite')), '../bin/electron-vite.js')
const result = spawnSync(process.execPath, [cli, 'build'], {
  stdio: 'inherit', env: { ...process.env, LIVELINK_TEST_BUILD: '1' }
})
process.exit(result.status ?? 1)
