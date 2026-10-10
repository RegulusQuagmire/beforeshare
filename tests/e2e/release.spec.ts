import {test,expect} from '@playwright/test'

test('production project path serves its own JS, CSS and favicon',async({page,request,baseURL})=>{
  const failed:string[]=[]
  page.on('requestfailed',r=>failed.push(r.url()))
  page.on('pageerror',e=>failed.push(e.message))
  await page.goto('./')
  await expect(page.getByRole('button',{name:'Выбрать изображение',exact:true})).toBeVisible()
  const expectedBase=new URL(baseURL!).pathname
  expect(new URL(page.url()).pathname).toBe(expectedBase)
  const assets=await page.locator('script[src],link[rel="stylesheet"],link[rel="icon"]').evaluateAll(elements=>elements.map(el=>el.getAttribute('src')??el.getAttribute('href')!))
  expect(assets.some(asset=>asset.endsWith('favicon.svg'))).toBe(true)
  for(const asset of assets) {
    const url=new URL(asset,page.url());expect(url.pathname.startsWith(expectedBase)).toBe(true)
    const response=await request.get(url.href);expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).not.toContain('text/html')
  }
  expect(failed).toEqual([])
})
