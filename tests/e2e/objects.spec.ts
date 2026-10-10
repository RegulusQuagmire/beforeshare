import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
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
