# Resume Analyzer

This feature area will manage the user's resume, compare it to job a job post, recommend updates to make the resume specific to the job post, reduce it in size to fit usual resume length conventions, store the job post and generated resume, and track the resources used and generated.

## Phase 1

This will be an MVP phase. The Resume Analyzer will merge a text version of the user's resume, a job description, and an AI prompt. The output will be an AI prompt that can be pasted into the user's AI tool of choice so that it can provide the desired feedback to update the resume.

### Configuration

The Resume Analyzer will have some configurable files:

1. The resume text

2. The job description text

3. The AI prompt template with replacement variables

    a. `[YOUR RESUME HERE]` - to be replaced by the content of the resume text

    b. `[JOB DESCRIPTION HERE]` - to be replaced by the content of the job description text
