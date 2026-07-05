import { defineConfig } from 'vite'

// Vite 配置 - 敦煌 3DShow 数字展馆
// Vite 会自动将 public 目录下的文件复制到 dist 根目录：
//   public/sw.js -> dist/sw.js
//   public/models/dunhuang_museum_v3.glb -> dist/models/dunhuang_museum_v3.glb
export default defineConfig({
  // GitHub Pages 项目站点 base 路径（v2 新站点）
  base: '/dunhuang-3dshow-v2/',
  server: {
    port: 3000,
    open: true,
    fs: {
      strict: false
    },
    cors: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three-vendor': ['three'],
        }
      }
    },
    chunkSizeWarningLimit: 80000,
    minify: 'esbuild',
  },
  assetsInclude: ['**/*.glb', '**/*.gltf'],
})
