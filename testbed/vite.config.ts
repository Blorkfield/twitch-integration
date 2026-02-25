import { defineConfig } from 'vite'
import { resolve } from 'path'

const isDocker = process.env.DOCKER === '1'

export default defineConfig({
  server: {
    port: 5175,
    host: isDocker ? '0.0.0.0' : undefined,
    open: !isDocker,
  },
  resolve: {
    alias: {
      // In Docker, blork-tabs is installed from npm — skip the local sibling-repo aliases
      ...(!isDocker && {
        '@blorkfield/blork-tabs/styles.css': resolve(__dirname, '../../blork-tabs/dist/styles.css'),
        '@blorkfield/blork-tabs': resolve(__dirname, '../../blork-tabs/dist/index.js'),
      }),
      '@blorkfield/twitch-integration': resolve(__dirname, '../dist/index.js'),
    },
  },
})
