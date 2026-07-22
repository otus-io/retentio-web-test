import { expect, test, type Locator, type Page } from '@playwright/test'

export function skipUnlessE2ECredentials() {
  test.skip(
    !process.env.E2E_USERNAME || !process.env.E2E_PASSWORD,
    'Requires E2E_USERNAME and E2E_PASSWORD',
  )
}

export function uniqueName(prefix: string) {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export async function gotoTagsPage(page: Page) {
  await page.goto('/tags')
  await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
}

export function tagRow(page: Page, tagName: string) {
  return page.locator('table tbody tr').filter({ hasText: tagName }).first()
}

export async function openTagCreateForm(page: Page) {
  await page.getByRole('button', { name: 'Create tag' }).click()
  await expect(page.getByRole('heading', { name: 'Create tag' })).toBeVisible()
}

export async function fillAndSubmitTagForm(
  page: Page,
  options: { name: string; description?: string; submitLabel?: RegExp | string },
) {
  await page.locator('#tag-name').fill(options.name)
  if (options.description !== undefined) {
    await page.locator('#tag-description').fill(options.description)
  }
  await page.getByRole('button', { name: options.submitLabel ?? /^(Create|Save)$/ }).click()
}

export async function createTagViaLibrary(
  page: Page,
  options: { name: string; description?: string },
) {
  await gotoTagsPage(page)
  await openTagCreateForm(page)
  await fillAndSubmitTagForm(page, options)
  await expect(tagRow(page, options.name)).toBeVisible({ timeout: 15_000 })
}

export async function openTagRowMenu(page: Page, tagName: string) {
  const row = tagRow(page, tagName)
  await expect(row).toBeVisible()
  await row.locator('button[aria-haspopup="menu"]').click()
  await expect(page.getByRole('menu')).toBeVisible()
}

export async function editTagViaLibrary(page: Page, tagName: string, newName: string) {
  await gotoTagsPage(page)
  await openTagRowMenu(page, tagName)
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  await expect(page.getByRole('heading', { name: 'Edit tag' })).toBeVisible()
  await fillAndSubmitTagForm(page, { name: newName, submitLabel: 'Save' })
  await expect(tagRow(page, newName)).toBeVisible({ timeout: 15_000 })
}

export async function deleteTagViaLibrary(page: Page, tagName: string) {
  await gotoTagsPage(page)
  await openTagRowMenu(page, tagName)
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Delete' }).click()
  await expect(tagRow(page, tagName)).toHaveCount(0, { timeout: 15_000 })
}

/** Open Tags → View facts for a tag; waits for the facts panel. */
export async function openTagViewFacts(page: Page, tagName: string) {
  await gotoTagsPage(page)
  await openTagRowMenu(page, tagName)
  await page.getByRole('menuitem', { name: 'View facts' }).click()
  await expect(page.getByText(`Facts with “${tagName}”`)).toBeVisible({ timeout: 15_000 })
}

/**
 * Type a tag name into a Deck/FactTagsPicker and click Add (creates or attaches).
 */
export async function pickOrCreateTagInScope(
  scope: Locator,
  searchInputId: string,
  tagName: string,
) {
  await scope.locator(`#${searchInputId}`).fill(tagName)
  await scope.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(scope.getByLabel(`Remove ${tagName}`)).toBeVisible({ timeout: 15_000 })
}

/**
 * Create a deck from /decks via the ⋯ menu form.
 * Optional tagNames are attached via DeckTagsPicker before submit.
 */
export async function createDeck(
  page: Page,
  name = 'TestDeck',
  fields = ['field1', 'field2'],
  tagNames: string[] = [],
) {
  await page.goto('/decks')
  await expect(page.getByRole('heading', { name: 'Decks', exact: true })).toBeVisible()

  await page.locator('button[aria-haspopup="menu"]').first().click()
  await page.getByRole('menuitem', { name: 'Create deck' }).click()

  const form = page.locator('form').filter({ has: page.locator('#create-name') })
  await page.locator('#create-name').fill(name)
  for (let i = 0; i < fields.length; i++) {
    const input = page.locator(`#create-field-${i}`)
    if ((await input.count()) === 0) {
      await page.getByRole('button', { name: 'Add field' }).click()
    }
    await page.locator(`#create-field-${i}`).fill(fields[i])
  }

  for (const tagName of tagNames) {
    await pickOrCreateTagInScope(form, 'deck-tags-search', tagName)
  }

  await form.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByText('Deck created.')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('link', { name })).toBeVisible()
}

