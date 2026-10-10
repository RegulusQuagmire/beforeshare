import { expect, it } from 'vitest'
import { appendAnnotation, createDocument } from '../../src/editor/document'
import { hitTest, transformAnnotation, updateAnnotation, removeAnnotation, strokePoints } from '../../src/editor/objects'
import { commit, createHistory, redo, undo } from '../../src/editor/history'
import type { Annotation } from '../../src/editor/types'

const mask: Annotation = { id:'mask', kind:'redact', rect:{x:20,y:20,width:40,height:30},color:'#000000' }
it('selects visible masks above overlapping annotations, newest first within each layer',()=>{
  const doc = appendAnnotation(appendAnnotation(createDocument(200,200),mask),{id:'n',kind:'number',at:{x:30,y:30},value:1})
  expect(hitTest(doc,{x:30,y:30},4)?.id).toBe('mask')
  expect(hitTest(doc,{x:180,y:180},4)).toBeNull()
})
it('moves and resizes without mutating history and clamps to the crop',()=>{
  const original = structuredClone(mask)
  expect(transformAnnotation(mask,'move',{x:25,y:25},{x:35,y:45},{x:0,y:0,width:200,height:200})).toMatchObject({rect:{x:30,y:40,width:40,height:30}})
  expect(transformAnnotation(mask,'end',{x:60,y:50},{x:250,y:250},{x:0,y:0,width:200,height:200})).toMatchObject({rect:{x:20,y:20,width:180,height:180}})
  expect(mask).toEqual(original)
})
it('moves one arrow endpoint independently',()=>{
  const item: Annotation={id:'a',kind:'arrow',from:{x:10,y:10},to:{x:80,y:80}}
  expect(transformAnnotation(item,'start',{x:10,y:10},{x:20,y:30},{x:0,y:0,width:200,height:200})).toMatchObject({from:{x:20,y:30},to:{x:80,y:80}})
})
it('records text, pencil, object edits and deletion in undo/redo',()=>{
  let doc=appendAnnotation(createDocument(200,200),{id:'t',kind:'text',at:{x:10,y:20},text:'Привет\nHello',fontSize:20,color:'#123456'})
  doc=appendAnnotation(doc,{id:'p',kind:'pencil',points:[{x:1,y:1},{x:20,y:20}],width:3,color:'#abcdef'})
  let h=createHistory(doc)
  h=commit(h,updateAnnotation(h.present,{...doc.annotations[0],color:'#ffffff'} as Annotation))
  h=commit(h,removeAnnotation(h.present,'p'))
  expect(h.present.annotations).toHaveLength(1)
  expect(undo(h).present.annotations).toHaveLength(2)
  expect(undo(undo(h)).present).toEqual(doc)
  expect(redo(undo(h)).present).toEqual(h.present)
})
it('samples nearby stroke points but retains the final endpoint',()=>{
  expect(strokePoints([{x:0,y:0},{x:0.1,y:0.1},{x:5,y:0},{x:5.1,y:0}],1)).toEqual([{x:0,y:0},{x:5,y:0},{x:5.1,y:0}])
})
it('selecting a clipped annotation does not move it or add history',()=>{
  const cropped={...createDocument(200,200),crop:{x:100,y:0,width:100,height:200}}
  const clipped:Annotation={id:'c',kind:'redact',rect:{x:20,y:20,width:120,height:30}}
  const next=transformAnnotation(clipped,'move',{x:120,y:30},{x:120,y:30},cropped.crop)
  expect(next).toEqual(clipped)
  const h=createHistory(appendAnnotation(cropped,clipped))
  expect(commit(h,updateAnnotation(h.present,next))).toBe(h)
})
