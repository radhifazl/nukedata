# Data Cleaning and Exploration

A browser-based data cleaning and exploration application designed to
help users upload, understand, clean, visualize, and export structured
datasets through a single workspace.

The application focuses on a practical data workflow while keeping the
core processing deterministic and privacy-conscious. Users can work with
spreadsheet files, inspect data quality issues, apply cleaning
operations, optionally use AI for recommendations, create
visualizations, and export the resulting dataset.

## Project Overview

The application follows this workflow:

``` text
Upload
  ↓
Parse
  ↓
Preview
  ↓
Profile
  ↓
Detect Issues
  ↓
Clean
  ↓
Optional AI Analysis
  ↓
Visualize
  ↓
Export
```

The core principle is that the uploaded file format is an input concern.
After parsing, the application works with a normalized dataset so
profiling, issue detection, cleaning, visualization, AI analysis, and
export do not need separate implementations for different file formats.

## Supported File Formats

The application is designed to accept spreadsheet data including:

-   CSV (`.csv`)
-   Excel (`.xlsx`)
-   Excel legacy (`.xls`) where supported by the current implementation

Input format should not affect the downstream cleaning and analysis
workflow.

For example:

``` text
CSV / XLSX / XLS
       ↓
    Parser
       ↓
Normalized Dataset
       ↓
Profile / Issues / Cleaning / AI / Visualization / Export
```

## Core Features

### Dataset Upload

Users can upload supported spreadsheet files through the initial upload
page.

The upload flow is intentionally separated from the workspace so users
do not have to repeatedly upload a file when moving between different
parts of the application.

The application can provide access to recent datasets so users can
return to previous workspaces without starting over.

### Dataset Preview

After a file is parsed, users can inspect the dataset before performing
cleaning operations.

The preview provides access to:

-   Rows
-   Columns
-   Dataset dimensions
-   Parsed values
-   Empty states
-   Parsing errors

### Data Profiling

The application automatically profiles the current dataset to provide an
overview of data quality.

Profiling can include:

-   Column types
-   Missing values
-   Unique values
-   Unique value ratios
-   Numeric statistics
-   Date ranges
-   Duplicate rows
-   Categorical distributions
-   Potential inconsistencies
-   Potential outliers

The profiling system is deterministic and does not require AI.

### Issue Detection

The application identifies potential data quality issues based on the
current dataset.

Examples include:

-   Missing values
-   Duplicate rows
-   Inconsistent text values
-   Invalid values
-   Type inconsistencies
-   Invalid dates
-   Potential numeric outliers

Issues are derived from the current dataset rather than manually marked
as fixed.

This means the intended lifecycle is:

``` text
Current Dataset
     ↓
Profile
     ↓
Detect Issues
     ↓
Fix Issue
     ↓
Cleaning Operation
     ↓
Dataset Changes
     ↓
Re-profile
     ↓
Re-detect Issues
```

When an issue has genuinely been resolved, it disappears naturally from
the issue list.

### Data Cleaning

Cleaning operations are applied to the current dataset without mutating
the original dataset.

The cleaning architecture follows:

``` text
Original Dataset
       +
Cleaning Operations
       ↓
Current Cleaned Dataset
```

Supported cleaning operations can include:

-   Remove duplicates
-   Fill missing values
-   Normalize text
-   Convert data types
-   Remove selected rows
-   Handle potential outliers

Cleaning operations are recorded as history so users can understand how
the current dataset was produced.

### Cleaning Preview

Before applying a cleaning operation, users can preview the expected
changes.

The intended workflow is:

``` text
Choose Fix
   ↓
Preview
   ↓
Confirm
   ↓
Apply Operation
   ↓
Update Dataset
   ↓
Re-profile
   ↓
Re-detect Issues
```

This prevents cleaning actions from silently modifying the dataset.

### Undo and Reset

Cleaning history is treated as part of the workspace state.

Undo removes the latest cleaning operation and regenerates the current
dataset from the original dataset and remaining operations.

Reset restores the original dataset and re-derives profiling and issue
detection.

``` text
Original Dataset
       ↓
Operation 1
       ↓
Operation 2
       ↓
Operation 3
       ↓
Current Dataset
```

Undoing Operation 3 results in:

``` text
Original Dataset
       ↓
Operation 1
       ↓
Operation 2
       ↓
Current Dataset
```

### Optional AI Analysis

AI analysis is an optional feature rather than a requirement for the
core application.

AI is intended to provide:

-   Dataset insights
-   Potential data quality observations
-   Suggested cleaning operations
-   Explanations for suggested improvements

The deterministic profiling and cleaning systems remain the source of
truth.

AI recommendations must map to existing cleaning operations rather than
directly modifying the dataset.

The intended flow is:

``` text
Dataset Profile
     +
Detected Issues
     ↓
Optional AI Analysis
     ↓
AI Suggestion
     ↓
Validate Suggestion
     ↓
Existing Cleaning Workflow
     ↓
Preview
     ↓
User Confirmation
     ↓
Apply Cleaning Operation
```

AI should never silently modify the user's dataset.

### AI Privacy

