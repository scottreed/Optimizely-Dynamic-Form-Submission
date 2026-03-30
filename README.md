# ScottReed.Optimizely.Forms.DynamicEmailRouting

A custom Optimizely Forms post-submission actor for CMS 12 that provides:

- **Email Routing** &mdash; dynamically routes the "To" email address based on a submitted form field value. The base "To" field acts as a fallback if no route matches.
- **Conditional Logic** &mdash; gates whether the email is sent at all, with AND/OR matching across multiple conditions using "is" and "is not" operators.
- **Full Email Template Support** &mdash; inherits the Insert Placeholder dropdown, rich text body editor, From/Reply-To/Subject fields from the built-in email actor.

---

## Installation

### Prerequisites

- Optimizely CMS 12 (.NET 8)
- `EPiServer.Forms` >= 5.x
- SMTP configured in `appsettings.json` (see [SMTP Configuration](#smtp-configuration))

### Install the NuGet Package

```bash
dotnet add package ScottReed.Optimizely.Forms.DynamicEmailRouting
```

Or via the Package Manager Console:

```
Install-Package ScottReed.Optimizely.Forms.DynamicEmailRouting
```

### What Happens on Install

The package follows the standard Optimizely protected module pattern (same as EPiServer.Forms.UI):

1. **Protected module ZIP** is copied to `modules/_protected/ScottReed.Optimizely.Forms.DynamicEmailRouting/` via an MSBuild target on build
2. **Module registration** &mdash; an `IConfigurableModule` in the DLL automatically registers the module with `ProtectedModuleOptions`, so Optimizely discovers the Dojo packages and lang files from the ZIP
3. **Localization** &mdash; the actor display name ("Dynamic email routing") is served from the ZIP's `lang/` folder
4. **Actor discovery** &mdash; the actor is found by Optimizely Forms via assembly scanning

No `Startup.cs` changes or manual configuration required.

### Verifying the Install

After building, confirm:
- `modules/_protected/ScottReed.Optimizely.Forms.DynamicEmailRouting/ScottReed.Optimizely.Forms.DynamicEmailRouting.zip` exists
- The **Dynamic email routing** actor appears on any form's Settings tab in the CMS editor

---

## Uninstalling

```bash
dotnet remove package ScottReed.Optimizely.Forms.DynamicEmailRouting
```

On the next build, the protected module ZIP is no longer copied and the module is no longer registered. You can manually delete `modules/_protected/ScottReed.Optimizely.Forms.DynamicEmailRouting/` if it persists.

Any forms that had the Dynamic Email Routing actor configured will need their actor settings updated.

---

## How It Works

The actor extends the built-in `SendEmailAfterSubmissionActor`, so editors get the same email template editing experience. It adds three custom sections to the email template dialog:

1. **Email Routing** &mdash; add/remove rows that map a form field value to a recipient email address
2. **Conditional Match** &mdash; choose whether ALL or ANY conditions must match
3. **Conditions** &mdash; add/remove rules that gate whether the email is sent

### Adding the Actor to a Form

1. In the CMS editor, navigate to your form
2. Select the **Form Container** block and open its **Settings** tab
3. The **Dynamic Email Routing** actor appears automatically alongside the built-in actors
4. Click the **+** button to add a new email rule
5. Configure email routing, conditions, and the email template
6. **Publish** the page

> **Important:** Do not configure both the Dynamic Email Routing actor and the built-in "Send email after form submission" actor with email rules on the same form, as both will send emails independently.

---

## Configuring Email Routing

The Email Routing section lets you route the "To" address based on a form field value. Each row contains:

| Column | Description |
|---|---|
| **Field** | Dropdown of form fields (e.g. "Department") |
| **Value** | The value to match (e.g. "Sales") |
| **Email** | The recipient email address when matched |

The first matching route wins. If no route matches, the base **To** field is used as a fallback.

**Example:**

| Field | Value | Email |
|---|---|---|
| Department | Sales | sales@company.com |
| Department | Support | support@company.com |
| Department | HR | hr@company.com |

If a visitor selects "Sales", the email is sent to `sales@company.com`. If they select "Other" (no match), the fallback "To" address is used.

---

## Configuring Conditions

Conditions gate whether the email is sent at all. The **Conditional Match** dropdown controls the logic:

- **All conditions must match (AND)** &mdash; every condition must pass for the email to be sent
- **Any condition must match (OR)** &mdash; at least one condition must pass

Each condition row contains:

| Column | Description |
|---|---|
| **Field** | Dropdown of form fields |
| **Operator** | "is" or "is not" |
| **Value** | The value to compare against |

**Example (AND mode):**

| Field | Operator | Value |
|---|---|---|
| Enquiry Type | is | Contact |
| Region | is not | Internal |

This only sends the email when the enquiry type is "Contact" AND the region is not "Internal".

**Example (OR mode):**

| Field | Operator | Value |
|---|---|---|
| Priority | is | Urgent |
| Priority | is | Critical |

This sends the email when the priority is either "Urgent" OR "Critical".

If no conditions are configured, the email is always sent (subject to email routing).

---

## Placeholders

Use the **Insert placeholder** dropdown (top-right of the dialog) to insert form field tokens into Subject, Message, or any text field. Tokens use the `::FieldName::` syntax and are automatically replaced with submitted values.

---

## SMTP Configuration

The actor uses Optimizely's built-in SMTP client. Configure in `appsettings.json`:

```json
{
  "EPiServer": {
    "Cms": {
      "Smtp": {
        "DeliveryMethod": "Network",
        "SenderEmailAddress": "noreply@example.com",
        "Network": {
          "Host": "smtp.example.com",
          "Port": "587"
        }
      }
    }
  }
}
```

> **Tip:** For local development, use [smtp4dev](https://github.com/rnwood/smtp4dev) or [Papercut SMTP](https://github.com/ChangemakerStudios/Papercut-SMTP) and point to `localhost:25`.

---

## Matching Behaviour

- **Case-insensitive** matching on all field names and values
- **Field name resolution** handles whitespace differences between the placeholder store and submission data (e.g. "Text 2" matches "Text2")
- **First matching route wins** for email routing; fallback to base "To" if none match
- **Empty conditions** = always send
- **Failed JSON parsing** = email is sent (fail-open design)

---

## Logging

The actor logs through `Microsoft.Extensions.Logging`:

- All submitted field values
- Each email routing check (field, submitted value, expected value, target email)
- Each condition evaluation (field, operator, expected, submitted, pass/fail)
- Whether routing matched or fell back to default "To"
- How many emails were sent

Configure logging output in your consuming application (e.g. Serilog to `App_Data/logs/log-{date}.txt`).

---

## Project Structure

```
ScottReed.Optimizely.Forms.DynamicEmailRouting/     NuGet package / class library
  Actors/
    DynamicEmailRoutingActor.cs                     Actor with routing + conditional logic
  Models/
    DynamicEmailRoutingActorModel.cs                Model with EmailRouting, ConditionMatch, Conditions
  Properties/
    PropertyDynamicEmailRoutingActor.cs             Property definition + editor descriptors
  DynamicEmailRoutingInitialization.cs              Auto-registers protected module with CMS
  Resources/Translations/
    DynamicEmailRouting.xml                         Embedded localization (for ProjectReference dev)
  ProtectedModule/                                  Source files for the module ZIP
    module.config                                   Module manifest (Dojo packages, assemblies)
    ClientResources/dynamic-email-routing/editors/
      DynamicEmailRoutingEditor.js                  Extends EmailTemplateActorEditor
      EmailRoutingEditor.js                         Add/remove routing rows (field, value, email)
      ConditionMatchEditor.js                       Dropdown: All (AND) or Any (OR)
      ConditionsEditor.js                           Add/remove condition rows (field, is/is not, value)
    lang/
      DynamicEmailRouting.xml                       Localization (actor display name + labels)
  build/
    *.targets                                       MSBuild targets (copies ZIP to consumer's modules/_protected/)

test/                                               Alloy demo site for development and testing
```

### What's in the NuGet Package

| Package Path | Purpose | Installed To |
|---|---|---|
| `lib/net8.0/*.dll` | Actor, model, properties, initialization module | `bin/` (automatic) |
| `contentFiles/**/modules/_protected/**/*.zip` | Protected module ZIP (JS editors, lang, module.config) | `modules/_protected/` (via MSBuild targets) |
| `build/*.targets` | MSBuild targets to copy ZIP on build | Not copied; runs on build |
| `README.md` | Package documentation | Shown on NuGet feed |

---

## Extending the Actor

1. **Add operators** &mdash; extend the `ConditionRule` model and `EvaluateConditions()` switch statement (e.g. "contains", "starts with")
2. **Add routing logic** &mdash; extend `ResolveEmailRouting()` for more complex routing (e.g. regex matching, multiple field combinations)

---

## Test Site (Alloy Demo)

The `test/` folder contains an Alloy MVC demo site used for development and testing. It references the NuGet project via `<ProjectReference>` and builds the protected module ZIP from source automatically.

Login details admin / Pa55word-84

### How to Run

#### Windows

Prerequisites:
- .NET SDK 8+
- SQL Server 2016 Express LocalDB (or later)

```bash
dotnet run --project test
```

#### Any OS with Docker

Prerequisites:
- Docker
- Review the .env file for Docker-related variables

```bash
docker-compose up
```

> Note that this Docker setup is just configured for local development. Follow this [guide to enable HTTPS](https://github.com/dotnet/dotnet-docker/blob/main/samples/run-aspnetcore-https-development.md).

#### Any OS with External Database

Prerequisites:
- .NET SDK 8+
- SQL Server 2016 (or later) on an external server, e.g. Azure SQL

Create an empty database and update the connection string accordingly.

```bash
dotnet run --project test
```

---

## CI/CD

A GitHub Actions workflow (`.github/workflows/build-nuget.yml`) automatically builds and packages on every push.

### What the Workflow Does

1. **Restores, builds, and packs** the NuGet project
2. **Produces `.nupkg` and `.snupkg`** (symbols) artifacts, downloadable from the Actions tab
3. **Auto-increments the minor version** after each successful build on `main`/`master`
4. Uses deterministic builds with SourceLink for reproducibility

Publishing to NuGet feeds is done manually after downloading the artifact (see below).

### Versioning

Version is controlled by two values:

- **`MAJOR_VERSION`** &mdash; set in the workflow file (`.github/workflows/build-nuget.yml`), currently `1`
- **`MINOR_VERSION`** &mdash; a GitHub repository variable that auto-increments on each build

| Trigger | Version Format | Example |
|---|---|---|
| Push to `main`/`master` | `{MAJOR}.{MINOR}.0` | `1.3.0` |
| Pull request | `{MAJOR}.{MINOR}.0-preview` | `1.4.0-preview` |
| Git tag `v2.0.0` | Exact tag version | `2.0.0` |

**To reset the minor version:** Go to **Settings > Secrets and variables > Actions > Variables** and set `MINOR_VERSION` to `0`.

**To bump the major version:** Change `MAJOR_VERSION` in the workflow file and reset `MINOR_VERSION` to `0`.

### Required GitHub Configuration

| Type | Name | Purpose |
|---|---|---|
| **Variable** | `MINOR_VERSION` | Auto-incrementing minor version (set initial value to `0`) |
| **Secret** | `PAT_TOKEN` | Personal Access Token with Variables read/write permission (needed to auto-increment `MINOR_VERSION`) |

To create the PAT: **GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens** with **Variables: Read and write** permission scoped to your repository.

### Downloading and Publishing

After a workflow run completes:

1. Go to the **Actions** tab in your GitHub repo
2. Click the completed workflow run
3. Download the **nuget-package** artifact (contains `.nupkg` and `.snupkg`)
4. Publish manually:

```bash
# To Optimizely feed
dotnet nuget push ScottReed.Optimizely.Forms.DynamicEmailRouting.{version}.nupkg --api-key YOUR_KEY --source https://nuget.optimizely.com/feed/packages.svc/

# To NuGet.org (optional)
dotnet nuget push ScottReed.Optimizely.Forms.DynamicEmailRouting.{version}.nupkg --api-key YOUR_KEY --source https://api.nuget.org/v3/index.json
```

---

## License

MIT &mdash; Copyright (c) Scott Reed 2026
