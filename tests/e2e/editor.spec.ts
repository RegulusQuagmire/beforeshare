import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

async function openImage(page: Page) {
  await page.goto('./')
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/ordinary.png'))
  await expect(page.getByText('320 × 180 px')).toBeVisible()
}

async function pixel(page: Page, x: number, y: number) {
  return page.locator('canvas').evaluate((canvas, point) => {
    const ctx = (canvas as HTMLCanvasElement).getContext('2d')!
    const px = Math.floor(point.x / 320 * ctx.canvas.width)
    const py = Math.floor(point.y / 180 * ctx.canvas.height)
    return Array.from(ctx.getImageData(px, py, 1, 1).data)
  }, { x, y })
}

async function drag(page: Page, from: [number, number], to: [number, number]) {
  const box = (await page.locator('canvas').boundingBox())!
  await page.mouse.move(box.x + from[0] / 320 * box.width, box.y + from[1] / 180 * box.height)
  await page.mouse.down()
  await page.mouse.move(box.x + to[0] / 320 * box.width, box.y + to[1] / 180 * box.height, { steps: 5 })
  await page.mouse.up()
}

test('reverse redaction is one undoable action and can be redone', async ({ page }) => {
  await openImage(page)
  const original = await pixel(page, 40, 40)
  await expect(page.getByRole('button', { name: 'Скрыть', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await drag(page, [80, 70], [20, 20])
  await expect.poll(() => pixel(page, 40, 40)).toEqual([0, 0, 0, 255])
  await page.getByRole('button', { name: 'Отменить', exact: true }).click()
  await expect.poll(() => pixel(page, 40, 40)).toEqual(original)
  await expect(page.getByRole('button', { name: 'Отменить', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
  await expect.poll(() => pixel(page, 40, 40)).toEqual([0, 0, 0, 255])
})

test('arrow and two numbered clicks are separate reversible actions', async ({ page }) => {
  await openImage(page)
  const original = await pixel(page, 150, 100)
  await page.getByRole('button', { name: 'Стрелка', exact: true }).click()
  await drag(page, [100, 100], [220, 100])
  await expect.poll(() => pixel(page, 150, 100)).toEqual([249, 115, 22, 255])
  await page.getByRole('button', { name: 'Номер', exact: true }).click()
  const box = (await page.locator('canvas').boundingBox())!
  for (const x of [100, 200]) await page.mouse.click(box.x + x / 320 * box.width, box.y + 140 / 180 * box.height)
  for (const x of [90, 190]) await expect.poll(() => pixel(page, x, 140)).toEqual([249, 115, 22, 255])
  await page.screenshot({ path: 'work/evening3.png', fullPage: true })
  await page.keyboard.press('Control+z')
  await expect.poll(() => pixel(page, 190, 140)).not.toEqual([249, 115, 22, 255])
  await page.keyboard.press('Control+Shift+z')
  await expect.poll(() => pixel(page, 190, 140)).toEqual([249, 115, 22, 255])
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Отменить', exact: true }).click()
  await expect.poll(() => pixel(page, 150, 100)).toEqual(original)
  await expect(page.getByRole('button', { name: 'Отменить', exact: true })).toBeDisabled()
})

test('Escape, pointercancel, tool change and lost capture discard drafts', async ({ page }) => {
  await openImage(page)
  const original = await pixel(page, 40, 40)
  for (const cancel of ['escape', 'pointercancel', 'tool', 'capture']) {
    // Toolbar clicks can scroll the page; each gesture needs current viewport coordinates.
    await page.locator('canvas').scrollIntoViewIfNeeded()
    const box = (await page.locator('canvas').boundingBox())!
    await page.mouse.move(box.x + 20 / 320 * box.width, box.y + 20 / 180 * box.height)
    await page.mouse.down()
    await page.mouse.move(box.x + 80 / 320 * box.width, box.y + 70 / 180 * box.height)
    await expect.poll(() => pixel(page, 40, 40)).toEqual([0, 0, 0, 255])
    if (cancel === 'escape') await page.keyboard.press('Escape')
    if (cancel === 'pointercancel') await page.locator('canvas').dispatchEvent('pointercancel', { pointerId: 1 })
    if (cancel === 'tool') await page.getByRole('button', { name: 'Стрелка', exact: true }).evaluate((button: HTMLButtonElement) => button.click())
    if (cancel === 'capture') await page.locator('canvas').evaluate((canvas) => canvas.releasePointerCapture(1))
    await page.mouse.up()
    await expect.poll(() => pixel(page, 40, 40)).toEqual(original)
    await expect(page.getByRole('button', { name: 'Отменить', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Скрыть', exact: true }).click()
  }
})

test('captured release outside canvas commits once, short gestures do nothing', async ({ page }) => {
  await openImage(page)
  await drag(page, [20, 20], [21, 70])
  await expect(page.getByRole('button', { name: 'Отменить', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Стрелка', exact: true }).click()
  await drag(page, [20, 20], [27, 20])
  await expect(page.getByRole('button', { name: 'Отменить', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Скрыть', exact: true }).click()
  await drag(page, [280, 130], [350, 210])
  await expect.poll(() => pixel(page, 310, 170)).toEqual([0, 0, 0, 255])
  await page.getByRole('button', { name: 'Отменить', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Отменить', exact: true })).toBeDisabled()
})

test('second pointer cannot alter or finish the active gesture', async ({ page }) => {
  await openImage(page)
  const box = (await page.locator('canvas').boundingBox())!
  await page.mouse.move(box.x + 20, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 80, box.y + 70)
  for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
    await page.locator('canvas').dispatchEvent(type, { pointerId: 9, isPrimary: false, button: 0, clientX: box.x + 200, clientY: box.y + 140 })
  }
  await expect(page.getByRole('button', { name: 'Отменить', exact: true })).toBeDisabled()
  await page.mouse.up()
  await expect.poll(() => pixel(page, 40, 40)).toEqual([0, 0, 0, 255])
  await expect.poll(() => pixel(page, 180, 120)).not.toEqual([0, 0, 0, 255])
  await page.getByRole('button', { name: 'Отменить', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Отменить', exact: true })).toBeDisabled()
})

test('black rectangles cover later arrows and markers; history shortcuts skip fields', async ({ page }) => {
  await openImage(page)
  await drag(page, [20, 20], [110, 90])
  await page.getByRole('button', { name: 'Стрелка', exact: true }).click()
  await drag(page, [10, 40], [220, 40])
  await page.getByRole('button', { name: 'Номер', exact: true }).click()
  const box = (await page.locator('canvas').boundingBox())!
  await page.mouse.click(box.x + 70, box.y + 60)
  await expect.poll(() => pixel(page, 60, 60)).toEqual([0, 0, 0, 255])
  // Test-only controls are inserted by Playwright, never shipped with the app.
  for (const tag of ['input', 'textarea', 'div']) {
    await page.evaluate((tag) => {
      const el = document.createElement(tag)
      el.id = 'test-editor-field'
      if (tag === 'div') el.contentEditable = 'true'
      document.body.append(el)
      el.focus()
    }, tag)
    await page.keyboard.press('Control+z')
    await page.locator('#test-editor-field').evaluate((el) => el.remove())
  }
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'я', code: 'KeyZ', ctrlKey: true, cancelable: true })))
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'я', code: 'KeyZ', ctrlKey: true, cancelable: true })))
  await expect.poll(() => pixel(page, 180, 40)).not.toEqual([249, 115, 22, 255])
  await expect.poll(() => pixel(page, 60, 60)).toEqual([0, 0, 0, 255])
  await page.getByRole('button', { name: 'Отменить', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Отменить', exact: true })).toBeDisabled()
})

test('number 100 reports the specified error and undo allows a new number 99', async ({ page }) => {
  await openImage(page)
  await page.getByRole('button', { name: 'Номер', exact: true }).click()
  const box = (await page.locator('canvas').boundingBox())!
  for (let i = 0; i < 100; i++) await page.mouse.click(box.x + 60, box.y + 60)
  await expect(page.getByRole('alert')).toHaveText('Достигнут предел: 99 меток')
  await page.getByRole('button', { name: 'Отменить', exact: true }).click()
  const newBox = (await page.locator('canvas').boundingBox())!
  await page.mouse.click(newBox.x + 140, newBox.y + 60)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Повторить', exact: true })).toBeDisabled()
  await expect.poll(() => pixel(page, 130, 60)).toEqual([249, 115, 22, 255])
})

test('DPR and narrow resize preserve source positions and full preview', async ({ browser }) => {
  for (const deviceScaleFactor of [1, 2]) {
    const context = await browser.newContext({ deviceScaleFactor, viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    await openImage(page)
    await drag(page, [20, 20], [80, 70])
    for (const width of [1024, 360, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expect.poll(() => pixel(page, 40, 40)).toEqual([0, 0, 0, 255])
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await context.close()
  }
})

test('real touch drawing does not scroll a narrow page', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 360, height: 740 } })
  const page = await context.newPage()
  await openImage(page)
  await page.locator('canvas').scrollIntoViewIfNeeded()
  const box = (await page.locator('canvas').boundingBox())!
  const scroll = await page.evaluate(() => scrollY)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 20, y: box.y + 20 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 80, y: box.y + 70 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  expect(await page.evaluate(() => scrollY)).toBe(scroll)
  await expect.poll(() => pixel(page, 40, 40)).toEqual([0, 0, 0, 255])
  await page.getByRole('button', { name: 'Отменить', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Отменить', exact: true })).toBeDisabled()
  await context.close()
})

test('ordinary application contains no fixture controls and exposes PNG download', async ({ page }) => {
  await openImage(page)
  await expect(page.getByText('fixture add', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Скачать PNG', exact: true })).toBeEnabled()
  await page.goto('/tests/fixtures/editor-harness.html')
  await expect(page.getByText('fixture add', { exact: true })).toHaveCount(0)
})


test('editing history reuses one bitmap; invalid replacement preserves edits and successful replacement resets them', async ({ page }) => {
  await page.addInitScript(() => {
    const records: { closed: boolean }[] = []
    Object.assign(window, { testBitmaps: records })
    const original = window.createImageBitmap.bind(window)
    window.createImageBitmap = async (...args: unknown[]) => {
      const bitmap: ImageBitmap = await Reflect.apply(original, window, args)
      const record = { closed: false }
      records.push(record)
      const close = bitmap.close.bind(bitmap)
      bitmap.close = () => { record.closed = true; close() }
      return bitmap
    }
  })
  await openImage(page)
  await drag(page, [20, 20], [80, 70])
  await page.getByRole('button', { name: 'Отменить', exact: true }).click()
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as { testBitmaps: unknown[] }).testBitmaps.length)).toBe(1)
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/transparent.png'))
  await expect.poll(() => pixel(page, 40, 40)).toEqual([0, 0, 0, 255])
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/corrupt.png'))
  await expect(page.getByRole('alert')).toBeVisible()
  await expect.poll(() => pixel(page, 40, 40)).toEqual([0, 0, 0, 255])
  await expect(page.getByRole('button', { name: 'Отменить', exact: true })).toBeEnabled()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByLabel('Файл изображения').setInputFiles(path.resolve('tests/fixtures/transparent.png'))
  await expect(page.getByText('80 × 60 px')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Отменить', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Повторить', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Скрыть', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => (window as unknown as { testBitmaps: { closed: boolean }[] }).testBitmaps.map((record) => record.closed))).toEqual([true, false])
})

test('extreme valid source aspect ratios keep their far-end pixels at DPR 1 and 2', async ({ browser }) => {
  for (const deviceScaleFactor of [1, 2]) {
    const context = await browser.newContext({ deviceScaleFactor })
    const page = await context.newPage()
    await page.goto('./')
    for (const [width, height] of [[1, 6000], [6000, 1]]) {
      const data = await page.evaluate(([width, height]) => {
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = 'white'; ctx.fillRect(0, 0, width, height)
        ctx.fillStyle = 'red'; ctx.fillRect(Math.max(0, width - 40), Math.max(0, height - 40), 40, 40)
        return canvas.toDataURL('image/png').split(',')[1]
      }, [width, height])
      if (width > 1) page.once('dialog', (dialog) => dialog.accept())
      await page.getByLabel('Файл изображения').setInputFiles({ name: 'narrow.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') })
      await expect(page.getByText(width + ' × ' + height + ' px')).toBeVisible()
      await expect.poll(() => page.locator('canvas').evaluate((canvas: HTMLCanvasElement) =>
        Array.from(canvas.getContext('2d')!.getImageData(canvas.width - 1, canvas.height - 1, 1, 1).data))).toEqual([255, 0, 0, 255])
    }
    await context.close()
  }
})
