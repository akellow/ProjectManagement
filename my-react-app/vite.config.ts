import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    port: 5173,
    proxy:
      mode === 'development'
        ? {
            '/api': {
              target: 'https://projectmanagement-qpdj.onrender.com',
              changeOrigin: true,
            },
          }
        : undefined,
  },
}))
