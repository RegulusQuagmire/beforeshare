import type { Annotation, EditorDocument, LoadedImage, Point, Rect } from './types'

function drawAnnotation(ctx: CanvasRenderingContext2D, item: Extract<Annotation, { kind: 'arrow' | 'number' }>) {
  if (item.kind === 'number') {
    ctx.beginPath()
    ctx.arc(item.at.x, item.at.y, 16, 0, Math.PI * 2)
    ctx.fillStyle = '#F97316'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#FFFFFF'
    ctx.stroke()
    ctx.font = 'bold 18px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(String(item.value), item.at.x, item.at.y)
    return
  }
  const angle = Math.atan2(item.to.y - item.from.y, item.to.x - item.from.x)
  ctx.beginPath()
  ctx.moveTo(item.from.x, item.from.y)
  ctx.lineTo(item.to.x, item.to.y)
  for (const direction of [-1, 1]) {
    ctx.moveTo(item.to.x, item.to.y)
    ctx.lineTo(item.to.x - 16 * Math.cos(angle + direction * Math.PI / 6),
      item.to.y - 16 * Math.sin(angle + direction * Math.PI / 6))
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 7
  ctx.stroke()
  ctx.strokeStyle = '#F97316'
  ctx.lineWidth = 4
  ctx.stroke()
}

export function renderScene(ctx: CanvasRenderingContext2D, image: LoadedImage, doc: EditorDocument, scale: number, assets: ReadonlyMap<string, ImageBitmap> = new Map(), origin: Point = doc.crop): void {
  ctx.save()
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    ctx.shadowColor = 'transparent'
    ctx.setLineDash([])
    ctx.filter = 'none'
    ctx.scale(scale, scale)
    ctx.translate(-origin.x, -origin.y)
    ctx.beginPath()
    ctx.rect(doc.crop.x, doc.crop.y, doc.crop.width, doc.crop.height)
    ctx.clip()
    ctx.drawImage(image.bitmap, 0, 0)
    for (const item of doc.annotations) if (item.kind === 'arrow' || item.kind === 'number') drawAnnotation(ctx, item)
    ctx.fillStyle = '#000000'
    for (const item of doc.annotations) {
      if (item.kind !== 'redact' && item.kind !== 'texture') continue
      const left = Math.max(0, Math.floor(item.rect.x))
      const top = Math.max(0, Math.floor(item.rect.y))
      const right = Math.min(image.width, Math.ceil(item.rect.x + item.rect.width))
      const bottom = Math.min(image.height, Math.ceil(item.rect.y + item.rect.height))
      if (right > left && bottom > top) {
        ctx.fillStyle = item.kind === 'redact' ? item.color ?? '#000000' : '#000000'
        ctx.fillRect(left, top, right - left, bottom - top)
        if (item.kind === 'texture') { const patch = assets.get(item.assetId); if (patch) ctx.drawImage(patch, item.rect.x, item.rect.y) }
      }
    }
  } finally { ctx.restore() }
}

export function renderDraft(ctx: CanvasRenderingContext2D, crop: Rect, item: Annotation, scale: number, assets: ReadonlyMap<string, ImageBitmap> = new Map(), origin: Point = crop): void {
  ctx.save()
  try {
    ctx.setTransform(scale, 0, 0, scale, -origin.x * scale, -origin.y * scale)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.beginPath()
    ctx.rect(crop.x, crop.y, crop.width, crop.height)
    ctx.clip()
    if (item.kind === 'redact' || item.kind === 'texture') {
      ctx.fillStyle = item.kind === 'redact' ? item.color ?? '#000000' : '#000000'
      ctx.fillRect(item.rect.x, item.rect.y, item.rect.width, item.rect.height)
          if (item.kind === 'texture') { const patch = assets.get(item.assetId); if (patch) ctx.drawImage(patch, item.rect.x, item.rect.y) }
    } else drawAnnotation(ctx, item)
  } finally { ctx.restore() }
}

export function renderCropDraft(ctx: CanvasRenderingContext2D, crop: Rect, selection: Rect, scale: number, origin: Point = crop): void {
  ctx.save()
  try {
    ctx.setTransform(scale, 0, 0, scale, -origin.x * scale, -origin.y * scale)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)'
    const right = crop.x + crop.width, bottom = crop.y + crop.height
    ctx.fillRect(crop.x, crop.y, crop.width, selection.y - crop.y)
    ctx.fillRect(crop.x, selection.y + selection.height, crop.width, bottom - selection.y - selection.height)
    ctx.fillRect(crop.x, selection.y, selection.x - crop.x, selection.height)
    ctx.fillRect(selection.x + selection.width, selection.y, right - selection.x - selection.width, selection.height)
    ctx.strokeStyle = '#F97316'
    ctx.lineWidth = 2 / scale
    ctx.strokeRect(selection.x, selection.y, selection.width, selection.height)
  } finally { ctx.restore() }
}
