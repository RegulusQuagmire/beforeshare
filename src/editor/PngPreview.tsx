import { useLocale } from '../locale'
import { translate } from '../translations'
import { useEffect, useRef, useState } from 'react'
import { downloadBlob, exportPng, pngFilename } from './export'
import type { EditorDocument, LoadedImage } from './types'

export function PngPreview({image,doc,assets,onClose}:{image:LoadedImage;doc:EditorDocument;assets:ReadonlyMap<string,ImageBitmap>;onClose:()=>void}) {
  const { language } = useLocale()
  const t = (message: string) => translate(message, language)
  const dialog=useRef<HTMLDialogElement>(null)
  const [result,setResult]=useState<{blob:Blob;url:string}|null>(null),[error,setError]=useState('')
  useEffect(()=>{
    dialog.current?.showModal()
    let cancelled=false,url:string|undefined
    void exportPng(image,doc,assets).then(blob=>{
      if(cancelled)return
      url=URL.createObjectURL(blob);setResult({blob,url})
    }).catch(()=>{if(!cancelled)setError('Не удалось создать PNG. Вернитесь к редактированию и попробуйте снова.')})
    return ()=>{cancelled=true;if(url)URL.revokeObjectURL(url)}
  },[image,doc,assets])
  return <dialog ref={dialog} className="editor-dialog png-preview" aria-label={t("Предпросмотр итогового PNG")} onCancel={e=>{e.preventDefault();onClose()}}>
    <h2>{t("Перед отправкой")}</h2>
    <p>{t("Проверьте, что конфиденциальные данные скрыты, особенно после перемещения или удаления заливок.")}</p>
    <p>{doc.crop.width} × {doc.crop.height} px</p>
    {error?<p role="alert">{t(error)}</p>:result?<img src={result.url} alt={t("Итоговый PNG")}/>:<p role="status">{t("Создаём PNG…")}</p>}
    <div className="dialog-actions"><button type="button" disabled={!result} onClick={()=>{if(result)downloadBlob(result.blob,pngFilename())}}>{t("Скачать PNG")}</button><button autoFocus type="button" className="secondary" onClick={onClose}>{t("Вернуться к редактированию")}</button></div>
  </dialog>
}
