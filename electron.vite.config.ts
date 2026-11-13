import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

// 版本号只有 package.json 一个真源。此前 Sidebar 里手写了一份，
// 结果发到 1.4.1 时侧栏还显示 1.4.0——注入进来，从此不会再对不上
const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf-8')) as { version: string }

export default defineConfig({
  main: {
    define: { 'process.env.LIVELINK_TEST_BUILD': JSON.stringify(process.env.LIVELINK_TEST_BUILD === '1' ? '1' : '0') },
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    root: '.',
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@overlay': resolve('src/overlay'),
        '@danmu-overlay': resolve('src/danmu-overlay'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [vue()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version + (process.env.LIVELINK_TEST_BUILD === '1' ? '-test' : ''))
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          audio: resolve('src/audio/index.html'),
          overlay: resolve('src/overlay/index.html'),
          'danmu-overlay': resolve('src/danmu-overlay/index.html')
        }
      }
    }
  }
})
