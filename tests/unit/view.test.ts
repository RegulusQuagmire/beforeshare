import { describe, expect, it } from 'vitest'
import { previewView, pointInView } from '../../src/editor/view'

describe('bounded viewport zoom', () => {
  const crop = { x: 100, y: 50, width: 5500, height: 2000 }
  it('fits whole image while manual zoom remains 25–400%', () => {
    expect(previewView(crop, { width: 1000, height: 500 }, null, { x: 0, y: 0 }, 1).cssScale).toBeCloseTo(1000 / 5500)
    expect(previewView(crop, { width: 1000, height: 500 }, 400, { x: 0, y: 0 }, 2).cssScale).toBe(4)
  })
  it.each([25, 100, 400])('limits backing size to the visible viewport at %i%%', zoom => {
    const view = previewView(crop, { width: 1000, height: 500 }, zoom, { x: 500, y: 200 }, 2)
    expect(view.backingWidth).toBeLessThanOrEqual(2001)
    expect(view.backingHeight).toBeLessThanOrEqual(1001)
  })
  it('maps pointer coordinates through scroll and shifted crop at 400%', () => {
    const view = previewView(crop, { width: 1000, height: 500 }, 400, { x: 800, y: 400 }, 2)
    expect(pointInView({ x: 210, y: 120 }, { x: 10, y: 20, width: 1000, height: 500 }, view, crop)).toEqual({ x: 350, y: 175 })
  })
  it('clamps captured pointers to the full image, not just the visible viewport', () => {
    const view = previewView(crop, { width: 1000, height: 500 }, 400, { x: 800, y: 400 }, 1)
    expect(pointInView({ x: 1400, y: 100 }, { x: 0, y: 0, width: 1000, height: 500 }, view, crop).x).toBe(650)
  })
  it.each([[1, 6000], [6000, 1]])('preserves extreme aspect ratio %i x %i when fitting', (width,height) => {
    const view=previewView({x:0,y:0,width,height},{width:1000,height:500},null,{x:0,y:0},2)
    expect(view.backingWidth).toBeGreaterThanOrEqual(1)
    expect(view.backingHeight).toBeGreaterThanOrEqual(1)
    expect(view.scale).toBe(1)
  })
})
