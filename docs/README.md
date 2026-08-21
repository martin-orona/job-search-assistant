This is a utility that helps the user track their job applications.

It starts with allowing a user to copy the link to a OneNote paragraph and uses the information in the clipboard to update an Excel table, per [README.Excel-writer.md](README.Excel-writer.md).


Note: There was a failed attempt to get data directly from OneNote, but the development computer wasn't configured with the correct COM registrations for local notebook access and the online notebook API errored out with a 500 status code when reading the desired notebook page. See [README.OneNote-reader.md](README.OneNote-reader.md)

## Applications clipboard workflow

Writing to Excel requires a date context. Copy a date in `yyyymmdd` format, optionally followed by the day name, or enter it manually and set it in the Applications UI before copying a paragraph.

Each paragraph is identified by its OneNote paragraph link/object identifier, not by its displayed text. Copying the same paragraph again does not add a duplicate row; if its copied text differs, the existing row text is updated through the first newline.

When OneNote provides a truncated link text followed by a separate full-text clipboard copy, the full text is matched as a longer prefix of the current-date row and replaces the existing row text through the first newline. Different OneNote paragraph identifiers remain distinct even when their displayed text is identical.

The listening workflow is:

1. Copy the date to set the date context.
2. Copy a paragraph link to add the linked paragraph to Excel.
3. Copy the full paragraph text to complete the existing Excel entry.

# Develop in small steps

## Job Application Tracker

AI prompts
1. Let's start very simply. Create a desktop app that has one button. When the button is pressed, it displays the content of the clipboard. I expect the clipboard contents to be complex, so I want to see all of it so that I can choose what parts to use and what parts to ignore.

2. Add a button to clear the display

3. Add a word wrap toggle so that I don't have to scroll sideways all the time.

4. The `Format: OneNote Link` looks good. It has a link to a OneNote paragraph and the text of the paragraph.

   Example:

   ```text
   <!--StartFragment--><a
   href="onenote:https://d.docs.live.net/<ACCOUNT_ID>/onenote%20notebooks/<notebook-store>/<NotebookName>/<UserName>.one#<PageTitle>&amp;section-id={<SECTION_ID>}&amp;page-id={<PAGE_ID>}&amp;object-id={<OBJECT_ID>}&amp;CC">[Example Role] Example Job Title</a><!--EndFragment-->
   ```

   The `<a>` element has the link to the paragraph in the `href` property and its content is the text of the paragraph.

   Give the current display textbox a label, "Clipboard Contents".
   Add a new display textbox above the clipboard contents display; label it "Clipboard Link".

5. Change the label from "Clipboard Link" to "OneNote Link".

   Set word wrap on by default.

   In the link display, add a section for "Paragraph text" and one for "Paragraph link", to make it easy for the user to see what OneNote infor the have in the clipboard. If there is no "OneNote Link" in the clipboard, display "The clipboard doesn't contain a OneNote Link. Please copy the link to a paragraph and try again.".

6. Change the label from "Show Clipboard" to "Read Clipboard".

7. Add a button labeled "Write to Excel".

   When pressed, this button will:
   1. Do the equivalent of pressing the "Read Clipboard" button.
   2. Write the paragraph text to the currently selected Excel cell, with a hyperlink containing the paragraph link to OneNote.

8. In the active Excel file, look for a table named "Applications".

   Add an entry to the bottom of the table.

   Find the "OneNote Link" column and add the link from OneNote to that column in the newly added row.

   Copy the formulas from the previous row for columns "Application Number", "Date", "Day of Week", "Company", and "Job".

9. For the cell formulas being copied from the previous row: if it contains a "raw value", e.g. 20260803 for the "Date", do not copy it; if it contains a formula, update it so that it makes sense in the context of the new row rather than the old row, e.g. `=A187 + 1` -> `=A188 + 1`, e.g. `=TEXT( DATE(LEFT($B188,4), MID($B188,5,2), RIGHT($B188,2)), "dddd")` -> `=TEXT( DATE(LEFT($B189,4), MID($B189,5,2), RIGHT($B189,2)), "dddd")`.

10. Instead of popping up a dialog that indicates success. Add a status indicator to the OneNote Link display.

      Set the focus to Excel while working with it so that the user can see the update to Excel and gain confidence that way.

11. I said to set the focus to Excel while working with it so that the user can see the changes as they happen.

12. Now add a new ability: start a listening mode where each copy to the clipboard will behave as if the "Write to Excel" button was pressed. This listening mode needs to be able to be stopped.

      Do you think a toggle button would be a good UI for that?

13. If the copy to clipboard copies text in the format `<yyyymmdd>[ ][ddd]`, it will extract the date `yyyymmdd` and use it for the "Date" column for new rows until a new date is copied to the clipboard. The date will be displayed with a label "Date" in the OnteNote link display.

14. The format had an optional space and day portion. The following values are valid and should capture the same date value: `20260808`, `20260808 `, and `20260808 Saturday`

15. Add a new guard condition: If the same paragraph is copied, do not add a new entry. If it is expensive to search all existing paragraphs in the table, check only the entries for the current date.

16. That didn't work, I copied the same paragraph multiple times and saw new duplicate entries added. This was with a date in context

17. That seemed to work, once.

      I copied a date, copied a paragraph, a row was added, I copied the same paragraph again and saw a duplicate message in the UI with now new row added.

      Then I copied the next paragraph, a new row was added, I copied the original/previous paragraph, a new row was added, I copied the same paragraph several times and each one added a new row.  

