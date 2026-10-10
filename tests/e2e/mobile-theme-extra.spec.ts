import { expect,test } from '@playwright/test'
import path from 'node:path'

test('mouse pan never records edits, tool switch cancels a captured pan and reopening resets the mode',async({page})=>{
  await page.goto('./')
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/ordinary.png'))
  await page.getByRole('slider',{name:'Масштаб изображения'}).fill('400')
  await page.getByRole('button',{name:'Перемещение',exact:true}).click()
  const host=page.locator('.canvas-viewport'),box=(await host.boundingBox())!
  await page.mouse.move(box.x+box.width*.75,box.y+box.height*.75);await page.mouse.down()
  await page.mouse.move(box.x+box.width*.75-100,box.y+box.height*.75-100,{steps:8})
  expect(await host.evaluate(el=>el.scrollLeft)).toBeGreaterThan(50)
  expect(await host.evaluate(el=>el.scrollTop)).toBeGreaterThan(50)
  // Change mode while a pointer is captured (keyboard / assistive activation).
  await page.getByRole('button',{name:'Скрыть',exact:true}).focus();await page.keyboard.press('Enter')
  const stopped=await host.evaluate(el=>({x:el.scrollLeft,y:el.scrollTop}))
  await page.mouse.move(box.x+box.width*.75-140,box.y+box.height*.75-140,{steps:4})
  expect(await host.evaluate(el=>({x:el.scrollLeft,y:el.scrollTop}))).toEqual(stopped)
  await page.mouse.up()
  await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'Перемещение',exact:true}).click()
  page.once('dialog',dialog=>dialog.accept())
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/synthetic-account.png'))
  await expect(page.getByText('480 × 300 px')).toBeVisible()
  await expect(page.getByRole('button',{name:'Перемещение',exact:true})).toHaveAttribute('aria-pressed','false')
})

test('stars move, reduced motion freezes them, and hidden tabs pause the gradient animation',async({page})=>{
  await page.goto('./')
  const dot=page.locator('.constellations circle').first()
  const before=await dot.getAttribute('cx')
  await expect.poll(()=>dot.getAttribute('cx')).not.toBe(before)
  await page.emulateMedia({reducedMotion:'reduce'})
  await expect(page.locator('.ambient-background')).toHaveAttribute('data-paused','true')
  const frozen=await dot.getAttribute('cx');await page.waitForTimeout(180)
  expect(await dot.getAttribute('cx')).toBe(frozen)
  await page.emulateMedia({reducedMotion:'no-preference'})
  await expect.poll(()=>dot.getAttribute('cx')).not.toBe(frozen)
  await page.getByRole('button',{name:'Светлая тема',exact:true}).click()
  expect(await page.locator('.gradient-cloud').first().evaluate(el=>getComputedStyle(el).animationPlayState)).toBe('running')
  // Headless tabs do not reliably become hidden; exercise the visibility event explicitly.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))})
  await expect(page.locator('.ambient-background')).toHaveAttribute('data-paused','true')
  expect(await page.locator('.gradient-cloud').first().evaluate(el=>getComputedStyle(el).animationPlayState)).toBe('paused')
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))})
  await expect(page.locator('.ambient-background')).toHaveAttribute('data-paused','false')
})

test('Escape ends an active mouse pan without changing history',async({page})=>{
  await page.goto('./')
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/ordinary.png'))
  await page.getByRole('slider',{name:'Масштаб изображения'}).fill('400')
  await page.getByRole('button',{name:'Перемещение',exact:true}).click()
  const host=page.locator('.canvas-viewport'),box=(await host.boundingBox())!
  await page.mouse.move(box.x+box.width*.7,box.y+box.height*.7);await page.mouse.down()
  await page.mouse.move(box.x+box.width*.7-70,box.y+box.height*.7-70,{steps:5})
  await page.keyboard.press('Escape')
  const stopped=await host.evaluate(el=>({x:el.scrollLeft,y:el.scrollTop}))
  await page.mouse.move(box.x+box.width*.7-120,box.y+box.height*.7-120,{steps:5})
  expect(await host.evaluate(el=>({x:el.scrollLeft,y:el.scrollTop}))).toEqual(stopped)
  await page.mouse.up()
  await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeDisabled()
})
