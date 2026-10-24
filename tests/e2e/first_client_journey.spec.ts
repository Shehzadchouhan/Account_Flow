import { test, expect } from '@playwright/test'

/**
 * COMPLETE FIRST CLIENT ONBOARDING & FULL WORKFLOW TEST
 * Tests the entire application through the eyes of a real CA / Accounts firm client.
 */

test.describe('First Client End-to-End Experience', () => {

  test('Complete Client Journey: Login -> Dashboard -> Firms -> Cases -> Dispatch -> Reports -> Admin', async ({ page }) => {
    // =========================================================================
    // 1. LOGIN & BRANDING EXPERIENCE
    // =========================================================================
    await page.goto('/login')
    await expect(page.locator('h1')).toContainText('Accounts Office Portal')
    
    // Fill credentials
    await page.fill('input#email', 'amit.mehta@financeflow.local')
    await page.fill('input#password', 'Password123!')
    await page.click('button:has-text("Sign In")')

    // Verify redirected to Dashboard
    await page.waitForURL('**/')
    await expect(page.locator('aside').getByRole('link', { name: /FinanceFlow/i })).toBeVisible()
    await expect(page.locator('text=Priority Alerts')).toBeVisible()

    // =========================================================================
    // 2. DASHBOARD OVERVIEW & HOW IT WORKS MODAL
    // =========================================================================
    // Check metric cards exist
    await expect(page.locator('text=Client Firms').first()).toBeVisible()
    await expect(page.locator('text=Needs Attention').first()).toBeVisible()

    // Test "How It Works" interactive workflow guide modal
    const howItWorksBtn = page.locator('button:has-text("How FinanceFlow Works")').first()
    if (await howItWorksBtn.isVisible()) {
      await howItWorksBtn.click()
      await expect(page.locator('h2#how-it-works-title')).toBeVisible()
      // Close modal with Escape key
      await page.keyboard.press('Escape')
    }

    // =========================================================================
    // 3. FIRMS DIRECTORY (/firms) & CREATE NEW FIRM
    // =========================================================================
    await page.goto('/firms')
    await expect(page.locator('h1')).toContainText('Client Directory')
    await expect(page.locator('table tbody tr').first()).toBeVisible()

    // Create a new client firm
    const addFirmBtn = page.locator('a:has-text("Add Client"), a:has-text("Add Firm"), a:has-text("New Firm"), a[href*="/firms/new"]').first()
    await addFirmBtn.click()
    await page.waitForURL('**/firms/new')

    const testFirmName = `Omkar Enterprises ${Date.now().toString().slice(-4)}`
    await page.fill('input[name="name"]', testFirmName)
    await page.fill('input[name="contact_person"]', 'Vikram Seth')
    await page.fill('input[name="contact_email"]', 'vikram@omkar.fake')
    await page.fill('input[name="contact_phone"]', '+91 98200 11223')
    await page.click('button:has-text("Create Firm")')

    // Wait for creation & verify in directory
    await page.waitForTimeout(3000)
    await page.goto('/firms')
    await expect(page.locator(`table tbody`).getByText(testFirmName)).toBeVisible()

    // =========================================================================
    // 4. CASES DIRECTORY (/cases) & INSPECTION
    // =========================================================================
    await page.goto('/cases')
    await expect(page.locator('h1')).toContainText('Cases')
    await expect(page.locator('table tbody tr').first()).toBeVisible()

    // Click on a case detail (first available row)
    const firstCaseLink = page.locator('table tbody a[href^="/cases/"]').first()
    const caseHref = await firstCaseLink.getAttribute('href')
    expect(caseHref).toBeTruthy()
    await page.goto(caseHref!)

    // Check Case Detail view elements
    await expect(page.locator('text=Checklist').first()).toBeVisible()
    await expect(page.locator('text=Receipt Details').first()).toBeVisible()
    await expect(page.locator('text=Scan / PDF').first()).toBeVisible()

    // =========================================================================
    // 5. PENDING WORK QUEUE (/pending)
    // =========================================================================
    await page.goto('/pending')
    await expect(page.locator('h1')).toContainText('Pending Work')
    await expect(page.locator('select#firm_id')).toBeVisible()
    await expect(page.locator('select#status')).toBeVisible()
    await expect(page.locator('table').first()).toBeVisible()

    // =========================================================================
    // 6. OUTWARD DISPATCHES REGISTER (/dispatches)
    // =========================================================================
    await page.goto('/dispatches')
    await expect(page.locator('h1')).toContainText('Dispatches')
    await expect(page.locator('table').first()).toBeVisible()

    // =========================================================================
    // 7. REPORTS & EXPORTS (/reports)
    // =========================================================================
    await page.goto('/reports')
    await expect(page.locator('h1')).toContainText('Reports & Exports')
    await expect(page.locator('text=Pending Documents').first()).toBeVisible()
    await expect(page.locator('text=Dispatch History').first()).toBeVisible()

    // =========================================================================
    // 8. ADMIN PANELS: USERS & ACTIVITY LOG
    // =========================================================================
    await page.goto('/admin/users')
    await expect(page.locator('h1')).toContainText('Team Members')
    await expect(page.locator('text=CA Amit Mehta').first()).toBeVisible()
    await expect(page.locator('text=Rahul Sharma').first()).toBeVisible()

    // Check Activity Log
    await page.goto('/admin/activity')
    await expect(page.locator('h1')).toContainText('Activity & Audit Log')
    await expect(page.locator('table').first()).toBeVisible()
  })

})
