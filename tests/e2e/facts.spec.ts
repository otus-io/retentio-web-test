import { test, expect } from '@playwright/test'
import {
  addFact,
  createDeck,
  createTagViaLibrary,
  deleteTagViaLibrary,
  expectFactValuesInEditor,
  gotoDeckByName,
  skipUnlessE2ECredentials,
  uniqueName,
} from './helpers'

test.describe('Facts', () => {
  test.beforeEach(() => {
    skipUnlessE2ECredentials()
  })

  test('should create a deck and add a fact', async ({ page }) => {
    const deckName = uniqueName('FactDeck')
    const front = uniqueName('Front')
    const back = uniqueName('Back')

    await createDeck(page, deckName)
    await gotoDeckByName(page, deckName)
    await addFact(page, [front, back])

    await page.reload()
    await expect(page.getByText(deckName, { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Facts: 1')).toBeVisible()
    await expectFactValuesInEditor(page, [front, back])
  })

  test('should create multiple facts', async ({ page }) => {
    const deckName = uniqueName('MultiFact')
    const first = uniqueName('One')
    const second = uniqueName('Two')

    await createDeck(page, deckName)
    await gotoDeckByName(page, deckName)
    await addFact(page, [first, 'a'])
    await addFact(page, [second, 'b'])

    await expect(page.getByText('Facts: 2')).toBeVisible()
    await expectFactValuesInEditor(page, [first, 'a', second, 'b'])
  })
})

test.describe('Tags then facts', () => {
  test.beforeEach(() => {
    skipUnlessE2ECredentials()
  })

  test('should create tag, create deck with fact, then delete tag', async ({ page }) => {
    const tagName = uniqueName('FlowTag')
    const deckName = uniqueName('FlowDeck')
    const front = uniqueName('FlowFront')

    await createTagViaLibrary(page, { name: tagName })
    await createDeck(page, deckName)
    await gotoDeckByName(page, deckName)
    await addFact(page, [front, 'back'])

    await deleteTagViaLibrary(page, tagName)
    await gotoDeckByName(page, deckName)
    await expect(page.getByText('Facts: 1')).toBeVisible()
    await expectFactValuesInEditor(page, [front, 'back'])
  })
})
