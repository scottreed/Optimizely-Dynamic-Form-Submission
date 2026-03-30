define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/dom-construct",
    "dojo/on",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin"
], function (
    declare,
    lang,
    domConstruct,
    on,
    _WidgetBase,
    _TemplatedMixin
) {
    return declare([_WidgetBase, _TemplatedMixin], {

        templateString:
            '<div class="condition-match-editor">' +
                '<select data-dojo-attach-point="matchSelect" class="condition-match-select">' +
                    '<option value="all">All conditions must match (AND)</option>' +
                    '<option value="any">Any condition must match (OR)</option>' +
                '</select>' +
                '<style>' +
                    '.condition-match-editor { margin: 4px 0; }' +
                    '.condition-match-select { padding: 6px 8px; border: 1px solid #c8c8c8; border-radius: 3px; font-size: 13px; width: 100%; }' +
                '</style>' +
            '</div>',

        value: "all",

        postCreate: function () {
            this.inherited(arguments);
            this.own(on(this.matchSelect, "change", lang.hitch(this, this._onChanged)));
        },

        startup: function () {
            this.inherited(arguments);
            this.matchSelect.value = this.value || "all";
        },

        _setValueAttr: function (newValue) {
            this._set("value", newValue || "all");
            if (this.matchSelect) {
                this.matchSelect.value = this.value;
            }
        },

        _getValueAttr: function () {
            return this.value || "all";
        },

        _onChanged: function () {
            this._set("value", this.matchSelect.value);
            this.onChange(this.value);
        },

        onChange: function () {
            // callback stub
        }
    });
});
