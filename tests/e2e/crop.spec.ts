import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

async function openImage(page: Page) {
  await page.goto('./')
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/ordinary.png'))
  await expect(page.getByText('320 × 180 px')).toBeVisible()
}
async function drag(page: Page, from: [number, number], to: [number, number]) {
  const box = (await page.locator('canvas').boundingBox())!
  await page.mouse.move(box.x + from[0], box.y + from[1])
  await page.mouse.down()
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 5 })
  await page.mouse.up()
}
async function pixel(page: Page, x: number, y: number) {
  return page.locator('canvas').evaluate((canvas: HTMLCanvasElement, p) => Array.from(canvas.getContext('2d')!.getImageData(p.x, p.y, 1, 1).data), { x, y })
}

test('shapes retain positions after crop; new shapes use shifted source coordinates; undo/redo', async ({ page }) => {
  await openImage(page)
  await drag(page, [40, 40], [80, 70])
  await page.getByRole('button', { name: 'Стрелка', exact: true }).click()
  await drag(page, [100, 100], [220, 100])
  await page.getByRole('button', { name: 'Номер', exact: true }).click()
  const box = (await page.locator('canvas').boundingBox())!
  await page.mouse.click(box.x + 200, box.y + 140)
  await page.getByRole('button', { name: 'Обрезать', exact: true }).click()
  await drag(page, [280, 170], [20, 20])
  await expect(page.getByText('320 × 180 px')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Скрыть', exact: true })).toBeDisabled()
  await page.screenshot({ path: 'work/evening4-crop.png', fullPage: false })
  await page.getByRole('button', { name: 'Применить', exact: true }).click()
  await expect(page.getByText('260 × 150 px')).toBeVisible()
  await expect.poll(() => pixel(page, 30, 30)).toEqual([0, 0, 0, 255])
  await expect.poll(() => pixel(page, 130, 80)).toEqual([249, 115, 22, 255])
  await expect.poll(() => pixel(page, 170, 120)).toEqual([249, 115, 22, 255])
  await page.getByRole('button', { name: 'Скрыть', exact: true }).click()
  await drag(page, [100, 20], [130, 50])
  await expect.poll(() => pixel(page, 115, 35)).toEqual([0, 0, 0, 255])
  await page.getByRole('button', { name: 'Отменить', exact: true }).click()
  await page.getByRole('button', { name: 'Отменить', exact: true }).click()
  await expect(page.getByText('320 × 180 px')).toBeVisible()
  await expect.poll(() => pixel(page, 50, 50)).toEqual([0, 0, 0, 255])
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
  await expect(page.getByText('260 × 150 px')).toBeVisible()
  await expect.poll(() => pixel(page, 30, 30)).toEqual([0, 0, 0, 255])
})

test('crop cancellation via button/Escape and Enter confirmation; small crops leave no action', async ({ page }) => {
  await openImage(page)
  await page.getByRole('button', { name: 'Обрезать', exact: true }).click()
  await drag(page, [20, 20], [30, 80])
  await expect(page.getByRole('button', { name: 'Применить', exact: true })).toHaveCount(0)
  for (const method of ['button', 'escape']) {
    await drag(page, [20, 20], [180, 140])
    await expect(page.getByRole('button', { name: 'Применить', exact: true })).toBeVisible()
    if (method === 'button') await page.getByRole('button', { name: 'Отмена', exact: true }).click()
    else await page.keyboard.press('Escape')
    await expect(page.getByText('320 × 180 px')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Отменить', exact: true })).toBeDisabled()
  }
  await drag(page, [20, 20], [180, 140])
  await page.keyboard.press('Enter')
  await expect(page.getByText('160 × 120 px')).toBeVisible()
})

test('window resize discards both moving and pending crop without changing document', async ({ page }) => {
  await openImage(page)
  await page.getByRole('button', { name: 'Обрезать', exact: true }).click()
  const box = (await page.locator('canvas').boundingBox())!
  await page.mouse.move(box.x + 20, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 180, box.y + 140)
  await page.setViewportSize({ width: 1100, height: 800 })
  await page.mouse.up()
  await expect(page.getByRole('button', { name: 'Применить', exact: true })).toHaveCount(0)
  await drag(page, [20, 20], [180, 140])
  await expect(page.getByRole('button', { name: 'Применить', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 1024, height: 850 })
  await expect(page.getByRole('button', { name: 'Применить', exact: true })).toHaveCount(0)
  await expect(page.getByText('320 × 180 px')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Отменить', exact: true })).toBeDisabled()
})
