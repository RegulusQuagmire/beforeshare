import { expect, test } from '@playwright/test'
import path from 'node:path'

test('real finger pencil and selection gestures at 400% do not scroll or create intermediate history',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
  const page=await context.newPage();await page.goto('./')
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/ordinary.png'))
  await page.getByLabel('Масштаб изображения').fill('400')
  const session=await context.newCDPSession(page)
  const finger=async(y:number)=>{
    await page.locator('canvas').scrollIntoViewIfNeeded()
    const r=(await page.locator('canvas').boundingBox())!,x=r.x+50,startY=r.y+y
    const before=await page.evaluate(()=>scrollY)
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:startY}]})
    for(let i=1;i<=6;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+i*10,y:startY+10}]})
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
    expect(await page.evaluate(()=>scrollY)).toBe(before)
  }
  await page.getByRole('button',{name:'Карандаш',exact:true}).click();await finger(80)
  await page.getByRole('button',{name:'Выбрать',exact:true}).click();await finger(90)
  await page.getByRole('button',{name:'Отменить',exact:true}).click()
  await page.getByRole('button',{name:'Отменить',exact:true}).click()
  await expect(page.getByRole('button',{name:'Отменить',exact:true})).toBeDisabled()
  await context.close()
})
