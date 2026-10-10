import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'
import { createServer } from 'vite'
import type { ViteDevServer } from 'vite'
import { chooseLanguage, startupLines } from './dev-language.ts'
import type { ConsoleLanguage } from './dev-language.ts'

let language: ConsoleLanguage = 'ru'
let server: ViteDevServer | undefined
try {
  const { values } = parseArgs({
    options: {
      lang: { type: 'string' }, host: { type: 'string' },
      port: { type: 'string' }, strictPort: { type: 'boolean', default: true },
      open: { type: 'boolean', default: false },
    },
  })
  if (values.lang !== undefined) {
    const selected = chooseLanguage(values.lang)
    if (!selected) throw new Error('Язык / Language: ru или / or en')
    language = selected
  } else if (process.stdin.isTTY && process.stdout.isTTY) {
    const prompt = createInterface({ input: process.stdin, output: process.stdout })
    try {
      let selected: ConsoleLanguage | null = null
      while (!selected) selected = chooseLanguage(await prompt.question('Язык консоли / Console language: 1 — Русский, 2 — English [1]: '))
      language = selected
    } finally { prompt.close() }
  }
  const port = Number(values.port ?? 5173)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(language === 'ru' ? 'Порт должен быть числом от 1 до 65535.' : 'Port must be an integer between 1 and 65535.')
  server = await createServer({
    clearScreen: false,
    server: { host: values.host ?? '127.0.0.1', port, strictPort: values.strictPort, open: values.open },
  })
  await server.listen()
  console.log(startupLines(language, [...(server.resolvedUrls?.local ?? []), ...(server.resolvedUrls?.network ?? [])]).join('\n'))
  let closing = false
  const stop = async () => {
    if (closing) return
    closing = true
    await server?.close()
    console.log(language === 'ru' ? 'Сервер остановлен.' : 'Server stopped.')
    process.exit(0)
  }
  process.once('SIGINT', () => { void stop() })
  process.once('SIGTERM', () => { void stop() })
} catch (cause) {
  await server?.close()
  console.error(language === 'ru' ? 'Не удалось запустить сервер:' : 'Could not start the server:')
  // Keep original diagnostics intact for troubleshooting.
  console.error(cause instanceof Error ? cause.message : cause)
  process.exitCode = 1
}
