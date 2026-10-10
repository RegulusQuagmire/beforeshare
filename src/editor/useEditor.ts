import { useCallback, useEffect, useReducer } from 'react'
import { createDocument, cropDocument } from './document'
import { commit, createHistory, redo, undo } from './history'
import type { EditorDocument, HistoryState, Rect, Tool } from './types'

type State = { history: HistoryState | null; tool: Tool; cropDraft: Rect | null }
type Action =
  | { type: 'reset'; width: number; height: number }
  | { type: 'commit'; next: EditorDocument }
  | { type: 'tool'; tool: Tool }
  | { type: 'cropDraft'; rect: Rect }
  | { type: 'cancelCrop' | 'applyCrop' | 'undo' | 'redo' }

function reducer(state: State, action: Action): State {
  if (action.type === 'reset') return { history: createHistory(createDocument(action.width, action.height)), tool: 'redact', cropDraft: null }
  if (action.type === 'cancelCrop') return state.cropDraft ? { ...state, cropDraft: null } : state
  if (!state.history) return state
  if (action.type === 'applyCrop') {
    if (!state.cropDraft) return state
    const r = state.cropDraft
    const next = cropDocument(state.history.present, { x: r.x, y: r.y }, { x: r.x + r.width, y: r.y + r.height })
    return { ...state, cropDraft: null, history: commit(state.history, next) }
  }
  if (state.cropDraft) return state
  if (action.type === 'cropDraft') return { ...state, cropDraft: action.rect }
  if (action.type === 'tool') return action.tool === state.tool ? state : { ...state, tool: action.tool }
  const history = action.type === 'commit' ? commit(state.history, action.next)
    : action.type === 'undo' ? undo(state.history) : redo(state.history)
  return history === state.history ? state : { ...state, history }
}

export function useEditor(disabled = false) {
  const [state, dispatch] = useReducer(reducer, { history: null, tool: 'redact', cropDraft: null })
  const canUndo = !!state.history?.past.length
  const canRedo = !!state.history?.future.length
  const reset = useCallback((width: number, height: number) => dispatch({ type: 'reset', width, height }), [])
  const setTool = useCallback((tool: Tool) => dispatch({ type: 'tool', tool }), [])
  const commitDocument = useCallback((next: EditorDocument) => dispatch({ type: 'commit', next }), [])
  const undoAction = useCallback(() => dispatch({ type: 'undo' }), [])
  const redoAction = useCallback(() => dispatch({ type: 'redo' }), [])
  const setCropDraft = useCallback((rect: Rect) => dispatch({ type: 'cropDraft', rect }), [])
  const cancelCrop = useCallback(() => dispatch({ type: 'cancelCrop' }), [])
  const applyCrop = useCallback(() => dispatch({ type: 'applyCrop' }), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (disabled || event.defaultPrevented) return
      const target = event.target
      if (target instanceof HTMLElement && (target.closest('input, textarea') || target.isContentEditable)) return
      if (state.cropDraft) {
        if (event.key === 'Escape') { event.preventDefault(); cancelCrop() }
        if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); applyCrop() }
        return
      }
      if (event.altKey || !(event.ctrlKey || event.metaKey)) return
      const key = event.key.toLowerCase()
      const isZ = key === 'z' || event.code === 'KeyZ'
      const isY = key === 'y' || event.code === 'KeyY'
      const wantsUndo = isZ && !event.shiftKey
      const wantsRedo = (isZ && event.shiftKey) ||
        (isY && event.ctrlKey && !event.metaKey && !event.shiftKey && navigator.platform.startsWith('Win'))
      if (wantsUndo && canUndo) { event.preventDefault(); undoAction() }
      if (wantsRedo && canRedo) { event.preventDefault(); redoAction() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [disabled, state.cropDraft, canUndo, canRedo, undoAction, redoAction, cancelCrop, applyCrop])

  return { history: state.history, document: state.history?.present ?? null, tool: state.tool, cropDraft: state.cropDraft,
    canUndo, canRedo, reset, setTool, commitDocument, undo: undoAction, redo: redoAction, setCropDraft, cancelCrop, applyCrop }
}
