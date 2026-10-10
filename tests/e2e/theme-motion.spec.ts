import { expect, test } from '@playwright/test'

test('theme transitions and button hover are subtle and respect reduced motion', async ({ page }) => {
  await page.goto('./')
  const button = page.locator('.theme-toggle')
  await button.hover()
  await expect.poll(() => button.evaluate(el => getComputedStyle(el).scale)).toBe('1.035')
  await button.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect.poll(() => page.locator('.upload-zone').evaluate(el => getComputedStyle(el).animationName)).toBe('theme-light-in')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(() => button.evaluate(el => getComputedStyle(el).scale)).toBe('none')
  await expect.poll(() => page.locator('.upload-zone').evaluate(el => getComputedStyle(el).animationName)).toBe('none')
  await expect.poll(() => button.evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s')
  await page.getByRole('button', { name: 'Тёмная тема', exact: true }).click()
  await expect(page.locator('.ambient-background')).toHaveAttribute('data-paused', 'true')
})
