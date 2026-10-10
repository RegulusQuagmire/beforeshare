import { expect, test } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs/promises'

test('touch pan moves both axes without editing or changing exported PNG', async ({ browser }) => {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
  const page=await context.newPage()
  await page.goto('./')
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/ordinary.png'))
  await page.getByRole('slider',{name:'Масштаб изображения'}).fill('400')
  const save=async()=>{const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать PNG',exact:true}).click();return fs.readFile((await (await pending).path())!)}
  const before=await save()
  await page.getByRole('button',{name:'Перемещение',exact:true}).click()
  const viewport=page.locator('.canvas-viewport')
  await viewport.scrollIntoViewIfNeeded()
  const box=(await viewport.boundingBox())!,x=box.x+box.width*.75,y=box.y+box.height*.75
  const session=await context.newCDPSession(page)
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]})
  for(let step=1;step<=8;step++){
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-step*12,y:y-step*12}]})
    await page.waitForTimeout(25)
  }
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
  await expect.poll(()=>viewport.evaluate(el=>el.scrollLeft)).toBeGreaterThan(50)
  await expect.poll(()=>viewport.evaluate(el=>el.scrollTop)).toBeGreaterThan(50)
  await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeDisabled()
  expect((await save()).equals(before)).toBe(true)
  await page.getByRole('button',{name:'Скрыть',exact:true}).click()
  await expect(page.getByRole('button',{name:'Перемещение',exact:true})).toHaveAttribute('aria-pressed','false')
  await context.close()
})

test('theme switch keeps readable contrast and reduced motion stops both backgrounds',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.goto('./')
  await page.getByRole('button',{name:'Светлая тема',exact:true}).click()
  expect(await page.locator('html').evaluate(el=>getComputedStyle(el).colorScheme)).toBe('light')
  expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0)
  const contrast=await page.getByRole('button',{name:'Выбрать изображение',exact:true}).evaluate(el=>{
    const s=getComputedStyle(el),lum=(rgb:string)=>{const a=rgb.match(/\d+/g)!.slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return a[0]*.2126+a[1]*.7152+a[2]*.0722}
    const a=lum(s.color),b=lum(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)
  })
  expect(contrast).toBeGreaterThanOrEqual(4.5)
  await page.getByRole('button',{name:'Тёмная тема',exact:true}).click()
  expect(await page.locator('html').evaluate(el=>getComputedStyle(el).colorScheme)).toBe('dark')
  expect(await page.locator('.ambient-background').getAttribute('data-paused')).toBe('true')
})
