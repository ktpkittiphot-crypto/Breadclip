import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths work on both Vercel root domains and GitHub Pages subpaths.
  base: './',
})
