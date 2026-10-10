import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs/promises'

type Decoded={width:number;height:number;pixels:number[]}
async function open(page:Page,name='privacy-red.png') {
  await page.goto('./')
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures',name))
  await expect(page.locator('canvas')).toBeVisible()
}
async function drag(page:Page,a:[number,number],b:[number,number]) {
  const box=(await page.locator('canvas').boundingBox())!
  await page.mouse.move(box.x+a[0],box.y+a[1]);await page.mouse.down()
  await page.mouse.move(box.x+b[0],box.y+b[1],{steps:4});await page.mouse.up()
}
async function download(page:Page) {
  const event=page.waitForEvent('download')
  await page.getByRole('button',{name:'Скачать PNG',exact:true}).click()
  const file=await event
  expect(file.suggestedFilename()).toMatch(/^beforeshare-\d{8}-\d{6}\.png$/)
  return fs.readFile((await file.path())!)
}
async function decode(page:Page,bytes:Buffer):Promise<Decoded> {
  return page.evaluate(async data=>{
    const blob=new Blob([new Uint8Array(data)],{type:'image/png'})
    const bitmap=await createImageBitmap(blob)
    const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height
    const ctx=canvas.getContext('2d')!;ctx.drawImage(bitmap,0,0);bitmap.close()
    return {width:canvas.width,height:canvas.height,pixels:Array.from(ctx.getImageData(0,0,canvas.width,canvas.height).data)}
  },Array.from(bytes))
}
function at(image:Decoded,x:number,y:number){return image.pixels.slice((y*image.width+x)*4,(y*image.width+x)*4+4)}
function region(image:Decoded,x:number,y:number,w:number,h:number,color:number[]) {
  for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++)expect(at(image,col,row),`pixel ${col},${row}`).toEqual(color)
}

test('download is a flat opaque private PNG; later arrows and numbers cannot expose the red secret',async({page})=>{
  await open(page)
  await drag(page,[20,20],[60,50])
  await page.getByRole('button',{name:'Стрелка',exact:true}).click();await drag(page,[10,30],[90,30])
  await page.getByRole('button',{name:'Номер',exact:true}).click()
  const box=(await page.locator('canvas').boundingBox())!;await page.mouse.click(box.x+40,box.y+35)
  const result=await decode(page,await download(page))
  expect([result.width,result.height]).toEqual([200,140])
  region(result,20,20,40,30,[0,0,0,255])
  expect(at(result,150,100)).toEqual([255,255,255,255])
})

test('cropped transparent source keeps untouched alpha and fully opaque redaction edges',async({page})=>{
  await open(page,'privacy-transparent.png')
  await drag(page,[20,20],[60,50])
  await page.getByRole('button',{name:'Обрезать',exact:true}).click();await drag(page,[10,10],[110,90])
  await expect(page.getByRole('button',{name:'Скачать PNG',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'Применить',exact:true}).click()
  const result=await decode(page,await download(page))
  expect([result.width,result.height]).toEqual([100,80])
  region(result,10,10,40,30,[0,0,0,255]);expect(at(result,90,70)).toEqual([0,0,0,0])
})

test('fractional source selection rounds outwards and leaves adjacent pixels unchanged',async({page})=>{
  await open(page);await page.getByLabel('Масштаб изображения').fill('400')
  await drag(page,[81,81],[163,163])
  const result=await decode(page,await download(page))
  region(result,20,20,21,21,[0,0,0,255])
  expect(at(result,19,30)).toEqual([255,255,255,255])
  expect(at(result,41,30)).toEqual([255,0,0,255])
  expect(at(result,30,19)).toEqual([255,255,255,255])
  expect(at(result,30,41)).toEqual([255,0,0,255])
})

test('PNG Blob, source dimensions and pixels are independent of zoom and DPR',async({browser})=>{
  let reference:Decoded|undefined
  for(const deviceScaleFactor of [1,2]) {
    const context=await browser.newContext({deviceScaleFactor,viewport:{width:1280,height:900}})
    const page=await context.newPage();await open(page);await drag(page,[20,20],[60,50])
    await page.evaluate(()=>{
      const create=URL.createObjectURL.bind(URL)
      URL.createObjectURL=blob=>{Object.assign(window,{exportMime:(blob as Blob).type});return create(blob)}
    })
    for(const zoom of ['25','400']) {
      await page.getByLabel('Масштаб изображения').fill(zoom)
      const result=await decode(page,await download(page))
      expect(await page.evaluate(()=>(window as unknown as {exportMime:string}).exportMime)).toBe('image/png')
      if(reference)expect(result).toEqual(reference);else reference=result
    }
    await context.close()
  }
})

test('source textual metadata and name are omitted; EXIF orientation is flattened correctly',async({page})=>{
  await open(page,'privacy-metadata.png')
  const bytes=await download(page)
  expect(bytes.includes(Buffer.from('SYNTHETIC_PRIVATE_MARKER'))).toBe(false)
  const chunks:string[]=[]
  for(let pos=8;pos<bytes.length;) {chunks.push(bytes.toString('ascii',pos+4,pos+8));pos+=bytes.readUInt32BE(pos)+12}
  expect(chunks.some(type=>['tEXt','iTXt','zTXt','eXIf'].includes(type))).toBe(false)
  await open(page,'orientation-6.jpg')
  const result=await decode(page,await download(page))
  expect([result.width,result.height]).toEqual([180,320])
  const orange=at(result,160,20);expect(orange[0]).toBeGreaterThan(230);expect(orange[1]).toBeGreaterThan(90);expect(orange[2]).toBeLessThan(60)
})

test('encoding blocks edits, replacement and repeated download until completion',async({page})=>{
  await open(page);await drag(page,[20,20],[60,50])
  await page.evaluate(()=>{
    const encode=HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob=function(callback,type,quality){
      Object.assign(window,{finishExport:()=>encode.call(this,callback,type,quality)})
    }
  })
  await page.getByRole('button',{name:'Скачать PNG',exact:true}).click()
  for(const name of ['Скачать PNG','Открыть другое','Скрыть','Отменить','Вписать','Пипетка'])
    await expect(page.getByRole('button',{name,exact:true})).toBeDisabled()
  await expect(page.getByLabel('Файл изображения')).toBeDisabled()
  await expect(page.getByLabel('Цвет заливки')).toBeDisabled()
  await page.keyboard.press('Control+z');await drag(page,[80,80],[100,100])
  const event=page.waitForEvent('download');await page.evaluate(()=>(window as unknown as {finishExport:()=>void}).finishExport());await event
  await expect(page.getByRole('button',{name:'Скачать PNG',exact:true})).toBeEnabled()
  const result=await page.locator('canvas').evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext('2d')!.getImageData(30,30,1,1).data))
  expect(result).toEqual([0,0,0,255])
})

