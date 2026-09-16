# Job Applications implementation plan

This document tracks the ordered work needed to add the JobApplication, JobSource, and JobQuestion models and the related API/UI/test support.

## Priority 1: persistence foundation

### Goal

Establish the DB model and service registration contract before UI work.

### Work

- Confirm the final model shapes for JobApplication, JobSource, and JobQuestion.
- Ensure JobPosting is required on create/update for application records.
- Confirm how child collections are persisted under the repository's existing nested-model pattern.
- Add the DB definitions and CRUD service registrations needed for the new models.
- Validate required/optional relationship rules against the repository conventions.

### Output

- New models supported by the DB layer and CRUD services.
- Stable API contract for later UI and server work.

## Priority 2: server endpoints and API contract

### Goal

Make the backend support create/list/update/delete flows for the new models.

### Work

- Add or update server endpoint registration for JobApplications, JobSources, and JobQuestions.
- Ensure nested object graph rules are respected for create/update requests.
- Validate request payloads against the repository validation conventions.
- Expose list and detail operations needed by the DB Viewer and Job Applications tab.

### Output

- Server-side API endpoints ready for the UI to call.

## Priority 3: DB Viewer integration

### Goal

Add the new entities to the main entity listing and record editor behavior.

### Work

- Include JobApplication, JobSource, and JobQuestion in the “main Entities” coverage.
- Update the DB Viewer entity list and the per-entity editor flows.
- Ensure expanders, refresh, edit, delete, and nested relations behave consistently.

### Output

- New entities appear in the DB Viewer with CRUD support.

## Priority 4: Job Applications tab / Saved Applications list

### Goal

Show saved job applications in the UI using the repository’s usual expander patterns.

### Work

- Build the Saved Applications expander in the Job Applications tab.
- Load saved records from the server.
- Display a useful empty state and list of saved applications.
- Keep the UI consistent with existing Job Postings and DB Viewer patterns.

### Output

- Users can open Job Applications and see the saved application records list.

## Priority 5: test and doc updates

### Goal

Keep documentation and automated coverage aligned with the new behavior.

### Work

- Update [docs/README.tests.md](docs/README.tests.md) with scenarios for the new feature and entity coverage.
- Add or update scenario outlines for the main entity list and the Job Applications feature.
- Add focused C# tests for the model/service behavior.
- Add focused web UI tests for the new tab and saved-record list behavior.

### Output

- Test coverage and documentation reflect the actual product contract.

## Priority 6: regression verification

### Goal

Validate the specific impacted areas before expanding the feature further.

### Work

- Run the smallest relevant DB tests.
- Run the smallest relevant server tests.
- Run the relevant web UI tests for Job Applications and adjacent flows.
- Fix issues before moving on to broader feature changes.

### Output

- Stable feature increment with evidence.

## Notes

- Keep each step as a small, reviewable change instead of attempting the whole feature in one pass.
- Follow the repo guidance in [docs/CODING-STANDARDS.md](docs/CODING-STANDARDS.md) and the existing service/model patterns.
- Do not broaden scope beyond the ordered steps unless a new requirement clearly blocks the current step.
