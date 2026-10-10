import { describe, expect, it } from 'vitest'
import { chooseLanguage, startupLines } from '../../scripts/dev-language.ts'

describe('console language selection', () => {
  it.each(['', '1', 'ru', ' RU ', 'русский'])('chooses Russian for %j', answer => {
    expect(chooseLanguage(answer)).toBe('ru')
  })
  it.each(['2', 'en', 'EN', 'english'])('chooses English for %j', answer => {
    expect(chooseLanguage(answer)).toBe('en')
  })
  it('rejects an invalid answer instead of silently choosing', () => {
    expect(chooseLanguage('gibberish')).toBeNull()
  })
  it('includes the actual URL and stop instructions in Russian', () => {
    const text = startupLines('ru', ['http://127.0.0.1:5180/']).join('\n')
    expect(text).toContain('Сервер запущен')
    expect(text).toContain('http://127.0.0.1:5180/')
    expect(text).toContain('Ctrl+C')
  })
  it('includes the actual URL and stop instructions in English', () => {
    const text = startupLines('en', ['http://127.0.0.1:5180/']).join('\n')
    expect(text).toContain('Server is running')
    expect(text).toContain('http://127.0.0.1:5180/')
    expect(text).toContain('Ctrl+C')
  })
})
