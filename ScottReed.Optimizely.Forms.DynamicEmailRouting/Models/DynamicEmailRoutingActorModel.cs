using EPiServer.Forms.Implementation.Actors;
using EPiServer.Shell.ObjectEditing;
using System;
using System.ComponentModel.DataAnnotations;

namespace ScottReed.Optimizely.Forms.DynamicEmailRouting.Models
{
    /// <summary>
    /// Extends the built-in EmailTemplateActorModel with email routing and conditional logic.
    /// Inheriting from EmailTemplateActorModel gives us: From, To, Reply To, Subject, Body (with placeholder support).
    /// The "To" field from the base model acts as the fallback email address.
    /// EmailRouting overrides the "To" when a field value matches.
    /// Conditions gate whether the email is sent at all.
    /// </summary>
    [Serializable]
    public class DynamicEmailRoutingActorModel : EmailTemplateActorModel
    {
        [Display(Name = "Email Routing", Order = 0,
            Description = "Route emails to different addresses based on a form field value. The 'To' field below is used as a fallback if no route matches.")]
        [UIHint("EmailRoutingEditor")]
        public virtual string EmailRouting { get; set; }

        [Display(Name = "Conditional Match", Order = 1,
            Description = "Whether ALL or ANY conditions must match.")]
        [UIHint("ConditionMatchEditor")]
        public virtual string ConditionMatch { get; set; } = "all";

        [Display(Name = "Conditions", Order = 2,
            Description = "Conditions that control whether this email is sent. Leave empty to always send.")]
        [UIHint("ConditionsEditor")]
        public virtual string Conditions { get; set; }
    }

    /// <summary>
    /// Represents a single email routing rule: when a form field has a specific value, send to this email.
    /// </summary>
    public class EmailRoutingRule
    {
        public string Field { get; set; }
        public string Value { get; set; }
        public string Email { get; set; }
    }

    /// <summary>
    /// Represents a single condition rule for deserialization from the Conditions JSON.
    /// </summary>
    public class ConditionRule
    {
        public string Field { get; set; }
        public string Operator { get; set; }
        public string Value { get; set; }
    }
}
