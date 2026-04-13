define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/xhr",
    "dojo/dom-construct",
    "dojo/on",
    "dojo/when",
    "epi/dependency",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin"
], function (
    declare,
    lang,
    xhr,
    domConstruct,
    on,
    when,
    dependency,
    _WidgetBase,
    _TemplatedMixin
) {
    return declare([_WidgetBase, _TemplatedMixin], {

        templateString:
            '<div class="dynamic-conditions-editor">' +
            '<div data-dojo-attach-point="conditionsContainer"></div>' +
            '<div class="conditions-add-row">' +
            '<button type="button" data-dojo-attach-point="addButton" class="conditions-btn conditions-btn-add">+ Add Condition</button>' +
            '</div>' +
            '<style>' +
            '.dynamic-conditions-editor { margin: 4px 0; }' +
            '.condition-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }' +
            '.condition-row select, .condition-row input { padding: 6px 8px; border: 1px solid #c8c8c8; border-radius: 3px; font-size: 13px; }' +
            '.condition-row select.condition-field { flex: 2; min-width: 120px; }' +
            '.condition-row select.condition-operator { flex: 0 0 120px; }' +
            '.condition-row input.condition-value, .condition-row select.condition-value { flex: 2; min-width: 120px; }' +
            '.conditions-btn { padding: 4px 10px; border: 1px solid #c8c8c8; border-radius: 3px; cursor: pointer; font-size: 13px; background: #fff; }' +
            '.conditions-btn:hover { background: #f0f0f0; }' +
            '.conditions-btn-remove { color: #c00; border-color: #c00; padding: 4px 8px; }' +
            '.conditions-btn-remove:hover { background: #fee; }' +
            '.conditions-btn-add { color: #0078d4; border-color: #0078d4; }' +
            '.conditions-btn-add:hover { background: #e6f2ff; }' +
            '.conditions-add-row { margin-top: 4px; }' +
            '</style>' +
            '</div>',

        value: "[]",
        _rows: null,
        _updating: false,
        _formFields: null,
        _fieldsLoaded: false,
        // Cache of element items keyed by field key: { "fieldKey": [{ caption, value }] or null }
        _elementItemsCache: null,

        postCreate: function () {
            this.inherited(arguments);
            this._rows = [];
            this._formFields = [];
            this._elementItemsCache = {};
            this.own(on(this.addButton, "click", lang.hitch(this, this._onAddCondition)));
        },

        startup: function () {
            this.inherited(arguments);
            this._loadFormFields();
            this._loadSelectionItems();
        },

        _loadFormFields: function () {
            var self = this;

            try {
                var registry = dependency.resolve("epi.storeregistry");
                var contextService = dependency.resolve("epi.shell.ContextService");
                var formsDataStore = registry.get("epi-forms.formsdata");

                var query = {
                    id: "GetAvailableReplacablePlaceHolders",
                    contentLink: contextService.currentContext.id
                };

                when(formsDataStore.query(query), function (result) {
                    self._formFields = [];
                    if (result && result.length) {
                        for (var i = 0; i < result.length; i++) {
                            var item = result[i];
                            self._formFields.push({
                                value: item.key || item.name || item,
                                label: item.value || item.displayName || item.key || item.name || item
                            });
                        }
                    }
                    self._fieldsLoaded = true;
                    self._renderFromValue();
                }, function (err) {
                    console.warn("ConditionsEditor: Failed to load form fields from store", err);
                    self._fieldsLoaded = true;
                    self._renderFromValue();
                });
            } catch (e) {
                console.warn("ConditionsEditor: Could not access form fields store", e);
                this._fieldsLoaded = true;
                this._renderFromValue();
            }
        },

        // Loads all selection element options for the form in one API call.
        // Result is a map: { "FieldName": [{ caption, value }, ...], ... }
        _loadSelectionItems: function () {
            var self = this;

            try {
                var contextService = dependency.resolve("epi.shell.ContextService");
                var formContentLink = contextService.currentContext.id || "";

                if (!formContentLink) return;

                xhr.get({
                    url: "/api/dynamicemailrouting/selection-items/" + encodeURIComponent(formContentLink),
                    handleAs: "json",
                    load: function (data) {
                        self._elementItemsCache = data || {};
                        // Re-render to swap any value inputs that should be dropdowns
                        if (self._fieldsLoaded) {
                            self._renderFromValue();
                        }
                    },
                    error: function () {
                        self._elementItemsCache = {};
                    }
                });
            } catch (e) {
                console.warn("ConditionsEditor: Could not load selection items", e);
            }
        },

        // Returns cached selection items for a field, or null if not a selection element
        _getSelectionItems: function (fieldName) {
            if (!fieldName || !this._elementItemsCache) return null;
            var items = this._elementItemsCache[fieldName];
            return (items && items.length > 0) ? items : null;
        },

        _setValueAttr: function (newValue) {
            if (this._updating) return;
            this._set("value", newValue || "[]");
            if (this._started && this._fieldsLoaded) {
                this._renderFromValue();
            }
        },

        _getValueAttr: function () {
            return this.value || "[]";
        },

        _renderFromValue: function () {
            domConstruct.empty(this.conditionsContainer);
            this._rows = [];

            var conditions = [];
            try {
                conditions = JSON.parse(this.value || "[]");
            } catch (e) {
                conditions = [];
            }

            if (!Array.isArray(conditions)) {
                conditions = [];
            }

            for (var i = 0; i < conditions.length; i++) {
                this._addConditionRow(conditions[i]);
            }
        },

        _createFieldSelect: function (selectedValue, parentNode) {
            var fieldSelect = domConstruct.create("select", {
                "class": "condition-field"
            }, parentNode);

            domConstruct.create("option", {
                value: "",
                innerHTML: "-- Select field --"
            }, fieldSelect);

            for (var i = 0; i < this._formFields.length; i++) {
                var f = this._formFields[i];
                domConstruct.create("option", {
                    value: f.value,
                    innerHTML: f.label,
                    selected: (f.value === selectedValue || f.label === selectedValue)
                }, fieldSelect);
            }

            // If saved value doesn't match any current option, preserve it
            if (selectedValue && fieldSelect.value !== selectedValue) {
                domConstruct.create("option", {
                    value: selectedValue,
                    innerHTML: selectedValue + " (not found)",
                    selected: true
                }, fieldSelect);
            }

            return fieldSelect;
        },

        // Creates a text input for the value field
        _createValueInput: function (currentValue, parentNode, insertBefore) {
            var input = domConstruct.create("input", {
                type: "text",
                "class": "condition-value",
                placeholder: "Value",
                value: currentValue || ""
            }, parentNode, insertBefore ? { place: "before", refNode: insertBefore } : undefined);

            if (insertBefore) {
                domConstruct.place(input, insertBefore, "before");
            }

            return input;
        },

        // Creates a select dropdown for the value field with predefined options
        _createValueSelect: function (items, currentValue, parentNode, insertBefore) {
            var select = domConstruct.create("select", {
                "class": "condition-value"
            });

            domConstruct.create("option", {
                value: "",
                innerHTML: "-- Select value --"
            }, select);

            var hasCurrentValue = false;
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var optValue = item.value || item.caption || "";
                var optLabel = item.caption || item.value || "";
                var isSelected = (optValue === currentValue || optLabel === currentValue);
                if (isSelected) hasCurrentValue = true;

                domConstruct.create("option", {
                    value: optValue,
                    innerHTML: optLabel,
                    selected: isSelected
                }, select);
            }

            // Preserve saved value that's no longer in the options
            if (currentValue && !hasCurrentValue) {
                domConstruct.create("option", {
                    value: currentValue,
                    innerHTML: currentValue + " (not found)",
                    selected: true
                }, select);
            }

            if (insertBefore) {
                domConstruct.place(select, insertBefore, "before");
            } else {
                domConstruct.place(select, parentNode);
            }

            return select;
        },

        // Swaps the value input between text and dropdown based on the selected field
        _updateValueInput: function (rowData) {
            // Look up the field label (what the user sees) to match against selection items
            var fieldKey = rowData.fieldSelect.value;
            var fieldLabel = "";
            var selectedOption = rowData.fieldSelect.options[rowData.fieldSelect.selectedIndex];
            if (selectedOption) {
                fieldLabel = selectedOption.text || fieldKey;
            }

            var currentValue = rowData.valueInput.value || "";
            var items = this._getSelectionItems(fieldLabel) || this._getSelectionItems(fieldKey);

            var row = rowData.node;
            var oldInput = rowData.valueInput;
            var removeBtn = row.querySelector(".conditions-btn-remove");
            var newInput;

            if (items && items.length > 0) {
                newInput = this._createValueSelect(items, currentValue, row, removeBtn);
            } else {
                newInput = this._createValueInput(currentValue, row, removeBtn);
            }

            domConstruct.destroy(oldInput);
            rowData.valueInput = newInput;

            var eventType = newInput.tagName === "SELECT" ? "change" : "input";
            this.own(on(newInput, eventType, lang.hitch(this, this._onConditionChanged)));
        },

        _addConditionRow: function (data) {
            data = data || { field: "", operator: "is", value: "" };

            var self = this;
            var row = domConstruct.create("div", { "class": "condition-row" }, this.conditionsContainer);

            var fieldSelect = this._createFieldSelect(data.field || "", row);

            var operatorSelect = domConstruct.create("select", {
                "class": "condition-operator"
            }, row);
            domConstruct.create("option", { value: "is", innerHTML: "is", selected: (data.operator === "is") }, operatorSelect);
            domConstruct.create("option", { value: "is_not", innerHTML: "is not", selected: (data.operator === "is_not") }, operatorSelect);
            domConstruct.create("option", { value: "greater_than", innerHTML: "greater than", selected: (data.operator === "greater_than") }, operatorSelect);
            domConstruct.create("option", { value: "less_than", innerHTML: "less than", selected: (data.operator === "less_than") }, operatorSelect);
            domConstruct.create("option", { value: "contains", innerHTML: "contains", selected: (data.operator === "contains") }, operatorSelect);
            domConstruct.create("option", { value: "starts_with", innerHTML: "starts with", selected: (data.operator === "starts_with") }, operatorSelect);
            domConstruct.create("option", { value: "ends_with", innerHTML: "ends with", selected: (data.operator === "ends_with") }, operatorSelect);

            // Start with a text input; will be swapped if field has predefined options
            var valueInput = domConstruct.create("input", {
                type: "text",
                "class": "condition-value",
                placeholder: "Value",
                value: data.value || ""
            }, row);

            var removeBtn = domConstruct.create("button", {
                type: "button",
                "class": "conditions-btn conditions-btn-remove",
                innerHTML: "&minus;"
            }, row);

            var rowData = {
                node: row,
                fieldSelect: fieldSelect,
                operatorSelect: operatorSelect,
                valueInput: valueInput
            };
            this._rows.push(rowData);

            this.own(
                on(fieldSelect, "change", lang.hitch(this, function () {
                    this._updateValueInput(rowData);
                    this._onConditionChanged();
                })),
                on(operatorSelect, "change", lang.hitch(this, this._onConditionChanged)),
                on(valueInput, "input", lang.hitch(this, this._onConditionChanged)),
                on(removeBtn, "click", lang.hitch(this, function () {
                    this._removeConditionRow(rowData);
                }))
            );

            // If loading a saved row with a field, check for predefined options
            if (data.field) {
                this._updateValueInput(rowData);
            }
        },

        _removeConditionRow: function (rowData) {
            var idx = this._rows.indexOf(rowData);
            if (idx >= 0) {
                domConstruct.destroy(rowData.node);
                this._rows.splice(idx, 1);
                this._onConditionChanged();
            }
        },

        _onAddCondition: function () {
            this._addConditionRow({ field: "", operator: "is", value: "" });
        },

        _onConditionChanged: function () {
            this._updating = true;
            var conditions = [];
            for (var i = 0; i < this._rows.length; i++) {
                var r = this._rows[i];
                conditions.push({
                    field: r.fieldSelect.value,
                    operator: r.operatorSelect.value,
                    value: r.valueInput.value
                });
            }
            this._set("value", JSON.stringify(conditions));
            this.onChange(this.value);
            this._updating = false;
        },

        onChange: function () {
            // callback stub for Dijit form integration
        }
    });
});
