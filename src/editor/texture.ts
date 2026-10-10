import type { Rect } from './types'

export type TextureInput={pixels:Uint8ClampedArray;width:number;height:number;target:Rect;crop:Rect;excluded:Rect[]}
export type TextureResult={pixels:Uint8ClampedArray;donor:Rect}
export const MAX_TEXTURE_PIXELS=1_000_000
const intersects=(a:Rect,b:Rect)=>a.x<b.x+b.width && a.x+a.width>b.x && a.y<b.y+b.height && a.y+a.height>b.y
const inside=(x:number,y:number,r:Rect)=>x>=r.x && y>=r.y && x<r.x+r.width && y<r.y+r.height

export function restoreTexture({pixels,width,height,target,crop,excluded}:TextureInput):TextureResult {
  if(target.width*target.height>MAX_TEXTURE_PIXELS) throw new Error('Одна текстура — максимум 1 миллион пикселей. Выделите меньшую область.')
  const forbidden=[target,...excluded]
  const safe=(x:number,y:number)=>x>=0 && y>=0 && x<width && y<height && inside(x,y,crop) && !forbidden.some(r=>inside(x,y,r))
  const rgb=(x:number,y:number,c:number)=>{
    const i=(y*width+x)*4, a=pixels[i+3]/255
    return Math.round(pixels[i+c]*a+255*(1-a))
  }
  // Every candidate is a complete same-size rectangle. No donor may intersect a mask.
  const xs=new Set<number>(), ys=new Set<number>()
  const radius=Math.max(target.width,target.height)*2+128
  for(let i=-12;i<=12;i++) {
    xs.add(Math.round(target.x+i*radius/12)); ys.add(Math.round(target.y+i*radius/12))
  }
  for(const x of [crop.x,target.x-target.width,target.x+target.width,crop.x+crop.width-target.width]) xs.add(x)
  for(const y of [crop.y,target.y-target.height,target.y+target.height,crop.y+crop.height-target.height]) ys.add(y)
  let best:Rect|null=null, bestScore=Infinity
  for(const y of ys) for(const x of xs) {
    const donor={x,y,width:target.width,height:target.height}
    if(x<crop.x || y<crop.y || x+donor.width>crop.x+crop.width || y+donor.height>crop.y+crop.height || forbidden.some(r=>intersects(r,donor))) continue
    let error=0, count=0
    for(let step=0;step<24;step++) {
      const dx=Math.min(target.width-1,Math.floor(step*target.width/24))
      const dy=Math.min(target.height-1,Math.floor(step*target.height/24))
      for(const [tx,ty,px,py] of [
        [target.x+dx,target.y-1,x+dx,y-1],
        [target.x+dx,target.y+target.height,x+dx,y+target.height],
        [target.x-1,target.y+dy,x-1,y+dy],
        [target.x+target.width,target.y+dy,x+target.width,y+dy],
      ]) {
        if(!safe(tx,ty) || !safe(px,py)) continue
        for(let c=0;c<3;c++) error+=Math.abs(rgb(tx,ty,c)-rgb(px,py,c))
        count+=3
      }
    }
    if(count<12) continue
    const score=error/count + Math.hypot(x-target.x,y-target.y)*0.0001
    if(score<bestScore) { bestScore=score;best=donor }
  }
  if(!best || bestScore>45) throw new Error('Подходящей чистой текстуры рядом нет. Используйте обычную заливку.')
  const output=new Uint8ClampedArray(target.width*target.height*4)
  for(let y=0;y<target.height;y++) for(let x=0;x<target.width;x++) {
    const i=(y*target.width+x)*4
    for(let c=0;c<3;c++) output[i+c]=rgb(best.x+x,best.y+y,c)
    output[i+3]=255
  }
  return {pixels:output,donor:best}
}
