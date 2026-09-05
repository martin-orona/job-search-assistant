import { test, expect } from '@playwright/test'
import { generateExpanderStateTests, generateInputStateTests } from './helpers'

test.describe('Feature: Resume Analyzer', () => {
      test.describe('Scenario: Expander restores its toggled state', ()=>{
      (()=>generateExpanderStateTests([
          '#resume-analyzer--ai-prompt--container',
          '#resume-analyzer--ai-prompt--editor--prompt--container',
          '#resume-analyzer--ai-prompt--editor--ai-response--container',
          '#resume-analyzer--ai-prompt--saved-ai-prompts--container',
          '#resume-analyzer--job-description--container',
          '#resume-analyzer--job-description--content--container',
          '#resume-analyzer--resume--container',
          '#resume-analyzer--resume--editor--content--container',
          '#resume-analyzer--saved-resumes--container',
          '#resume-analyzer--prompt-template--container',
          '#resume-analyzer--prompt-template--editor--content--container',
          '#resume-analyzer--saved-prompt-templates--container',
      ], 'Resume Analyzer'))();
    });

    test.describe('Scenario: Input restores its value', ()=>{
        (() => generateInputStateTests([
            '#resume-analyzer--ai-prompt--ai-url',
            '#resume-analyzer--ai-prompt--editor--ai-url',
            '#resume-analyzer--resume--editor--name',
            '#resume-analyzer--resume--editor--job-title',
            '#resume-analyzer--resume--editor--date',
            '#resume-analyzer--resume--editor--id',
            '#resume-analyzer--resume--editor--document-type',
            '#resume-analyzer--resume--editor--content--editor',
            '#resume-analyzer--prompt-template--editor--name',
          ], 'Resume Analyzer'))();
    });

  test('Scenario: Navigate to the Resume Analyzer screen', async ({ page }) => {
    // Given the user is using the JSA
    await page.goto('/')
    const resumeAnalyzerTab = page.getByRole('tab', { name: 'Resume Analyzer' })
    const jobPostingsTab = page.getByRole('tab', { name: 'Job Postings' })

    await expect(jobPostingsTab).toHaveAttribute('aria-selected', 'true')
    await expect(resumeAnalyzerTab).toHaveAttribute('aria-selected', 'false')

    // When the user clicks on the Resume Analyzer tab
    await resumeAnalyzerTab.click()

    // Then the page content will change to display the Resume Analyzer screen
    await expect(resumeAnalyzerTab).toHaveAttribute('aria-selected', 'true')
    await expect(jobPostingsTab).toHaveAttribute('aria-selected', 'false')

    const heading = page.getByRole('heading', { name: 'Resume Analyzer', level: 1 })
    await expect(heading).toBeVisible()

    const aiPromptSummary = page.locator('.ai-prompt-container > summary')
    await expect(aiPromptSummary).toBeVisible()
    await expect(aiPromptSummary).toHaveText('AI Prompt')
  })
})
