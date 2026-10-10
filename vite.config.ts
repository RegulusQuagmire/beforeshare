import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export function deploymentBase(repository?: string): string {
  if (!repository) return '/beforeshare/'
  const [owner, name] = repository.split('/')
  return name.toLowerCase() === `${owner.toLowerCase()}.github.io` ? '/' : `/${name}/`
}

export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  base: command === 'serve' && !isPreview ? '/' : process.env.VITE_BASE_PATH ?? deploymentBase(process.env.GITHUB_REPOSITORY),
}))
