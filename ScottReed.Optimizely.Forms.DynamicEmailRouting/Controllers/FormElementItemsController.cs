using EPiServer;
using EPiServer.Core;
using EPiServer.Forms.Core.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;

namespace ScottReed.Optimizely.Forms.DynamicEmailRouting.Controllers
{
    /// <summary>
    /// API endpoint that returns the predefined selection options for form elements.
    /// Used by the ConditionsEditor and EmailRoutingEditor to swap the free-text value
    /// input to a dropdown when the selected field is a selection element.
    /// </summary>
    [ApiController]
    [Route("api/dynamicemailrouting")]
    [Authorize]
    public class FormElementItemsController : ControllerBase
    {
        private readonly IContentRepository _contentRepository;
        private readonly ILogger<FormElementItemsController> _logger;
        private readonly ContentAssetHelper _assetHelper;

        public FormElementItemsController(
            IContentRepository contentRepository,
            ILogger<FormElementItemsController> logger,
            ContentAssetHelper assetHelper)
        {
            _contentRepository = contentRepository;
            _logger = logger;
            _assetHelper = assetHelper;
        }

        /// <summary>
        /// Returns all selection elements and their options for a given form.
        /// This is called once per form and cached client-side.
        /// Response format: { "fieldName": [{ caption, value }, ...], ... }
        /// Only selection elements (dropdown, radio, checkbox) are included.
        /// </summary>
        /// <param name="formContentLink">The content reference ID of the form container</param>
        [HttpGet("selection-items/{formContentLink}")]
        public IActionResult GetSelectionItems(string formContentLink)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(formContentLink))
                {
                    return Ok(new { });
                }

                if (!ContentReference.TryParse(formContentLink, out var formRef) || ContentReference.IsNullOrEmpty(formRef))
                {
                    return Ok(new { });
                }

                var assetFolder = _assetHelper.GetAssetFolder(formRef);

                var children = _contentRepository.GetChildren<IContent>(assetFolder.ContentLink).ToList();
                if (children == null || children.Count == 0)
                {
                    return Ok(new { });
                }

                var result = new Dictionary<string, List<object>>();

                foreach (var descendant in children)
                {
                    // Check if it's a selection element
                    var elementType = descendant.GetType();
                    if (!IsSelectionElement(elementType))
                    {
                        continue;
                    }

                    // Call GetItems() to get the predefined options
                    var getItemsMethod = elementType.GetMethod("GetItems");
                    if (getItemsMethod == null)
                    {
                        continue;
                    }

                    var items = getItemsMethod.Invoke(descendant, null);
                    if (items == null)
                    {
                        continue;
                    }

                    var options = new List<object>();
                    foreach (var item in (System.Collections.IEnumerable)items)
                    {
                        var itemType = item.GetType();
                        var caption = itemType.GetProperty("Caption")?.GetValue(item)?.ToString() ?? "";
                        var value = itemType.GetProperty("Value")?.GetValue(item)?.ToString() ?? "";

                        if (!string.IsNullOrEmpty(caption) || !string.IsNullOrEmpty(value))
                        {
                            options.Add(new { caption, value });
                        }
                    }

                    if (options.Count > 0)
                    {
                        // Use element name as key. If duplicate names exist,
                        // the first one wins (same as how form submission works)
                        var fieldName = descendant.Name;
                        if (!result.ContainsKey(fieldName))
                        {
                            result[fieldName] = options;
                        }
                    }
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get selection items for form {FormContentLink}", formContentLink);
                return Ok(new { });
            }
        }

        private static bool IsSelectionElement(Type elementType)
        {
            var baseType = elementType.BaseType;
            while (baseType != null)
            {
                if (baseType.IsGenericType &&
                    baseType.GetGenericTypeDefinition().FullName?.Contains("SelectionElementBlockBase") == true)
                {
                    return true;
                }
                baseType = baseType.BaseType;
            }
            return false;
        }
    }
}
