import { useEffect, useState, type ReactNode } from 'react'
import { LocaleContext, storedLanguage } from './locale'
import { translate } from './translations'

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState(storedLanguage)
  useEffect(() => {
    document.documentElement.lang = language
    document.title = `BeforeShare — ${translate('Перед отправкой', language)}`
    document.querySelector('meta[name="description"]')?.setAttribute('content', language === 'en'
      ? 'Private screenshot editor: hide personal details, annotate and export PNG locally in your browser.'
      : 'Локальный редактор скриншотов: скройте лишнее, добавьте пометки и скачайте PNG.')
    try { localStorage.setItem('beforeshare-language', language) } catch { /* Language still works without storage. */ }
  }, [language])
  return <LocaleContext value={{ language, setLanguage }}>{children}</LocaleContext>
}
