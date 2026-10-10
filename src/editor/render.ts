import type { Annotation, EditorDocument, LoadedImage, Point, Rect } from './types'
import { annotationBounds, handles } from './objects'

function drawAnnotation(ctx: CanvasRenderingContext2D, item: Exclude<Annotation, { kind: 'redact' | 'texture' }>) {
  if(item.kind==='text') {
    ctx.font=`${item.fontSize}px system-ui`;ctx.textAlign='left';ctx.textBaseline='top';ctx.fillStyle=item.color
    item.text.split('\n').forEach((line,i)=>ctx.fillText(line,item.at.x,item.at.y+i*item.fontSize*1.25))
    return
  }
  if(item.kind==='pencil') {
    ctx.beginPath();const first=item.points[0];if(!first)return
    ctx.moveTo(first.x,first.y)
    for(let i=1;i<item.points.length;i++) {
      const p=item.points[i],next=item.points[i+1]??p
      ctx.quadraticCurveTo(p.x,p.y,(p.x+next.x)/2,(p.y+next.y)/2)
    }
    ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=item.width;ctx.strokeStyle=item.color
    if(item.points.length===1){ctx.arc(first.x,first.y,item.width/2,0,Math.PI*2);ctx.fillStyle=item.color;ctx.fill()}else ctx.stroke()
    return
  }
  if (item.kind === 'number') {
    ctx.beginPath()
    ctx.arc(item.at.x, item.at.y, 16, 0, Math.PI * 2)
    ctx.fillStyle = item.color ?? '#F97316'
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
  ctx.strokeStyle = item.color ?? '#F97316'
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
    for (const item of doc.annotations) if (item.kind !== 'redact' && item.kind !== 'texture') drawAnnotation(ctx, item)
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

export function renderSelection(ctx:CanvasRenderingContext2D,item:Annotation,scale:number,cssScale:number,origin:Point) {
  const box=annotationBounds(item)
  ctx.save()
  ctx.setTransform(scale,0,0,scale,-origin.x*scale,-origin.y*scale)
  ctx.strokeStyle='#ffffff';ctx.lineWidth=3/cssScale;ctx.strokeRect(box.x,box.y,box.width,box.height)
  ctx.strokeStyle='#7c3aed';ctx.lineWidth=1.5/cssScale;ctx.setLineDash([5/cssScale,3/cssScale]);ctx.strokeRect(box.x,box.y,box.width,box.height)
  ctx.setLineDash([])
  for(const p of handles(item)??[]) {
    ctx.fillStyle='#ffffff';ctx.fillRect(p.x-5/cssScale,p.y-5/cssScale,10/cssScale,10/cssScale)
    ctx.strokeRect(p.x-5/cssScale,p.y-5/cssScale,10/cssScale,10/cssScale)
  }
  ctx.restore()
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
