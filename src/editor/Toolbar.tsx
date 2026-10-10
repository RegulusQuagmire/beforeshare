import { useLocale } from '../locale'
import { translate } from '../translations'
import type { Tool } from './types'

type Props = {
  panning: boolean; onPan: () => void
  tool: Tool; onToolChange: (tool: Tool) => void
  canUndo: boolean; canRedo: boolean; disabled?: boolean; onUndo: () => void; onRedo: () => void
}
const groups = [
  [{ tool: 'select', label: 'Выбрать', icon: '↖' }, { tool: 'pan', label: 'Перемещение', icon: '↔' }],
  [{ tool: 'redact', label: 'Скрыть', icon: '▰' }, { tool: 'arrow', label: 'Стрелка', icon: '↗' }, { tool: 'number', label: 'Номер', icon: '①' }, { tool: 'text', label: 'Текст', icon: 'T' }, { tool: 'pencil', label: 'Карандаш', icon: '✎' }],
  [{ tool: 'crop', label: 'Обрезать', icon: '⌗' }, { tool: 'texture', label: 'Текстура', icon: '▧' }],
] as const

export function Toolbar({ panning, onPan, tool, onToolChange, canUndo, canRedo, disabled = false, onUndo, onRedo }: Props) {
  const { language } = useLocale()
  const t = (message: string) => translate(message, language)
  return <div className="toolbar" role="group" aria-label={t('Инструменты и история изменений')}>
    <div className="tool-palette">
      {groups.map((group, index) => <div className="tool-group" key={index}>
        {group.map(item => <button type="button" className="secondary tool-button" key={item.tool}
          aria-label={t(item.label)} title={t(item.label)} disabled={disabled}
          aria-pressed={item.tool === 'pan' ? panning : !panning && tool === item.tool}
          onClick={() => item.tool === 'pan' ? onPan() : onToolChange(item.tool)}>
          <span className="tool-icon" aria-hidden="true">{item.icon}</span><span className="tool-label">{t(item.label)}</span>
        </button>)}
      </div>)}
    </div>
    <div className="history-group">
      <button type="button" className="secondary history-button" disabled={disabled || !canUndo} onClick={onUndo} aria-label={t('Отменить')} aria-keyshortcuts="Control+Z Meta+Z" title="Ctrl/Cmd+Z"><span aria-hidden="true">↶</span></button>
      <button type="button" className="secondary history-button" disabled={disabled || !canRedo} onClick={onRedo} aria-label={t('Повторить')} aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y" title={t('Ctrl/Cmd+Shift+Z; Ctrl+Y на Windows')}><span aria-hidden="true">↷</span></button>
    </div>
  </div>
}
