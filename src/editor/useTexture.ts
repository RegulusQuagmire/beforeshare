import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TextureWorker from './texture.worker?worker&inline'
import { clearTextures, collectTextures, TEXTURE_MEMORY_LIMIT } from './assets'
import { appendAnnotation } from './document'
import { MAX_TEXTURE_PIXELS } from './texture'
import type { Annotation, EditorDocument, HistoryState, LoadedImage, Rect } from './types'

type TextureAnnotation=Extract<Annotation,{kind:'texture'}>
type Options={image:LoadedImage|null;doc:EditorDocument|null;history:HistoryState|null;commit:(doc:EditorDocument)=>void;onError:(message:string)=>void;onLock:(locked:boolean)=>void}

export function useTexture({image,doc,history,commit,onError,onLock}:Options) {
  const assets=useMemo(()=>new Map<string,ImageBitmap>(),[])
  const worker=useRef<Worker|null>(null), generation=useRef(0)
  const [computing,setComputing]=useState(false),[preview,setPreview]=useState<TextureAnnotation|null>(null)
  const [fallback,setFallback]=useState<{rect:Rect;doc:EditorDocument}|null>(null)

  const cancel=useCallback(()=>{
    generation.current++;worker.current?.terminate();worker.current=null
    setComputing(false);setPreview(null);onLock(false)
  },[onLock])
  const reset=useCallback(()=>{cancel();setFallback(null);clearTextures(assets)},[cancel,assets])
  useEffect(()=>{collectTextures(assets,history,preview?.assetId)},[assets,history,preview])
  useEffect(()=>()=>{generation.current++;worker.current?.terminate();clearTextures(assets)},[assets])
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape' && (computing||preview)){event.preventDefault();cancel()}
    }
    window.addEventListener('keydown',key)
    return ()=>window.removeEventListener('keydown',key)
  },[computing,preview,cancel])

  const request=useCallback(async(rect:Rect)=>{
    if(!image || !doc || computing || preview) return
    onError('');setFallback(null)
    if(rect.width*rect.height>MAX_TEXTURE_PIXELS) {
      onError('Одна текстура — максимум 1 миллион пикселей. Выделите меньшую область.');setFallback({rect,doc});return
    }
    const used=[...assets.values()].reduce((sum,item)=>sum+item.width*item.height*4,0)
    if(used+rect.width*rect.height*4>TEXTURE_MEMORY_LIMIT) {
      onError('Недостаточно памяти для текстуры. Используйте заливку.');setFallback({rect,doc});return
    }
    const id=++generation.current
    setComputing(true);onLock(true)
    try {
      const bitmap=await createImageBitmap(image.bitmap)
      if(generation.current!==id){bitmap.close();return}
      let job: Worker
      try { job=new TextureWorker() } catch(cause) { bitmap.close();throw cause }
      worker.current=job
      const fail=(message:string)=>{
        if(generation.current!==id) return
        job.terminate();worker.current=null;setComputing(false);onLock(false);onError(message);setFallback({rect,doc})
      }
      job.onerror=(event)=>{event.preventDefault();fail('Не удалось восстановить текстуру. Используйте заливку.')}
      job.onmessage=async(event:MessageEvent<{error?:string;needsPixels?:boolean;pixels:Uint8ClampedArray;width:number;height:number}>)=>{
        if(generation.current!==id) return
        if(event.data.error){fail(event.data.error);return}
        if(event.data.needsPixels) {
          // Some WebKit ports lack OffscreenCanvas in workers. Transfer a crop
          // raster instead; matching and mask sanitization stay in the worker.
          const canvas=document.createElement('canvas')
          try {
            canvas.width=doc.crop.width;canvas.height=doc.crop.height
            const ctx=canvas.getContext('2d',{willReadFrequently:true})
            if(!ctx)throw new Error('Canvas недоступен')
            ctx.drawImage(image.bitmap,-doc.crop.x,-doc.crop.y)
            const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data
            const excluded=doc.annotations.flatMap(item=>item.kind==='redact'||item.kind==='texture'?[item.rect]:[])
            job.postMessage({pixels,crop:doc.crop,target:rect,excluded},[pixels.buffer])
          } catch {fail('Не удалось прочитать текстуру. Используйте заливку.')}
          finally {canvas.width=0;canvas.height=0}
          return
        }
        try {
          const pixels=new Uint8ClampedArray(event.data.pixels)
          const patch=await createImageBitmap(new ImageData(pixels,event.data.width,event.data.height))
          if(generation.current!==id){patch.close();return}
          job.terminate();worker.current=null
          const assetId=crypto.randomUUID();assets.set(assetId,patch)
          setPreview({id:crypto.randomUUID(),kind:'texture',assetId,rect});setComputing(false)
        } catch {fail('Не удалось показать текстуру. Используйте заливку.')}
      }
      const excluded=doc.annotations.flatMap(item=>item.kind==='redact'||item.kind==='texture'?[item.rect]:[])
      try { job.postMessage({bitmap,crop:doc.crop,target:rect,excluded},[bitmap]) } catch(cause) { bitmap.close();throw cause }
    } catch(cause) {
      if(generation.current!==id) return
      worker.current?.terminate();worker.current=null;setComputing(false);onLock(false)
      onError(cause instanceof Error?cause.message:'Не удалось восстановить текстуру. Используйте заливку.');setFallback({rect,doc})
    }
  },[image,doc,computing,preview,assets,onError,onLock])
  function apply() {
    if(!preview || !doc) return
    commit(appendAnnotation(doc,preview));setPreview(null);onLock(false);onError('')
  }
  function fill(color:string) {
    if(!fallback || fallback.doc!==doc) return
    commit(appendAnnotation(doc,{id:crypto.randomUUID(),kind:'redact',rect:fallback.rect,color}))
    setFallback(null);onError('')
  }
  return {assets,preview,computing,request,cancel,reset,apply,fill,canFill:!!fallback && fallback.doc===doc}
}
