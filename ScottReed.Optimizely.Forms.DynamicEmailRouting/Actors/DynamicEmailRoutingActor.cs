using EPiServer.Forms.Core.PostSubmissionActor;
using EPiServer.Forms.Core.PostSubmissionActor.Internal;
using EPiServer.Forms.EditView;
using EPiServer.Forms.Implementation.Actors;
using EPiServer.ServiceLocation;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using ScottReed.Optimizely.Forms.DynamicEmailRouting.Models;
using ScottReed.Optimizely.Forms.DynamicEmailRouting.Properties;

namespace ScottReed.Optimizely.Forms.DynamicEmailRouting.Actors
{
    /// <summary>
    /// Post-submission actor that extends the built-in SendEmailAfterSubmissionActor
    /// with email routing and conditional logic.
    ///
    /// Email Routing: Routes the "To" address based on a form field value.
    ///   e.g. When "Department" = "Sales" → send to sales@company.com
    ///   The base "To" field acts as a fallback if no routing rule matches.
    ///
    /// Conditions: Gates whether the email is sent at all (AND/OR logic).
    ///   e.g. Only send when "Enquiry Type" is "Contact" AND "Region" is not "Internal"
    /// </summary>
    public class DynamicEmailRoutingActor : SendEmailAfterSubmissionActor, IUIPropertyCustomCollection
    {
        private readonly ILogger<DynamicEmailRoutingActor> _log;

        public DynamicEmailRoutingActor()
        {
            _log = ServiceLocator.Current
                .GetInstance<ILoggerFactory>()
                .CreateLogger<DynamicEmailRoutingActor>();
        }

        public override string EditViewFriendlyTitle => "Dynamic Email Routing";

        public new Type PropertyType => typeof(PropertyDynamicEmailRoutingActor);

        public override object Run(object input)
        {
            try
            {
                var allRules = Model as IEnumerable<DynamicEmailRoutingActorModel>;
                if (allRules == null || !allRules.Any())
                {
                    _log.LogWarning("DynamicEmailRoutingActor: No rules configured.");
                    return new SubmissionActorResult { CancelSubmit = false };
                }


                var friendlyData = BuildFriendlySubmissionData();

                _log.LogDebug("DynamicEmailRoutingActor: Friendly data: {Keys}",
                    string.Join(", ", friendlyData.Select(kv => $"[{kv.Key}]=[{kv.Value}]")));

                // Process each rule: evaluate conditions, apply email routing
                var rulesToSend = new List<DynamicEmailRoutingActorModel>();

                foreach (var rule in allRules)
                {
                    // Step 1: Evaluate conditions — if they fail, skip this rule entirely
                    if (!string.IsNullOrWhiteSpace(rule.Conditions))
                    {
                        var matchMode = rule.ConditionMatch?.Trim().ToLowerInvariant() ?? "all";
                        if (!EvaluateConditions(rule.Conditions, friendlyData, matchMode))
                        {
                            _log.LogDebug("DynamicEmailRoutingActor: Rule skipped — conditions not met (mode={Mode}).", matchMode);
                            continue;
                        }
                    }

                    // Step 2: Apply email routing — override the "To" address if a route matches
                    var routedEmail = ResolveEmailRouting(rule.EmailRouting, friendlyData);
                    if (!string.IsNullOrWhiteSpace(routedEmail))
                    {
                        _log.LogDebug("DynamicEmailRoutingActor: Email routed to {Email}", routedEmail);
                        rule.ToEmails = routedEmail;
                    }
                    else
                    {
                        _log.LogDebug("DynamicEmailRoutingActor: No routing match — using fallback ToEmails: {To}", rule.ToEmails);
                    }

                    rulesToSend.Add(rule);
                }

                if (!rulesToSend.Any())
                {
                    _log.LogInformation("DynamicEmailRoutingActor: No rules matched — no emails sent.");
                    return new SubmissionActorResult { CancelSubmit = false };
                }

                _log.LogInformation("DynamicEmailRoutingActor: Sending {Count} email(s).", rulesToSend.Count);

                Model = rulesToSend;
                return base.Run(input);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "DynamicEmailRoutingActor: Error processing email routing.");
                return new SubmissionActorResult { CancelSubmit = false };
            }
        }

