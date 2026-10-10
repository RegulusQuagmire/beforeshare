import { useCallback, useEffect, useRef, useState } from 'react'
import type { LoadedImage, Tool } from './editor/types'
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
  redact:'Протяните прямоугольник над данными. Заливка полностью непрозрачная; цвет можно выбрать выше.',
  arrow:'Протяните стрелку от начала к месту, на которое хотите указать.',
  number:'Нажмите на изображение, чтобы поставить следующий номер. Доступны номера от 1 до 99.',
  crop:'Выделите область и подтвердите обрезку: Enter — применить, Escape — отменить.',
  texture:'Выделите область, проверьте предпросмотр и нажмите «Применить» или «Отмена». Текстура копирует соседний участок; на сложном фоне возможны повторы и швы.',
}

export default function App() {
  const [theme,setTheme]=useState<'dark'|'light'>('dark')
  const [panning,setPanning]=useState(false)
  useEffect(()=>{document.documentElement.dataset.theme=theme},[theme])
  const [image,setImage]=useState<LoadedImage|null>(null)
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[scale,setScale]=useState(100)
  const [zoom,setZoom]=useState<number|null>(null),[color,setColor]=useState('#000000'),[picking,setPicking]=useState(false)
  const [textureLocked,setTextureLocked]=useState(false)
  const [exporting,setExporting]=useState(false),exportInFlight=useRef(false)
  const current=useRef<LoadedImage|null>(null),loading=useRef(false),mounted=useRef(true)
  const editor=useEditor(busy||textureLocked||exporting)
  const texture=useTexture({image,doc:editor.document,history:editor.history,commit:editor.commitDocument,onError:setError,onLock:setTextureLocked})
  const {reset}=editor
  const {reset:resetTexture}=texture
  const locked=busy||textureLocked||exporting||!!editor.cropDraft

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
    if(loading.current||exportInFlight.current||files.length===0||textureLocked) return
    if(files.length!==1){setError('Выберите одно изображение');return}
    if(current.current&&!window.confirm('Открыть другое изображение? Текущие изменения будут потеряны')) return
    loading.current=true;setBusy(true);setError('')
    try {
      const next=await loadImage(files[0])
      if(!mounted.current){next.bitmap.close();return}
      const previous=current.current;current.current=next
      resetTexture();reset(next.width,next.height);setImage(next)
      setPanning(false);setZoom(null);setColor('#000000');setPicking(false)
      previous?.bitmap.close()
    } catch(cause) {
      if(mounted.current) setError(cause instanceof Error?cause.message:'Не удалось открыть изображение.')
    } finally {loading.current=false;if(mounted.current) setBusy(false)}
  },[reset,resetTexture,textureLocked])

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

  return <><AmbientBackdrop theme={theme}/><main>
    <UploadZone busy={busy||textureLocked||exporting} hasImage={!!image} onFiles={openFiles}>
      <header><span className="brand-mark" aria-hidden="true"><i/><i/><i/></span><div className="brand"><span className="brand-name">BeforeShare</span><h1>Перед отправкой</h1></div>{image&&<p className="stage">Редактирование изображения</p>}<button type="button" className="secondary theme-toggle" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?'Светлая тема':'Тёмная тема'}</button></header>
      {!image&&<section className="intro">
        <div className="hero-copy">
          <p className="eyebrow">Только ваш браузер. Только ваша картинка.</p>
          <h2>Скрой личное.<br/><span>Поделись остальным.</span></h2>
          <p className="hero-description">Подготовьте скриншот перед отправкой: закройте личные данные, добавьте пояснения и сохраните готовый PNG.</p>
          <p className="paste-hint">Перетащите изображение сюда или вставьте через <kbd>Ctrl+V</kbd> / <kbd>Cmd+V</kbd>.</p>
          <div className="hero-tags"><span>Без загрузки на сервер</span><span>Без регистрации</span></div>
        </div>
        <div className="hero-preview" aria-hidden="true">
          <div className="preview-caption">Лишние детали — под вашим контролем <span>Пример</span></div>
          <div className="mock-window mock-before"><div className="mock-title"><span>● ● ●</span>До</div><div className="mock-content"><div className="mock-avatar">Д</div><strong>Демо-аккаунт</strong><small>Электронная почта</small><p>demo@example.invalid</p><small>Номер аккаунта</small><p>DEMO-1234-5678</p></div></div>
          <div className="mock-window mock-after"><div className="mock-title"><span>● ● ●</span>Готово к отправке ↗</div><div className="mock-content"><div className="mock-avatar">Д</div><strong>Демо-аккаунт</strong><small>Электронная почта</small><div className="mock-redaction wide"/><small>Номер аккаунта</small><div className="mock-redaction"/><span className="mock-number">1</span></div></div>
          <p className="preview-note">Непрозрачное скрытие · чистый PNG</p>
        </div>
      </section>}
      {image&&<>
        <Toolbar panning={panning} onPan={()=>{setPicking(false);setPanning(value=>!value)}} tool={editor.tool} onToolChange={tool=>{setPanning(false);setPicking(false);editor.setTool(tool)}} disabled={locked} canUndo={editor.canUndo} canRedo={editor.canRedo} onUndo={editor.undo} onRedo={editor.redo}/>
        <div className="view-controls" role="group" aria-label="Масштаб и цвет">
          <label className="zoom-control">Масштаб
            <input type="range" aria-label="Масштаб изображения" min="25" max="400" step="1" value={zoom??Math.max(25,Math.min(400,scale))} disabled={locked} onChange={event=>changeZoom(Number(event.target.value))}/>
          </label>
          <button type="button" className="secondary" disabled={locked} onClick={()=>changeZoom(null)}>Вписать</button>
          <label className="color-control">Цвет заливки <input aria-label="Цвет заливки" type="color" value={color} disabled={locked} onChange={event=>setColor(event.target.value)}/></label>
          <button type="button" className="secondary" disabled={locked} aria-pressed={picking} onClick={()=>{setPanning(false);setPicking(!picking)}}>Пипетка</button>
        </div>
      </>}
      {image&&editor.cropDraft&&<div className="crop-actions" role="group" aria-label="Подтверждение обрезки">
        <button type="button" disabled={busy} onClick={editor.applyCrop}>Применить</button>
        <button type="button" className="secondary" disabled={busy} onClick={editor.cancelCrop}>Отмена</button>
      </div>}
      {image&&(texture.computing||texture.preview)&&<div className="crop-actions" role="group" aria-label="Подтверждение текстуры">
        {texture.preview&&<button type="button" onClick={texture.apply}>Применить</button>}
        <button type="button" className="secondary" onClick={texture.cancel}>Отмена</button>
      </div>}
      {error&&<p className="error" role="alert">{error}</p>}
      {texture.canFill&&<button type="button" className="secondary fallback-fill" disabled={locked} onClick={()=>texture.fill(color)}>Использовать заливку</button>}
      <p className="status" role="status">{exporting?'Создаём PNG…':busy?'Открываем изображение…':texture.computing?'Подбираем соседнюю текстуру…':texture.preview?'Предпросмотр текстуры: примените или отмените.':picking?'Нажмите на изображение, чтобы выбрать цвет. Escape — отмена.':''}</p>
      {image&&editor.document&&<>
        <section className="workspace" aria-label="Предпросмотр изображения" aria-busy={busy||texture.computing||exporting}>
          <EditorCanvas panning={panning} cropDraft={editor.cropDraft} onCropDraft={editor.setCropDraft} onCancelCrop={editor.cancelCrop}
            tool={editor.tool} disabled={locked} onCommit={editor.commitDocument} image={image} doc={editor.document}
            onScaleChange={setScale} onError={setError} zoom={zoom} color={color} picking={picking} onPick={pick}
            assets={texture.assets} textureDraft={texture.preview} onTexture={texture.request}/>
        </section>
        <button type="button" className="export-button" disabled={locked} onClick={savePng}>Скачать PNG</button>
        <p className="dimensions">{editor.document.crop.width} × {editor.document.crop.height} px <span>Масштаб {scale}%</span></p>
      </>}
    </UploadZone>
    <p className="privacy">Изображение обрабатывается в вашем браузере и не отправляется на сервер</p>
    {image&&<>
      <p className="note" id="editor-help">{panning?'Перемещение: двигайте картинку пальцем или перетаскивайте мышью. Для выделения выберите «Скрыть» или другой инструмент.':toolHelp[editor.tool]}</p>
      <p className="shortcuts" id="editor-shortcuts">Отмена: <kbd>Ctrl/Cmd+Z</kbd> · Повтор: <kbd>Ctrl/Cmd+Shift+Z</kbd> или <kbd>Ctrl+Y</kbd> на Windows · <kbd>Escape</kbd> — отмена текущего жеста.</p>
    </>}
  </main></>
}
