import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs/promises'

async function sourcePoint(page:Page,x:number,y:number,width=480,height=300) {
  const box=(await page.locator('canvas').boundingBox())!
  return {x:box.x+x/width*box.width,y:box.y+y/height*box.height}
}
async function draw(page:Page,a:[number,number],b:[number,number]) {
  const from=await sourcePoint(page,...a),to=await sourcePoint(page,...b)
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:5});await page.mouse.up()
}

test('main journey: cover synthetic email/token, annotate, crop undo redo and reopen downloaded PNG',async({page,context})=>{
  await page.goto('./')
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/synthetic-account.png'))
  await expect(page.getByText('480 × 300 px')).toBeVisible()
  await draw(page,[24,64],[320,104]);await draw(page,[24,124],[380,164])
  await page.getByRole('button',{name:'Стрелка',exact:true}).click();await draw(page,[400,220],[350,160])
  await page.getByRole('button',{name:'Номер',exact:true}).click()
  for(const [x,y] of [[420,80],[420,140]]) {const point=await sourcePoint(page,x,y);await page.mouse.click(point.x,point.y)}
  await page.getByRole('button',{name:'Обрезать',exact:true}).click();await draw(page,[16,40],[464,260])
  await page.keyboard.press('Enter');await expect(page.getByText('448 × 220 px')).toBeVisible()
  await page.getByRole('button',{name:'Отменить',exact:true}).click();await expect(page.getByText('480 × 300 px')).toBeVisible()
  await page.getByRole('button',{name:'Повторить',exact:true}).click();await expect(page.getByText('448 × 220 px')).toBeVisible()
  const event=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать PNG',exact:true}).click()
  const file=await event,bytes=await fs.readFile((await file.path())!)
  const separate=await context.newPage();await separate.goto('./')
  // Open just the downloaded PNG in a separate browser page, outside the editor.
  await separate.evaluate(async data=>{
    const image=new Image();image.src=URL.createObjectURL(new Blob([new Uint8Array(data)],{type:'image/png'}))
    await image.decode();document.body.replaceChildren(image);URL.revokeObjectURL(image.src)
  },Array.from(bytes))
  const result=await separate.locator('img').evaluate((image:HTMLImageElement)=>{
    const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight
    const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0)
    const secret=(x:number,y:number,w:number,h:number)=>Array.from(ctx.getImageData(x,y,w,h).data).every((v,i)=>v===(i%4===3?255:0))
    return {width:c.width,height:c.height,email:secret(8,24,296,40),token:secret(8,84,356,40),markers:[Array.from(ctx.getImageData(414,48,1,1).data),Array.from(ctx.getImageData(414,108,1,1).data)],arrow:Array.from(ctx.getImageData(359,150,1,1).data)}
  })
  expect(result.width).toBe(448);expect(result.height).toBe(220)
  expect(result.email).toBe(true);expect(result.token).toBe(true)
  expect(result.markers).toEqual([[249,115,22,255],[249,115,22,255]])
  expect(result.arrow).toEqual([249,115,22,255])
  expect(errors).toEqual([])
  await separate.close()
})

test('Tab focus and keyboard tool activation expose correct states, allow undo, and retain visible focus',async({page})=>{
  await page.goto('./')
  await expect(page.getByRole('button',{name:'Светлая тема',exact:true})).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button',{name:'Светлая тема',exact:true})).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button',{name:'Выбрать изображение',exact:true})).toBeFocused()
  expect(await page.locator(':focus').evaluate(el=>{const style=getComputedStyle(el);return style.outlineStyle!=='none' && parseFloat(style.outlineWidth)>=2})).toBe(true)
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/synthetic-account.png'))
  await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'Стрелка',exact:true}).focus();await page.keyboard.press('Enter')
  await expect(page.getByRole('button',{name:'Стрелка',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(page.getByRole('button',{name:'Скрыть',exact:true})).toHaveAttribute('aria-pressed','false')
  await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Номер',exact:true})).toBeFocused()
  await page.keyboard.press('Space')
  const point=await sourcePoint(page,420,80);await page.mouse.click(point.x,point.y)
  await page.getByRole('button',{name:'Отменить',exact:true}).focus();await page.keyboard.press('Enter')
  await expect(page.getByRole('button',{name:'Повторить',exact:true})).toBeEnabled()
})

test('rejected inputs and replacement cancellation preserve edited pixels; accepted replacement resets history',async({page})=>{
  await page.goto('./')
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/synthetic-account.png'))
  await expect(page.getByText('480 × 300 px')).toBeVisible();await draw(page,[24,64],[320,104])
  const sample=()=>page.locator('canvas').evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext('2d')!.getImageData(Math.floor(40*c.width/480),Math.floor(80*c.height/300),1,1).data))
  await expect.poll(sample).toEqual([0,0,0,255])
  const files=await page.evaluateHandle(()=>{const dt=new DataTransfer();dt.items.add(new File(['a'],'one.png'));dt.items.add(new File(['b'],'two.png'));return dt})
  await page.locator('.upload-zone').dispatchEvent('drop',{dataTransfer:files})
  await expect(page.getByRole('alert')).toContainText('одно изображение');await expect.poll(sample).toEqual([0,0,0,255])
  await page.evaluate(()=>{const dt=new DataTransfer();dt.setData('text/plain','synthetic text');window.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt}))})
  await expect.poll(sample).toEqual([0,0,0,255])
  let accept=true,dialogs=0;page.on('dialog',async dialog=>{dialogs++;if(accept)await dialog.accept();else await dialog.dismiss()})
  await page.getByLabel('Файл изображения').setInputFiles({name:'fake.png',mimeType:'image/png',buffer:Buffer.from('not a PNG')})
  await expect(page.getByRole('alert')).toContainText('только PNG, JPEG или WebP')
  await page.getByLabel('Файл изображения').setInputFiles({name:'large.png',mimeType:'image/png',buffer:Buffer.alloc(20*1024*1024+1)})
  await expect(page.getByRole('alert')).toContainText('20 MiB')
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/corrupt.png'))
  await expect(page.getByRole('alert')).toContainText('Повреждённое')
  const jpeg=await fs.readFile(path.resolve('tests/fixtures/ordinary.jpg'))
  const sof=jpeg.findIndex((byte,index)=>byte===0xff && [0xc0,0xc2].includes(jpeg[index+1]))
  const end=sof+2+jpeg.readUInt16BE(sof+2)
  // Valid size header, missing scan data: preflight succeeds and native decode fails.
  await page.getByLabel('Файл изображения').setInputFiles({name:'broken.jpg',mimeType:'image/jpeg',buffer:Buffer.concat([jpeg.subarray(0,end),Buffer.from([0xff,0xd9])])})
  await expect(page.getByRole('alert')).toContainText('Повреждённое')
  await expect.poll(sample).toEqual([0,0,0,255]);await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeEnabled()
  accept=false;await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/ordinary.png'))
  await expect(page.getByText('480 × 300 px')).toBeVisible();await expect.poll(sample).toEqual([0,0,0,255])
  accept=true;await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/ordinary.png'))
  await expect(page.getByText('320 × 180 px')).toBeVisible()
  await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeDisabled();expect(dialogs).toBe(6)
})