AI analysis is opt-in.

When AI is disabled:

-   No AI request is made
-   No model discovery request is made
-   Dataset information remains in the browser
-   The application does not send dataset information to an AI provider

When AI is enabled, analysis should use the smallest useful
representation of the dataset where possible, such as:

-   Dataset metadata
-   Column information
-   Profiling results
-   Detected issues
-   Aggregated statistics

The application should avoid sending the complete raw dataset to the AI
provider unless explicitly required by a future feature.

API keys must remain server-side and must never be exposed in
client-side code.

### AI Analysis Cache

AI analysis is associated with the dataset version or fingerprint.

If the dataset has not changed, an existing analysis can be reused
instead of making another API request.

If the dataset changes:

``` text
Existing AI Analysis
        ↓
     Outdated
        ↓
User explicitly chooses
Re-analyze
```

The application should not automatically re-run AI analysis after every
cleaning operation.

Stale AI suggestions must not be applied to a different dataset version.

### Visualization

The application provides data visualization based on the structure of
the current dataset.

Possible visualization types include:

-   Bar charts
-   Line charts
-   Histograms
-   Scatter plots
-   Donut or pie charts where appropriate

Visualization recommendations are deterministic and based on the dataset
profile.

Examples:

``` text
Numeric column
    → Histogram

Date + Numeric
    → Line chart

Categorical column
    → Bar chart

Numeric + Numeric
    → Scatter plot
```

High-cardinality datasets should be aggregated or sampled when necessary
instead of rendering excessive numbers of points directly.

### Export

Users can export the original or current cleaned dataset.

Supported export formats can include:

-   CSV
-   XLSX

The export system should treat serialization as a separate layer from
the cleaning engine.

For example:

``` text
Current Dataset
      ↓
CSV Exporter
```

or:

``` text
Current Dataset
      ↓
XLSX Exporter
```

CSV export must correctly handle:

-   Commas inside values
-   Quotes inside values
-   Newlines inside values
-   Empty values
-   Unicode text
-   Numbers
-   Dates
-   Boolean values

XLSX export should produce a real spreadsheet so that Excel opens the
result as separate rows and columns.

### Cleaning Summary

The application can provide a summary of the cleaning process, including
information such as:

-   Original row count
-   Current row count
-   Column count
-   Cleaning operations
-   Quality score before cleaning
-   Quality score after cleaning

### Workspace Navigation

The application uses a workspace model where the sidebar provides
navigation between the main dataset views.

Typical workspace sections include:

``` text
Overview
Columns
Data
Issues
Cleaning
AI Analysis
Visualize
Export
```

The sidebar and active view must remain synchronized.

Navigation should work through the application's canonical routing or
workspace state rather than maintaining separate copies of the active
tab.

The same workspace remains active while users move between views.

## Workspace State

The current workspace is centered around a single canonical dataset.

``` text
Workspace
├── Original Dataset
├── Current Dataset
├── Dataset Metadata
├── Profile
├── Issues
├── Cleaning History
├── AI Analysis
└── Visualization Configurations
```

The current dataset is the source of truth.

Derived information such as profiles, issues, quality scores, and
visualizations should be updated when the dataset changes.

Individual tabs should not maintain independent copies of the dataset or
issue state.

## Recent Data

The application can maintain recent workspaces so users can return to
previously opened datasets.

A recent workspace should represent more than the original uploaded file
where persistence allows it.

It may include:

-   Original dataset
-   Current cleaned dataset
-   Cleaning history
-   Profile
-   Issues
-   AI analysis
-   Visualization configurations

The purpose is to allow a user to leave one workspace, work with another
dataset, and later return to the previous workspace.

## New Dataset Flow

Uploading a new dataset from inside an existing workspace should not
silently replace the current workspace.

The intended flow is:

``` text
Current Workspace
      ↓
New Dataset
      ↓
Confirmation
      ↓
Start New
      ↓
Upload Page
      ↓
New Workspace
```

If the current workspace is recoverable through Recent Data, the
confirmation should make this clear.

Users should be able to cancel the action without losing their current
workspace.

## Architecture Principles

### Single Source of Truth

The current dataset is the canonical source of truth.

Derived state should follow the dataset:

``` text
Current Dataset
      ↓
Profile
      ↓
Issues
      ↓
Quality Score
      ↓
Visualization
      ↓
Export
```

### Format-Agnostic Processing

CSV and Excel are input formats.

After parsing, the application should use a normalized dataset
representation.

Core logic should not contain unnecessary format-specific branches.

### Deterministic Core

The following systems should remain deterministic:

-   Parsing
-   Profiling
-   Issue detection
-   Cleaning
-   Quality scoring
-   Visualization recommendations
-   Export

AI should complement these systems rather than replace them.

### Immutable Original Dataset

The original dataset should remain available throughout the workspace
lifecycle.

Cleaning operations should produce a current dataset without
destructively modifying the original dataset.

### Derived Issue State

Issues should be recalculated from the current dataset.

The application should not solve synchronization problems by manually
deleting an issue after a user clicks Fix.

Instead:

