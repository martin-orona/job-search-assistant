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

</details>

## Feature: Job Postings

<details>
    <summary>expand to see details</summary>

The user is able to capture and track Job Postings.

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
    And the extracted job posting content will be viewable in the Fromatted Content display, with the original formatting, to make it easier for the user to compare the original content to the extracted content
    And the extracted job posting content will be viewable in the Markdown Content display, in markdown format, to be easy to handle as text data

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

## Feature: DB Viewer

<details>
    <summary>expand to see details</summary>

The Database Viewer allows the User to view the various tables in the database and edit them if need be.

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

### Scenario Outline: Entities link to referenced entities

    Given one record (<parent>) that references another record (child)
    And the user is vieweing the list of parent records
    And the parent record has a link that to the child record
    And the parent record does not have a link to itself

    When the user clicks on the link to the child record

    Then the list of child records is expanded, if needed
    And the child record is scrolled into view if it is not already in view
    And the child has a transition animation to identify it as the target record

    Examples:
    | parent |
    | Job Posting |
    | Resume |
    | AI Prompt Template |
    | AI Prompts |

### Scenario: Referenced records link back to referencing records

    Given one record (parent) references another record (child)
    And the user is viewing the referenced record in the DB Viewer

    Then the record displays the referencing record in a Referenced By list

    When the user clicks the referencing record link

    Then the referencing record's entity expander opens
    And the referencing record is brought into view

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

    And When the user presses the save button

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

</details>