        /// <summary>
        /// Resolves the "To" email address from the email routing rules.
        /// Returns the first matching route's email, or null if no route matches.
        /// </summary>
        private string ResolveEmailRouting(string emailRoutingJson, Dictionary<string, string> friendlyData)
        {
            if (string.IsNullOrWhiteSpace(emailRoutingJson))
                return null;

            List<EmailRoutingRule> routes;
            try
            {
                routes = JsonSerializer.Deserialize<List<EmailRoutingRule>>(emailRoutingJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            }
            catch (JsonException ex)
            {
                _log.LogWarning(ex, "DynamicEmailRoutingActor: Failed to parse email routing JSON: {Json}", emailRoutingJson);
                return null;
            }

            if (routes == null || !routes.Any())
                return null;

            foreach (var route in routes)
            {
                if (string.IsNullOrWhiteSpace(route.Field) || string.IsNullOrWhiteSpace(route.Email))
                    continue;

                var fieldName = route.Field.Trim().Trim(':');
                var submittedValue = ResolveFieldValue(fieldName, friendlyData);
                var routeValue = route.Value?.Trim() ?? string.Empty;
                var op = route.Operator?.Trim().ToLowerInvariant() ?? "is";

                bool routeMatched = EvaluateComparison(submittedValue, routeValue, op);

                _log.LogDebug(
                    "DynamicEmailRoutingActor: Email route check — '{Field}' {Op} '{RouteValue}' (submitted='{Submitted}') → {Result}, email={Email}",
                    fieldName, op, routeValue, submittedValue, routeMatched ? "MATCH" : "NO MATCH", route.Email);

                if (routeMatched)
                {
                    return route.Email.Trim();
                }
            }

            return null;
        }

        /// <summary>
        /// Resolves a field value from friendly data, trying exact match first,
        /// then falling back to a whitespace-insensitive match.
        /// The placeholder store may return "Text 2" while the submission data has "Text2".
        /// </summary>
        private string ResolveFieldValue(string fieldName, Dictionary<string, string> friendlyData)
        {
            // Exact match first
            if (friendlyData.TryGetValue(fieldName, out var value))
                return value?.Trim() ?? string.Empty;

            // Fallback: compare with whitespace removed
            var normalised = fieldName.Replace(" ", "");
            foreach (var kvp in friendlyData)
            {
                if (string.Equals(kvp.Key.Replace(" ", ""), normalised, StringComparison.OrdinalIgnoreCase))
                    return kvp.Value?.Trim() ?? string.Empty;
            }

            _log.LogDebug("DynamicEmailRoutingActor: Field '{Field}' not found in submission data. Available keys: {Keys}",
                fieldName, string.Join(", ", friendlyData.Keys));

            return string.Empty;
        }

        /// <summary>
        /// Evaluates a comparison operation between two values using the specified operator.
        /// </summary>
        /// <param name="submittedValue">The actual value from the form submission</param>
        /// <param name="comparisonValue">The expected value to compare against</param>
        /// <param name="operatorName">The comparison operator (is, is_not, contains, starts_with, ends_with, greater_than, less_than)</param>
        /// <returns>True if the comparison passes, false otherwise</returns>
        private bool EvaluateComparison(string submittedValue, string comparisonValue, string operatorName)
        {
            switch (operatorName)
            {
                case "is_not":
                    return !string.Equals(submittedValue, comparisonValue, StringComparison.OrdinalIgnoreCase);
                case "greater_than":
                    return string.Compare(submittedValue, comparisonValue, StringComparison.OrdinalIgnoreCase) > 0;
                case "less_than":
                    return string.Compare(submittedValue, comparisonValue, StringComparison.OrdinalIgnoreCase) < 0;
                case "contains":
                    return submittedValue.IndexOf(comparisonValue, StringComparison.OrdinalIgnoreCase) >= 0;
                case "starts_with":
                    return submittedValue.StartsWith(comparisonValue, StringComparison.OrdinalIgnoreCase);
                case "ends_with":
                    return submittedValue.EndsWith(comparisonValue, StringComparison.OrdinalIgnoreCase);
                case "is":
                default:
                    return string.Equals(submittedValue, comparisonValue, StringComparison.OrdinalIgnoreCase);
            }
        }

        private Dictionary<string, string> BuildFriendlySubmissionData()
        {
            var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var submissionData = SubmissionData?.Data;
            if (submissionData == null) return result;

            var friendlyNameInfos = SubmissionFriendlyNameInfos;

            foreach (var kvp in submissionData)
            {
                if (kvp.Key.StartsWith("SYSTEMCOLUMN", StringComparison.OrdinalIgnoreCase))
                    continue;

                var friendlyName = kvp.Key;
                if (friendlyNameInfos != null)
                {
                    var nameInfo = friendlyNameInfos.FirstOrDefault(n =>
                        string.Equals(n.ElementId, kvp.Key, StringComparison.OrdinalIgnoreCase));

                    if (nameInfo != null)
                    {
                        friendlyName = !string.IsNullOrEmpty(nameInfo.Label)
                            ? nameInfo.Label
                            : nameInfo.FriendlyName ?? kvp.Key;
                    }
                }

                result[friendlyName] = kvp.Value?.ToString() ?? string.Empty;
            }

            return result;
        }

        private bool EvaluateConditions(string conditionsJson, Dictionary<string, string> friendlyData, string matchMode = "all")
        {
            List<ConditionRule> conditions;
            try
            {
                conditions = JsonSerializer.Deserialize<List<ConditionRule>>(conditionsJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            }
            catch (JsonException ex)
            {
                _log.LogWarning(ex, "DynamicEmailRoutingActor: Failed to parse conditions JSON: {Json}", conditionsJson);
                return true;
            }

            if (conditions == null || !conditions.Any())
                return true;

            _log.LogInformation("DynamicEmailRoutingActor: Evaluating conditions with mode={Mode}", matchMode);

            foreach (var condition in conditions)
            {
                if (string.IsNullOrWhiteSpace(condition.Field))
                    continue;

                var fieldName = condition.Field.Trim().Trim(':');
                var submittedValue = ResolveFieldValue(fieldName, friendlyData);
                var conditionValue = condition.Value?.Trim() ?? string.Empty;
                var op = condition.Operator?.Trim().ToLowerInvariant() ?? "is";

                bool conditionPassed = EvaluateComparison(submittedValue, conditionValue, op);

                _log.LogDebug(
                    "DynamicEmailRoutingActor: Condition — '{Field}' {Op} '{Expected}' (submitted='{Submitted}') → {Result}",
                    fieldName, op, conditionValue, submittedValue, conditionPassed ? "PASS" : "FAIL");

                if (matchMode == "any")
                {
                    // ANY mode: return true as soon as one condition passes
                    if (conditionPassed)
                        return true;
                }
                else
                {
                    // ALL mode: return false as soon as one condition fails
                    if (!conditionPassed)
                        return false;
                }
            }

            // ALL mode: all conditions passed → true
            // ANY mode: no condition passed → false
            return matchMode != "any";
        }
    }
}
