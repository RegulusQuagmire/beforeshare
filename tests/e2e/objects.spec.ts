import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs/promises'
async function open(page:Page) {
  await page.goto('./')
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/ordinary.png'))
  await expect(page.getByText('320 × 180 px')).toBeVisible()
}
async function drag(page:Page,a:[number,number],b:[number,number]) {
  await page.locator('canvas').scrollIntoViewIfNeeded()
  const r=(await page.locator('canvas').boundingBox())!
  await page.mouse.move(r.x+a[0],r.y+a[1]);await page.mouse.down()
  await page.mouse.move(r.x+b[0],r.y+b[1],{steps:15});await page.mouse.up()
}
test('select, move, resize, delete and one gesture undo',async({page})=>{
  await open(page);await drag(page,[20,20],[70,60])
  await page.getByRole('button',{name:'Выбрать',exact:true}).click()
  await drag(page,[40,40],[100,90])
  await expect(page.getByRole('button',{name:'Удалить объект',exact:true})).toBeEnabled()
  await drag(page,[130,110],[150,130])
  await page.getByRole('button',{name:'Удалить объект',exact:true}).click()
  for(let i=0;i<4;i++)await page.getByRole('button',{name:'Отменить',exact:true}).click()
  await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeDisabled()
  for(let i=0;i<4;i++)await page.getByRole('button',{name:'Повторить',exact:true}).click()
})
test('multiline text editing and pencil survive exact PNG preview',async({page})=>{
  await open(page)
  await page.getByRole('button',{name:'Текст',exact:true}).click();await drag(page,[20,20],[20,20])
  await page.getByLabel('Текст подписи').fill('Привет\nHello')
  await page.getByRole('button',{name:'Применить текст',exact:true}).click()
  await page.getByRole('button',{name:'Редактировать текст',exact:true}).click()
  await page.getByLabel('Текст подписи').fill('Проверено\nVerified')
  await page.getByRole('button',{name:'Применить текст',exact:true}).click()
  await page.getByRole('button',{name:'Карандаш',exact:true}).click();await drag(page,[20,130],[190,140])
  await page.getByRole('button',{name:'Предпросмотр PNG',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await expect(dialog.getByRole('img',{name:'Итоговый PNG'})).toBeVisible()
  await expect(dialog).toContainText('320 × 180')
  const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'Скачать PNG',exact:true}).click()
  expect((await download).suggestedFilename()).toMatch(/\.png$/)
  await dialog.getByRole('button',{name:'Вернуться к редактированию'}).click()
  await expect(dialog).not.toBeVisible()
})

test('arrow endpoints, color and overlap selection list',async({page})=>{
  await open(page);await page.getByRole('button',{name:'Стрелка',exact:true}).click();await drag(page,[40,70],[200,70])
  await page.getByRole('button',{name:'Выбрать',exact:true}).click();await drag(page,[120,70],[120,70])
  await drag(page,[200,70],[200,110]);await drag(page,[40,70],[60,50])
  await page.getByLabel('Цвет объекта').fill('#00ff00')
  const options=page.getByLabel('Объект',{exact:true}).locator('option');expect(await options.count()).toBe(2)
  await page.getByRole('button',{name:'Скрыть',exact:true}).click();await drag(page,[20,20],[230,120])
  await page.getByRole('button',{name:'Выбрать',exact:true}).click();await drag(page,[100,70],[100,70])
  await expect(page.getByLabel('Цвет объекта')).toHaveValue('#000000')
  await page.getByLabel('Объект',{exact:true}).selectOption({index:1})
  await expect(page.getByLabel('Цвет объекта')).toHaveValue('#00ff00')
  const event=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать PNG',exact:true}).click()
  const bytes=await fs.readFile((await (await event).path())!)
  const px=await page.evaluate(async data=>{
    const b=await createImageBitmap(new Blob([new Uint8Array(data)])),c=document.createElement('canvas');c.width=b.width;c.height=b.height
    const ctx=c.getContext('2d')!;ctx.drawImage(b,0,0);b.close();return Array.from(ctx.getImageData(120,70,1,1).data)
  },Array.from(bytes))
  expect(px).toEqual([0,0,0,255])
})

