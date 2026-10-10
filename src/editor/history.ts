import { documentsEqual } from './document'
import type { Annotation, EditorDocument, HistoryState } from './types'

const LIMIT = 50
const owned = new WeakSet<Annotation>()

function freezeTree(value:object):void {
  for(const child of Object.values(value))if(child!==null&&typeof child==='object')freezeTree(child)
  Object.freeze(value)
}

function snapshot(doc:EditorDocument):EditorDocument {
  const annotations=doc.annotations.map(item=>{
    // Only objects cloned and frozen here can be shared across snapshots.
    if(owned.has(item))return item
    const copy=structuredClone(item);freezeTree(copy);owned.add(copy);return copy
  })
  const result={crop:{...doc.crop},annotations}
  Object.freeze(result.crop);Object.freeze(annotations);Object.freeze(result)
  return result
}

export function createHistory(doc: EditorDocument): HistoryState {
  return { past: [], present: snapshot(doc), future: [] }
}

export function commit(history: HistoryState, next: EditorDocument): HistoryState {
  if (documentsEqual(history.present, next)) return history
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present: snapshot(next),
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
