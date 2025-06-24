import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Otimizações de build
  build: {
    // Minificação padrão (esbuild é mais rápido que terser)
    minify: 'esbuild',
    
    // Otimizações de chunk
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          socket: ['socket.io-client']
        }
      }
    },
    
    // Configurações de performance
    chunkSizeWarningLimit: 1000,
    
    // Source maps apenas em desenvolvimento
    sourcemap: process.env.NODE_ENV === 'development'
  },
  
  // Configurações de desenvolvimento
  server: {
    port: 5173,
    host: true, // Permite acesso externo
    cors: true
  },
  
  // Configurações de preview
  preview: {
    port: 4173,
    host: true
  },
  
  // Alias para imports
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  
  // Otimizações de CSS
  css: {
    postcss: './postcss.config.js'
  },
  
  // Configurações de environment
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '2.1.2'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  }
}) 