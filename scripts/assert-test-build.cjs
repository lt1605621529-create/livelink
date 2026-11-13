const fs = require('node:fs')
const path = require('node:path')
module.exports = async function beforePack(context) {
  const main = fs.readFileSync(path.join(context.packager.projectDir, 'out/main/index.js'), 'utf8')
  if (!main.includes('const applicationName = "LiveLink Test";') || !main.includes('"LiveLink-Test"')) {
    throw new Error('Refusing to package non-test code. Run pnpm build:test first.')
  }
}
