﻿/**
 * English translations for WebExpress
 */
webexpress.webui.I18N.register("en", "webexpress.webapp", {

    "dropdown.search.placeholder": "Search...",

    "form.edit_row": "Edit Row",
    "form.edit_item": "Edit Item",

    "input.unique.error": "Unable to check uniqueness - server could not be reached.",
    "input.unique.checking": "Checking uniqueness...",
    "input.unique.available": "\"{value}\" is available.",
    "input.unique.unavailable": "\"{value}\" is not available.",

    "form.validation.errors": "Please fix the following errors before proceeding:",

    // validation messages
    "validation.invalid": "Invalid value",
    "validation.email.invalid": "Please enter a valid email address.",
    "validation.format.invalid": "Invalid format.",
    "validation.number.range": "Value must be {max}.",
    "validation.minlength": "Please enter at least {minlength} characters.",
    "validation.maxlength": "Please enter no more than {maxlength} characters.",
    "validation.failed": "Validation failed.",

    // error / status messages
    "error.no_endpoint": "No API endpoint configured for RestFormCtrl",
    "error.load_failed": "Failed to load data: {status}",
    "error.request_failed": "Request failed with status {status}",
    "error.generic": "An error occurred",
    "error.create_failed": "Creation failed.",
    "error.missing_id": "Missing 'id' parameter.",
    "error.not_found": "Item not found.",
    "error.update_failed": "Error updating resource: {message}",
    "error.delete_failed": "Error deleting resource: {message}",

    "delete.confirmation.prompt": "Please type {item} to confirm deletion.", 
    "delete.confirmation.mismatch": "The value does not match. Please check your input.",

    // status
    "status.online": "Online",
    "status.connecting": "Connecting...",
    "status.error": "Error",
    "status.offline": "Offline",
    
    // wql
    "wql.placeholder": "wql",
    "wql.status.initializing": "Initializing...",
    "wql.status.ready": "Ready.",
    "wql.status.sent": "Valid query sent.",
    "wql.error.history.unavailable": "History unavailable.",
    "wql.error.unknown": "Unknown error",
    "wql.error.network": "Network error during validation.",
    "wql.error.label": "Error",
    "wql.no.suggestions": "No suggestions.",
    "wql.type.input": "Input",
    "wql.type.attribute": "Attribute",
    "wql.type.operator": "Operator",
    "wql.type.parameter": "Value",
    "wql.type.set.parameter": "List Value",
    "wql.type.parenthesis.open": "Start List",
    "wql.type.set.next": "Separator",
    "wql.type.after.parameter": "Option/Logic",
    "wql.type.logical.operator": "Logic",
    "wql.type.number": "Number",
    "wql.tab.label": "Press <span class=\"wx-wql-key\">Tab</span> for <b>{0}</b>",
    "wql.cursor.label": "Use <span class=\"wx-wql-key ms-5\">↑/↓</span> to navigate (<span class=\"text-muted\">{0}</span>)"
});