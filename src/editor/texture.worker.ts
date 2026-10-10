import { restoreTexture } from './texture'
import type { Rect } from './types'

type Request={bitmap?:ImageBitmap;pixels?:Uint8ClampedArray;crop:Rect;target:Rect;excluded:Rect[]}
self.onmessage=(event:MessageEvent<Request>)=>{
  const {bitmap,crop,target,excluded}=event.data
  try {
    let pixels=event.data.pixels
    if(!pixels) {
      if(typeof OffscreenCanvas==='undefined'){bitmap?.close();self.postMessage({needsPixels:true});return}
      if(!bitmap)throw new Error('Не удалось прочитать изображение.')
      const canvas=new OffscreenCanvas(crop.width,crop.height)
      const ctx=canvas.getContext('2d',{willReadFrequently:true})
      if(!ctx) throw new Error('Восстановление текстуры недоступно. Используйте заливку.')
      ctx.drawImage(bitmap,-crop.x,-crop.y);bitmap.close()
      pixels=ctx.getImageData(0,0,crop.width,crop.height).data
      canvas.width=0;canvas.height=0
    }
    const local=(r:Rect)=>({...r,x:r.x-crop.x,y:r.y-crop.y})
    const masks=[target,...excluded].map(local)
    // Remove hidden content before scoring/copying; it never contributes to the result.
    for(const r of masks) {
      const left=Math.max(0,Math.min(crop.width,r.x))
      const right=Math.max(0,Math.min(crop.width,r.x+r.width))
      const top=Math.max(0,Math.min(crop.height,r.y))
      const bottom=Math.max(0,Math.min(crop.height,r.y+r.height))
      if(right<=left || bottom<=top) continue
      for(let y=top;y<bottom;y++) pixels.fill(0,(y*crop.width+left)*4,(y*crop.width+right)*4)
    }
    const result=restoreTexture({pixels,width:crop.width,height:crop.height,crop:{x:0,y:0,width:crop.width,height:crop.height},target:local(target),excluded:excluded.map(local)})
    self.postMessage({pixels:result.pixels,width:target.width,height:target.height}, {transfer:[result.pixels.buffer]})
  } catch(cause) {
    bitmap?.close()
    self.postMessage({error:cause instanceof Error ? cause.message : 'Не удалось восстановить текстуру. Используйте заливку.'})
  }
}
