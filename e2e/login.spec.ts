import { expect, test, type Page } from '@playwright/test'

async function stubUnauthenticatedRefresh(page: Page) {
  await page.route('**/api/v1/auth/refresh', async (route) => {
    const origin = 'http://127.0.0.1:4175'
    const headers = {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'accept, content-type',
    }
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Authentication required',
        error: { code: 'UNAUTHORIZED', details: [] },
      }),
    })
  })
}

test('login screen validates credentials before sending a request', async ({ page }) => {
  await stubUnauthenticatedRefresh(page)
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByText('Enter a valid email address.')).toBeVisible()
  await expect(page.getByText('Enter your password.')).toBeVisible()
})

test('login form remains usable at a mobile viewport', async ({ page }) => {
  await stubUnauthenticatedRefresh(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Work email' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()

  const formBounds = await page.locator('.auth-card').boundingBox()
  if (!formBounds) throw new Error('Login form is not visible at the mobile viewport.')
  expect(formBounds.x + formBounds.width).toBeLessThanOrEqual(375)
})
