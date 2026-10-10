import { expect, test } from '@playwright/test'
import path from 'node:path'

test('English interface persists and switching languages preserves annotations and history', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('button', { name: 'Choose image', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByLabel('Image file').setInputFiles(path.resolve('tests/fixtures/ordinary.png'))
  await page.getByRole('button', { name: 'Text', exact: true }).click()
  await page.locator('canvas').click({ position: { x: 25, y: 25 } })
  await page.getByLabel('Caption text', { exact: true }).fill('Привет\nHello')
  await page.getByRole('button', { name: 'Apply text', exact: true }).click()
  await page.getByRole('button', { name: 'Русский', exact: true }).click()
  await page.getByRole('button', { name: 'Редактировать текст', exact: true }).click()
  await expect(page.getByLabel('Текст подписи', { exact: true })).toHaveValue('Привет\nHello')
  await page.getByRole('button', { name: 'Отмена', exact: true }).click()
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await page.getByRole('button', { name: 'Light theme', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await page.getByRole('button', { name: 'Preview PNG', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Final PNG', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back to editing', exact: true }).click()
})

test('English errors and mobile toolbar remain accessible without storage', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('storage unavailable') } })
  await page.goto('./')
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await page.getByLabel('Image file').setInputFiles({ name: 'broken.webp', mimeType: 'image/webp', buffer: Buffer.from('broken') })
  await expect(page.getByRole('alert')).toContainText('Only PNG, JPEG or WebP')
  await page.getByLabel('Image file').setInputFiles(path.resolve('tests/fixtures/ordinary.png'))
  for (const name of ['Select', 'Pan', 'Hide', 'Arrow', 'Number', 'Text', 'Pencil', 'Crop', 'Texture']) {
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true')
  }
})
