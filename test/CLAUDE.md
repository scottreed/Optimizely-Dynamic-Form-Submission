# Dynamic Email Routing Actor for Optimizely Forms (CMS 12)

## Overview

A custom post-submission actor for Optimizely Forms that extends the built-in `SendEmailAfterSubmissionActor` with:

1. **Email Routing** — dynamically routes the "To" email address based on a submitted form field value (e.g. when Department = "Sales", send to sales@company.com). Falls back to the base "To" field if no route matches.
2. **Conditional Logic** — gates whether the email is sent at all, with support for AND/OR matching across multiple conditions using "is" and "is not" operators.
3. **Full Email Template Support** — inherits the Insert Placeholder dropdown, rich text body editor, From/Reply-To/Subject fields from the base email actor.

## Solution Structure

Two projects in one solution:

- **`ScottReed.Optimizely.Forms.DynamicEmailRouting/`** — NuGet package (class library). Contains the actor, model, properties, Dojo widgets, and module config. Packaged as a standard Optimizely protected module (ZIP in `modules/_protected/`).
- **`test/`** — Alloy demo site. References the NuGet project via `<ProjectReference>` for local development. Builds the protected module ZIP from source on every build.

## Architecture

The actor extends `SendEmailAfterSubmissionActor` (not `PostSubmissionActorBase`) so it inherits the built-in email sending infrastructure including Optimizely's internal SMTP client. Custom properties are rendered via Dojo widgets registered through `UIHint` + `EditorDescriptor` pairs.

### Key Design Decisions

- **Model inherits from `EmailTemplateActorModel`** — gives us `FromEmail`, `ToEmails` (string), `ReplyToEmails`, `Subject`, `Body` properties for free. The base "To" property name is `ToEmails` (not `To`).
- **Custom UI via UIHint EditorDescriptors** — each custom property (EmailRouting, ConditionMatch, Conditions) has its own Dojo widget registered via a `[UIHint("...")]` attribute and corresponding `EditorDescriptor`.
- **Form field dropdowns use the Forms data store** — field names are loaded from `epi-forms.formsdata` store with query `{ id: "GetAvailableReplacablePlaceHolders", contentLink: currentContext.id }`.
- **Field name matching uses whitespace-insensitive fallback** — the placeholder store may return "Text 2" (with space) while submission data has "Text2" (no space). The `ResolveFieldValue` helper tries exact match first, then strips spaces for a fallback match.
- **Protected module pattern** — JS editors and lang files are packaged in a ZIP under `modules/_protected/`, following the same pattern as EPiServer.Forms.UI. The module is auto-registered via `DynamicEmailRoutingInitialization` (IConfigurableModule) which adds it to `ProtectedModuleOptions`.
- **The `PropertyType` must use `new` keyword** — `public new Type PropertyType => typeof(...)` because the base class already defines it.
- **`ProtectedModuleOptions.AutoDiscovery` defaults to `Minimal`** — modules must be explicitly registered. Our `DynamicEmailRoutingInitialization.cs` handles this automatically.

## File Structure

### NuGet Project (ScottReed.Optimizely.Forms.DynamicEmailRouting/)

```
Actors/
  DynamicEmailRoutingActor.cs           # Extends SendEmailAfterSubmissionActor
    - Run() → evaluate conditions → resolve email routing → base.Run()
    - ResolveEmailRouting() — first matching route overrides ToEmails
    - EvaluateConditions() — AND mode: all must pass; ANY mode: one must pass
    - BuildFriendlySubmissionData() — maps element IDs to friendly labels

Models/
  DynamicEmailRoutingActorModel.cs      # Extends EmailTemplateActorModel
    - EmailRouting (string, JSON) — [UIHint("EmailRoutingEditor")]
    - ConditionMatch (string, "all"|"any") — [UIHint("ConditionMatchEditor")]
    - Conditions (string, JSON) — [UIHint("ConditionsEditor")]
    - EmailRoutingRule { Field, Value, Email }
    - ConditionRule { Field, Operator, Value }

Properties/
  PropertyDynamicEmailRoutingActor.cs   # Property + 4 EditorDescriptors
    - DynamicEmailRoutingActorEditorDescriptor → "epi-forms/contentediting/editors/EmailTemplateActorEditor"
    - ConditionsEditorDescriptor → "dynamic-email-routing/editors/ConditionsEditor"
    - ConditionMatchEditorDescriptor → "dynamic-email-routing/editors/ConditionMatchEditor"
    - EmailRoutingEditorDescriptor → "dynamic-email-routing/editors/EmailRoutingEditor"

DynamicEmailRoutingInitialization.cs    # IConfigurableModule — auto-registers with ProtectedModuleOptions
Resources/Translations/
  DynamicEmailRouting.xml               # Embedded resource (for ProjectReference localization)

ProtectedModule/                        # Source files for the module ZIP (built dynamically at pack time)
  module.config                         # Module manifest: assemblies + Dojo packages
  ClientResources/dynamic-email-routing/editors/
    DynamicEmailRoutingEditor.js        # Thin wrapper extending EmailTemplateActorEditor
    ConditionsEditor.js                 # Add/remove condition rows (field dropdown, is/is not, value)
    ConditionMatchEditor.js             # Dropdown: "All (AND)" or "Any (OR)"
    EmailRoutingEditor.js               # Add/remove routing rows (field dropdown, value, email)
  lang/
    DynamicEmailRouting.xml             # Localization (actor display name + labels)

build/
  *.targets                             # MSBuild targets — copies ZIP to consumer's modules/_protected/
```

### Test Project (test/)

```
Startup.cs                              # AddEmbeddedLocalization<DynamicEmailRoutingActor>() for ProjectReference
test.csproj                             # ProjectReference + BuildDynamicEmailRoutingModule target
appsettings.json                        # SMTP config under EPiServer:Cms:Smtp:Network
modules/_protected/                     # Built from source on every build (gitignored)
```

## NuGet Packaging

The `.csproj` dynamically builds the protected module ZIP at pack time:
1. `CreateModuleZip` target stages files into `{version}/ClientResources/...` and `{version}/lang/...`
2. `ZipDirectory` creates the ZIP
3. ZIP is included as a `contentFile` in the `.nupkg`
4. `build/*.targets` copies the ZIP to consumer's `modules/_protected/` on build

## Known Issues & Gotchas

- **Field name mismatch**: The placeholder store returns display names (e.g. "Text 2") while submission data uses friendly names without spaces ("Text2"). The `ResolveFieldValue` helper handles this with a whitespace-stripped fallback.
- **Field names from conditions/routing JSON may contain `::` prefix/suffix**: These are stripped with `.Trim(':')`.
- **The built-in `SendEmailAfterSubmissionActor` runs independently**: If both actors are configured on the same form, emails will be sent twice. Only use one or the other.
- **Empty conditions = always send**: If no conditions are configured, the email is always sent (by design).
- **Failed condition parsing = email sent**: If the conditions JSON is malformed, the email is sent rather than blocked (fail-open).
- **Logging**: Configured via Microsoft.Extensions.Logging. Test project uses Serilog to `App_Data/logs/log-{date}.txt`.

## Dependencies

- `EPiServer.CMS` (>= 12.x)
- `EPiServer.Forms` (>= 5.x)
- Test project additionally uses `Serilog.AspNetCore` + `Serilog.Sinks.File`