``` text
Fix
 ↓
Dataset changes
 ↓
Re-profile
 ↓
Re-detect
 ↓
Resolved issue disappears
```

If a partial fix does not completely resolve an issue, the issue should
remain.

If a cleaning operation introduces a new issue, the new issue should be
detected.

### Version and Fingerprint Awareness

Dataset versioning or fingerprinting should be used where necessary to
prevent stale derived data from being applied to a newer dataset.

This is especially important for:

-   AI analysis
-   Profiling caches
-   Issue detection caches
-   Visualization caches
-   Asynchronous processing

## Performance

The application is intended to work with datasets larger than simple
demonstration files.

Performance considerations include:

-   Avoiding unnecessary dataset copies
-   Efficient table rendering
-   Pagination or virtualization for large datasets
-   Sampling large scatter plots
-   Aggregating high-cardinality charts
-   Caching derived dataset information
-   Web Workers for expensive client-side processing where appropriate
-   Efficient CSV and spreadsheet export
-   Cleaning up Chart.js instances and temporary resources
-   Avoiding unnecessary re-parsing during workspace navigation

Performance optimization should be based on measurement rather than
premature optimization.

## Data Privacy

The application is designed with a local-first approach for the core
data workflow.

The main dataset processing pipeline should be performed in the browser
where possible:

``` text
User File
   ↓
Browser
   ↓
Parse
   ↓
Profile
   ↓
Clean
   ↓
Visualize
   ↓
Export
```

AI is an explicit opt-in feature and should be isolated from the normal
data processing pipeline.

Users should have a clear understanding of when data may leave the
browser.

## Quality Score

The application can calculate a deterministic data quality score based
on detected issues.

The score should be derived from the current dataset and current issue
state rather than manually adjusted after individual cleaning actions.

When the dataset changes:

``` text
Dataset Changes
      ↓
Re-profile
      ↓
Re-detect Issues
      ↓
Recalculate Quality Score
```

## Testing Strategy

Important tests should cover the complete data lifecycle.

### Parsing

Test:

-   CSV files
-   XLSX files
-   XLS files where supported
-   Empty files
-   Invalid files
-   Unicode values
-   Different column counts
-   Parsing errors

### Profiling

Test:

-   Missing values
-   Numeric columns
-   Date columns
-   Boolean columns
-   Unique values
-   Duplicates
-   Potential outliers
-   Inconsistent categorical values

### Cleaning

Test:

-   Remove duplicates
-   Fill missing values
-   Normalize text
-   Convert types
-   Remove rows
-   Multiple operations
-   Undo
-   Reset

### Issue Synchronization

Test:

``` text
Issue detected
→ Choose fix
→ Preview
→ Apply
→ Dataset changes
→ Re-profile
→ Re-detect
→ Issue updates
```

Also test:

-   Partial fixes
-   Fixes that create new issues
-   Undo causing an issue to return
-   Reset restoring original issues
-   Switching between workspace tabs

### AI

Test:

-   AI disabled
-   AI enabled
-   Explicit analysis
-   Cached analysis
-   Dataset changes after analysis
-   Stale AI results
-   Invalid AI responses
-   Applying AI suggestions through the normal cleaning pipeline
-   Preventing duplicate AI requests

### Visualization

Test that charts use the current dataset after cleaning.

Cleaning the dataset should invalidate or update the relevant
visualization state.

### Export

Test:

``` text
CSV → CSV
CSV → XLSX
XLSX → CSV
XLSX → XLSX
```

and XLS where supported.

Verify that:

-   Columns remain separate
-   Rows remain correct
-   Values are preserved
-   Unicode is preserved
-   Cleaned values are exported
-   Row counts are correct
-   CSV quoting is valid
-   XLSX files open correctly in spreadsheet software

## Development Principles

When extending the application:

1.  Inspect the existing architecture before adding new code.
2.  Reuse existing components and utilities.
3.  Keep the normalized dataset as the central data representation.
4.  Avoid duplicated sources of truth.
5.  Keep AI optional.
6.  Never allow AI to silently mutate data.
7.  Recalculate derived state when the dataset changes.
8.  Preserve CSV and Excel support.
9.  Avoid unnecessary dependencies.
10. Avoid unrelated refactors.
11. Test the complete workflow rather than isolated UI actions.
12. Optimize large datasets based on measurements.

## Future Improvements

Potential future development areas include:

-   More advanced Excel support
-   Multiple Excel sheet handling
-   Excel export improvements
-   Advanced filtering
-   More cleaning operations
-   Fuzzy matching and duplicate detection
-   More advanced data transformations
-   Saved projects
-   Data quality reports
-   PDF reporting
-   More visualization types
-   AI-assisted natural-language data exploration
-   Cloud storage
-   Collaboration

These features should be considered separately from the core MVP so the
primary cleaning workflow remains reliable and easy to understand.

## Project Goal

The goal of this project is to provide a practical data cleaning and
exploration workflow that is easier to use than manually inspecting
spreadsheets while remaining transparent about how data is changed.

The application combines deterministic data-quality tooling with
optional AI assistance without making AI a requirement for understanding
or modifying the dataset.
