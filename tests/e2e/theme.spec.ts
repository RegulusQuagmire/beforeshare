import { expect, test } from '@playwright/test'

test('dark landing respects reduced motion and stays keyboard accessible on a narrow screen', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('./')
  expect(await page.locator('html').evaluate(el => getComputedStyle(el).colorScheme)).toBe('dark')
  expect(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length)).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button',{name:'English',exact:true})).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button',{name:'Светлая тема',exact:true})).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Выбрать изображение', exact: true })).toBeFocused()
  expect(await page.locator(':focus').evaluate(el => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThanOrEqual(2)
})
