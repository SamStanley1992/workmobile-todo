import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/workmobile-todo/', // 👈 this must match your repo name exactly
  build: {
    outDir: 'dist', // default, but good to include explicitly
    chunkSizeWarningLimit: 1000,
  },
})
