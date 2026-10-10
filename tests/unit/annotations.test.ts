import { describe, expect, it } from 'vitest'
import { appendAnnotation, createAnnotation, createDocument } from '../../src/editor/document'
import { commit, createHistory, undo } from '../../src/editor/history'

describe('completed drawing gestures', () => {
  const doc = createDocument(320, 180)

  it('normalizes reverse redaction and rounds its edges outwards', () => {
    expect(createAnnotation(doc, 'redact', { x: 30.2, y: 40.8 }, { x: 10.7, y: 20.1 }, 'r')).toEqual({
      id: 'r', kind: 'redact', rect: { x: 10, y: 20, width: 21, height: 21 },
    })
    expect(doc.annotations).toEqual([])
  })

  it('clamps redaction to the document view before rounding', () => {
    const cropped = { ...doc, crop: { x: 10, y: 20, width: 100, height: 60 } }
    expect(createAnnotation(cropped, 'redact', { x: -100, y: -100 }, { x: 500, y: 500 }, 'r')).toEqual({
      id: 'r', kind: 'redact', rect: { x: 10, y: 20, width: 100, height: 60 },
    })
  })

  it.each([
    [{ x: 0, y: 0 }, { x: 1.99, y: 20 }],
    [{ x: 0, y: 0 }, { x: 20, y: 1.99 }],
    [{ x: 5, y: 5 }, { x: 5, y: 5 }],
  ])('rejects undersized redactions before pixel rounding (%j → %j)', (from, to) => {
    expect(createAnnotation(doc, 'redact', from, to, 'r')).toBeNull()
  })

  it('accepts a 2 × 2 redaction at the inclusive boundary', () => {
    expect(createAnnotation(doc, 'redact', { x: 0, y: 0 }, { x: 2, y: 2 }, 'r')?.kind).toBe('redact')
  })

  it('retains arrow direction and requires length at least eight source pixels', () => {
    expect(createAnnotation(doc, 'arrow', { x: 20, y: 20 }, { x: 12, y: 20 }, 'a')).toEqual({
      id: 'a', kind: 'arrow', from: { x: 20, y: 20 }, to: { x: 12, y: 20 },
    })
    expect(createAnnotation(doc, 'arrow', { x: 20, y: 20 }, { x: 12.01, y: 20 }, 'a')).toBeNull()
    expect(createAnnotation(doc, 'arrow', { x: 0, y: 0 }, { x: -20, y: 0 }, 'a')).toBeNull()
  })

  it('numbers by current maximum, excluding non-number shapes', () => {
    const numbered = appendAnnotation(doc, { id: 'n', kind: 'number', at: { x: 10, y: 10 }, value: 4 })
    expect(createAnnotation(numbered, 'number', { x: 20, y: 30 }, { x: 20, y: 30 }, 'n2')).toEqual({
      id: 'n2', kind: 'number', at: { x: 20, y: 30 }, value: 5,
    })
    expect(createAnnotation(doc, 'number', { x: 20, y: 30 }, { x: 20, y: 30 }, 'n1')).toMatchObject({ value: 1 })
  })

  it('reuses the undone number and abandons redo on a new commit', () => {
    let state = createHistory(doc)
    state = commit(state, appendAnnotation(state.present, createAnnotation(state.present, 'number', { x: 20, y: 20 }, { x: 20, y: 20 }, '1')!))
    state = commit(state, appendAnnotation(state.present, createAnnotation(state.present, 'number', { x: 40, y: 20 }, { x: 40, y: 20 }, '2')!))
    state = undo(state)
    const replacement = createAnnotation(state.present, 'number', { x: 80, y: 20 }, { x: 80, y: 20 }, '3')!
    expect(replacement).toMatchObject({ value: 2 })
    state = commit(state, appendAnnotation(state.present, replacement))
    expect(state.future).toHaveLength(0)
  })

  it('accepts 99, rejects 100 without modifying the document', () => {
    const previous = appendAnnotation(doc, { id: '98', kind: 'number', at: { x: 20, y: 20 }, value: 98 })
    const last = createAnnotation(previous, 'number', { x: 40, y: 20 }, { x: 40, y: 20 }, '99')!
    expect(last).toMatchObject({ value: 99 })
    const full = appendAnnotation(previous, last)
    expect(() => createAnnotation(full, 'number', { x: 60, y: 20 }, { x: 60, y: 20 }, '100')).toThrow('Достигнут предел: 99 меток')
    expect(full.annotations).toHaveLength(2)
  })
})
