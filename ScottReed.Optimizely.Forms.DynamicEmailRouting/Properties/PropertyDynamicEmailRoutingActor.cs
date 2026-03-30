using EPiServer.Cms.Shell.UI.ObjectEditing.EditorDescriptors;
using EPiServer.Forms.EditView;
using EPiServer.Framework.DataAnnotations;
using EPiServer.PlugIn;
using EPiServer.Shell.ObjectEditing;
using EPiServer.Shell.ObjectEditing.EditorDescriptors;
using System.Collections.Generic;
using ScottReed.Optimizely.Forms.DynamicEmailRouting.Models;

namespace ScottReed.Optimizely.Forms.DynamicEmailRouting.Properties
{
    /// <summary>
    /// Property definition for the Dynamic Email Routing actor.
    /// Registers the property type so Optimizely CMS can serialize/deserialize the model.
    /// </summary>
    [EditorHint("DynamicEmailRoutingActorPropertyHint")]
    [PropertyDefinitionTypePlugIn(DisplayName = "DynamicEmailRoutingActor")]
    public class PropertyDynamicEmailRoutingActor
        : PropertyGenericList<DynamicEmailRoutingActorModel>
    {
    }

    /// <summary>
    /// Editor descriptor that renders the routing rules using the EmailTemplateActorEditor widget,
    /// which provides the "Insert placeholder" dropdown for form field tokens.
    /// </summary>
    [EditorDescriptorRegistration(
        TargetType = typeof(IEnumerable<DynamicEmailRoutingActorModel>),
        UIHint = "DynamicEmailRoutingActorPropertyHint")]
    public class DynamicEmailRoutingActorEditorDescriptor
        : CollectionEditorDescriptor<DynamicEmailRoutingActorModel>
    {
        public DynamicEmailRoutingActorEditorDescriptor()
        {
            // Use the built-in EmailTemplateActorEditor for placeholder support.
            // The Conditions property has its own UIHint/EditorDescriptor for the custom widget.
            ClientEditingClass = "epi-forms/contentediting/editors/EmailTemplateActorEditor";
        }
    }

    /// <summary>
    /// Editor descriptor for the Conditions property.
    /// Renders the ConditionsEditor Dojo widget for any property with UIHint("ConditionsEditor").
    /// </summary>
    [EditorDescriptorRegistration(
        TargetType = typeof(string),
        UIHint = "ConditionsEditor")]
    public class ConditionsEditorDescriptor : EditorDescriptor
    {
        public ConditionsEditorDescriptor()
        {
            ClientEditingClass = "dynamic-email-routing/editors/ConditionsEditor";
        }
    }

    /// <summary>
    /// Editor descriptor for the Conditional Match dropdown.
    /// </summary>
    [EditorDescriptorRegistration(
        TargetType = typeof(string),
        UIHint = "ConditionMatchEditor")]
    public class ConditionMatchEditorDescriptor : EditorDescriptor
    {
        public ConditionMatchEditorDescriptor()
        {
            ClientEditingClass = "dynamic-email-routing/editors/ConditionMatchEditor";
        }
    }

    /// <summary>
    /// Editor descriptor for the Email Routing property.
    /// Renders the EmailRoutingEditor Dojo widget for any property with UIHint("EmailRoutingEditor").
    /// </summary>
    [EditorDescriptorRegistration(
        TargetType = typeof(string),
        UIHint = "EmailRoutingEditor")]
    public class EmailRoutingEditorDescriptor : EditorDescriptor
    {
        public EmailRoutingEditorDescriptor()
        {
            ClientEditingClass = "dynamic-email-routing/editors/EmailRoutingEditor";
        }
    }
}
