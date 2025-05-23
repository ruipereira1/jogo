import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Garante que a pasta public seja copiada para dist durante o build
  publicDir: 'public',
}) 