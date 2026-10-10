import { useLocale } from '../locale'
import { translate } from '../translations'
import type { Tool } from './types'

type Props = {
  panning:boolean; onPan:()=>void
  tool: Tool; onToolChange: (tool: Tool) => void
  canUndo: boolean; canRedo: boolean; disabled?: boolean; onUndo: () => void; onRedo: () => void
}
const tools = [{ tool: 'select', label: 'Выбрать' }, { tool: 'pan', label: 'Перемещение' }, { tool: 'redact', label: 'Скрыть' }, { tool: 'arrow', label: 'Стрелка' }, { tool: 'number', label: 'Номер' }, { tool: 'text', label: 'Текст' }, { tool: 'pencil', label: 'Карандаш' }, { tool: 'crop', label: 'Обрезать' }, { tool: 'texture', label: 'Текстура' }] as const

export function Toolbar({ panning,onPan,tool, onToolChange, canUndo, canRedo, disabled = false, onUndo, onRedo }: Props) {
  const { language } = useLocale()
  const t = (message: string) => translate(message, language)
  return <div className="toolbar" role="group" aria-label={t("Инструменты и история изменений")}>
    {tools.map((item) => <button type="button" className="secondary" key={item.tool}
      title={t(item.label)} disabled={disabled} aria-pressed={item.tool==='pan'?panning:!panning && tool === item.tool} onClick={() => item.tool==='pan'?onPan():onToolChange(item.tool)}>{t(item.label)}</button>)}
    <button type="button" className="secondary" disabled={disabled || !canUndo} onClick={onUndo} aria-keyshortcuts="Control+Z Meta+Z" title="Ctrl/Cmd+Z">{t("Отменить")}</button>
    <button type="button" className="secondary" disabled={disabled || !canRedo} onClick={onRedo} aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y" title={t("Ctrl/Cmd+Shift+Z; Ctrl+Y на Windows")}>{t("Повторить")}</button>
  </div>
}
