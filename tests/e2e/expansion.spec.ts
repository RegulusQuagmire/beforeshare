import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
async function open(page:Page) {
  await page.goto('./')
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/ordinary.png'))
  await expect(page.getByText('320 × 180 px')).toBeVisible()
}
async function drag(page:Page,a:[number,number],b:[number,number]) {
  const box=(await page.locator('canvas').boundingBox())!
  await page.mouse.move(box.x+a[0],box.y+a[1]);await page.mouse.down()
  await page.mouse.move(box.x+b[0],box.y+b[1],{steps:5});await page.mouse.up()
}
async function pixel(page:Page,x:number,y:number) {
  return page.locator('canvas').evaluate((c:HTMLCanvasElement,p)=>Array.from(c.getContext('2d')!.getImageData(p.x,p.y,1,1).data),{x,y})
}
test('opaque chosen color, eyedropper and undo/redo',async({page})=>{
  await open(page)
  await page.getByLabel('Цвет заливки').fill('#336699')
  await drag(page,[20,20],[80,70])
  await expect.poll(()=>pixel(page,40,40)).toEqual([51,102,153,255])
  await page.getByRole('button',{name:'Отменить',exact:true}).click()
  await page.getByRole('button',{name:'Повторить',exact:true}).click()
  await expect.poll(()=>pixel(page,40,40)).toEqual([51,102,153,255])
  await page.getByRole('button',{name:'Пипетка',exact:true}).click()
  const box=(await page.locator('canvas').boundingBox())!
  await page.mouse.click(box.x+40,box.y+40)
  await expect(page.getByLabel('Цвет заливки')).toHaveValue('#336699')
  await page.getByRole('button',{name:'Отменить',exact:true}).click()
  await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeDisabled()
})
test('400% zoom and scrolling preserve coordinates without oversized backing canvas',async({page})=>{
  await open(page)
  await page.getByLabel('Масштаб изображения').fill('400')
  await expect(page.getByText('Масштаб 400%',{exact:true})).toBeVisible()
  const scroll=await page.locator('.canvas-viewport').evaluate(el=>{el.scrollLeft=400;el.scrollTop=160;el.dispatchEvent(new Event('scroll'));return {x:el.scrollLeft,y:el.scrollTop}})
  await page.getByLabel('Цвет заливки').fill('#123456')
  await drag(page,[80,40],[160,120])
  await expect.poll(()=>pixel(page,100,60)).toEqual([18,52,86,255])
  await page.getByRole('button',{name:'Вписать',exact:true}).click()
  await expect.poll(()=>pixel(page,Math.floor((scroll.x+100)/4),Math.floor((scroll.y+60)/4))).toEqual([18,52,86,255])
  await page.getByRole('button',{name:'Отменить',exact:true}).click()
  await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeDisabled()
})
test('texture preview cancel/apply/undo and failure fallback leave history correct',async({page})=>{
  await open(page)
  await page.getByRole('button',{name:'Текстура',exact:true}).click()
  await drag(page,[20,20],[60,60])
  await expect(page.getByRole('button',{name:'Применить',exact:true})).toBeVisible()
  await expect.poll(()=>pixel(page,30,30)).toEqual([249,115,22,255])
  await page.getByRole('button',{name:'Отмена',exact:true}).click()
  await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeDisabled()
  await drag(page,[20,20],[60,60])
  await expect(page.getByRole('button',{name:'Применить',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Применить',exact:true}).click()
  await page.getByRole('button',{name:'Отменить',exact:true}).click()
  await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'Повторить',exact:true}).click()
  await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeEnabled()
  await drag(page,[0,0],[320,180])
  await expect(page.getByRole('alert')).toContainText('заливку')
  await expect(page.getByRole('button',{name:'Использовать заливку',exact:true})).toBeVisible()
})
test('5500px source at 400% uses only viewport canvas; operation stays local',async({page})=>{
  await page.goto('./')
  const data=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=5500;c.height=2000
    const ctx=c.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height)
    ctx.fillStyle='red';ctx.fillRect(5490,1990,10,10)
    return c.toDataURL().split(',')[1]
  })
  await page.getByLabel('Файл изображения').setInputFiles({name:'large.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')})
  await expect(page.getByText('5500 × 2000 px')).toBeVisible()
  await page.getByLabel('Масштаб изображения').fill('400')
  await page.locator('.canvas-viewport').evaluate(el=>{el.scrollLeft=el.scrollWidth;el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event('scroll'))})
  const size=await page.locator('canvas').evaluate((c:HTMLCanvasElement)=>({w:c.width,h:c.height}))
  expect(size.w*size.h).toBeLessThan(8_100_000)
  await expect.poll(()=>page.locator('canvas').evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext('2d')!.getImageData(c.width-2,c.height-2,1,1).data))).toEqual([255,0,0,255])
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})


