import { useLocale } from './locale'
import { translate } from './translations'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Annotation, LoadedImage, Point, Tool } from './editor/types'
import { appendAnnotation } from './editor/document'
import { removeAnnotation, transformAnnotation, updateAnnotation } from './editor/objects'
import { TextDialog, type TextAnnotation } from './editor/TextDialog'
import { PngPreview } from './editor/PngPreview'
import { EditorCanvas } from './editor/EditorCanvas'
import { Toolbar } from './editor/Toolbar'
import { useEditor } from './editor/useEditor'
import { useTexture } from './editor/useTexture'
import { exportPng, downloadBlob, pngFilename } from './editor/export'
import { loadImage } from './upload/loadImage'
import { UploadZone } from './upload/UploadZone'
import { AmbientBackdrop } from './AmbientBackdrop'
import './styles.css'

const toolHelp:Record<Tool,string>={
  select:'Выберите объект. Перетаскивайте его или квадратные маркеры заливки/стрелки. Стрелки клавиатуры — сдвиг, Delete — удалить, Escape — снять выделение. Для перекрытых объектов используйте список.',
  text:'Нажмите на изображение и введите подпись. Для изменения выберите текст и нажмите «Редактировать текст».',
  pencil:'Рисуйте мышью или пальцем. Один штрих — одно действие. Для прокрутки выберите «Перемещение».',
  redact:'Протяните прямоугольник над данными. Заливка полностью непрозрачная; цвет можно выбрать выше.',
  arrow:'Протяните стрелку от начала к месту, на которое хотите указать.',
  number:'Нажмите на изображение, чтобы поставить следующий номер. Доступны номера от 1 до 99.',
  crop:'Выделите область и подтвердите обрезку: Enter — применить, Escape — отменить.',
  texture:'Выделите область, проверьте предпросмотр и нажмите «Применить» или «Отмена». Текстура копирует соседний участок; на сложном фоне возможны повторы и швы.',
}

