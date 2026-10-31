/**
 * The link page WebApp adds to the editor's link dialog: the targets an application offers -
 * its pages, documents or records - are loaded from the editor's link service and chosen from
 * a list instead of typing their address. The service answers with items carrying a uri, a
 * title and an optional description; it is offered only to an editor that names the service.
 */
webexpress.webui.DialogPanels.register("editor-link", {
    id: "webexpress.webapp.editor.link.library",
    title: webexpress.webui.I18N.translate("webexpress.webapp:editor.link.library.title"),
    iconClass: "sitemap",

    /**
     * Offers the page to an editor with a link library address.
     * @param {object} editor - The editor the dialog belongs to.
     * @returns {boolean} Whether the page is shown.
     */
    available: function (editor) {
        return !!editor.linkLibraryUri;
    },

    /**
     * Builds the list of link targets.
     * @param {HTMLElement} pane - The page pane.
     * @param {object} modal - The dialog, whose editorDialog names the editor.
     */
    render: function (pane, modal) {
        const page = modal._webappLink = {};
        page.library = new webexpress.webapp.EditorLibrary({
            uri: modal.editorDialog.editor.linkLibraryUri,
            className: "wx-webapp-editor-library wx-webapp-editor-link-library",
            accept: (item) => !!modal.editorDialog.address(item.uri),
            activate: () => modal.submit?.(),
            render: (item) => {
                const content = document.createElement("span");
                content.className = "wx-webapp-editor-link-item";
                const title = document.createElement("span");
                title.className = "wx-webapp-editor-link-title";
                title.textContent = webexpress.webapp.EditorLibrary.label(item);
                content.appendChild(title);
                if (item.description) {
                    const description = document.createElement("span");
                    description.className = "wx-webapp-editor-link-description";
                    description.textContent = String(item.description);
                    content.appendChild(description);
                }
                const address = document.createElement("span");
                address.className = "wx-webapp-editor-link-uri";
                address.textContent = item.uri;
                content.appendChild(address);
                return content;
            }
        });
        pane.appendChild(page.library.element);
    },

    /**
     * Starts each opening without a choice; an edited link's target is chosen once it is listed.
     * @param {object} modal - The dialog.
     */
    onShow: function (modal) {
        const page = modal._webappLink;
        const dialog = modal.editorDialog;
        if (!page || !dialog) {
            return;
        }
        page.library.reset(dialog.mode === "edit" ? dialog.prefill.url : null);
        page.library.load();
    },

    /**
     * Requires a chosen target.
     * @param {object} modal - The dialog.
     * @returns {true|{valid:false,message:string}}
     */
    validate: function (modal) {
        if (!modal._webappLink.library.selected) {
            return { valid: false, message: webexpress.webui.I18N.translate("webexpress.webapp:editor.link.library.select") };
        }
        return true;
    },

    /**
     * Links the selection, or inserts the target's title where nothing was selected; the dialog
     * closes once this returns. Whether the link opens in a new tab follows its address.
     * @param {object} modal - The dialog.
     */
    onSubmit: function (modal) {
        const dialog = modal.editorDialog;
        const item = modal._webappLink.library.selected;
        const text = dialog.prefill.text || webexpress.webapp.EditorLibrary.label(item);
        if (!dialog.apply({ href: item.uri, text })) {
            throw new Error(webexpress.webui.I18N.translate("webexpress.webapp:editor.link.invalid"));
        }
    }
});
