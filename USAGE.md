# Dynamic Email Routing Actor for Optimizely Forms (CMS 12)

Routes form submission emails to different recipients based on submitted field values.

## Files

```
Models/DynamicEmailRoutingActorModel.cs   - Configuration model (one row per routing rule)
Actors/DynamicEmailRoutingActor.cs        - Actor that evaluates rules and sends emails
Properties/PropertyDynamicEmailRoutingActor.cs - Property + EditorDescriptor for the CMS UI
```

## How It Works

1. Editor adds the **DynamicEmailRoutingActor** to a form's post-submission actors
2. Editor configures routing rules as rows in a grid:

| Field Name     | Field Value | To Email(s)                  | CC Email(s) | Email Subject             | Send Summary |
|----------------|-------------|------------------------------|-------------|---------------------------|--------------|
| Department     | Sales       | sales@company.com            |             | New Sales Enquiry         | true         |
| Department     | Support     | support@company.com          |             | Support Request: #Name#   | true         |
| Department     | HR          | hr@company.com, hr2@co.com   |             | HR Enquiry                | true         |
| Department     | *           | general@company.com          |             | General Enquiry           | true         |

3. When a visitor submits the form, the actor:
   - Reads the submitted field values
   - Matches each rule's **Field Name** + **Field Value** against the submission
   - Sends an email to the matching rule's recipients
   - `*` acts as a wildcard/catch-all (always matches)

## Configuration Fields

| Field            | Required | Description                                                      |
|------------------|----------|------------------------------------------------------------------|
| Form Field Name  | Yes      | The label/name of the form element to evaluate                   |
| Field Value      | Yes      | The value to match. Use `*` for a catch-all/default rule         |
| To Email(s)      | Yes      | Comma-separated recipient email addresses                        |
| CC Email(s)      | No       | Comma-separated CC email addresses                               |
| Email Subject    | No       | Subject line. Supports `#FieldName#` placeholders                |
| Send Form Summary| No       | When true, includes all submitted fields in the email body       |

## Subject Placeholders

Use `#FieldName#` syntax in the subject to insert submitted values:

- Subject: `New enquiry from #Name# about #Department#`
- Result: `New enquiry from John Smith about Sales`

## Multiple Rules Can Match

If the form has multiple fields being evaluated, multiple emails can be sent from a single submission. For example:

| Field Name | Field Value | To Email(s)           |
|------------|-------------|-----------------------|
| Region     | US          | us-team@company.com   |
| Priority   | Urgent      | escalation@company.com|

A submission with Region=US and Priority=Urgent triggers **both** emails.

## Prerequisites

- SMTP must be configured in your CMS 12 site (appsettings.json or web.config)
- The `EPiServer.Forms` NuGet package must be installed
- Form field names in rules must match the form element labels exactly (case-insensitive)

## Required NuGet Packages

```
EPiServer.Forms (>= 5.x for CMS 12)
```

## Namespace

Adjust the namespaces (`Site.Features.Forms.DynamicEmailRouting.*`) to match your project structure.
