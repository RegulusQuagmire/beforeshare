import { describe, expect, it } from 'vitest'
import { appendAnnotation, createDocument, cropDocument } from '../../src/editor/document'
import { commit, createHistory, redo, undo } from '../../src/editor/history'

describe('non-destructive crop', () => {
  const original = appendAnnotation(createDocument(320, 180), { id: 'r', kind: 'redact', rect: { x: 40, y: 40, width: 30, height: 20 } })
  it('normalizes reverse directions and rounds edges outwards', () => {
    const next = cropDocument(original, { x: 240.1, y: 150.2 }, { x: 20.7, y: 10.8 })
    expect(next.crop).toEqual({ x: 20, y: 10, width: 221, height: 141 })
    expect(original.crop).toEqual({ x: 0, y: 0, width: 320, height: 180 })
  })
  it('preserves all annotations and their source coordinates', () => {
    const next = cropDocument(original, { x: 100, y: 80 }, { x: 300, y: 160 })
    expect(next.annotations).toEqual(original.annotations)
    expect(next.annotations[0]).toEqual({ id: 'r', kind: 'redact', rect: { x: 40, y: 40, width: 30, height: 20 } })
  })
  it('repeated crop stays within the current crop, including outward rounding', () => {
    const first = cropDocument(original, { x: 40, y: 20 }, { x: 280, y: 160 })
    const next = cropDocument(first, { x: -20, y: -20 }, { x: 150.4, y: 90.8 })
    expect(next.crop).toEqual({ x: 40, y: 20, width: 111, height: 71 })
  })
  it.each([[15.99, 40], [40, 15.99], [0, 0]])('rejects undersized crop %i x %i without changing history', (width, height) => {
    const next = cropDocument(original, { x: 20, y: 20 }, { x: 20 + width, y: 20 + height })
    expect(next).toBe(original)
    const state = createHistory(original)
    expect(commit(state, next)).toBe(state)
  })
  it('accepts the inclusive 16x16 boundary', () => {
    expect(cropDocument(original, { x: 20, y: 20 }, { x: 36, y: 36 }).crop).toEqual({ x: 20, y: 20, width: 16, height: 16 })
  })
  it('full-view crop is a no-op and undo/redo restore exact document state', () => {
    expect(cropDocument(original, { x: -100, y: -100 }, { x: 999, y: 999 })).toBe(original)
    const initial = createHistory(original)
    const cropped = cropDocument(original, { x: 20, y: 10 }, { x: 280, y: 170 })
    const state = commit(initial, cropped)
    expect(undo(state).present).toEqual(original)
    expect(redo(undo(state))).toEqual(state)
  })
})
