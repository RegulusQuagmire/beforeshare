import { useEffect, useRef, useState } from 'react'
import type { Annotation } from './types'

export type TextAnnotation=Extract<Annotation,{kind:'text'}>
export function TextDialog({item,onApply,onCancel}:{item:TextAnnotation;onApply:(item:TextAnnotation)=>void;onCancel:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null)
  const [text,setText]=useState(item.text),[size,setSize]=useState(item.fontSize),[color,setColor]=useState(item.color)
  useEffect(()=>{dialog.current?.showModal()},[])
  return <dialog ref={dialog} className="editor-dialog" aria-label="Текстовая подпись" onCancel={event=>{event.preventDefault();onCancel()}}>
    <form onSubmit={event=>{event.preventDefault();if(text.trim())onApply({...item,text,fontSize:size,color})}}>
      <h2>Текстовая подпись</h2>
      <label>Текст подписи<textarea autoFocus aria-label="Текст подписи" maxLength={2000} rows={4} value={text} onChange={e=>setText(e.target.value)}/></label>
      <label>Размер шрифта<input type="number" aria-label="Размер шрифта" min={8} max={200} value={size} onChange={e=>setSize(Math.max(8,Math.min(200,Number(e.target.value)||8)))}/></label>
      <label>Цвет текста<input type="color" aria-label="Цвет текста" value={color} onChange={e=>setColor(e.target.value)}/></label>
      <div className="dialog-actions"><button type="submit" disabled={!text.trim()}>Применить текст</button><button type="button" className="secondary" onClick={onCancel}>Отмена</button></div>
    </form>
  </dialog>
}
