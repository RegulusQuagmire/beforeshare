import type { Point, Rect } from './types'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function normalizeRect(a: Point, b: Point, bounds: Rect): Rect {
  const left = clamp(Math.min(a.x, b.x), bounds.x, bounds.x + bounds.width)
  const top = clamp(Math.min(a.y, b.y), bounds.y, bounds.y + bounds.height)
  const right = clamp(Math.max(a.x, b.x), bounds.x, bounds.x + bounds.width)
  const bottom = clamp(Math.max(a.y, b.y), bounds.y, bounds.y + bounds.height)
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function clientToImage(client: Point, canvasRect: Rect, crop: Rect): Point {
  if (canvasRect.width <= 0 || canvasRect.height <= 0) throw new RangeError('Canvas rectangle must be visible')
  return {
    x: clamp(crop.x + (client.x - canvasRect.x) * crop.width / canvasRect.width, crop.x, crop.x + crop.width),
    y: clamp(crop.y + (client.y - canvasRect.y) * crop.height / canvasRect.height, crop.y, crop.y + crop.height),
  }
}

export function fitPreview(size: Pick<Rect, 'width' | 'height'>, area: Pick<Rect, 'width' | 'height'>, dpr: number) {
  const cssScale = Math.min(1, area.width / size.width, area.height / size.height)
  // Keep the shortest side at least one backing pixel; otherwise a 1px source
  // can be clipped or get alpha loss before the browser scales the canvas in CSS.
  const desiredScale = Math.max(cssScale * dpr, 1 / Math.min(size.width, size.height))
  const backingWidth = Math.max(1, Math.round(size.width * desiredScale))
  const scale = backingWidth / size.width
  return {
    width: size.width * cssScale, height: size.height * cssScale,
    backingWidth, backingHeight: Math.max(1, Math.ceil(size.height * scale)),
    scale, percent: Math.round(cssScale * 100),
  }
}
