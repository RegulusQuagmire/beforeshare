import { renderScene } from './render'
import type { EditorDocument, LoadedImage } from './types'

export async function exportPng(image:LoadedImage,doc:EditorDocument,assets:ReadonlyMap<string,ImageBitmap>=new Map()):Promise<Blob> {
  const canvas=document.createElement('canvas')
  try {
    canvas.width=doc.crop.width;canvas.height=doc.crop.height
    const ctx=canvas.getContext('2d')
    if(!ctx) throw new Error('Не удалось создать PNG. Попробуйте другой браузер.')
    renderScene(ctx,image,doc,1,assets)
    return await new Promise<Blob>((resolve,reject)=>{
      canvas.toBlob(blob=>blob ? resolve(blob) : reject(new Error('Не удалось создать PNG. Попробуйте ещё раз.')),'image/png')
    })
  } finally {
    canvas.width=0;canvas.height=0
  }
}

export function pngFilename(now=new Date()):string {
  const pad=(value:number)=>String(value).padStart(2,'0')
  return `beforeshare-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`
}

export function downloadBlob(blob:Blob,filename:string):void {
  const url=URL.createObjectURL(blob)
  const link=document.createElement('a')
  try {
    link.href=url;link.download=filename
    document.body.append(link);link.click()
  } finally {
    link.remove()
    // Let the browser consume the download URL before releasing it.
    window.setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
}
