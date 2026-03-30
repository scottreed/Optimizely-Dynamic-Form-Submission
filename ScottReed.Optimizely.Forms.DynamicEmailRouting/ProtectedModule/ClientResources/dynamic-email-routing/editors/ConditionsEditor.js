define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/dom-construct",
    "dojo/on",
    "dojo/when",
    "epi/dependency",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin"
], function (
    declare,
    lang,
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
                    '.condition-row select.condition-operator { flex: 0 0 90px; }' +
                    '.condition-row input.condition-value { flex: 2; min-width: 120px; }' +
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

        postCreate: function () {
            this.inherited(arguments);
            this._rows = [];
            this._formFields = [];
            this.own(on(this.addButton, "click", lang.hitch(this, this._onAddCondition)));
        },

        startup: function () {
            this.inherited(arguments);
            this._loadFormFields();
        },

        // Loads form fields from the same data store that the Insert placeholder dropdown uses
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
                    // Now render rows (fields are available for the dropdowns)
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

        _addConditionRow: function (data) {
            data = data || { field: "", operator: "is", value: "" };

            var row = domConstruct.create("div", { "class": "condition-row" }, this.conditionsContainer);

            var fieldSelect = this._createFieldSelect(data.field || "", row);

            var operatorSelect = domConstruct.create("select", {
                "class": "condition-operator"
            }, row);
            domConstruct.create("option", { value: "is", innerHTML: "is", selected: (data.operator !== "is not") }, operatorSelect);
            domConstruct.create("option", { value: "is not", innerHTML: "is not", selected: (data.operator === "is not") }, operatorSelect);

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
                on(fieldSelect, "change", lang.hitch(this, this._onConditionChanged)),
                on(operatorSelect, "change", lang.hitch(this, this._onConditionChanged)),
                on(valueInput, "input", lang.hitch(this, this._onConditionChanged)),
                on(removeBtn, "click", lang.hitch(this, function () {
                    this._removeConditionRow(rowData);
                }))
            );
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
