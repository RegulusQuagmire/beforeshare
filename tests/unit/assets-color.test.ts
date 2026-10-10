import { describe, expect, it, vi } from 'vitest'
import { clearTextures, collectTextures } from '../../src/editor/assets'
import { appendAnnotation, createAnnotation, createDocument, documentsEqual } from '../../src/editor/document'
import { commit, createHistory, undo } from '../../src/editor/history'

describe('colored privacy layers and texture ownership',()=>{
  it('stores validated opaque RGB and compares colors as part of document history',()=>{
    const doc=createDocument(100,100)
    const a=createAnnotation(doc,'redact',{x:1,y:1},{x:20,y:20},'a','#ABCDEF')!
    expect(a).toMatchObject({color:'#abcdef'})
    const next=appendAnnotation(doc,a)
    const changed=structuredClone(next)
    if(changed.annotations[0].kind==='redact') changed.annotations[0].color='#123456'
    expect(documentsEqual(next,changed)).toBe(false)
    expect(createAnnotation(doc,'redact',{x:1,y:1},{x:20,y:20},'a','rgba(0,0,0,0)')).toMatchObject({color:'#000000'})
  })
  it('keeps texture assets through undo/redo and preview, releases abandoned redo',()=>{
    const close=vi.fn(), orphanClose=vi.fn(), previewClose=vi.fn()
    const assets=new Map([['used',{close} as unknown as ImageBitmap],['orphan',{close:orphanClose} as unknown as ImageBitmap],['preview',{close:previewClose} as unknown as ImageBitmap]])
    const initial=createHistory(createDocument(100,100))
    const state=undo(commit(initial,appendAnnotation(initial.present,{id:'t',kind:'texture',assetId:'used',rect:{x:10,y:10,width:20,height:20}})))
    collectTextures(assets,state,'preview')
    expect(close).not.toHaveBeenCalled();expect(previewClose).not.toHaveBeenCalled();expect(orphanClose).toHaveBeenCalledOnce()
    const branch=commit(state,appendAnnotation(state.present,{id:'r',kind:'redact',rect:{x:0,y:0,width:10,height:10}}))
    collectTextures(assets,branch)
    expect(close).toHaveBeenCalledOnce();expect(previewClose).toHaveBeenCalledOnce();expect(assets.size).toBe(0)
  })
  it('clears every texture on image replacement and never stores patch pixels in history',()=>{
    const close=vi.fn(),assets=new Map([['t',{close} as unknown as ImageBitmap]])
    const doc=appendAnnotation(createDocument(100,100),{id:'a',kind:'texture',assetId:'t',rect:{x:0,y:0,width:20,height:20}})
    expect(JSON.stringify(createHistory(doc))).not.toMatch(/bitmap|pixels|buffer/)
    clearTextures(assets);expect(close).toHaveBeenCalledOnce();expect(assets.size).toBe(0)
  })
})
