import { test, expect } from '@playwright/test'
import {
  addFact,
  createDeck,
  createTagViaLibrary,
  deleteTagViaLibrary,
  expectDeckLacksTag,
  expectDeckShowsTag,
  expectFactValuesInEditor,
  gotoDeckByName,
  gotoTagsPage,
  openTagCreateForm,
  openTagViewFacts,
  removeDeckTagOnEdit,
  selectStudyTag,
  skipUnlessE2ECredentials,
  tagRow,
  uniqueName,
} from './helpers'

test.describe('Tag associations', () => {
  test.beforeEach(() => {
    skipUnlessE2ECredentials()
  })

  test('should attach tag on deck create and show it on deck + library counts', async ({ page }) => {
    const tagName = uniqueName('DeckTag')
    const deckName = uniqueName('TaggedDeck')

    await createDeck(page, deckName, ['field1', 'field2'], [tagName])
    await gotoDeckByName(page, deckName)
    await expectDeckShowsTag(page, tagName)

    await gotoTagsPage(page)
    const row = tagRow(page, tagName)
    await expect(row).toBeVisible()
    // Columns: Name, Description, Decks, Facts, Used on, Actions
    await expect(row.locator('td').nth(2)).toHaveText('1')
    await expect(row.locator('td').nth(4)).toContainText('deck')
  })

  test('should detach tag from deck via edit', async ({ page }) => {
    const tagName = uniqueName('DetachTag')
    const deckName = uniqueName('UntagDeck')

    await createDeck(page, deckName, ['field1', 'field2'], [tagName])
    await gotoDeckByName(page, deckName)
    await expectDeckShowsTag(page, tagName)

    await removeDeckTagOnEdit(page, tagName)
    await expectDeckLacksTag(page, tagName)
  })

  test('should tag a fact on add and show it in study filter', async ({ page }) => {
    const tagName = uniqueName('FactTag')
    const deckName = uniqueName('FactTagDeck')
    const front = uniqueName('TaggedFront')

    await createDeck(page, deckName)
    await gotoDeckByName(page, deckName)
    await addFact(page, [front, 'back'], [tagName])

    await page.reload()
    await expect(page.getByText(deckName, { exact: true })).toBeVisible({ timeout: 15_000 })
    await selectStudyTag(page, tagName)

    await gotoTagsPage(page)
    const row = tagRow(page, tagName)
    await expect(row.locator('td').nth(3)).toHaveText('1')
    await expect(row.locator('td').nth(4)).toContainText('fact')
  })

  test('should list tagged facts from View facts on tags page', async ({ page }) => {
    const tagName = uniqueName('ViewFacts')
    const deckName = uniqueName('ViewFactsDeck')
    const front = uniqueName('ViewFront')

    await createDeck(page, deckName)
    await gotoDeckByName(page, deckName)
    await addFact(page, [front, 'back'], [tagName])

    await openTagViewFacts(page, tagName)
    await expect(page.getByText('No facts have this tag.')).toHaveCount(0)
    await expect(page.locator(`a[href*="/decks/"]`).first()).toBeVisible()
  })

  test('should remove associations when tag is deleted but keep fact', async ({ page }) => {
    const tagName = uniqueName('CascadeTag')
    const deckName = uniqueName('CascadeDeck')
    const front = uniqueName('CascadeFront')

    // Library-first so the tag is unused and available in both deck and fact pickers.
    await createTagViaLibrary(page, { name: tagName })
    await createDeck(page, deckName, ['field1', 'field2'], [tagName])
    await gotoDeckByName(page, deckName)
    await addFact(page, [front, 'back'], [tagName])

    await deleteTagViaLibrary(page, tagName)

    await gotoDeckByName(page, deckName)
    await expectDeckLacksTag(page, tagName)
    await expect(page.getByText('Facts: 1')).toBeVisible()
    await expectFactValuesInEditor(page, [front, 'back'])

    await page.reload()
    await expect(page.locator('#study-tag-filter option', { hasText: tagName })).toHaveCount(0)
  })

  test('should reject duplicate tag names after normalization', async ({ page }) => {
    const baseName = uniqueName('DupTag')
    const duplicateName = `  ${baseName.toUpperCase()}  `

    await createTagViaLibrary(page, { name: baseName })
    await gotoTagsPage(page)
    await openTagCreateForm(page)
    await page.locator('#tag-name').fill(duplicateName)
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(page.getByText(/tag name already exists/i)).toBeVisible({ timeout: 10_000 })
    await expect(tagRow(page, baseName)).toHaveCount(1)
  })
})
