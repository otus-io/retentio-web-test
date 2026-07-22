import { test, expect } from '@playwright/test'
import {
  createTagViaLibrary,
  deleteTagViaLibrary,
  editTagViaLibrary,
  gotoTagsPage,
  openTagCreateForm,
  skipUnlessE2ECredentials,
  tagRow,
  uniqueName,
} from './helpers'

test.describe('Tags library', () => {
  test.beforeEach(() => {
    skipUnlessE2ECredentials()
  })

  test('should navigate to tags page', async ({ page }) => {
    await gotoTagsPage(page)
    await expect(page).toHaveURL(/\/tags$/)
    await expect(page.getByText(/Your tags \(\d+\)/)).toBeVisible()
  })

  test('should create a tag', async ({ page }) => {
    const tagName = uniqueName('Tag')
    const description = 'E2E test description'

    await createTagViaLibrary(page, { name: tagName, description })

    await page.reload()
    await expect(tagRow(page, tagName)).toBeVisible()
    await expect(tagRow(page, tagName)).toContainText(description)
  })

  test('should filter tags by search', async ({ page }) => {
    const tagA = uniqueName('AppleOnly')
    const tagB = uniqueName('BananaOnly')

    await createTagViaLibrary(page, { name: tagA })
    await createTagViaLibrary(page, { name: tagB })

    await page.getByRole('textbox', { name: 'Search tags' }).fill(tagA)
    await expect(tagRow(page, tagA)).toBeVisible()
    await expect(tagRow(page, tagB)).toHaveCount(0)

    await page.getByRole('textbox', { name: 'Search tags' }).fill('')
    await expect(tagRow(page, tagA)).toBeVisible()
    await expect(tagRow(page, tagB)).toBeVisible()
  })

  test('should edit a tag', async ({ page }) => {
    const originalName = uniqueName('EditTag')
    const updatedName = uniqueName('UpdatedTag')

    await createTagViaLibrary(page, { name: originalName })
    await editTagViaLibrary(page, originalName, updatedName)

    await page.reload()
    await expect(tagRow(page, updatedName)).toBeVisible()
    await expect(tagRow(page, originalName)).toHaveCount(0)
  })

  test('should delete a tag', async ({ page }) => {
    const tagName = uniqueName('DeleteTag')

    await createTagViaLibrary(page, { name: tagName })
    await deleteTagViaLibrary(page, tagName)

    await page.reload()
    await expect(tagRow(page, tagName)).toHaveCount(0)
  })

  test('should reject empty tag name', async ({ page }) => {
    await gotoTagsPage(page)
    await openTagCreateForm(page)
    await page.locator('#tag-name').fill('   ')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByText('Name is required')).toBeVisible()
  })
})
