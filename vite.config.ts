import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'
const isUserPagesRepo = repositoryName.toLowerCase().endsWith('.github.io')
const base = isGitHubActions && !isUserPagesRepo ? `/${repositoryName}/` : '/'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base,
})
