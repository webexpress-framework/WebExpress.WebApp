/**
 * English translations for WebExpress
 */
webexpress.webui.I18N.register("en", "webexpress.webapp", {

    "dropdown.search.placeholder": "Search...",

    "form.edit_row": "Edit Row",
    "form.edit_item": "Edit Item",
    
    "wizard.previous": "Previous",
    "wizard.next": "Next",
    "wizard.finish": "Finish",

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

    "login.error.empty": "Username and password are required.",
    "login.error.invalid": "Invalid username or password.",
    "login.error.locked": "Too many failed attempts. Please try again later.",

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
    "wql.error.label": "Invalid WQL syntax.",
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
    "wql.cursor.label": "Use <span class=\"wx-wql-key ms-5\">↑/↓</span> to navigate (<span class=\"text-muted\">{0}</span>)",

    // form editor
    "formeditor.form.default_name": "New form",
    "formeditor.form.fallback_name": "Form",
    "formeditor.form.name.placeholder": "Form name",
    "formeditor.form.description.placeholder": "Add a form description…",
    "formeditor.tab.default_name": "Details",
    "formeditor.tab.new_name": "Tab {0}",
    "formeditor.tab.fallback_name": "Tab",
    "formeditor.tab.add": "+ Add tab",
    "formeditor.preview.toggle.show": "Show preview",
    "formeditor.preview.toggle.hide": "Hide preview",
    "formeditor.preview.title": "Live preview",
    "formeditor.preview.empty": "Empty tab — add fields from the structure pane.",
    "formeditor.preview.placeholder.enter": "Enter {0}",
    "formeditor.preview.placeholder.describe": "Describe {0}…",
    "formeditor.preview.placeholder.unassigned": "Unassigned",
    "formeditor.preview.placeholder.file": "Drop files or browse…",
    "formeditor.structure.title": "Structure · {0}",
    "formeditor.structure.meta": "{0} nodes",
    "formeditor.structure.empty": "No fields on this tab yet. Use Add field below or press N.",
    "formeditor.structure.required": "REQUIRED",
    "formeditor.group.fallback": "FormGroup",
    "formeditor.group.default_label": "Group",
    "formeditor.field.default_name": "Untitled",
    "formeditor.quickadd.placeholder": "Quick add — type field name or \"vertical\", \"horizontal\"…",
    "formeditor.quickadd.add": "+ Add",
    "formeditor.picker.empty": "No matches.",
    "formeditor.picker.fields": "Fields",
    "formeditor.picker.groups": "Layout groups",
    "formeditor.picker.used": "already used",
    "formeditor.row.action.rename": "Rename (F2)",
    "formeditor.row.action.delete": "Delete (Del)",
    "formeditor.row.action.move": "Drag to move",
    "formeditor.footer.hint": "Drag nodes to reorder · double-click to rename · press N to add",
    "formeditor.footer.draft": "Draft · autosaves on every change",
    "formeditor.footer.offline": "Offline preview · changes are not persisted",
    "formeditor.hints.navigate": "Navigate",
    "formeditor.hints.collapse": "Collapse / expand",
    "formeditor.hints.rename": "Rename",
    "formeditor.hints.delete": "Delete",
    "formeditor.hints.add": "Add"
});