import { execSync } from 'child_process'
import { existsSync } from 'fs'

const mode = process.argv[2]

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' })
}

if (mode === 'connect') {
  if (!existsSync('testbed/node_modules')) run('pnpm -C testbed install')
  run('pnpm -C testbed dev')
} else {
  if (!existsSync('testbed-sim/node_modules')) run('pnpm -C testbed-sim install')
  run('pnpm -C testbed-sim dev')
}
