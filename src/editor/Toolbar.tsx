import type { Tool } from './types'

type Props = {
  tool: Tool; onToolChange: (tool: Tool) => void
  canUndo: boolean; canRedo: boolean; disabled?: boolean; onUndo: () => void; onRedo: () => void
}
const tools = [{ tool: 'redact', label: 'Скрыть' }, { tool: 'arrow', label: 'Стрелка' }, { tool: 'number', label: 'Номер' }, { tool: 'crop', label: 'Обрезать' }, { tool: 'texture', label: 'Текстура' }] as const

export function Toolbar({ tool, onToolChange, canUndo, canRedo, disabled = false, onUndo, onRedo }: Props) {
  return <div className="toolbar" role="group" aria-label="Инструменты и история изменений">
    {tools.map((item) => <button type="button" className="secondary" key={item.tool}
      disabled={disabled} aria-pressed={tool === item.tool} onClick={() => onToolChange(item.tool)}>{item.label}</button>)}
    <button type="button" className="secondary" disabled={disabled || !canUndo} onClick={onUndo} aria-keyshortcuts="Control+Z Meta+Z" title="Ctrl/Cmd+Z">Отменить</button>
    <button type="button" className="secondary" disabled={disabled || !canRedo} onClick={onRedo} aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y" title="Ctrl/Cmd+Shift+Z; Ctrl+Y на Windows">Повторить</button>
  </div>
}
