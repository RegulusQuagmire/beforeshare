import { describe, expect, it } from 'vitest'
import { normalizeRect, clientToImage } from '../../src/editor/geometry'

describe('source-coordinate geometry', () => {
  const bounds = { x: 100, y: 50, width: 400, height: 200 }
  it.each([
    [{ x: 120, y: 70 }, { x: 200, y: 170 }],
    [{ x: 200, y: 70 }, { x: 120, y: 170 }],
    [{ x: 120, y: 170 }, { x: 200, y: 70 }],
    [{ x: 200, y: 170 }, { x: 120, y: 70 }],
  ])('normalizes every gesture direction', (a, b) => {
    expect(normalizeRect(a, b, bounds)).toEqual({ x: 120, y: 70, width: 80, height: 100 })
  })
  it('clips to shifted bounds', () => {
    expect(normalizeRect({ x: -10, y: 0 }, { x: 800, y: 400 }, bounds)).toEqual(bounds)
  })
  it('keeps fractional source precision and zero-size gestures', () => {
    expect(normalizeRect({ x: 120.5, y: 70.25 }, { x: 120.5, y: 70.25 }, bounds))
      .toEqual({ x: 120.5, y: 70.25, width: 0, height: 0 })
  })
  it('maps the specified reduced and shifted preview example', () => {
    expect(clientToImage({ x: 110, y: 70 }, { x: 10, y: 20, width: 200, height: 100 }, bounds))
      .toEqual({ x: 300, y: 150 })
  })
  it('clamps outside coordinates to crop edges', () => {
    const preview = { x: 10, y: 20, width: 200, height: 100 }
    expect(clientToImage({ x: -50, y: -50 }, preview, bounds)).toEqual({ x: 100, y: 50 })
    expect(clientToImage({ x: 500, y: 500 }, preview, bounds)).toEqual({ x: 500, y: 250 })
  })
  it('does not assume a uniform CSS scale', () => {
    expect(clientToImage({ x: 110, y: 45 }, { x: 10, y: 20, width: 200, height: 50 }, bounds)).toEqual({ x: 300, y: 150 })
  })
  it('rejects an empty DOM canvas rectangle', () => {
    expect(() => clientToImage({ x: 0, y: 0 }, { x: 0, y: 0, width: 0, height: 10 }, bounds)).toThrow(RangeError)
  })
})
