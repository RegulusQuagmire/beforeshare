import { useLocale } from '../locale'
import { translate } from '../translations'
import { useEffect, useLayoutEffect, useRef, type PointerEvent } from 'react'
import { normalizeRect } from './geometry'
import { pointInView, previewView, type PreviewView } from './view'
import { appendAnnotation, createAnnotation, cropDocument } from './document'
import { renderCropDraft, renderDraft, renderScene, renderSelection } from './render'
import { handleAt, hitTest, strokePoints, transformAnnotation, updateAnnotation, type Handle } from './objects'
import type { Annotation, EditorDocument, LoadedImage, Point, Rect, Tool } from './types'

type Props = {
  selectedId:string|null; onSelect:(id:string|null)=>void; onText:(at:Point)=>void; lineWidth:number
  panning:boolean
  cropDraft:Rect|null; onCropDraft:(rect:Rect)=>void; onCancelCrop:()=>void
  image:LoadedImage; doc:EditorDocument; tool:Tool; disabled?:boolean
  zoom:number|null; color:string; picking:boolean; onPick:(color:string)=>void
  assets:ReadonlyMap<string,ImageBitmap>; textureDraft:Extract<Annotation,{kind:'texture'}>|null; onTexture:(rect:Rect)=>void
  onCommit:(next:EditorDocument)=>void
  onScaleChange:(percent:number)=>void; onError:(message:string)=>void
}
type Gesture={pointerId:number;from:Point;to:Point;item?:Annotation;handle?:Handle;points:Point[]}

