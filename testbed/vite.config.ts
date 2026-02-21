import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  server: {
    port: 5175,
    open: true,
  },
  resolve: {
    alias: {
      '@blorkfield/blork-tabs/styles.css': resolve(__dirname, '../../blork-tabs/dist/styles.css'),
      '@blorkfield/blork-tabs': resolve(__dirname, '../../blork-tabs/dist/index.js'),
      '@blorkfield/twitch-integration': resolve(__dirname, '../dist/index.js'),
    },
  },
})
