import { defineConfig } from 'vite'
import { resolve } from 'path'

const isDocker = process.env.DOCKER === '1'

export default defineConfig({
  server: {
    port: 5176,
    host: isDocker ? '0.0.0.0' : undefined,
    open: !isDocker,
  },
  resolve: {
    alias: {
      '@blorkfield/twitch-integration/simulation': resolve(__dirname, '../dist/simulation/index.js'),
      '@blorkfield/twitch-integration': resolve(__dirname, '../dist/index.js'),
    },
  },
})
