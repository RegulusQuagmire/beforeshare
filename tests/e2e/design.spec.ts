import { expect, test } from '@playwright/test'
import path from 'node:path'

test('context settings follow tools and mobile editor leaves room for the image', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./')
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/ordinary.png'))
  await expect(page.getByLabel('Цвет заливки')).toBeVisible()
  await page.getByRole('button', { name: 'Обрезать', exact: true }).click()
  await expect(page.getByLabel('Цвет заливки')).toBeHidden()
  await page.getByRole('button', { name: 'Карандаш', exact: true }).click()
  await expect(page.getByLabel('Толщина линии')).toBeVisible()
  await expect(page.getByLabel('Цвет заливки')).toBeVisible()
  await page.getByRole('button', { name: 'Перемещение', exact: true }).click()
  await expect(page.getByLabel('Толщина линии')).toBeHidden()
  await expect(page.getByLabel('Цвет заливки')).toBeHidden()
  const workspace = await page.locator('.canvas-viewport').boundingBox()
  expect(workspace!.height).toBeGreaterThanOrEqual(320)
  for (const name of ['Выбрать', 'Перемещение', 'Скрыть', 'Стрелка', 'Номер', 'Текст', 'Карандаш', 'Обрезать', 'Текстура']) {
    const button = page.getByRole('button', { name, exact: true })
    const box = await button.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
