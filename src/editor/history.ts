import { documentsEqual } from './document'
import type { EditorDocument, HistoryState } from './types'

const LIMIT = 50

export function createHistory(doc: EditorDocument): HistoryState {
  return { past: [], present: structuredClone(doc), future: [] }
}

export function commit(history: HistoryState, next: EditorDocument): HistoryState {
  if (documentsEqual(history.present, next)) return history
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present: structuredClone(next),
    future: [],
  }
}

export function undo(history: HistoryState): HistoryState {
  if (history.past.length === 0) return history
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
  }
}

export function redo(history: HistoryState): HistoryState {
  if (history.future.length === 0) return history
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present: history.future[0],
    future: history.future.slice(1),
  }
}
