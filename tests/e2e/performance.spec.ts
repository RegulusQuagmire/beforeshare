import { expect, test } from '@playwright/test'
import path from 'node:path'

test('pointer bursts coalesce and idle background does not redraw editor',async({page})=>{
  await page.goto('./')
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/ordinary.png'))
  await expect(page.getByText('320 × 180 px')).toBeVisible()
  const result=await page.locator('canvas').evaluate(async(c:HTMLCanvasElement)=>{
    const ctx=c.getContext('2d')!,clear=ctx.clearRect.bind(ctx)
    let draws=0,resets=0
    ctx.clearRect=(...args)=>{draws++;clear(...args)}
    for(const key of ['width','height'] as const){const d=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,key)!;Object.defineProperty(c,key,{get:()=>d.get!.call(c),set:(v:number)=>{resets++;d.set!.call(c,v)}})}
    const box=c.getBoundingClientRect(),start=performance.now()
    const fire=(type:string,x:number)=>c.dispatchEvent(new PointerEvent(type,{pointerId:11,isPrimary:true,button:0,clientX:box.x+x,clientY:box.y+30,bubbles:true}))
    // Synthetic pointer capture is unavailable; it does not affect draw scheduling.
    c.setPointerCapture=()=>{}
    fire('pointerdown',20)
    for(let i=0;i<240;i++)fire('pointermove',20+i/2)
    await new Promise(requestAnimationFrame)
    const burst={draws,resets,ms:performance.now()-start}
    fire('pointercancel',150)
    await new Promise(requestAnimationFrame)
    draws=0
    await new Promise(resolve=>setTimeout(resolve,150))
    return {...burst,idleDraws:draws}
  })
  console.log('CANVAS_BENCH',JSON.stringify(result))
  expect(result.idleDraws).toBe(0)
  expect(result.draws).toBeLessThanOrEqual(2)
  expect(result.resets).toBe(0)
})
