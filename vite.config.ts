import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // maplibre-gl 6 resolves its worker next to the real module; keep it out of pre-bundling.
  optimizeDeps: { exclude: ['maplibre-gl'] },
})
