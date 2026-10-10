import { describe, expect, it } from 'vitest'
import { appendAnnotation, createDocument } from '../../src/editor/document'
import { commit, createHistory, redo, undo } from '../../src/editor/history'
import type { EditorDocument } from '../../src/editor/types'

const mark = (doc: EditorDocument, value: number) => appendAnnotation(doc, { id: String(value), kind: 'number', at: { x: 20, y: 20 }, value })

describe('immutable document and bounded history', () => {
  it('starts with the entire source and no annotations', () => {
    expect(createDocument(320, 180)).toEqual({ crop: { x: 0, y: 0, width: 320, height: 180 }, annotations: [] })
  })
  it('adds a shape without changing old document or retaining mutable input', () => {
    const doc = createDocument(320, 180)
    const item = { id: 'a', kind: 'redact' as const, rect: { x: 10, y: 10, width: 20, height: 20 } }
    const next = appendAnnotation(doc, item)
    item.rect.x = 999
    expect(doc.annotations).toEqual([])
    expect(next.annotations[0]).toEqual({ ...item, rect: { x: 10, y: 10, width: 20, height: 20 } })
  })
  it('undo/redo empty branches return the identical history', () => {
    const state = createHistory(createDocument(320, 180))
    expect(undo(state)).toBe(state)
    expect(redo(state)).toBe(state)
  })
  it('commit undo redo restore exact states without mutating past history', () => {
    const initial = createHistory(createDocument(320, 180))
    const next = mark(initial.present, 1)
    const added = commit(initial, next)
    expect(initial.past).toEqual([])
    expect(initial.present.annotations).toEqual([])
    const undone = undo(added)
    expect(undone.present).toEqual(initial.present)
    expect(undone.future).toEqual([next])
    expect(redo(undone)).toEqual(added)
    expect(added.present).toEqual(next)
  })
  it('branching removes redo', () => {
    const initial = createHistory(createDocument(320, 180))
    const undone = undo(commit(initial, mark(initial.present, 1)))
    const branched = commit(undone, mark(undone.present, 2))
    expect(branched.future).toEqual([])
    expect(redo(branched)).toBe(branched)
  })
  it('no-op commits (including equivalent snapshots) retain redo and identity', () => {
    const initial = createHistory(createDocument(320, 180))
    const undone = undo(commit(initial, mark(initial.present, 1)))
    expect(commit(undone, undone.present)).toBe(undone)
    expect(commit(undone, structuredClone(undone.present))).toBe(undone)
  })
  it('caps past at 50 snapshots and stops at the oldest retained snapshot', () => {
    let state = createHistory(createDocument(320, 180))
    for (let i = 1; i <= 60; i++) state = commit(state, mark(state.present, i))
    expect(state.past).toHaveLength(50)
    expect(state.past[0].annotations).toHaveLength(10)
    for (let i = 0; i < 50; i++) state = undo(state)
    expect(state.present.annotations).toHaveLength(10)
    expect(undo(state)).toBe(state)
    expect(state.future).toHaveLength(50)
    for (let i = 0; i < 50; i++) state = redo(state)
    expect(state.present.annotations).toHaveLength(60)
    expect(state.past).toHaveLength(50)
  })
  it('stores only document data; source bitmap is not present in any snapshot', () => {
    const state = createHistory(createDocument(320, 180))
    const added = commit(state, mark(state.present, 1))
    for (const doc of [...added.past, added.present, ...added.future]) {
      expect(Object.keys(doc).sort()).toEqual(['annotations', 'crop'])
    }
  })
  it('snapshots do not share mutable incoming annotation data', () => {
    const state = createHistory(createDocument(320, 180))
    const next = mark(state.present, 1)
    const added = commit(state, next)
    next.crop.width = 1
    next.annotations.length = 0
    expect(added.present.crop.width).toBe(320)
    expect(added.present.annotations).toHaveLength(1)
  })
})
