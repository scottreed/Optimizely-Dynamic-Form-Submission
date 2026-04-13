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
            '<div class="dynamic-email-routing-editor">' +
            '<div data-dojo-attach-point="routesContainer"></div>' +
            '<div class="routing-add-row">' +
            '<button type="button" data-dojo-attach-point="addButton" class="routing-btn routing-btn-add">+ Add Route</button>' +
            '</div>' +
            '<style>' +
            '.dynamic-email-routing-editor { margin: 4px 0; }' +
            '.routing-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }' +
            '.routing-row select, .routing-row input { padding: 6px 8px; border: 1px solid #c8c8c8; border-radius: 3px; font-size: 13px; }' +
            '.routing-row select.routing-field { flex: 1; min-width: 100px; }' +
            '.routing-row select.routing-operator { flex: 0 0 120px; }' +
            '.routing-row input.routing-value, .routing-row select.routing-value { flex: 1; min-width: 80px; }' +
            '.routing-row input.routing-email { flex: 2; min-width: 150px; }' +
            '.routing-btn { padding: 4px 10px; border: 1px solid #c8c8c8; border-radius: 3px; cursor: pointer; font-size: 13px; background: #fff; }' +
            '.routing-btn:hover { background: #f0f0f0; }' +
            '.routing-btn-remove { color: #c00; border-color: #c00; padding: 4px 8px; }' +
            '.routing-btn-remove:hover { background: #fee; }' +
            '.routing-btn-add { color: #0078d4; border-color: #0078d4; }' +
            '.routing-btn-add:hover { background: #e6f2ff; }' +
            '.routing-add-row { margin-top: 4px; }' +
            '</style>' +
            '</div>',

        value: "[]",
        _rows: null,
        _updating: false,
        _formFields: null,
        _fieldsLoaded: false,
        _elementItemsCache: null,

        postCreate: function () {
            this.inherited(arguments);
            this._rows = [];
            this._formFields = [];
            this._elementItemsCache = {};
            this.own(on(this.addButton, "click", lang.hitch(this, this._onAddRoute)));
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
                    console.warn("EmailRoutingEditor: Failed to load form fields", err);
                    self._fieldsLoaded = true;
                    self._renderFromValue();
                });
            } catch (e) {
                console.warn("EmailRoutingEditor: Could not access form fields store", e);
                this._fieldsLoaded = true;
                this._renderFromValue();
            }
        },

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
                        if (self._fieldsLoaded) {
                            self._renderFromValue();
                        }
                    },
                    error: function () {
                        self._elementItemsCache = {};
                    }
                });
            } catch (e) {
                console.warn("EmailRoutingEditor: Could not load selection items", e);
            }
        },

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
            domConstruct.empty(this.routesContainer);
            this._rows = [];

            var routes = [];
            try {
                routes = JSON.parse(this.value || "[]");
            } catch (e) {
                routes = [];
            }

            if (!Array.isArray(routes)) {
                routes = [];
            }

            for (var i = 0; i < routes.length; i++) {
                this._addRouteRow(routes[i]);
            }
        },

        _createFieldSelect: function (selectedValue, parentNode) {
            var fieldSelect = domConstruct.create("select", {
                "class": "routing-field"
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

            if (selectedValue && fieldSelect.value !== selectedValue) {
                domConstruct.create("option", {
                    value: selectedValue,
                    innerHTML: selectedValue + " (not found)",
                    selected: true
                }, fieldSelect);
            }

            return fieldSelect;
        },

        _createValueSelect: function (items, currentValue, parentNode, insertBefore) {
            var select = domConstruct.create("select", {
                "class": "routing-value"
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

        _updateValueInput: function (rowData) {
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
            var emailInput = rowData.emailInput;
            var newInput;

            if (items && items.length > 0) {
                newInput = this._createValueSelect(items, currentValue, row, emailInput);
            } else {
                newInput = domConstruct.create("input", {
                    type: "text",
                    "class": "routing-value",
                    placeholder: "Field value",
                    value: currentValue
                });
                domConstruct.place(newInput, emailInput, "before");
            }

            domConstruct.destroy(oldInput);
            rowData.valueInput = newInput;

            var eventType = newInput.tagName === "SELECT" ? "change" : "input";
            this.own(on(newInput, eventType, lang.hitch(this, this._onRouteChanged)));
        },

        _addRouteRow: function (data) {
            data = data || { field: "", operator: "is", value: "", email: "" };

            var self = this;
            var row = domConstruct.create("div", { "class": "routing-row" }, this.routesContainer);

            var fieldSelect = this._createFieldSelect(data.field || "", row);

            var operatorSelect = domConstruct.create("select", {
                "class": "routing-operator"
            }, row);
            domConstruct.create("option", { value: "is", innerHTML: "is", selected: (data.operator === "is") }, operatorSelect);
            domConstruct.create("option", { value: "is_not", innerHTML: "is not", selected: (data.operator === "is_not") }, operatorSelect);
            domConstruct.create("option", { value: "greater_than", innerHTML: "greater than", selected: (data.operator === "greater_than") }, operatorSelect);
            domConstruct.create("option", { value: "less_than", innerHTML: "less than", selected: (data.operator === "less_than") }, operatorSelect);
            domConstruct.create("option", { value: "contains", innerHTML: "contains", selected: (data.operator === "contains") }, operatorSelect);
            domConstruct.create("option", { value: "starts_with", innerHTML: "starts with", selected: (data.operator === "starts_with") }, operatorSelect);
            domConstruct.create("option", { value: "ends_with", innerHTML: "ends with", selected: (data.operator === "ends_with") }, operatorSelect);

            var valueInput = domConstruct.create("input", {
                type: "text",
                "class": "routing-value",
                placeholder: "Field value",
                value: data.value || ""
            }, row);

            var emailInput = domConstruct.create("input", {
                type: "email",
                "class": "routing-email",
                placeholder: "email@example.com",
                value: data.email || ""
            }, row);

            var removeBtn = domConstruct.create("button", {
                type: "button",
                "class": "routing-btn routing-btn-remove",
                innerHTML: "&minus;"
            }, row);

            var rowData = {
                node: row,
                fieldSelect: fieldSelect,
                operatorSelect: operatorSelect,
                valueInput: valueInput,
                emailInput: emailInput
            };
            this._rows.push(rowData);

            this.own(
                on(fieldSelect, "change", lang.hitch(this, function () {
                    this._updateValueInput(rowData);
                    this._onRouteChanged();
                })),
                on(operatorSelect, "change", lang.hitch(this, this._onRouteChanged)),
                on(valueInput, "input", lang.hitch(this, this._onRouteChanged)),
                on(emailInput, "input", lang.hitch(this, this._onRouteChanged)),
                on(removeBtn, "click", lang.hitch(this, function () {
                    this._removeRouteRow(rowData);
                }))
            );

            // If loading a saved row with a field, check for predefined options
            if (data.field) {
                this._updateValueInput(rowData);
            }
        },

        _removeRouteRow: function (rowData) {
            var idx = this._rows.indexOf(rowData);
            if (idx >= 0) {
                domConstruct.destroy(rowData.node);
                this._rows.splice(idx, 1);
                this._onRouteChanged();
            }
        },

        _onAddRoute: function () {
            this._addRouteRow({ field: "", operator: "is", value: "", email: "" });
        },

        _onRouteChanged: function () {
            this._updating = true;
            var routes = [];
            for (var i = 0; i < this._rows.length; i++) {
                var r = this._rows[i];
                routes.push({
                    field: r.fieldSelect.value,
                    operator: r.operatorSelect.value,
                    value: r.valueInput.value,
                    email: r.emailInput.value
                });
            }
            this._set("value", JSON.stringify(routes));
            this.onChange(this.value);
            this._updating = false;
        },

        onChange: function () {
            // callback stub
        }
    });
});
