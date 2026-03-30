define([
    "dojo/_base/declare",
    "epi-forms/contentediting/editors/EmailTemplateActorEditor"
], function (
    declare,
    EmailTemplateActorEditor
) {
    // Placeholder module — currently just inherits EmailTemplateActorEditor as-is.
    // The Conditions property is rendered by the CMS using its own EditorDescriptor
    // (ConditionsEditorDescriptor) which points to the ConditionsEditor widget.
    return declare([EmailTemplateActorEditor], {});
});