test('pencil cancellation and text input shortcuts leave document history alone',async({page})=>{
  await open(page);await page.getByRole('button',{name:'Карандаш',exact:true}).click()
  await page.locator('canvas').scrollIntoViewIfNeeded();const r=(await page.locator('canvas').boundingBox())!
  await page.locator('canvas').evaluate(c=>c.addEventListener('pointerdown',e=>c.setAttribute('data-test-pointer',String((e as PointerEvent).pointerId))))
  for(const cancel of ['Escape','pointercancel','lostpointercapture']) {
    await page.mouse.move(r.x+20,r.y+30);await page.mouse.down();await page.mouse.move(r.x+120,r.y+50)
    if(cancel==='Escape')await page.keyboard.press('Escape');else await page.locator('canvas').dispatchEvent(cancel,{pointerId:Number(await page.locator('canvas').getAttribute('data-test-pointer'))})
    await page.mouse.up();await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeDisabled()
  }
  await page.getByRole('button',{name:'Текст',exact:true}).click();await drag(page,[30,30],[30,30])
  await page.getByLabel('Текст подписи').fill('Локальный текст');await page.getByLabel('Текст подписи').press('Control+z')
  await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'Отмена',exact:true}).click()
  await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeDisabled()
})
test('pointer selection transfers keyboard focus for nudge, Escape and Delete',async({page})=>{
  await open(page);await drag(page,[20,20],[70,60])
  await page.getByRole('button',{name:'Выбрать',exact:true}).click();await drag(page,[40,40],[40,40])
  await expect(page.locator('canvas')).toBeFocused()
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape')
  await expect(page.getByRole('button',{name:'Удалить объект',exact:true})).toBeDisabled()
  await drag(page,[40,40],[40,40]);await page.keyboard.press('Delete')
  await expect(page.getByLabel('Объект',{exact:true}).locator('option')).toHaveCount(1)
})

test('WebP bytes decode in the browser; malformed replacement preserves edits',async({page})=>{
  await page.goto('./')
  const bytes=await fs.readFile(path.resolve('tests/fixtures/ordinary.webp'))
  expect(bytes.toString('ascii',0,4)).toBe('RIFF');expect(bytes.toString('ascii',8,12)).toBe('WEBP')
  await page.getByLabel('Файл изображения').setInputFiles({name:'wrong.txt',mimeType:'text/plain',buffer:bytes})
  await expect(page.getByText('80 × 60 px')).toBeVisible();await drag(page,[10,10],[30,30])
  page.on('dialog',d=>d.accept())
  await page.getByLabel('Файл изображения').setInputFiles({name:'bad.webp',mimeType:'image/webp',buffer:bytes.subarray(0,30)})
  await expect(page.getByRole('alert')).toContainText('Повреждённое')
  await expect(page.getByText('80 × 60 px')).toBeVisible();await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeEnabled()
})

for(const theme of ['dark','light'])test(`touch pencil, select, text, 400% and reduced motion in ${theme}`,async({browser,browserName})=>{
  test.skip(browserName==='firefox','Firefox Playwright does not emulate isMobile; desktop covered separately')
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'})
  const page=await context.newPage();await open(page)
  if(theme==='light')await page.getByRole('button',{name:'Светлая тема',exact:true}).click()
  await page.getByLabel('Масштаб изображения').fill('400')
  await page.getByRole('button',{name:'Карандаш',exact:true}).click()
  await page.locator('canvas').scrollIntoViewIfNeeded()
  await page.locator('canvas').evaluate(c=>{
    const r=c.getBoundingClientRect();c.setPointerCapture=()=>{}
    for(const [type,x] of [['pointerdown',40],['pointermove',80],['pointerup',120]] as const)c.dispatchEvent(new PointerEvent(type,{pointerId:21,pointerType:'touch',isPrimary:true,button:0,bubbles:true,clientX:r.x+x,clientY:r.y+60}))
  })
  await page.getByRole('button',{name:'Выбрать',exact:true}).click();await page.getByLabel('Объект',{exact:true}).selectOption({index:1})
  await page.getByLabel('Цвет объекта').fill('#ff0000')
  await page.getByRole('button',{name:'Текст',exact:true}).click();await drag(page,[40,100],[40,100])
  await page.getByLabel('Текст подписи').fill('Мобильный\nMobile');await page.getByRole('button',{name:'Применить текст',exact:true}).click()
  await page.getByRole('button',{name:'Предпросмотр PNG',exact:true}).click()
  await expect(page.getByRole('img',{name:'Итоговый PNG'})).toBeVisible()
  expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:`work/objects-mobile-${theme}.png`})
  await page.getByRole('button',{name:'Вернуться к редактированию'}).click();await context.close()
})

