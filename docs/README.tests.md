# Tests

These test cases use the Gherkin language to define test cases in a structured language that is mostly readable by normal people. See [Test Case Key Terms](#test-case-key-terms) below for the glossary of key terms used in the test cases.

## Standard for test scenarios

When adding or changing behavior tests, the test documentation must be updated at the same time.

- If a new automated test covers a user-visible behavior that is not already described by a scenario, add the missing scenario before or with the test change.
- If the same test pattern is reused across multiple controls or components, prefer a Scenario Outline with Examples instead of repeating the same scenario.
- Keep the scenario description in user terms and match the actual control IDs/selectors used by the implementation and automated tests.
- Documentation is part of the behavior contract: a new test without a matching scenario is considered incomplete.

## End-to-end database isolation contract

Browser-driven tests must exercise the real server and database flow. To keep those tests isolated and repeatable, the server uses a per-test flow database. This keeps E2E tests real without causing cross-test contamination from shared data.

See [CODING-STANDARDS.md:End to End (e2e)](<CODING-STANDARDS.md:#end-to-end-(e2e)>) for specific rules.

The Job Postings tests verify that each browser flow starts with an empty real-server database.
Server regressions also verify that endpoints retain their selected database across async calls
and that cleaning up one flow preserves other flows. Flow IDs include a hash so the server's
length limit cannot truncate away their uniqueness.

## Key Concepts of Gherkin

Gherkin scenarios follow a **Given-When-Then** structure.

<details>
    <summary>expand to see details</summary>

| Term               | Description                                                                                                                                                                |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Feature`          | A unit of user facing functionality.                                                                                                                                       |
| `Scenario`         | Represents a specific example or use case.                                                                                                                                 |
| `Given`            | Sets the initial context or preconditions.                                                                                                                                 |
| `When`             | Specifies the action or event.                                                                                                                                             |
| `Then`             | Defines the expected outcome.                                                                                                                                              |
| `And`              | Adds additional conditions to the steps.                                                                                                                                   |
| `But`              | Adds additional conditions to the steps.                                                                                                                                   |
| `Background`       | Defines common steps shared across multiple scenarios within a Feature. Note: depending on the test parser/runner tool, this might apply for all Scenarios in a test file. |
| `Scenario Outline` | Allows running the same scenario with different data sets. Plug in variables are defined with pointy brackets (`<details >`).                                              |
| `Examples`         | A table with rows of data that can be plugged in to a Scenario Outline's plugin variables. There is a column for each plug in variable in the Scenario Outline.            |
| `Tags`             | Categorize or group features and scenarios for filtering in test execution, e.g. @smoke.                                                                                   |
| `Doc Strings`      | Allow multi-line text to be passed as input to a step without breaking formatting. Enclosed in triple quotes """. Often used for JSON, XML, or plain text content.         |

</details>

## Test Case Key Terms

<details>
    <summary>expand to see details</summary>

| Term      | Description                          |
| :-------- | :----------------------------------- |
| `Feature` | A unit of user facing functionality. |

See also: [README.md:Glossary](README.md#glossary) for general terms.

</details>

## Feature: JSA Functional

<details>
    <summary>expand to see details</summary>

The user should be able to see use it.

### Scenario: Successful navigation to the JSA

    Given the user has a web browser
    When the user types/pastes the web app's URL into their browser
    Then the JSA UI is loaded
    Then the page loads
    And the  user can see the application UI

### Scenario Outline: Expanders remember their state

The various UI components that have state, remember it so that the next time the user visits the JSA, it feels like they can pick up right where they left off.

    Given that the user is in the JSA web page

    When the user causes the state of component <Screen>:<Component>
    And navigates away from the JSA
    And navigates back to the JSA

    Then the JSA's state is restored
    And its expanded toggle state is restored
    And the user can resume their work from where they left off

    Examples:
    | Screen | Component |
    | :--- | :--- |
    | Job Postings | #job-postings--capture--container |
    | Job Postings | #job-postings--job-post-page--container |
    | Job Postings | #job-postings--formatted-content--container |
    | Job Postings | #job-postings--markdown-content--container |
    | Job Postings | #job-postings--saved-job-postings--container |
    | Resume Analyzer | #resume-analyzer--ai-prompt--container |
    | Resume Analyzer | #resume-analyzer--ai-prompt--editor--prompt--container |
    | Resume Analyzer | #resume-analyzer--ai-prompt--editor--ai-response--container |
    | Resume Analyzer | #resume-analyzer--ai-prompt--saved-ai-prompts--container |
    | Resume Analyzer | #resume-analyzer--job-description--container |
    | Resume Analyzer | #resume-analyzer--job-description--content--container |
    | Resume Analyzer | #resume-analyzer--resume--container |
    | Resume Analyzer | #resume-analyzer--resume--editor--content--container |
    | Resume Analyzer | #resume-analyzer--saved-resumes--container |
    | Resume Analyzer | #resume-analyzer--prompt-template--container |
    | Resume Analyzer | #resume-analyzer--prompt-template--editor--content--container |
    | Resume Analyzer | #resume-analyzer--saved-prompt-templates--container |

</details>

### Scenario Outline: Input components remember their state

The various UI components that have state, remember it so that the next time the user visits the JSA, it feels like they can pick up right where they left off.

    Given that the user is in the JSA web page

    When the user causes the state of component <Screen>:<Component>
    And navigates away from the JSA
    And navigates back to the JSA

    Then the JSA's state is restored
    And the value is restored
    And the user can resume their work from where they left off

    Examples:
    | Screen | Component |
    | :--- | :--- |
    | Job Postings | #job-postings--capture--url |
    | Job Postings | #job-postings--formatted-content--remove-images-toggle |
    | Job Postings | #job-postings--formatted-content--remove-buttons-toggle |
    | Resume Analyzer | #resume-analyzer--ai-prompt--ai-url |
    | Resume Analyzer | #resume-analyzer--ai-prompt--editor |
    | Resume Analyzer | #resume-analyzer--ai-prompt--editor--ai-url |
    | Resume Analyzer | #resume-analyzer--resume--editor--name |
    | Resume Analyzer | #resume-analyzer--resume--editor--job-title |
    | Resume Analyzer | #resume-analyzer--resume--editor--date |
    | Resume Analyzer | #resume-analyzer--resume--editor--id |
    | Resume Analyzer | #resume-analyzer--resume--editor--document-type |
    | Resume Analyzer | #resume-analyzer--resume--editor--content--editor |
    | Resume Analyzer | #resume-analyzer--prompt-template--editor--name |

### Scenario: Database management - startup and shutdown

The JSA uses Sqlite as its database. It is backed up to a well known directory. It is the user's responsibility to backup that directory to a durable backup of their choosing, e.g. OneDrive or Dropbox.

    Given the user uses the JSA

    When the API Server starts up

    Then it copies the database from the Cloud Backup Database Directory to the Local Database Directory

    When the API Server shuts down

    Then it copies the database from the Local Database Directory to the Cloud Backup Database Directory

### Scenario: Database management - AI prompt details are preserved

    Given an AI prompt has a name, AI provider name, URL, and related records
    When the AI prompt and its documents are saved
    Then the create response includes the AI provider name
    And the saved AI prompt is retrieved
    Then its name, AI provider name, URL, and related record IDs are preserved

### Scenario: Database management - AI prompt update timestamp

    Given an AI prompt has been saved with all required details
    When its name is changed after the original save timestamp
    Then its database update timestamp advances

### Scenario: Database management - daily backups

The JSA has a simple strategy to be able to restore the database to an earlier point in time. It maintains a daily backup per day that the JSA runs.

    Given the user uses the JSA

    When the API Server shuts down

    Then it makes a backup copy in the Cloud Backup Database Directory with a timestamp at the end of the file name, to make each backup unique
    And only one daily backup is maintained, the latest daily backup of the day

### Scenario: Database management - data export

The JSA has the ability to export records in a structured format.

    Given the User is on the DB Viewer tab

    When the User presses the Export button, to the right of the Refresh button

    Then the JSA presents the User with a list of Entity rows to select for export

    When the User makes the selections they want
    And presses the confirmation button

    Then the JSA exports a JSON document with the selected records and their child records

    When the User presses the Cancel button, to the right of the confirmation button, instead of the confirmation button

    Then the selection list disappears

### Scenario: Database management - data import

The JSA has the ability to import data, in the same data format as the export format.

    Given the User is on the DB Viewer tab

    When the User presses the Import button, to the right of the Export button

    Then the JSA presents the user with a file selection dialog

    When the user selects a file to import
    And presses the confirmation button

    Then JSA imports the file's data
    And the imported records are assigned new database-generated IDs
    And the User sees a list that highlights the imported records

### Scenario Outline: Enumerated fields are rendered as dropdowns in edit forms

The DB Viewer editor uses the domain model's enum values to present a constrained selector instead of free-form text so the user can only choose valid values.

    Given the user is on the DB Viewer tab
    And there is a saved <Entity> record in the database

    When the user opens the edit form for that record

    Then the <Field> control is displayed as a dropdown
    And the dropdown includes the allowed values for that enum
    And the selected value matches the saved record

    Examples:
    | Entity | Field | Allowed values |
    | :--- | :--- | :--- |
    | Job Posting | Work Model | Unknown, Remote, InOffice, Hybrid |
    | Job Application | Status | Unknown, Draft, Saved, Applied, Interviewing, Offer, Accepted, Rejected, Withdrawn, Ghosted, Other |

</details>

## Feature: Job Postings

<details>
    <summary>expand to see details</summary>

The user is able to capture and track Job Postings.

Automated navigation and capture use a shared extension-bridge simulator that opens
and reads a real browser tab containing a deterministic job posting fixture. The
application's extraction, rendering, and server/database calls run normally. These
tests do not verify installation or execution of the packaged browser extension,
or availability of the live Indeed posting.

### Scenario: Navigate to the Job Postings screen

    Given the user is using the JSA

    When the user clicks on the Job Postings tab

    Then the page content will change to display the Job Postings screen

### Scenario: Navigate to a job posting

    Given the user is on the Job Postings screen

    When the user types/pastes the URL, `https://www.indeed.com/viewjob?jk=455de5af61ae4e7a`, into the URL textbox
    And clicks on the Go button

    Then the browser will open a new tab to the job posting URL
    And the focus will be placed on the new tab so that the user can see the job posting

### Scenario: Capture a job posting

    Given the user is on the Job Postings screen
    and there is an open tab to the URL in the URL textbox

    When the user clicks on the Capture button

    Then the job posting will be copied from the job posting page/tab
    And the job posting page will be visible in the Job Post Page display
    And the extracted job posting content will be viewable in the Formatted Content display, with the original formatting, to make it easier for the user to compare the original content to the extracted content
    And the extracted job posting content will be viewable in the Markdown Content display, in markdown format, to be easy to handle as text data

### Scenario: Save a captured job posting

    Given the user has captured a job posting on the Job Postings screen
    When the user clicks Save
    Then the server creates the posting and its document in the test flow database
    And the Saved Job Postings section displays its title and company
    When the user reloads the page
    Then the saved posting is still displayed

### Scenario: Refresh Job Postings list

    Given the user is on the Job Postings screen
    And the Saved Job Postings section is expanded
    And there are saved job postings stored in the database

    When the user clicks the Refresh button

    Then the button will request the saved job postings from the server
    And the list of saved job postings will reload from the database
    And each saved posting will be displayed with its company, title, work model, and salary information

</details>

## Feature: Resume Analyzer

<details>
    <summary>expand to see details</summary>

The user is able to analyze whether they are qualified for a job posting and how to tailor their resume to the job posting.

### Scenario: Navigate to the Resume Analyzer screen

    Given the user is using the JSA
    And is on the Job Postings screen

    When the user clicks on the Resume Analyzer tab

    Then the page content will change to display the Resume Analyzer screen

</details>

## Feature: Job Applications

<details>
    <summary>expand to see details</summary>

The job searcher at some point has to apply to open positions to get a job.

### Scenario: Navigate to the Job Applications screen

    Given the user is using the JSA

    When the user clicks on the Job Applications tab

    Then the page content will change to display the Job Applications screen

### Scenario: Saved Applications expander starts empty

    Given the user is on the Job Applications screen
    And the Job Applications tab is selected

    When the user views the Saved Applications section

    Then the Saved Applications expander label is visible
    And the saved applications list is collapsed by default
    When the user expands the Saved Applications section
    Then the section displays the empty state message: "No saved job applications yet."

### Scenario: Saved Applications expander loads saved job applications from the real server

    Given the user is on the Job Applications screen
    And the test flow database contains a saved job source and job posting
    And the test flow database contains a saved Job Application record

    When the user expands the Saved Applications expander

    Then the saved job applications list becomes visible
    And the list displays the company name, role title, and current status for each saved application
    And the data reflects the real server record, not an earlier shared database state

### Scenario: Saved Applications displays an applied date without timezone drift

    Given a saved application has an applied date of "2026-09-15"
    And the browser uses the America/Los_Angeles timezone and en-US locale
    When the user expands that application in the Saved Applications section
    Then its applied date is displayed as "Sep 15, 2026"
    When the user opens its editor
    Then the Applied On date input contains "2026-09-15"

### Scenario: The saved application editor appears inline with the matching record

    Given the Saved Applications section contains two applications
    When the user clicks Edit for one application
    Then that application's editor replaces its display within the same record row
    And the other application remains in display mode

### Scenario: The saved application editor uses shared form controls

    Given the user opens a saved application's editor
    Then the editor uses the shared entity-editor styling
    And its Id is read-only
    And its company, role, applied date, status, and related record ID fields are visible
    And Status is a dropdown with all allowed application statuses
    And its selected status matches the saved record
    And Save uses the primary button styling

### Scenario: The saved application editor displays its linked records

    Given a saved application references a job source and job posting
    When the user opens that application's editor
    Then the source name is displayed beneath its Source Id field
    And the job posting is displayed beneath its Job Posting Id field
    And the linked displays have no Edit or Delete buttons

### Scenario: Editing a saved application persists only the changed fields

    Given the user opens a saved application's editor
    When the user changes its company and clicks Save
    Then the PATCH request contains only the changed company
    And unchanged linked records and server-generated timestamps are not submitted
    And the editor closes after a successful save
    And the saved row displays the changed company
    When the user reloads the page and opens Saved Applications
    Then the changed company is still displayed

### Scenario: Partial updates preserve IDs for changed linked records

    Given an editable record is cloned from a saved record
    When a partial update is computed without changing any values
    Then the partial update is empty
    When a linked record's name changes
    Then the partial update includes only that linked record's Id and changed name
    And its unchanged server-generated timestamps are omitted
    When a note is also changed
    Then the changed notes list is included in the partial update

### Scenario Outline: Saved Applications use the per-test database flow

    Given the user is on the Job Applications screen
    And the browser request includes a unique <TestFlowId>

    When the server receives the request

    Then the request is routed to the disposable database for that test flow
    And any saved application data in that database is isolated from other test runs
    And the test cleanup removes the temporary database for that flow after the scenario completes

    Examples:
    | TestFlowId |
    | X-JSA-Test-Flow |
    | jsa_test_flow |

</details>

## Feature: DB Viewer

<details>
    <summary>expand to see details</summary>

The Database Viewer allows the User to view the various tables in the database and edit them if need be.

### Scenario: Adding an existing question pair to an application persists its shared reference

    Given a saved question with question "fdsa" and answer "asdf"
    And a saved Job Application without questions
    And the user is editing that application in the DB Viewer

    When the user adds question "fdsa" and answer "asdf"
    And the user saves the application

    Then the save succeeds even when questions are the only changed field
    And the application displays the saved question and answer after refresh
    And the existing question is reused without creating a duplicate
    And the question displays a Referenced By link to the application

    Question rows and application-question links are saved in the same transaction.
    Repeating a save does not duplicate links. Removing a question from an application
    removes only its link, preserving the shared question. An invalid question rolls
    back all changes to the application, questions, and links.

### Scenario: Navigate to the DB Viewer screen

    Given the user is using the JSA

    When the user clicks on the DB Viewer tab

    Then the page content will change to display the DB Viewer screen

### Scenario Outline: Entities visible in the DB Viewer

There are various entities that the JSA tracks. Each of them is visible in the DB Viewer.

    Given the user is using the JSA

    When the user opens the DB Viewer tab

    Then the user sees the <Entity> display
    And the <Entity> display is an expander
    And the expander displays:
        the name of the entity,
        the number of saved entity records,
        a refresh button to get the latest list of saved records,
        a list of the saved records

    Examples:
    | Entity |
    | Job Posting |
    | Resume |
    | AI Prompt Template |
    | AI Prompts |

### Scenario Outline: Entity lists display data

    Given the user is on the DB Viewer tab

    When the user expands an <Entity> expander

    Then the user sees the list of saved <Entity> records

    Examples:
    | Entity |
    | Job Posting |
    | Resume |
    | AI Prompt Template |
    | AI Prompts |

### Scenario Outline: Entity list items are expandable

The records are taking up a lot of visual space. When there are many records, it becomes difficult for a User to make sense things because there is too much visual noise.

    Given the user is on the DB Viewer tab

    When the user expands an <Entity> expander

    Then the user sees the list of saved <Entity> records
    And each record is displayed in an expander
    And the expander starts collapsed
    And the first line of information in the list item is visible when the record expander is collapsed

    Examples:
    | Entity |
    | Job Posting |
    | Resume |
    | AI Prompt Template |
    | AI Prompts |

### Scenario Outline: Entities link to referenced entities

    Given one record (<parent>) that references another record (child)
    And the user is vieweing the list of parent records
    And the parent record has a link that to the child record
    And the parent record does not have a link to itself

    When the user clicks on the link to the child record

    Then the list of child records is expanded, if needed
    And the child record is scrolled into view if it is not already in view
    And the child record is expanded if it is currently collapsed
    And the child has a transition animation to identify it as the target record

    Examples:
    | parent |
    | Job Posting |
    | Resume |
    | AI Prompt Template |
    | AI Prompts |

### Scenario Outline: Referenced records show incoming references in the Referenced By section

    Given a <TargetEntity> record that has one or more incoming references
    And the user is viewing the referenced record in the DB Viewer

    Then the record displays a Referenced By section
    And the record lists each incoming referencing record as a link

    When the user clicks one of the referencing record links

    Then the corresponding referencing record's entity expander opens
    And the referencing record is brought into view

    Examples:
    | TargetEntity | ReferencingEntity |
    | Job Posting | AI Prompt |
    | Job Posting | Job Application |
    | Resume | AI Prompt |
    | AI Prompt Template | AI Prompt |
    | Job Source | Job Application |
    | Job Question | Job Application |

    A target record may legitimately have more than one incoming reference type.
    For example, a Job Posting may be referenced by both AI Prompt and Job Application records.
    Job Applications reference saved questions through their Questions collection; questions do not contain a JobApplicationId field.

### Scenario Outline: Entity lists can refresh data

    Given the user is on the DB Viewer tab

    When the user presses the refresh button for the <Entity> listing

    Then the user sees the latest list of saved <Entity> records
    And the <Entity>'s info is displayed
    And there is an Edit button at the right side of the record

    Examples:
    | Entity |
    | Job Posting |
    | Resume |
    | AI Prompt Template |
    | AI Prompts |

### Scenario Outline: Entities are editable

    An Entity display's content has two segments: the top is a card that has edit fields for the <Entity>'s fields.

    Given the user is on the DB Viewer tab
    And the user has the <Entity> display expanded
    And the user can see the saved records list

    When the user clicks the Edit button on a list item

    Then the record's display components are replaced by edit components
    And the edit components start with the record's current data
    And the Edit button is replaced by a Save button and Cancel button
    And the Save button has a primary button look and feel

    When the user clicks on the Save button

    Then the edit components are replaced by the display components
    And the Save and Cancel buttons are replaced by the Edit button
    And the record is updated with the new data
    And the updated data is displayed in the display components

    Examples:
    | Entity |
    | Job Posting |
    | Resume |
    | AI Prompt Template |
    | AI Prompts |

### Scenario Outline: Documents are editable

    Some entities have documents that the entity represents, but the data is structured where the document is a foreign key reference. For those entities, the document is editable as part of the entity's editor UI.

    Given an <Entity> that has a directly-attached <Document> that is referenced as a foreign key reference

    When the user presses the Edit button

    Then the document is editable

    When the user presses the save button

    Then the updates to the document are saved

    Examples:
    | Entity | Document property |
    | Job Posting | Document |
    | Resume | Document |
    | AI Prompt Template | Document |
    | AI Prompts | PromptDocument |
    | AI Prompts | ResponseDocument |

### Scenario Outline: Entity edits can be cancelled

    A user may decide not to keep their changes after opening an entity editor.

    Given the user is on the DB Viewer tab
    And the user has the <Entity> display expanded
    And the user has opened an entity editor for a saved record
    And the user has made changes to some of the fields in the edit components

    When the user clicks on the Cancel button

    Then no changes are made to the record
    And the original values remain in the record display
    And the edit components are replaced with display components
    And the top of the record line item is scrolled into the viewport, if it isn't already visible

    Examples:
    | Entity |
    | Job Posting |
    | Resume |
    | AI Prompt Template |
    | AI Prompts |

### Scenario Outline: Entities can be deleted

    Given the user is on the DB Viewer tab
    And the <Entity> section is expanded
    And records are visible
    And each record has a Delete button, to the right of the Refresh button

    When the user presses the Delete button

    Then the user is asked to confirm that they really want to delete the record
    And if the <Entity> has any foreign key references to other entities, the user is given a list of referenced objects to include in the deletion

    When the user presses the Delete button on the confirmation screen

    Then the record is deleted on the server
    And the record is no longer visible in the list

    Examples:
    | Entity |
    | Job Posting |
    | Resume |
    | AI Prompt Template |
    | AI Prompts |

### Scenario Outline: Entity deletion can be cancelled

    Given the user is on the DB Viewer tab
    And the confirmation dialog for deleting an <Entity> record is open

    When the user presses the Cancel button in the confirmation screen

    Then the confirmation screen is removed
    And the record is left intact

    Examples:
    | Entity |
    | Job Posting |
    | Resume |
    | AI Prompt Template |
    | AI Prompts |

### Scenario Outline: Entity deletion failure due to foreign key constraint

    Given the user in on the DB Viewer tab
    And the confirmation dialog for deleting an <Entity> record is open

    When the user presses the Cancel button in the confirmation screen
    And the record deletion has failed on the server due to the record having an incoming foreign key reference that prevented the deletion

    Then the user is shown a notification screen that informs them that the record cannot be deleted because it is being referenced by other records

### Scenario: Daily backups

    Given the User is on the DB Viewer tab
    And the User sees the DB Backups expander section

    When the User expands DB Backups section

    Then the User can see a list of the database's daily backups
    And a Create Snapshot button, to the left of the Refresh button

    When the User presses the Create Snapshot button

    Then the JSA creates a new daily snapshot of the database

    NOTE: Not yet, but for future features:
    1. Load a backup to view the content in it
    2. Restore a backup to overwrite the current database

</details>
