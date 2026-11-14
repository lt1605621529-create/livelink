const { spawnSync } = require('node:child_process')
const { appendFileSync } = require('node:fs')
let failed = false
for (const name of ['ai-dto','rules','tts','reader','song','assets','ai-reply','danmu-display','welcome']) {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', `verify:${name}`], {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024
  })
  const output = (result.stdout || '') + (result.stderr || '')
  process.stdout.write(output)
  const passed = result.status === 0
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- verify:${name}: ${passed ? 'PASS' : 'FAIL'}\n`)
  if (!passed) {
    failed = true
    if (process.env.GITHUB_ACTIONS) {
      const details = output.split(/\r?\n/).filter(line => /FAIL|Error|error|Cannot|failed|not found|not defined|ENOENT/.test(line)).slice(-12).join('\n') || output.slice(-2000)
      console.log(`::error title=verify:${name}::${details.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A')}`)
    }
  }
}
process.exit(failed ? 1 : 0)
