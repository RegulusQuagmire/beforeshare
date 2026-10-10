import { chromium, expect, test } from '@playwright/test'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

// This isolated test-only extension changes actual tab zoom, not CSS or pinch zoom.
// It is never loaded into the user's browser or shipped in the application.
test('native tab zoom 125% and 200% preserves layout, coordinates and PNG at 1024/1440 widths',async({baseURL})=>{
  test.setTimeout(90_000)
  const scratch=await mkdtemp(path.join(os.tmpdir(),'beforeshare-zoom-'))
  try {
    const extension=path.join(scratch,'extension');await mkdir(extension)
    await writeFile(path.join(extension,'manifest.json'),JSON.stringify({manifest_version:3,name:'BeforeShare zoom QA',version:'1.0',permissions:['tabs'],background:{service_worker:'background.js'}}))
    await writeFile(path.join(extension,'background.js'),'globalThis.ready = true;')
    for(const width of [1024,1440]) {
      const context=await chromium.launchPersistentContext(path.join(scratch,'profile-'+width),{
        channel:'chromium',executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,headless:true,viewport:null,deviceScaleFactor:undefined,
        args:[`--window-size=${width},1000`,`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],
      })
      try {
        const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker')
        const page=await context.newPage();await page.goto(baseURL!);await page.bringToFront()
        const base=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio}))
        for(const factor of [1,1.25,2]) {
          const actual=await worker.evaluate(async factor=>{
            const api=(globalThis as unknown as {chrome:{tabs:{query:(query:object)=>Promise<{id:number;url:string}[]>;setZoom:(id:number,factor:number)=>Promise<void>;getZoom:(id:number)=>Promise<number>}}}).chrome
            const tab=(await api.tabs.query({url:'http://127.0.0.1:4183/*'}))[0]
            await api.tabs.setZoom(tab.id,factor);return api.tabs.getZoom(tab.id)
          },factor)
          expect(actual).toBe(factor)
          await expect.poll(()=>page.evaluate(()=>devicePixelRatio)).toBe(base.dpr*factor)
          expect(Math.abs((await page.evaluate(()=>innerWidth))*factor-base.width)).toBeLessThanOrEqual(2)
          expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
          await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/ordinary.png'))
          await expect(page.getByText('320 × 180 px')).toBeVisible()
          await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
          await page.locator('canvas').scrollIntoViewIfNeeded()
          const box=(await page.locator('canvas').boundingBox())!
          await page.mouse.move(box.x+20/320*box.width,box.y+20/180*box.height);await page.mouse.down()
          await page.mouse.move(box.x+80/320*box.width,box.y+70/180*box.height,{steps:4});await page.mouse.up()
          const event=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать PNG',exact:true}).click()
          const file=await event
          // Decode the actual downloaded file back in the browser.
          const buffer=await readFile((await file.path())!)
          const result=await page.evaluate(async data=>{
            const bitmap=await createImageBitmap(new Blob([new Uint8Array(data)],{type:'image/png'}))
            const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height
            const ctx=c.getContext('2d')!;ctx.drawImage(bitmap,0,0);bitmap.close()
            return {width:c.width,height:c.height,pixel:Array.from(ctx.getImageData(40,40,1,1).data)}
          },Array.from(buffer))
          expect(result).toEqual({width:320,height:180,pixel:[0,0,0,255]})
          await page.screenshot({path:`work/evening6/zoom-${width}-${factor}.png`})
          await page.goto(baseURL!)
        }
      } finally {await context.close()}
    }
  } finally {
    // mkdtemp's exact child is the only directory removed; no user profile is used.
    if(path.dirname(scratch)===os.tmpdir() && path.basename(scratch).startsWith('beforeshare-zoom-')) await rm(scratch,{recursive:true,force:true})
  }
})
