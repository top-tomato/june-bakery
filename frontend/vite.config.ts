import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Django serves the page shell (menu/templates/menu/app.html) and the API; Vite only builds the JS/CSS.
// - dev:   `npm run dev` on :5173, Django on :8000 loads /@vite/client + src/main.tsx from here (VITE_DEV_SERVER)
// - build: files go to dist/ with a manifest; Django's {% vite_assets %} tag reads it and whitenoise serves them
const django = 'http://127.0.0.1:8000'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/static/' : '/',
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react()],
  resolve: { alias: { '@': decodeURI(new URL('./src', import.meta.url).pathname) } },
  server: {
    port: 5173,
    strictPort: true,
    origin: 'http://localhost:5173',
    cors: { origin: django },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'app',
    manifest: true,
    rollupOptions: { input: 'src/main.tsx' },
    target: 'es2022',
  },
}))
