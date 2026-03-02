import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/simulation/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['ws'],
  sourcemap: true,
})
