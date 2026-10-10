import { createContext, useContext } from 'react'
import type { Language } from './translations'

export const LocaleContext = createContext<{ language: Language; setLanguage: (language: Language) => void }>({ language: 'ru', setLanguage: () => {} })
export function useLocale() { return useContext(LocaleContext) }
export function storedLanguage(): Language {
  try { return localStorage.getItem('beforeshare-language') === 'en' ? 'en' : 'ru' } catch { return 'ru' }
}