test('null and thrown encoding errors unlock editor, preserve document, and permit retry with URL cleanup',async({page})=>{
  await open(page);await drag(page,[20,20],[60,50])
  await page.evaluate(()=>{
    Object.assign(window,{encode:HTMLCanvasElement.prototype.toBlob})
    HTMLCanvasElement.prototype.toBlob=function(cb){cb(null)}
  })
  await page.getByRole('button',{name:'Скачать PNG',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('PNG')
  await expect(page.getByRole('button',{name:'Скачать PNG',exact:true})).toBeEnabled()
  await page.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=()=>{throw new Error('synthetic encoder failure')}})
  await page.getByRole('button',{name:'Скачать PNG',exact:true}).click()
  await expect(page.getByRole('button',{name:'Скачать PNG',exact:true})).toBeEnabled()
  await page.evaluate(()=>{
    HTMLCanvasElement.prototype.toBlob=(window as unknown as {encode:typeof HTMLCanvasElement.prototype.toBlob}).encode
    const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL)
    const urls:string[]=[];Object.assign(window,{urls})
    URL.createObjectURL=blob=>{const url=create(blob);urls.push(url);return url}
    URL.revokeObjectURL=url=>{urls.splice(urls.indexOf(url),1);revoke(url)}
  })
  const first=await decode(page,await download(page));region(first,20,20,40,30,[0,0,0,255])
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {urls:string[]}).urls.length)).toBe(0)
  await page.getByLabel('Цвет заливки').fill('#336699');await drag(page,[80,80],[100,100])
  const second=await decode(page,await download(page));region(second,80,80,20,20,[51,102,153,255])
  region(second,20,20,40,30,[0,0,0,255])
})

test('export discards an unfinished pointer draft and includes only committed content',async({page})=>{
  await open(page)
  const box=(await page.locator('canvas').boundingBox())!
  await page.mouse.move(box.x+20,box.y+20);await page.mouse.down();await page.mouse.move(box.x+60,box.y+50)
  const event=page.waitForEvent('download')
  await page.getByRole('button',{name:'Скачать PNG',exact:true}).evaluate((button:HTMLButtonElement)=>button.click())
  const file=await event;await page.mouse.up()
  const result=await decode(page,await fs.readFile((await file.path())!))
  region(result,20,20,40,30,[255,0,0,255])
  await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeDisabled()
})

test('production upload/edit/texture/export stays local and texture previews cannot be exported',async({page})=>{
  await page.goto('./');await page.waitForLoadState('networkidle')
  const requests:string[]=[],sockets:string[]=[]
  page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url())})
  page.on('websocket',socket=>sockets.push(socket.url()))
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/privacy-red.png'))
  await expect(page.locator('canvas')).toBeVisible()
  await page.getByRole('button',{name:'Текстура',exact:true}).click();await drag(page,[20,20],[60,50])
  await expect(page.getByRole('button',{name:'Применить',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Скачать PNG',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'Отмена',exact:true}).click()
  region(await decode(page,await download(page)),20,20,40,30,[255,0,0,255])
  await drag(page,[20,20],[60,50]);await page.getByRole('button',{name:'Применить',exact:true}).click()
  region(await decode(page,await download(page)),20,20,40,30,[255,255,255,255])
  await page.getByRole('button',{name:'Отменить',exact:true}).click()
  region(await decode(page,await download(page)),20,20,40,30,[255,0,0,255])
  expect(requests).toEqual([]);expect(sockets).toEqual([])
  expect(await page.evaluate(()=>localStorage.length)).toBe(0)
})
