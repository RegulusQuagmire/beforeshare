import { clientToImage } from './geometry'
import type { Point, Rect } from './types'

export function previewView(crop: Rect, area: {width:number;height:number}, zoom: number | null, scroll: Point, dpr: number) {
  const cssScale = zoom === null ? Math.min(1, area.width/crop.width, area.height/crop.height) : Math.min(400,Math.max(25,zoom))/100
  const worldWidth=crop.width*cssScale, worldHeight=crop.height*cssScale
  const surfaceWidth=Math.max(area.width,worldWidth), surfaceHeight=Math.max(area.height,worldHeight)
  const offsetX=(surfaceWidth-worldWidth)/2, offsetY=(surfaceHeight-worldHeight)/2
  const sx=Math.max(0,Math.min(scroll.x,surfaceWidth-area.width)), sy=Math.max(0,Math.min(scroll.y,surfaceHeight-area.height))
  const x=Math.max(offsetX,sx), y=Math.max(offsetY,sy)
  const width=worldWidth<=area.width ? worldWidth : Math.max(0.001,Math.min(offsetX+worldWidth,sx+area.width)-x)
  const height=worldHeight<=area.height ? worldHeight : Math.max(0.001,Math.min(offsetY+worldHeight,sy+area.height)-y)
  const source={x:crop.x+(x-offsetX)/cssScale,y:crop.y+(y-offsetY)/cssScale,width:width/cssScale,height:height/cssScale}
  const density=Math.min(cssScale*Math.max(1,dpr),Math.sqrt(8_000_000/(source.width*source.height)))
  const desiredScale=Math.max(density,1/Math.min(crop.width,crop.height))
  const backingWidth=Math.max(1,Math.round(source.width*desiredScale))
  const scale=backingWidth/source.width
  return {cssScale,surfaceWidth,surfaceHeight,canvas:{x,y,width,height},source,backingWidth,backingHeight:Math.max(1,Math.ceil(source.height*scale)),scale}
}
export type PreviewView=ReturnType<typeof previewView>

export function pointInView(client:Point, canvasRect:Rect, view:PreviewView, crop:Rect):Point {
  return clientToImage(client,{
    x:canvasRect.x-(view.source.x-crop.x)*view.cssScale,
    y:canvasRect.y-(view.source.y-crop.y)*view.cssScale,
    width:crop.width*view.cssScale,height:crop.height*view.cssScale,
  },crop)
}
