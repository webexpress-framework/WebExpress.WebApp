/**
 * German translation for WebExpress
 */
webexpress.webui.I18N.register("de", "webexpress.webapp", {

    "dropdown.search.placeholder": "Suche...",

    "form.edit_row": "Eintrag bearbeiten",
    "form.edit_item": "Element bearbeiten",
    
    "wizard.previous": "Zurück",
    "wizard.next": "Weiter",
    "wizard.finish": "Abschließen",

    "input.unique.error": "Eindeutigkeit kann nicht überprüft werden - Server ist nicht erreichbar.",
    "input.unique.checking": "Eindeutigkeit wird überprüft...",
    "input.unique.available": "\"{value}\" ist verfügbar.",
    "input.unique.unavailable": "\"{value}\" ist nicht verfügbar.",

    "form.validation.errors": "Bitte beheben Sie die folgenden Fehler, bevor Sie fortfahren:",

    // validation messages
    "validation.invalid": "Ungültiger Wert",
    "validation.email.invalid": "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    "validation.format.invalid": "Ungültiges Format.",
    "validation.number.range": "Wert muss {max} sein.",
    "validation.minlength": "Bitte geben Sie mindestens {minlength} Zeichen ein.",
    "validation.maxlength": "Bitte geben Sie nicht mehr als {maxlength} Zeichen ein.",
    "validation.failed": "Validierung fehlgeschlagen.",

    // error / status messages
    "error.no_endpoint": "Kein API-Endpunkt für RestFormCtrl konfiguriert",
    "error.load_failed": "Daten konnten nicht geladen werden: {status}",
    "error.request_failed": "Anfrage fehlgeschlagen mit Status {status}",
    "error.generic": "Ein Fehler ist aufgetreten",
    "error.create_failed": "Erstellung fehlgeschlagen.",
    "error.missing_id": "Fehlender Parameter 'id'.",
    "error.not_found": "Eintrag nicht gefunden.",
    "error.update_failed": "Fehler beim Aktualisieren der Ressource: {message}",
    "error.delete_failed": "Fehler beim Löschen der Ressource: {message}",

    "delete.confirmation.prompt": "Bitte geben Sie {item} ein, um die Löschaktion zu bestätigen.",
    "delete.confirmation.mismatch": "Der Wert stimmt nicht überein. Bitte überprüfen Sie Ihre Eingabe.",

    "login.error.empty": "Benutzername und Passwort sind erforderlich.",
    "login.error.invalid": "Ungültiger Benutzername oder falsches Passwort.",
    "login.error.locked": "Zu viele fehlgeschlagene Versuche. Bitte versuchen Sie es später erneut.",

    // status
    "status.online": "Online",
    "status.connecting": "Verbindung wird aufgebaut",
    "status.error": "Fehler",
    "status.offline": "Offline",

    // wql
    "wql.placeholder": "wql",
    "wql.status.initializing": "Initialisiere...",
    "wql.status.ready": "Bereit.",
    "wql.status.sent": "Gültige Abfrage gesendet.",
    "wql.error.history.unavailable": "Verlauf nicht verfügbar.",
    "wql.error.unknown": "Unbekannter Fehler",
    "wql.error.network": "Netzwerkfehler bei der Validierung.",
    "wql.error.label": "Ungültige WQL-Syntax.",
    "wql.no.suggestions": "Keine Vorschläge.",
    "wql.type.input": "Eingabe",
    "wql.type.attribute": "Attribut",
    "wql.type.operator": "Operator",
    "wql.type.parameter": "Wert",
    "wql.type.set.parameter": "Listenwert",
    "wql.type.parenthesis.open": "Listenstart",
    "wql.type.set.next": "Trennzeichen",
    "wql.type.after.parameter": "Option/Logik",
    "wql.type.logical.operator": "Logik",
    "wql.type.number": "Zahl",
    "wql.tab.label": "<span class=\"wx-wql-key\">Tab</span> für <b>{0}</b>",
    "wql.cursor.label": "<span class=\"wx-wql-key ms-5\">↑/↓</span> für (<span class=\"text-muted\">{0}</span>)"

});