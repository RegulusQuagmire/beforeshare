import { describe, expect, it } from 'vitest'
import { restoreTexture } from '../../src/editor/texture'
import type { Rect } from '../../src/editor/types'

function image() {
  const pixels = new Uint8ClampedArray(80 * 60 * 4)
  for (let y=0;y<60;y++) for(let x=0;x<80;x++) {
    const n=(Math.floor(x/4)+Math.floor(y/4))%2 ? 180 : 220
    pixels.set([n,n,n,255],(y*80+x)*4)
  }
  return pixels
}
const target={x:32,y:24,width:12,height:12}
const crop={x:0,y:0,width:80,height:60}
const run=(pixels:Uint8ClampedArray, excluded:Rect[]=[])=>restoreTexture({pixels,width:80,height:60,target,crop,excluded})

describe('safe neighboring texture copy', () => {
  it('copies actual patterned neighboring pixels, opaque, and leaves source untouched', () => {
    const pixels=image(), previous=pixels.slice()
    const result=run(pixels)
    expect(result.pixels.length).toBe(12*12*4)
    expect(new Set(Array.from(result.pixels).filter((_,i)=>i%4===0)).size).toBeGreaterThan(1)
    for(let i=3;i<result.pixels.length;i+=4) expect(result.pixels[i]).toBe(255)
    expect(pixels).toEqual(previous)
  })
  it('does not depend on any pixels inside target or existing hidden regions', () => {
    const a=image(), b=image()
    const hidden={x:0,y:0,width:20,height:60}
    for(const rect of [target,hidden]) for(let y=rect.y;y<rect.y+rect.height;y++) for(let x=rect.x;x<rect.x+rect.width;x++) {
      a.set([255,0,0,255],(y*80+x)*4); b.set([0,255,120,20],(y*80+x)*4)
    }
    expect(run(a,[hidden])).toEqual(run(b,[hidden]))
  })
  it('never uses an intersecting donor or samples outside the crop', () => {
    const hidden={x:0,y:0,width:32,height:60}
    const result=run(image(),[hidden])
    const r=result.donor
    expect(r.x>=32 && (r.x>=target.x+target.width || r.x+r.width<=target.x || r.y>=target.y+target.height || r.y+r.height<=target.y)).toBe(true)
    expect(r.x+r.width<=80 && r.y+r.height<=60).toBe(true)
  })
  it('rejects absent clean donors and oversize selections without allocating a patch', () => {
    expect(()=>run(image(),[crop])).toThrow('заливку')
    expect(()=>restoreTexture({pixels:new Uint8ClampedArray(),width:2000,height:2000,crop:{x:0,y:0,width:2000,height:2000},target:{x:0,y:0,width:1001,height:1000},excluded:[]})).toThrow('1')
  })
  it('flattens transparent donor pixels to an opaque background', () => {
    const pixels=image()
    for(let i=0;i<pixels.length;i+=4) pixels.set([200,200,200,100],i)
    const result=run(pixels)
    expect(result.pixels[3]).toBe(255)
    expect(result.pixels[0]).toBeGreaterThan(200)
  })
})
