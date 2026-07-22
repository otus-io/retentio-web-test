import { test, expect } from '@playwright/test'
import { skipUnlessE2ECredentials } from './helpers'

test('should be logged in via global setup', async ({ page }) => {
  skipUnlessE2ECredentials()
  await page.goto('/decks')
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Decks', exact: true })).toBeVisible()
})

test.describe('unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.locator('#username').fill('invalid-user')
    await page.locator('#password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.locator('p.text-destructive')).toBeVisible({ timeout: 10_000 })
  })
})
