import { describe, expect, it, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import ts from 'typescript'
import { english, translate } from '../../src/translations'
import { storedLanguage } from '../../src/locale'

afterEach(() => vi.unstubAllGlobals())
describe('interface localization', () => {
  it('translates every Russian UI and local processing message', () => {
    const files = ['src/App.tsx', 'src/editor/Toolbar.tsx', 'src/editor/TextDialog.tsx', 'src/editor/PngPreview.tsx',
      'src/editor/EditorCanvas.tsx', 'src/upload/UploadZone.tsx', 'src/upload/loadImage.ts', 'src/editor/document.ts',
      'src/editor/texture.ts', 'src/editor/texture.worker.ts', 'src/editor/useTexture.ts', 'src/editor/export.ts']
    const missing = new Set<string>()
    for (const file of files) {
      const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
      const visit = (node: ts.Node) => {
        // The language selector intentionally names Russian in Russian.
        if (ts.isStringLiteral(node) && /[А-Яа-яЁё]/.test(node.text) && !['Canvas недоступен', 'Русский'].includes(node.text) && !english[node.text]) missing.add(node.text)
        ts.forEachChild(node, visit)
      }
      visit(ast)
    }
    expect([...missing]).toEqual([])
  })
  it('keeps Russian and unknown browser errors intact', () => {
    expect(translate('Скачать PNG', 'ru')).toBe('Скачать PNG')
    expect(translate('Browser error 123', 'en')).toBe('Browser error 123')
  })
  it('defaults safely when storage is blocked or contains an invalid locale', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') } })
    expect(storedLanguage()).toBe('ru')
    vi.stubGlobal('localStorage', { getItem: () => 'fr' })
    expect(storedLanguage()).toBe('ru')
    vi.stubGlobal('localStorage', { getItem: () => 'en' })
    expect(storedLanguage()).toBe('en')
  })
})
