export type ConsoleLanguage = 'ru' | 'en'

export function chooseLanguage(answer: string): ConsoleLanguage | null {
  const value = answer.trim().toLowerCase()
  if (['', '1', 'ru', 'русский'].includes(value)) return 'ru'
  if (['2', 'en', 'english'].includes(value)) return 'en'
  return null
}

export function startupLines(language: ConsoleLanguage, urls: string[]): string[] {
  return language === 'ru'
    ? ['Перед отправкой — сервер разработки', 'Сервер запущен.', ...urls.map(url => 'Откройте в браузере: ' + url), 'Оставьте консоль открытой. Остановка: Ctrl+C.']
    : ['BeforeShare — development server', 'Server is running.', ...urls.map(url => 'Open in your browser: ' + url), 'Keep this console open. Stop: Ctrl+C.']
}