test('preview download uses exact displayed bytes, masks cover text and pencil, no operation network',async({page})=>{
  await open(page)
  const requests:string[]=[];page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())})
  await drag(page,[20,20],[120,100])
  await page.getByRole('button',{name:'Текст',exact:true}).click();await drag(page,[30,30],[30,30])
  await page.getByLabel('Текст подписи').fill('SECRET');await page.getByRole('button',{name:'Применить текст'}).click()
  await page.getByRole('button',{name:'Карандаш',exact:true}).click();await drag(page,[20,50],[120,50])
  await page.getByRole('button',{name:'Предпросмотр PNG',exact:true}).click()
  const img=page.getByRole('img',{name:'Итоговый PNG'});await expect(img).toBeVisible()
  const expected=await img.evaluate(async(el:HTMLImageElement)=>Array.from(new Uint8Array(await (await fetch(el.src)).arrayBuffer())))
  const event=page.waitForEvent('download');await page.getByRole('dialog').getByRole('button',{name:'Скачать PNG',exact:true}).click()
  const bytes=await fs.readFile((await (await event).path())!);expect(Array.from(bytes)).toEqual(expected)
  const pixel=await img.evaluate((el:HTMLImageElement)=>{const c=document.createElement('canvas');c.width=el.naturalWidth;c.height=el.naturalHeight;const ctx=c.getContext('2d')!;ctx.drawImage(el,0,0);return Array.from(ctx.getImageData(40,50,1,1).data)})
  expect(pixel).toEqual([0,0,0,255]);expect(requests).toEqual([])
})
test('mixed text pencil object move crop and texture restore through history',async({page})=>{
  await open(page)
  await page.getByRole('button',{name:'Текст',exact:true}).click();await drag(page,[20,20],[20,20])
  await page.getByLabel('Текст подписи').fill('Undo');await page.getByRole('button',{name:'Применить текст'}).click()
  await drag(page,[35,30],[50,45])
  await page.getByRole('button',{name:'Карандаш',exact:true}).click();await drag(page,[30,140],[90,140])
  await page.getByRole('button',{name:'Обрезать',exact:true}).click();await drag(page,[10,10],[310,170])
  await page.getByRole('button',{name:'Применить',exact:true}).click()
  await page.getByRole('button',{name:'Текстура',exact:true}).click();await drag(page,[200,20],[230,50])
  await page.getByRole('button',{name:'Применить',exact:true}).click()
  await expect(page.getByText('300 × 160 px')).toBeVisible()
  for(let i=0;i<5;i++)await page.getByRole('button',{name:'Отменить',exact:true}).click()
  await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeDisabled()
  await expect(page.getByText('320 × 180 px')).toBeVisible()
  for(let i=0;i<5;i++)await page.getByRole('button',{name:'Повторить',exact:true}).click()
  await expect(page.getByText('300 × 160 px')).toBeVisible()
  await page.getByRole('button',{name:'Предпросмотр PNG',exact:true}).click()
  await expect(page.getByRole('img',{name:'Итоговый PNG'})).toBeVisible()
})
test('closing pending PNG preview ignores old encoding and releases preview URLs',async({page})=>{
  await open(page)
  await page.evaluate(()=>{
    const original=HTMLCanvasElement.prototype.toBlob
    Object.assign(window,{previewState:{pending:null as (()=>void)|null,created:0,revoked:0}})
    const state=(window as unknown as {previewState:{pending:(()=>void)|null;created:number;revoked:number}}).previewState
    HTMLCanvasElement.prototype.toBlob=function(...args:Parameters<typeof original>){state.pending=()=>original.apply(this,args)}
    const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL)
    URL.createObjectURL=blob=>{state.created++;return create(blob)}
    URL.revokeObjectURL=url=>{state.revoked++;revoke(url)}
  })
  await page.getByRole('button',{name:'Предпросмотр PNG',exact:true}).click()
  await expect(page.getByRole('button',{name:'Скрыть',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'Вернуться к редактированию'}).click()
  await page.evaluate(()=>(window as unknown as {previewState:{pending:()=>void}}).previewState.pending())
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByRole('button',{name:'Предпросмотр PNG',exact:true}).click()
  await page.evaluate(()=>(window as unknown as {previewState:{pending:()=>void}}).previewState.pending())
  await expect(page.getByRole('img',{name:'Итоговый PNG'})).toBeVisible()
  await page.getByRole('button',{name:'Вернуться к редактированию'}).click()
  await expect.poll(()=>page.evaluate(()=>{const s=(window as unknown as {previewState:{created:number;revoked:number}}).previewState;return [s.created,s.revoked]})).toEqual([1,1])
})