/**
 * Open a deck by name from /decks and wait until the deck page is ready.
 * Facts live in modals (Add Facts / Edit Facts), not an on-page Facts list.
 */
export async function gotoDeckByName(page: Page, deckName: string) {
  await page.goto('/decks')
  await page.getByRole('link', { name: deckName }).click()
  await page.waitForURL(/\/decks\/[^/]+$/)
  await expect(page.getByText(deckName, { exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Copy deck ID')).toBeVisible()
}

/** DeckInfoCard ⋯ menu (card that shows Copy deck ID). */
async function openDeckInfoMenu(page: Page) {
  const card = page
    .locator('div.relative')
    .filter({ has: page.getByText('Copy deck ID') })
    .first()
  await card.locator('button[aria-haspopup="menu"]').click()
  await expect(page.getByRole('menu')).toBeVisible()
}

export async function openDeckEdit(page: Page) {
  await openDeckInfoMenu(page)
  await page.getByRole('menuitem', { name: 'Edit Deck' }).click()
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible({ timeout: 15_000 })
}

export async function expectDeckShowsTag(page: Page, tagName: string) {
  const tagsBlock = page.locator('dl').filter({ has: page.getByText('Tags', { exact: true }) })
  await expect(tagsBlock.getByText(tagName, { exact: true })).toBeVisible({ timeout: 15_000 })
}

export async function expectDeckLacksTag(page: Page, tagName: string) {
  const tagsBlock = page.locator('dl').filter({ has: page.getByText('Tags', { exact: true }) })
  await expect(tagsBlock.getByText(tagName, { exact: true })).toHaveCount(0)
}

/** Remove a deck tag on the edit form (immediate PUT/DELETE when deckId is set). */
export async function removeDeckTagOnEdit(page: Page, tagName: string) {
  await openDeckEdit(page)
  await page.getByLabel(`Remove ${tagName}`).click()
  await expect(page.getByLabel(`Remove ${tagName}`)).toHaveCount(0, { timeout: 15_000 })
  await page.getByRole('button', { name: 'Cancel' }).click()
}

export async function openAddFactsModal(page: Page) {
  await openDeckInfoMenu(page)
  await page.getByRole('menuitem', { name: 'Add Facts' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Add Facts/ })).toBeVisible()
}

export async function openEditFactsModal(page: Page) {
  await openDeckInfoMenu(page)
  await page.getByRole('menuitem', { name: 'Edit Facts' }).click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 })
}

/**
 * Fill the first N value inputs in the Add Facts modal and submit.
 * Optional tagNames are attached via FactTagsPicker before submit.
 */
export async function addFact(page: Page, values: string[], tagNames: string[] = []) {
  const factsStat = page.getByText(/^Facts:\s*\d+$/)
  const beforeText = (await factsStat.textContent()) ?? 'Facts: 0'
  const beforeCount = Number(beforeText.replace(/\D/g, '')) || 0

  await openAddFactsModal(page)
  const dialog = page.getByRole('dialog')
  for (let i = 0; i < values.length; i++) {
    await dialog.locator(`#fact-0-${i}`).fill(values[i])
  }
  for (const tagName of tagNames) {
    await pickOrCreateTagInScope(dialog, 'fact-tags-search', tagName)
  }
  await dialog.getByRole('button', { name: 'Add Facts' }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })
  await expect(page.getByText('Facts added.')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(`Facts: ${beforeCount + 1}`)).toBeVisible({ timeout: 15_000 })
}

/** Open Edit Facts and assert each value appears in an input. */
export async function expectFactValuesInEditor(page: Page, values: string[]) {
  await openEditFactsModal(page)
  const dialog = page.getByRole('dialog')
  for (const value of values) {
    await expect(dialog.locator(`input[value=${JSON.stringify(value)}]`).first()).toBeVisible({
      timeout: 15_000,
    })
  }
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
}

/** Select a fact tag in the Study by fact tag dropdown (reload first if tags were just added). */
export async function selectStudyTag(page: Page, tagName: string) {
  const select = page.locator('#study-tag-filter')
  await expect(select).toBeVisible()
  await expect(select.locator('option', { hasText: tagName })).toBeAttached({ timeout: 15_000 })
  await select.selectOption({ label: tagName })
  await expect(select).toHaveValue(/.+/)
}
