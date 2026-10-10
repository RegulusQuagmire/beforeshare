import type { Annotation, EditorDocument, Point, Rect } from './types'

export type Handle = 'move' | 'start' | 'end'
const inside = (p:Point,r:Rect,t=0) => p.x>=r.x-t && p.y>=r.y-t && p.x<=r.x+r.width+t && p.y<=r.y+r.height+t
const distance = (p:Point,a:Point,b:Point) => {
  const dx=b.x-a.x,dy=b.y-a.y
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)))
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)
}
export function annotationBounds(item:Annotation):Rect {
  if(item.kind==='redact'||item.kind==='texture') return item.rect
  if(item.kind==='number') return {x:item.at.x-16,y:item.at.y-16,width:32,height:32}
  if(item.kind==='text') {
    const ctx=typeof document==='undefined'?null:document.createElement('canvas').getContext('2d')
    if(ctx)ctx.font=`${item.fontSize}px system-ui`
    return {x:item.at.x,y:item.at.y,width:Math.max(1,...item.text.split('\n').map(line=>ctx?ctx.measureText(line).width:line.length*item.fontSize)),height:item.text.split('\n').length*item.fontSize*1.25}
  }
  const points=item.kind==='arrow'?[item.from,item.to]:item.points
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity
  for(const p of points){left=Math.min(left,p.x);top=Math.min(top,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y)}
  return {x:left,y:top,width:right-left,height:bottom-top}
}
export function handles(item:Annotation):[Point,Point]|null {
  if(item.kind==='arrow')return [item.from,item.to]
  if(item.kind==='redact')return [{x:item.rect.x,y:item.rect.y},{x:item.rect.x+item.rect.width,y:item.rect.y+item.rect.height}]
  return null
}
export function handleAt(item:Annotation,p:Point,tolerance:number):Handle {
  const pair=handles(item)
  if(pair){if(Math.hypot(p.x-pair[0].x,p.y-pair[0].y)<=tolerance)return 'start';if(Math.hypot(p.x-pair[1].x,p.y-pair[1].y)<=tolerance)return 'end'}
  return 'move'
}
export function hitTest(doc:EditorDocument,p:Point,tolerance:number):Annotation|null {
  // Match rendering: protective layers always cover explanatory annotations.
  const layers=[...doc.annotations.filter(i=>i.kind!=='redact'&&i.kind!=='texture'),...doc.annotations.filter(i=>i.kind==='redact'||i.kind==='texture')]
  for(const item of layers.reverse()) {
    if(item.kind==='arrow' && distance(p,item.from,item.to)<=tolerance+4)return item
    if(item.kind==='pencil' && item.points.some((a,i)=>distance(p,a,item.points[i+1]??a)<=tolerance+item.width/2))return item
    if(item.kind!=='arrow'&&item.kind!=='pencil'&&inside(p,annotationBounds(item),tolerance))return item
  }
  return null
}
export function transformAnnotation(item:Annotation,handle:Handle,from:Point,to:Point,crop:Rect):Annotation {
  const clamp=(p:Point)=>({x:Math.max(crop.x,Math.min(crop.x+crop.width,p.x)),y:Math.max(crop.y,Math.min(crop.y+crop.height,p.y))})
  const bounds=annotationBounds(item)
  // Cropping may already clip a shape. Do not snap it on selection (delta=0).
  const dx=Math.max(Math.min(0,crop.x-bounds.x),Math.min(Math.max(0,crop.x+crop.width-bounds.x-bounds.width),to.x-from.x))
  const dy=Math.max(Math.min(0,crop.y-bounds.y),Math.min(Math.max(0,crop.y+crop.height-bounds.y-bounds.height),to.y-from.y))
  const move=(p:Point)=>({x:p.x+dx,y:p.y+dy})
  if(item.kind==='arrow')return {...item,from:handle==='start'?clamp(to):handle==='move'?move(item.from):item.from,to:handle==='end'?clamp(to):handle==='move'?move(item.to):item.to}
  if(item.kind==='redact'||item.kind==='texture') {
    if(handle==='move'||item.kind==='texture')return {...item,rect:{...item.rect,x:Math.round(item.rect.x+dx),y:Math.round(item.rect.y+dy)}}
    const pair=handles(item)!,p=clamp(to),fixed=pair[handle==='start'?1:0]
    const x=Math.floor(Math.min(p.x,fixed.x)),y=Math.floor(Math.min(p.y,fixed.y))
    return {...item,rect:{x,y,width:Math.max(2,Math.ceil(Math.max(p.x,fixed.x))-x),height:Math.max(2,Math.ceil(Math.max(p.y,fixed.y))-y)}}
  }
  if(item.kind==='pencil')return {...item,points:item.points.map(move)}
  return {...item,at:move(item.at)}
}
export function updateAnnotation(doc:EditorDocument,item:Annotation):EditorDocument {
  return {...doc,annotations:doc.annotations.map(old=>old.id===item.id?structuredClone(item):old)}
}
export function removeAnnotation(doc:EditorDocument,id:string):EditorDocument {
  return {...doc,annotations:doc.annotations.filter(item=>item.id!==id)}
}
export function strokePoints(points:Point[],spacing:number):Point[] {
  const sampled:Point[]=[]
  for(const p of points)if(!sampled.length||Math.hypot(p.x-sampled[sampled.length-1].x,p.y-sampled[sampled.length-1].y)>=spacing)sampled.push(p)
  const last=points[points.length-1]
  if(last&&sampled[sampled.length-1]!==last)sampled.push(last)
  return sampled
}