18. Also add a requirement to have a date context. If there isn't one, ask the user to copy one or enter one manually into the UI.

19. When a duplicate is detected, if the paragraph text is different update the existing entry's paragraph text.

20. It turns out that for long paragraphs, OneNote doesn't copy the whole text of the paragraph; it truncates the text, which causes the Excel table to have a partial entry when compared to the original.

      The fix is that after a paragraph is copied and added to Excel, if there is a text copy that starts with the same text as the paragraph, update the text in Excel.

      The workflow will be:

      1. action: copy the date

         result: the date context is set for subsequent copies

      2. action: copy the link to a paragraph

         result: Excel is updated with a copy of the paragraph text linking to the original paragraph so that when a user clicks on the link in Excel, they are automatically taken to the original paragraph in OneNote

      3. action: copy the full text of the paragraph

         result: The Excel entry will be updated so that the text is the full text of the paragraph in OneNote.

21. When updating the text of a paragraph, stop at the first new line.

22. There is a bug in duplicate detection. There are some job entries that are being falsely recognized as duplicates because the text is the same, even though the paragraph links are different. The logic should detect duplicates based on their OneNote paragraph link, not the text. Multiple paragraphs are allowed to have the same text, but each paragraph gets a unique ID.

23. Have the application window remember its location so that it comes back to the same place it closed from.

## Resume Analyzer

AI Prompts:

1. The current functionality is focused on tracking job applications. I want to add distinct functionality. Let's start by adding a tabbed interface. Put the current functionality into tab "Applications". Add tab "Resume Analyzer".

2. Now to work with the Resume Analyzer feature.

   1. Add a toolbar that includes
      1. a button labeled "Merge"
   1. Add a display for the resume content:
      1. make it a collapsible panel, labeled "Resume", that includes
      1. a file path that will be remembered across app invocations, like the window placement
      1. a button to select a different file
      1. a collapsible panel, labeled "Resume", that includes the resume file's content
   1. Add a display for the job description:
      1. make it a collapsible panel, labeled "Job Description", that includes
      1. a file path that will be remembered across app invocations, like the window placement
      1. a button to select a different file
      1. a collapsible panel, labled "Description", the includes the job description file's content
   1. Add a display for the AI prompt template
      1. make it a collapsible panel, labeled "AI Prompt Template", that includes
      1. a file path that will be remembered across app invocations, like the window placement
      1. a button to select a different file
      1. a collapsible panel, labled "Template", the includes the job description file's content
   1. Add a display for the generated AI prompt
      1. make it a collapsible panel, labeled "AI Prompt", that includes
      1. a button labeled "Generate Prompt" - when the button is pressed
         1. the AI prompt template will be merged with the resume and job description
            1.The AI prompt template has replacement variables
            1. `[YOUR RESUME HERE]` - to be replaced by the content of the resume text
            1. `[JOB DESCRIPTION HERE]` - to be replaced by the content of the job description text
         1. the generated text will be copied to the "Template" textbox
         1. the generated text will be copied to the clipboard
      1. a button labeled "Copy Prompt" - when pressed, the text from the "Template" textbox will be copied to the clipboard
      1. a collapsible panel, labled "Template", the includes a textbox that holds the generated AI prompt

3. Next to button "Copy Prompt", add button "Open AI".
Next to the "Open AI" button add a textbox that will hold a URL that will be remembered.

## Job Listing Manager

The Job Listings Manager will gather a job listing from a web page and make it available for candidate match analysis by the Resume Analyzer.

AI Prompts:

1. Add a new tab to the MAUI UI. Label it "Job Listings".

   Add a button labeled "Extract".

   When the Extract button is pressed, the job listing will be extracted from the current page, and stored.

   The format of the job listing will vary by website.

   For **Indeed.com**:
   1. A job listing is contained by an element with CSS Class `jobsearch-JobComponent`
   2. The job listing header element has a class name of `jobsearch-InfoHeaderContainer`
   3. The job details element has a class name of `jobsearch-BodyContainer`
   4. The job descriiption element has a class name of `jobsearch-JobComponent-description`
   5. The actual job description element has a class name of `jobsearch-JobComponent-description`

   For now, store the job description in a markdown file titled `<company name> - <job title> - <date\:yyyymmdd> - <local | remote>.md`

   The company name is found at `.jobsearch-InfoHeaderContainer [data-testid="jobsearch-CompanyInfoContainer"] [data-company-name="true"][data-testid="inlineHeader-companyName"]`

   A remote job lists "Remote" in the location at `.jobsearch-InfoHeaderContainer [data-testid="inlineHeader-companyLocation"]`

   **NOTE:** The AI (GPT 5.6 Luna) generated a tab and a web viewer so that I could see the page that is being worked with. I like it.

2. Add an expander around the page viewer, label it "Listing Page".

   Add another expander, labeled "Extracted Job Listing".

      Inside the container add a label for the file's path, a button labeled "Open" which will launch the file in the default editor, and a textbox to hold the extracted content, include this last textbox in its own expander.  This will look like the visual pattern in the Resume Analyzer screen.

3. Add a "Copy to Clipboard" button to the left of the file path textbox. When pressed, the content from the extracted textbox will be copied to the clipboard.

4. I want to be able to copy both the markdown text version and the formatted version of the job posting. Add a button labeled "Markdown to Clipboard". The "Markdown to Clipboard" button will copy the markdown text to the clipboard. The "Copy to Clipboard" button will copy the formatted text to the clipboard.