test('arrows, numbers, crop, texture and eyedropper work at 400% at DPR 1 and 2',async({browser})=>{
  for(const deviceScaleFactor of [1,2]) {
    const context=await browser.newContext({deviceScaleFactor,viewport:{width:1280,height:1000}})
    const page=await context.newPage();await open(page)
    await page.getByLabel('Масштаб изображения').fill('400')
    await page.getByRole('button',{name:'Стрелка',exact:true}).click()
    await drag(page,[80,400],[400,400])
    await page.getByRole('button',{name:'Номер',exact:true}).click()
    let box=(await page.locator('canvas').boundingBox())!
    await page.mouse.click(box.x+600,box.y+560)
    await page.getByRole('button',{name:'Текстура',exact:true}).click()
    await drag(page,[80,80],[240,240])
    await expect(page.getByRole('button',{name:'Применить',exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Применить',exact:true}).click()
    await page.getByRole('button',{name:'Пипетка',exact:true}).click()
    box=(await page.locator('canvas').boundingBox())!
    await page.mouse.click(box.x+120,box.y+120)
    await expect(page.getByLabel('Цвет заливки')).toHaveValue('#f97316')
    await page.getByRole('button',{name:'Обрезать',exact:true}).click()
    await drag(page,[80,80],[480,480])
    await page.getByRole('button',{name:'Применить',exact:true}).click()
    await expect(page.getByText('100 × 100 px')).toBeVisible()
    await page.getByRole('button',{name:'Отменить',exact:true}).click()
    await expect(page.getByText('320 × 180 px')).toBeVisible()
    await context.close()
  }
})

test('cancel computation and preview with Escape; no operation HTTP requests or persistent image storage',async({page})=>{
  await open(page)
  const requests:string[]=[]
  page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url())})
  await page.evaluate(()=>{
    const NativeWorker=window.Worker
    window.Worker=new Proxy(NativeWorker,{
      construct(Target,args){
        const worker=new Target(...args as ConstructorParameters<typeof Worker>)
        return new Proxy(worker,{
          set(target,key,value){
            if(key==='onmessage' && typeof value==='function') {
              target.onmessage=(event)=>{setTimeout(()=>value(event),300)}
              return true
            }
            return Reflect.set(target,key,value,target)
          },
          get(target,key){const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value}
        })
      }
    })
  })
  await page.getByRole('button',{name:'Текстура',exact:true}).click()
  await drag(page,[20,20],[60,60])
  await expect(page.getByRole('button',{name:'Отмена',exact:true})).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeDisabled()
  await drag(page,[20,20],[60,60])
  await expect(page.getByRole('button',{name:'Применить',exact:true})).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeDisabled()
  expect(requests).toEqual([])
  expect(await page.evaluate(()=>Object.entries(localStorage))).toEqual([['beforeshare-language','ru']])
})