export function EditorCanvas({selectedId,onSelect,onText,lineWidth,panning,cropDraft,onCropDraft,onCancelCrop,image,doc,tool,disabled=false,zoom,color,picking,onPick,assets,textureDraft,onTexture,onCommit,onScaleChange,onError}:Props) {
  const { language } = useLocale()
  const t = (message: string) => translate(message, language)
  const viewport=useRef<HTMLDivElement>(null), surface=useRef<HTMLDivElement>(null), canvas=useRef<HTMLCanvasElement>(null)
  const gesture=useRef<Gesture|null>(null), viewRef=useRef<PreviewView|null>(null)
  const pan=useRef<{id:number;x:number;y:number;left:number;top:number}|null>(null)
  const redraw=useRef<()=>void>(()=>{})
  const selectedRef=useRef(selectedId)
  useLayoutEffect(()=>{selectedRef.current=selectedId;redraw.current()},[selectedId])
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
      if(target.width!==view.backingWidth)target.width=view.backingWidth
      if(target.height!==view.backingHeight)target.height=view.backingHeight
      const draft=gesture.current
      const editing=draft?.item?transformAnnotation(draft.item,draft.handle??'move',draft.from,draft.to,doc.crop):null
      let scene=textureDraft ? {...doc,annotations:[...doc.annotations,textureDraft]} : doc
      if(editing) scene=updateAnnotation(scene,editing)
      renderScene(ctx,image,scene,view.scale,assets,view.source)
      if(cropDraft) renderCropDraft(ctx,doc.crop,cropDraft,view.scale,view.source)
      const selected=editing??doc.annotations.find(item=>item.id===selectedRef.current)
      if(selected&&!panning&&!picking)renderSelection(ctx,selected,view.scale,view.cssScale,view.source)
      if(draft && !picking) {
        if(tool==='crop') renderCropDraft(ctx,doc.crop,normalizeRect(draft.from,draft.to,doc.crop),view.scale,view.source)
        else if(tool==='pencil')renderDraft(ctx,doc.crop,{id:'draft',kind:'pencil',points:draft.points,width:lineWidth,color},view.scale,assets,view.source)
        else {
          try {
            const item=createAnnotation(doc,tool==='texture'?'redact':tool,draft.from,draft.to,'draft',color)
            if(item) renderDraft(ctx,doc.crop,item,view.scale,assets,view.source)
          } catch { /* Report marker limits only on completion. */ }
        }
      }
      onScaleChange(Math.round(view.cssScale*100))
    }
    let frame:number|null=null
    const schedule=()=>{if(frame===null)frame=requestAnimationFrame(()=>{frame=null;draw()})}
    redraw.current=schedule;draw()
    const observer=new ResizeObserver(schedule);observer.observe(host)
    const resize=()=>{cancelCrop();schedule()}
    window.addEventListener('resize',resize)
    let resolution:MediaQueryList
    const watch=()=>{
      resolution?.removeEventListener('change',density)
      resolution=window.matchMedia('(resolution: '+(window.devicePixelRatio||1)+'dppx)')
      resolution.addEventListener('change',density)
    }
    const density=()=>{schedule();watch()}
    watch()
    return ()=>{if(frame!==null)cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',resize);resolution.removeEventListener('change',density);redraw.current=()=>{}}
  },[image,doc,tool,panning,disabled,cropDraft,onCancelCrop,onScaleChange,onError,zoom,color,picking,assets,textureDraft,lineWidth])

  function point(event:PointerEvent<HTMLCanvasElement>) {
    return pointInView({x:event.clientX,y:event.clientY},event.currentTarget.getBoundingClientRect(),viewRef.current!,doc.crop)
  }
  function down(event:PointerEvent<HTMLCanvasElement>) {
    if(panning || disabled || gesture.current || !event.isPrimary || event.button!==0) return
    event.preventDefault()
    event.currentTarget.focus({preventScroll:true})
    const from=point(event)
    if(tool==='text'&&!picking){onText(from);return}
    let item:Annotation|undefined,handle:Handle='move'
    if(tool==='select'&&!picking) {
      const tolerance=(event.pointerType==='touch'?18:9)/(viewRef.current?.cssScale??1)
      const selected=doc.annotations.find(i=>i.id===selectedId)
      if(selected&&handleAt(selected,from,tolerance)!=='move'){item=selected;handle=handleAt(selected,from,tolerance)}
      else item=hitTest(doc,from,tolerance)??undefined
      onSelect(item?.id??null)
    }
    gesture.current={pointerId:event.pointerId,from,to:from,item,handle,points:[from]}
    event.currentTarget.setPointerCapture(event.pointerId);redraw.current()
  }
  function move(event:PointerEvent<HTMLCanvasElement>) {
    if(gesture.current?.pointerId!==event.pointerId) return
    event.preventDefault();gesture.current.to=point(event)
    if(tool==='pencil') {
      const points=gesture.current.points,p=gesture.current.to,last=points[points.length-1]
      if(points.length<10000&&Math.hypot(p.x-last.x,p.y-last.y)>=Math.max(0.5,lineWidth/4))points.push(p)
    }
    redraw.current()
  }
  function up(event:PointerEvent<HTMLCanvasElement>) {
    const active=gesture.current
    if(!active || active.pointerId!==event.pointerId) return
    event.preventDefault()
    const to=point(event);cancelGesture()
    if(disabled) return
    if(tool==='select'&&!picking){if(active.item)onCommit(updateAnnotation(doc,transformAnnotation(active.item,active.handle??'move',active.from,to,doc.crop)));return}
    if(tool==='pencil'&&!picking){onCommit(appendAnnotation(doc,{id:crypto.randomUUID(),kind:'pencil',points:strokePoints([...active.points,to],Math.max(0.5,lineWidth/4)),width:lineWidth,color}));return}
    if(picking) {
      const sample=document.createElement('canvas');sample.width=1;sample.height=1
      const ctx=sample.getContext('2d')!
      renderScene(ctx,image,doc,1,assets,{x:Math.min(image.width-1,Math.floor(active.from.x)),y:Math.min(image.height-1,Math.floor(active.from.y))})
      const rgba=ctx.getImageData(0,0,1,1).data
      const rgb=[0,1,2].map(i=>Math.round(rgba[i]*rgba[3]/255+255*(1-rgba[3]/255)).toString(16).padStart(2,'0'))
      sample.width=0;sample.height=0;onPick('#'+rgb.join(''));return
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
      <canvas ref={canvas} tabIndex={0} aria-describedby="editor-help editor-shortcuts" aria-label={t("Загруженное изображение, ")+doc.crop.width+t(" на ")+doc.crop.height+t(" пикселей")}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} />
    </div>
  </div>
}
