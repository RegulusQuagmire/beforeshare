import { clientToImage, normalizeRect } from './geometry'
import type { Annotation, EditorDocument, Point, Tool } from './types'

export function createDocument(width: number, height: number): EditorDocument {
  return { crop: { x: 0, y: 0, width, height }, annotations: [] }
}

export function appendAnnotation(doc: EditorDocument, item: Annotation): EditorDocument {
  return { crop: { ...doc.crop }, annotations: [...doc.annotations, structuredClone(item)] }
}

export function documentsEqual(a: EditorDocument, b: EditorDocument): boolean {
  if (a === b) return true
  if (a.crop.x !== b.crop.x || a.crop.y !== b.crop.y || a.crop.width !== b.crop.width || a.crop.height !== b.crop.height) return false
  if (a.annotations.length !== b.annotations.length) return false
  return a.annotations.every((item, i) => {
    const other = b.annotations[i]
    if (item.id !== other.id || item.kind !== other.kind) return false
    if (item === other) return true
    if (item.kind === 'text' && other.kind === 'text') return item.text === other.text && item.fontSize === other.fontSize && item.color === other.color && item.at.x === other.at.x && item.at.y === other.at.y
    if (item.kind === 'pencil' && other.kind === 'pencil') return item.color === other.color && item.width === other.width && item.points.length === other.points.length && item.points.every((p,j)=>p.x===other.points[j].x && p.y===other.points[j].y)
    if (item.kind === 'texture' && other.kind === 'texture') return item.assetId === other.assetId && item.rect.x === other.rect.x && item.rect.y === other.rect.y && item.rect.width === other.rect.width && item.rect.height === other.rect.height
    if (item.kind === 'redact' && other.kind === 'redact') {
      return (item.color ?? '#000000').toLowerCase() === (other.color ?? '#000000').toLowerCase() && item.rect.x === other.rect.x && item.rect.y === other.rect.y && item.rect.width === other.rect.width && item.rect.height === other.rect.height
    }
    if (item.kind === 'arrow' && other.kind === 'arrow') {
      return item.color === other.color && item.from.x === other.from.x && item.from.y === other.from.y && item.to.x === other.to.x && item.to.y === other.to.y
    }
    return item.kind === 'number' && other.kind === 'number' && item.color === other.color && item.at.x === other.at.x && item.at.y === other.at.y && item.value === other.value
  })
}

export function createAnnotation(doc: EditorDocument, tool: Tool, from: Point, to: Point, id: string, color?: string): Annotation | null {
  const bounds = doc.crop
  const a = clientToImage(from, bounds, bounds)
  const b = clientToImage(to, bounds, bounds)
  if (tool === 'redact') {
    const rect = normalizeRect(a, b, bounds)
    if (rect.width < 2 || rect.height < 2) return null
    const x = Math.floor(rect.x), y = Math.floor(rect.y)
    return { id, kind: 'redact', ...(color ? { color: /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : '#000000' } : {}), rect: { x, y,
      width: Math.ceil(rect.x + rect.width) - x, height: Math.ceil(rect.y + rect.height) - y } }
  }
  if (tool === 'arrow') {
    return Math.hypot(b.x - a.x, b.y - a.y) < 8 ? null : { id, kind: 'arrow', from: a, to: b }
  }
  if (tool === 'number') {
    const value = 1 + doc.annotations.reduce((max, item) => item.kind === 'number' ? Math.max(max, item.value) : max, 0)
    if (value > 99) throw new Error('Достигнут предел: 99 меток')
    return { id, kind: 'number', at: a, value }
  }
  return null
}

export function cropDocument(doc: EditorDocument, from: Point, to: Point): EditorDocument {
  const rect = normalizeRect(from, to, doc.crop)
  if (rect.width < 16 || rect.height < 16) return doc
  const x = Math.max(doc.crop.x, Math.floor(rect.x))
  const y = Math.max(doc.crop.y, Math.floor(rect.y))
  const right = Math.min(doc.crop.x + doc.crop.width, Math.ceil(rect.x + rect.width))
  const bottom = Math.min(doc.crop.y + doc.crop.height, Math.ceil(rect.y + rect.height))
  const crop = { x, y, width: right - x, height: bottom - y }
  if (crop.x === doc.crop.x && crop.y === doc.crop.y && crop.width === doc.crop.width && crop.height === doc.crop.height) return doc
  return { ...doc, crop }
}
