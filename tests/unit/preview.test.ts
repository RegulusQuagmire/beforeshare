import { describe, expect, it } from 'vitest'
import { fitPreview } from '../../src/editor/geometry'

describe('preview layout does not clip narrow sources after rounding', () => {
  it.each([1, 2])('retains a 1 × 6000 image at DPR %i', dpr => {
    const view = fitPreview({ width: 1, height: 6000 }, { width: 1200, height: 720 }, dpr)
    expect(view.width).toBeCloseTo(0.12)
    expect(view.height).toBe(720)
    expect(view.backingWidth).toBe(1)
    expect(view.backingHeight).toBe(6000)
    expect(view.scale).toBe(1)
  })
  it.each([1, 2])('retains a 6000 × 1 image without alpha loss at DPR %i', dpr => {
    const view = fitPreview({ width: 6000, height: 1 }, { width: 1200, height: 720 }, dpr)
    expect(view.width).toBe(1200)
    expect(view.backingWidth).toBe(6000)
    expect(view.backingHeight).toBe(1)
    expect(view.scale).toBe(1)
  })
  it.each([[3, 5999], [5999, 3], [1200, 800], [80, 60]])('uses consistent uniform scale for %i × %i', (width, height) => {
    const view = fitPreview({ width, height }, { width: 278, height: 432 }, 2)
    expect(view.width).toBeLessThanOrEqual(Math.min(width, 278))
    expect(view.height).toBeLessThanOrEqual(Math.min(height, 432))
    expect(view.backingWidth).toBeCloseTo(width * view.scale, 8)
    expect(view.backingHeight).toBeGreaterThanOrEqual(height * view.scale)
    expect(view.backingHeight).toBe(Math.ceil(height * view.scale))
  })
})