export default function App() {
  const { language, setLanguage } = useLocale()
  const t = (message: string) => translate(message, language)
  const [theme,setTheme]=useState<'dark'|'light'>('dark')
  const [panning,setPanning]=useState(false)
  const [selectedId,setSelectedId]=useState<string|null>(null),[textDraft,setTextDraft]=useState<TextAnnotation|null>(null)
  const [lineWidth,setLineWidth]=useState(4),[preview,setPreview]=useState(false)
  useEffect(()=>{document.documentElement.dataset.theme=theme},[theme])
  const [image,setImage]=useState<LoadedImage|null>(null)
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[scale,setScale]=useState(100)
  const [zoom,setZoom]=useState<number|null>(null),[color,setColor]=useState('#000000'),[picking,setPicking]=useState(false)
  const [textureLocked,setTextureLocked]=useState(false)
  const [exporting,setExporting]=useState(false),exportInFlight=useRef(false)
  const current=useRef<LoadedImage|null>(null),loading=useRef(false),mounted=useRef(true)
  const editor=useEditor(busy||textureLocked||exporting||!!textDraft||preview)
  const texture=useTexture({image,doc:editor.document,history:editor.history,commit:editor.commitDocument,onError:setError,onLock:setTextureLocked})
  const {reset}=editor
  const {reset:resetTexture}=texture
  const locked=busy||textureLocked||exporting||!!editor.cropDraft||!!textDraft||preview
  const selected=editor.document?.annotations.find(i=>i.id===selectedId)

  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(locked||panning||editor.tool!=='select'||!selected||!editor.document||event.defaultPrevented)return
      if(event.target instanceof HTMLElement&&(event.target.closest('input,textarea,select,button')||event.target.isContentEditable))return
      if(event.key==='Escape'){setSelectedId(null);event.preventDefault();return}
      if(event.key==='Delete'||event.key==='Backspace'){editor.commitDocument(removeAnnotation(editor.document,selected.id));setSelectedId(null);event.preventDefault();return}
      const moves:Record<string,Point>={ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1}}
      const delta=moves[event.key]
      if(delta){event.preventDefault();const n=event.shiftKey?10:1;editor.commitDocument(updateAnnotation(editor.document,transformAnnotation(selected,'move',{x:0,y:0},{x:delta.x*n,y:delta.y*n},editor.document.crop)))}
    }
    window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key)
  },[locked,panning,selected,editor])

  useEffect(()=>{
    mounted.current=true
    return ()=>{mounted.current=false;current.current?.bitmap.close();current.current=null}
  },[])
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape' && picking){setPicking(false);event.preventDefault()}}
    window.addEventListener('keydown',key)
    return ()=>window.removeEventListener('keydown',key)
  },[picking])

  const openFiles=useCallback(async(files:File[])=>{
    if(loading.current||exportInFlight.current||files.length===0||textureLocked||textDraft||preview) return
    if(files.length!==1){setError('Выберите одно изображение');return}
    if(current.current&&!window.confirm(translate('Открыть другое изображение? Текущие изменения будут потеряны', language))) return
    loading.current=true;setBusy(true);setError('')
    try {
      const next=await loadImage(files[0])
      if(!mounted.current){next.bitmap.close();return}
      const previous=current.current;current.current=next
      resetTexture();reset(next.width,next.height);setImage(next)
      setPanning(false);setZoom(null);setColor('#000000');setPicking(false)
      setSelectedId(null)
      previous?.bitmap.close()
    } catch(cause) {
      if(mounted.current) setError(cause instanceof Error?cause.message:'Не удалось открыть изображение.')
    } finally {loading.current=false;if(mounted.current) setBusy(false)}
  },[reset,resetTexture,textureLocked,textDraft,preview,language])

  async function savePng() {
    if(!image || !editor.document || loading.current || locked || exportInFlight.current) return
    exportInFlight.current=true;setExporting(true);setError('');setPicking(false)
    try {
      const blob=await exportPng(image,editor.document,texture.assets)
      if(mounted.current) downloadBlob(blob,pngFilename())
    } catch {
      if(mounted.current) setError('Не удалось сохранить PNG. Попробуйте ещё раз.')
    } finally {
      exportInFlight.current=false
      if(mounted.current) setExporting(false)
    }
  }

  function changeZoom(value:number|null) {editor.cancelCrop();setPicking(false);setZoom(value)}
  function pick(value:string){setPanning(false);setColor(value);setPicking(false);editor.setTool('redact')}
  function startText(at:Point) {
    if(!editor.document)return
    setTextDraft({id:crypto.randomUUID(),kind:'text',at,text:'',fontSize:24,color})
  }
  function applyText(item:TextAnnotation) {
    if(!editor.document)return
    editor.commitDocument(editor.document.annotations.some(i=>i.id===item.id)?updateAnnotation(editor.document,item):appendAnnotation(editor.document,item))
    setTextDraft(null);setSelectedId(item.id);editor.setTool('select')
  }
  function objectColor(value:string) {
    if(selected&&editor.document&&selected.kind!=='texture')editor.commitDocument(updateAnnotation(editor.document,{...selected,color:value} as Annotation))
  }

  return <><AmbientBackdrop theme={theme}/><main>
    <UploadZone busy={busy||textureLocked||exporting||!!textDraft||preview} hasImage={!!image} onFiles={openFiles}>
      <header><span className="brand-mark" aria-hidden="true"><i/><i/><i/></span><div className="brand"><span className="brand-name">BeforeShare</span><h1>{t("Перед отправкой")}</h1></div><button type="button" className="secondary language-toggle" lang={language==='ru'?'en':'ru'} onClick={()=>setLanguage(language==='ru'?'en':'ru')}>{language==='ru'?'English':'Русский'}</button>{image&&<p className="stage">{t("Редактирование изображения")}</p>}<button type="button" className="secondary theme-toggle" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?t("Светлая тема"):t("Тёмная тема")}</button></header>
      {!image&&<section className="intro">
        <div className="hero-copy">
          <p className="eyebrow">{t("Только ваш браузер. Только ваша картинка.")}</p>
          <h2>{t("Скрой личное.")}<br/><span>{t("Поделись остальным.")}</span></h2>
          <p className="hero-description">{t("Подготовьте скриншот перед отправкой: закройте личные данные, добавьте пояснения и сохраните готовый PNG.")}</p>
          <p className="paste-hint">{t("Перетащите изображение сюда или вставьте через")} <kbd>Ctrl+V</kbd> / <kbd>Cmd+V</kbd>.</p>
          <div className="hero-tags"><span>{t("Без загрузки на сервер")}</span><span>{t("Без регистрации")}</span></div>
        </div>
        <div className="hero-preview" aria-hidden="true">
          <div className="preview-caption">{t("Лишние детали — под вашим контролем")}<span>{t("Пример")}</span></div>
          <div className="mock-window mock-before"><div className="mock-title"><span>● ● ●</span>{t("До")}</div><div className="mock-content"><div className="mock-avatar">{t("Д")}</div><strong>{t("Демо-аккаунт")}</strong><small>{t("Электронная почта")}</small><p>demo@example.invalid</p><small>{t("Номер аккаунта")}</small><p>DEMO-1234-5678</p></div></div>
          <div className="mock-window mock-after"><div className="mock-title"><span>● ● ●</span>{t("Готово к отправке ↗")}</div><div className="mock-content"><div className="mock-avatar">{t("Д")}</div><strong>{t("Демо-аккаунт")}</strong><small>{t("Электронная почта")}</small><div className="mock-redaction wide"/><small>{t("Номер аккаунта")}</small><div className="mock-redaction"/><span className="mock-number">1</span></div></div>
          <p className="preview-note">{t("Непрозрачное скрытие · чистый PNG")}</p>
        </div>
      </section>}
      {image&&<>
        <Toolbar panning={panning} onPan={()=>{setPicking(false);setPanning(value=>!value)}} tool={editor.tool} onToolChange={tool=>{setSelectedId(null);setPanning(false);setPicking(false);editor.setTool(tool)}} disabled={locked} canUndo={editor.canUndo} canRedo={editor.canRedo} onUndo={editor.undo} onRedo={editor.redo}/>
        <div className="view-controls" role="group" aria-label={t("Масштаб и цвет")}>
          <label className="zoom-control">{t("Масштаб")}<input type="range" aria-label={t("Масштаб изображения")} min="25" max="400" step="1" value={zoom??Math.max(25,Math.min(400,scale))} disabled={locked} onChange={event=>changeZoom(Number(event.target.value))}/>
          </label>
          <button type="button" className="secondary" disabled={locked} onClick={()=>changeZoom(null)}>{t("Вписать")}</button>
          <label className="color-control">{t("Цвет заливки")}<input aria-label={t("Цвет заливки")} type="color" value={color} disabled={locked} onChange={event=>setColor(event.target.value)}/></label>
          <button type="button" className="secondary" disabled={locked} aria-pressed={picking} onClick={()=>{setPanning(false);setPicking(!picking)}}>{t("Пипетка")}</button>
          {editor.tool==='pencil'&&<label>{t("Толщина линии")}<input aria-label={t("Толщина линии")} type="number" min={1} max={80} value={lineWidth} disabled={locked} onChange={e=>setLineWidth(Math.max(1,Math.min(80,Number(e.target.value)||1)))}/></label>}
        </div>
        {editor.tool==='select'&&!panning&&<div className="view-controls" role="group" aria-label={t("Выбранный объект")}>
          <label>{t("Объект")}<select aria-label={t("Объект")} value={selected?.id??''} disabled={locked} onChange={e=>setSelectedId(e.target.value||null)}>
            <option value="">{t("Нет выделения")}</option>
            {editor.document?.annotations.map((item,i)=><option key={item.id} value={item.id}>{i+1}. {item.kind==='text'?item.text.slice(0,25):item.kind==='texture'?t("Текстура"):t(toolHelp[item.kind]).split('.')[0]}</option>)}
          </select></label>
          <label>{t("Цвет объекта")}<input type="color" aria-label={t("Цвет объекта")} value={selected&&selected.kind!=='texture'?(selected.color??(selected.kind==='redact'?'#000000':'#f97316')):'#000000'} disabled={locked||!selected||selected.kind==='texture'} onChange={e=>objectColor(e.target.value)}/></label>
          <button type="button" className="secondary" disabled={locked||selected?.kind!=='text'} onClick={()=>{if(selected?.kind==='text')setTextDraft(selected)}}>{t("Редактировать текст")}</button>
          <button type="button" className="secondary" disabled={locked||!selected} onClick={()=>{if(selected&&editor.document)editor.commitDocument(removeAnnotation(editor.document,selected.id));setSelectedId(null)}}>{t("Удалить объект")}</button>
          <button type="button" className="secondary" disabled={locked||!selected} onClick={()=>setSelectedId(null)}>{t("Снять выделение")}</button>
          <small>{t("После изменения заливки проверьте, не открылись ли личные данные.")}</small>
        </div>}
      </>}
      {image&&editor.cropDraft&&<div className="crop-actions" role="group" aria-label={t("Подтверждение обрезки")}>
        <button type="button" disabled={busy} onClick={editor.applyCrop}>{t("Применить")}</button>
        <button type="button" className="secondary" disabled={busy} onClick={editor.cancelCrop}>{t("Отмена")}</button>
      </div>}
      {image&&(texture.computing||texture.preview)&&<div className="crop-actions" role="group" aria-label={t("Подтверждение текстуры")}>
        {texture.preview&&<button type="button" onClick={texture.apply}>{t("Применить")}</button>}
        <button type="button" className="secondary" onClick={texture.cancel}>{t("Отмена")}</button>
      </div>}
      {error&&<p className="error" role="alert">{t(error)}</p>}
      {texture.canFill&&<button type="button" className="secondary fallback-fill" disabled={locked} onClick={()=>texture.fill(color)}>{t("Использовать заливку")}</button>}
      <p className="status" role="status">{exporting?t("Создаём PNG…"):busy?t("Открываем изображение…"):texture.computing?t("Подбираем соседнюю текстуру…"):texture.preview?t("Предпросмотр текстуры: примените или отмените."):picking?t("Нажмите на изображение, чтобы выбрать цвет. Escape — отмена."):''}</p>
      {image&&editor.document&&<>
        <section className="workspace" aria-label={t("Предпросмотр изображения")} aria-busy={busy||texture.computing||exporting}>
          <EditorCanvas selectedId={selectedId} onSelect={setSelectedId} onText={startText} lineWidth={lineWidth} panning={panning} cropDraft={editor.cropDraft} onCropDraft={editor.setCropDraft} onCancelCrop={editor.cancelCrop}
            tool={editor.tool} disabled={locked} onCommit={editor.commitDocument} image={image} doc={editor.document}
            onScaleChange={setScale} onError={setError} zoom={zoom} color={color} picking={picking} onPick={pick}
            assets={texture.assets} textureDraft={texture.preview} onTexture={texture.request}/>
        </section>
        <button type="button" className="export-button" disabled={locked} onClick={savePng}>{t("Скачать PNG")}</button>
        <button type="button" className="secondary" disabled={locked} onClick={()=>{setPicking(false);setPreview(true)}}>{t("Предпросмотр PNG")}</button>
        <p className="dimensions">{editor.document.crop.width} × {editor.document.crop.height} px <span>{t("Масштаб")} {scale}%</span></p>
      </>}
    </UploadZone>
    {textDraft&&<TextDialog key={textDraft.id} item={textDraft} onApply={applyText} onCancel={()=>setTextDraft(null)}/>}
    {preview&&image&&editor.document&&<PngPreview image={image} doc={editor.document} assets={texture.assets} onClose={()=>setPreview(false)}/>}
    <p className="privacy">{t("Изображение обрабатывается в вашем браузере и не отправляется на сервер")}</p>
    {image&&<>
      <p className="note" id="editor-help">{panning?t("Перемещение: двигайте картинку пальцем или перетаскивайте мышью. Для выделения выберите «Скрыть» или другой инструмент."):t(toolHelp[editor.tool])}</p>
      <p className="shortcuts" id="editor-shortcuts">{t("Отмена:")}<kbd>Ctrl/Cmd+Z</kbd>{t("· Повтор:")}<kbd>Ctrl/Cmd+Shift+Z</kbd>{t("или")}<kbd>Ctrl+Y</kbd>{t("на Windows ·")}<kbd>Escape</kbd>{t("— отмена текущего жеста.")}</p>
    </>}
  </main></>
}