test('Worker construction failure releases the cloned bitmap and unlocks editor',async({page})=>{
  await open(page)
  await page.evaluate(()=>{
    const records:{closed:boolean}[]=[]
    Object.assign(window,{clones:records})
    const decode=window.createImageBitmap.bind(window)
    window.createImageBitmap=async(...args:unknown[])=>{
      const bitmap:ImageBitmap=await Reflect.apply(decode,window,args)
      const record={closed:false};records.push(record)
      const close=bitmap.close.bind(bitmap);bitmap.close=()=>{record.closed=true;close()}
      return bitmap
    }
    window.Worker=new Proxy(window.Worker,{construct(){throw new Error('Worker unavailable')}})
  })
  await page.getByRole('button',{name:'Текстура',exact:true}).click()
  await drag(page,[20,20],[60,60])
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button',{name:'Скрыть',exact:true})).toBeEnabled()
  expect(await page.evaluate(()=>(window as unknown as {clones:{closed:boolean}[]}).clones.map(x=>x.closed))).toEqual([true])
})

test('real Worker texture result is independent of hidden pixels and replaces every pixel opaquely',async({page})=>{
  const outputs:number[][]=[]
  for(const secret of ['red','blue']) {
    await page.goto('./')
    const data=await page.evaluate(secret=>{
      const c=document.createElement('canvas');c.width=160;c.height=120
      const ctx=c.getContext('2d')!
      for(let y=0;y<120;y+=4)for(let x=0;x<160;x+=4){ctx.fillStyle=((x+y)/4)%2?'#b4b4b4':'#dcdcdc';ctx.fillRect(x,y,4,4)}
      ctx.fillStyle=secret;ctx.fillRect(0,0,20,120);ctx.fillRect(64,48,24,24)
      return c.toDataURL().split(',')[1]
    },secret)
    await page.getByLabel('Файл изображения').setInputFiles({name:'texture.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')})
    await expect(page.getByText('160 × 120 px')).toBeVisible()
    await drag(page,[0,0],[20,120])
    await page.getByRole('button',{name:'Текстура',exact:true}).click()
    await drag(page,[64,48],[88,72])
    await expect(page.getByRole('button',{name:'Применить',exact:true})).toBeVisible()
    const result=await page.locator('canvas').evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext('2d')!.getImageData(64,48,24,24).data))
    expect(result.filter((_,i)=>i%4===3).every(value=>value===255)).toBe(true)
    expect(new Set(result.filter((_,i)=>i%4===0)).size).toBeGreaterThan(1)
    outputs.push(result)
    await page.getByRole('button',{name:'Применить',exact:true}).click()
    await page.screenshot({path:'work/texture-preview-result.png',fullPage:false})
  }
  expect(outputs[0]).toEqual(outputs[1])
})


test('texture ignores old masks entirely outside a later crop',async({page})=>{
  await page.goto('./')
  const data=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=160;c.height=120
    const ctx=c.getContext('2d')!
    for(let y=0;y<120;y+=4)for(let x=0;x<160;x+=4){ctx.fillStyle=((x+y)/4)%2?'#b4b4b4':'#dcdcdc';ctx.fillRect(x,y,4,4)}
    ctx.fillStyle='red';ctx.fillRect(0,0,20,120);ctx.fillRect(64,48,24,24)
    return c.toDataURL().split(',')[1]
  })
  await page.getByLabel('Файл изображения').setInputFiles({name:'crop-texture.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')})
  await expect(page.getByText('160 × 120 px')).toBeVisible()
  await drag(page,[0,0],[20,120])
  await page.getByRole('button',{name:'Обрезать',exact:true}).click()
  await drag(page,[40,0],[160,120])
  await page.getByRole('button',{name:'Применить',exact:true}).click()
  await expect(page.getByText('120 × 120 px')).toBeVisible()
  await page.getByRole('button',{name:'Текстура',exact:true}).click()
  await drag(page,[24,48],[48,72])
  await expect(page.getByRole('button',{name:'Применить',exact:true})).toBeVisible()
  const values=await page.locator('canvas').evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext('2d')!.getImageData(24,48,24,24).data))
  expect(new Set(values.filter((_,i)=>i%4===0))).toEqual(new Set([180,220]))
})
