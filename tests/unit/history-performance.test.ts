import { expect, it } from 'vitest'
import { createHistory, commit } from '../../src/editor/history'
import { appendAnnotation, createDocument } from '../../src/editor/document'
import type { Annotation } from '../../src/editor/types'
it('shares unchanged owned strokes between history snapshots',()=>{
  const stroke:Annotation={id:'s',kind:'pencil',color:'#000000',width:4,points:Array.from({length:10000},(_,i)=>({x:i%1000,y:i%600}))}
  let h=createHistory(appendAnnotation(createDocument(1000,600),stroke))
  const first=h.present.annotations[0],start=performance.now()
  for(let i=0;i<50;i++)h=commit(h,appendAnnotation(h.present,{id:String(i),kind:'number',value:i+1,at:{x:20,y:20}}))
  console.log('HISTORY_BENCH',JSON.stringify({ms:performance.now()-start,uniqueStrokes:new Set([...h.past,h.present].map(d=>d.annotations[0])).size}))
  expect(h.present.annotations[0]).toBe(first)
  stroke.points[0].x=9999
  expect(h.present.annotations[0]).toMatchObject({points:[{x:0,y:0},...stroke.points.slice(1)]})
})
