import { useEffect, useLayoutEffect, useRef, type PointerEvent } from 'react'
import { normalizeRect } from './geometry'
import { pointInView, previewView, type PreviewView } from './view'
import { appendAnnotation, createAnnotation, cropDocument } from './document'
import { renderCropDraft, renderDraft, renderScene } from './render'
import type { Annotation, EditorDocument, LoadedImage, Point, Rect, Tool } from './types'

type Props = {
  panning:boolean
  cropDraft:Rect|null; onCropDraft:(rect:Rect)=>void; onCancelCrop:()=>void
  image:LoadedImage; doc:EditorDocument; tool:Tool; disabled?:boolean
  zoom:number|null; color:string; picking:boolean; onPick:(color:string)=>void
  assets:ReadonlyMap<string,ImageBitmap>; textureDraft:Extract<Annotation,{kind:'texture'}>|null; onTexture:(rect:Rect)=>void
  onCommit:(next:EditorDocument)=>void
  onScaleChange:(percent:number)=>void; onError:(message:string)=>void
}
type Gesture={pointerId:number;from:Point;to:Point}

export function EditorCanvas({panning,cropDraft,onCropDraft,onCancelCrop,image,doc,tool,disabled=false,zoom,color,picking,onPick,assets,textureDraft,onTexture,onCommit,onScaleChange,onError}:Props) {
  const viewport=useRef<HTMLDivElement>(null), surface=useRef<HTMLDivElement>(null), canvas=useRef<HTMLCanvasElement>(null)
  const gesture=useRef<Gesture|null>(null), viewRef=useRef<PreviewView|null>(null)
  const pan=useRef<{id:number;x:number;y:number;left:number;top:number}|null>(null)
  const redraw=useRef<()=>void>(()=>{})
  function cancelGesture() {
    const active=gesture.current;gesture.current=null
    if(active && canvas.current?.hasPointerCapture(active.pointerId)) canvas.current.releasePointerCapture(active.pointerId)
    redraw.current()
  }
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(event.key!=='Escape')return
      const active=pan.current,host=viewport.current
      if(active){
        event.preventDefault();pan.current=null
        if(host?.hasPointerCapture(active.id))host.releasePointerCapture(active.id)
      }
      if(gesture.current){event.preventDefault();cancelGesture()}
    }
    window.addEventListener('keydown',key)
    return ()=>window.removeEventListener('keydown',key)
  },[])
  useLayoutEffect(()=>{
    const host=viewport.current,stage=surface.current,target=canvas.current
    if(!host || !stage || !target) return
    const dragging=pan.current;pan.current=null
    if(dragging && host.hasPointerCapture(dragging.id))host.releasePointerCapture(dragging.id)
    const active=gesture.current;gesture.current=null
    if(active && target.hasPointerCapture(active.pointerId)) target.releasePointerCapture(active.pointerId)
    const ctx=target.getContext('2d')
    if(!ctx){onError('Не удалось создать предпросмотр изображения. Попробуйте другой браузер.');return}
    let oldWidth=host.clientWidth,oldHeight=host.clientHeight
    const cancelCrop=()=>{
      if(tool==='crop') {
        const current=gesture.current;gesture.current=null
        if(current && target.hasPointerCapture(current.pointerId)) target.releasePointerCapture(current.pointerId)
      }
      if(cropDraft) onCancelCrop()
    }
    const draw=()=>{
      const width=host.clientWidth,height=host.clientHeight
      if(width<=0 || height<=0) return
      if(width!==oldWidth || height!==oldHeight) cancelCrop()
      oldWidth=width;oldHeight=height
      const view=previewView(doc.crop,{width,height},zoom,{x:host.scrollLeft,y:host.scrollTop},window.devicePixelRatio||1)
      viewRef.current=view
      stage.style.width=view.surfaceWidth+'px';stage.style.height=view.surfaceHeight+'px'
      target.style.left=view.canvas.x+'px';target.style.top=view.canvas.y+'px'
      target.style.width=view.canvas.width+'px';target.style.height=view.canvas.height+'px'
      target.width=view.backingWidth;target.height=view.backingHeight
      const scene=textureDraft ? {...doc,annotations:[...doc.annotations,textureDraft]} : doc
      renderScene(ctx,image,scene,view.scale,assets,view.source)
      if(cropDraft) renderCropDraft(ctx,doc.crop,cropDraft,view.scale,view.source)
      const draft=gesture.current
      if(draft && !picking) {
        if(tool==='crop') renderCropDraft(ctx,doc.crop,normalizeRect(draft.from,draft.to,doc.crop),view.scale,view.source)
        else {
          try {
            const item=createAnnotation(doc,tool==='texture'?'redact':tool,draft.from,draft.to,'draft',color)
            if(item) renderDraft(ctx,doc.crop,item,view.scale,assets,view.source)
          } catch { /* Report marker limits only on completion. */ }
        }
      }
      onScaleChange(Math.round(view.cssScale*100))
    }
    redraw.current=draw;draw()
    const observer=new ResizeObserver(draw);observer.observe(host)
    const resize=()=>{cancelCrop();draw()}
    window.addEventListener('resize',resize)
    let resolution:MediaQueryList
    const watch=()=>{
      resolution?.removeEventListener('change',density)
      resolution=window.matchMedia('(resolution: '+(window.devicePixelRatio||1)+'dppx)')
      resolution.addEventListener('change',density)
    }
    const density=()=>{draw();watch()}
    watch()
    return ()=>{observer.disconnect();window.removeEventListener('resize',resize);resolution.removeEventListener('change',density);redraw.current=()=>{}}
  },[image,doc,tool,panning,disabled,cropDraft,onCancelCrop,onScaleChange,onError,zoom,color,picking,assets,textureDraft])

  function point(event:PointerEvent<HTMLCanvasElement>) {
    return pointInView({x:event.clientX,y:event.clientY},event.currentTarget.getBoundingClientRect(),viewRef.current!,doc.crop)
  }
  function down(event:PointerEvent<HTMLCanvasElement>) {
    if(panning || disabled || gesture.current || !event.isPrimary || event.button!==0) return
    event.preventDefault()
    const from=point(event);gesture.current={pointerId:event.pointerId,from,to:from}
    event.currentTarget.setPointerCapture(event.pointerId);redraw.current()
  }
  function move(event:PointerEvent<HTMLCanvasElement>) {
    if(gesture.current?.pointerId!==event.pointerId) return
    event.preventDefault();gesture.current.to=point(event);redraw.current()
  }
  function up(event:PointerEvent<HTMLCanvasElement>) {
    const active=gesture.current
    if(!active || active.pointerId!==event.pointerId) return
    event.preventDefault()
    const to=point(event);cancelGesture()
    if(disabled) return
    if(picking) {
      const sample=new OffscreenCanvas(1,1),ctx=sample.getContext('2d')!
      renderScene(ctx as unknown as CanvasRenderingContext2D,image,doc,1,assets,{x:Math.min(image.width-1,Math.floor(active.from.x)),y:Math.min(image.height-1,Math.floor(active.from.y))})
      const rgba=ctx.getImageData(0,0,1,1).data
      const rgb=[0,1,2].map(i=>Math.round(rgba[i]*rgba[3]/255+255*(1-rgba[3]/255)).toString(16).padStart(2,'0'))
      onPick('#'+rgb.join(''));return
    }
    if(tool==='crop') {
      const next=cropDocument(doc,active.from,to)
      if(next!==doc) onCropDraft(next.crop)
      return
    }
    try {
      const item=createAnnotation(doc,tool==='texture'?'redact':tool,active.from,to,crypto.randomUUID(),color)
      if(!item) return
      onError('')
      if(tool==='texture' && item.kind==='redact') onTexture(item.rect)
      else onCommit(appendAnnotation(doc,item))
    } catch(cause){onError(cause instanceof Error?cause.message:'Не удалось добавить метку.')}
  }
  function cancel(event:PointerEvent<HTMLCanvasElement>){if(gesture.current?.pointerId===event.pointerId) cancelGesture()}

  function panDown(event:PointerEvent<HTMLDivElement>) {
    if(!panning||disabled||event.pointerType==='touch'||!event.isPrimary||event.button!==0)return
    event.preventDefault();const host=event.currentTarget
    pan.current={id:event.pointerId,x:event.clientX,y:event.clientY,left:host.scrollLeft,top:host.scrollTop}
    host.setPointerCapture(event.pointerId)
  }
  function panMove(event:PointerEvent<HTMLDivElement>) {
    const active=pan.current;if(!active||active.id!==event.pointerId)return
    event.currentTarget.scrollLeft=active.left+active.x-event.clientX
    event.currentTarget.scrollTop=active.top+active.y-event.clientY
  }
  function panEnd(event:PointerEvent<HTMLDivElement>) {
    if(pan.current?.id!==event.pointerId)return
    pan.current=null
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)
  }
  return <div className={'canvas-viewport'+(panning?' panning':'')} ref={viewport} onPointerDown={panDown} onPointerMove={panMove} onPointerUp={panEnd} onPointerCancel={panEnd} onLostPointerCapture={panEnd} onScroll={()=>{cancelGesture()}}>
    <div className="canvas-frame" ref={surface}>
      <canvas ref={canvas} aria-describedby="editor-help editor-shortcuts" aria-label={'Загруженное изображение, '+doc.crop.width+' на '+doc.crop.height+' пикселей'}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} />
    </div>
  </div>
}
