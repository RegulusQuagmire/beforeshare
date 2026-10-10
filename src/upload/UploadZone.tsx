import { useLocale } from '../locale'
import { translate } from '../translations'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

type Props = { busy: boolean; hasImage: boolean; onFiles: (files: File[]) => void; children: ReactNode }

export function UploadZone({ busy, hasImage, onFiles, children }: Props) {
  const { language } = useLocale()
  const t = (message: string) => translate(message, language)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement && (target.closest('input, textarea') || target.isContentEditable)) return
      const files = Array.from(event.clipboardData?.files ?? [])
      if (files.length === 0) return
      event.preventDefault()
      if (!busy) onFiles(files)
    }
    window.addEventListener('paste', paste)
    return () => window.removeEventListener('paste', paste)
  }, [busy, onFiles])

  return <div aria-busy={busy} className={`upload-zone ${hasImage ? 'loaded' : ''}`}
    onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = busy ? 'none' : 'copy' }}
    onDrop={event => { event.preventDefault(); if (!busy) onFiles(Array.from(event.dataTransfer.files)) }}>
    {children}
    <div className="file-controls">
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" disabled={busy} hidden
        aria-label={t("Файл изображения")}
        onChange={event => { onFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>
        {hasImage ? t("Открыть другое") : t("Выбрать изображение")}
      </button>
      {!hasImage && <p className="limits">{t("PNG, JPEG или WebP · до 20 MiB · до 20 Мп · до 6000 px по стороне")}</p>}
    </div>
  </div>
}
