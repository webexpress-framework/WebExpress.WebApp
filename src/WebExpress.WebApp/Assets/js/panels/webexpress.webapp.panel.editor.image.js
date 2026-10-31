/**
 * The image page WebApp adds to the editor's image dialog: an image is uploaded through the
 * editor's upload service or chosen from its image library. WebUI only knows image addresses;
 * where the files of an application live and how they arrive there is the application's matter,
 * so the page is offered only to an editor that names an upload or a library address.
 *
 * The upload answers with the stored file - an item carrying its uri, as in a file result - so
 * the image is inserted at the address the server chose rather than at a guessed one.
 */
webexpress.webui.DialogPanels.register("editor-image", {
    id: "webexpress.webapp.editor.image.library",
    title: webexpress.webui.I18N.translate("webexpress.webapp:editor.image.library.title"),
    iconClass: "images",

    /**
     * Offers the page to an editor with an upload or a library address.
     * @param {object} editor - The editor the dialog belongs to.
     * @returns {boolean} Whether the page is shown.
     */
    available: function (editor) {
        return !!(editor.imageUploadUri || editor.imageLibraryUri);
    },

    /**
     * Builds the upload area, the library and the alternative text.
     * @param {HTMLElement} pane - The page pane.
     * @param {object} modal - The dialog, whose editorDialog names the editor.
     */
    render: function (pane, modal) {
        const editor = modal.editorDialog.editor;
        const page = modal._webappImage = { uploading: 0 };

        const status = document.createElement("div");
        status.className = "form-text";
        status.setAttribute("role", "status");
        page.status = status;

        if (editor.imageUploadUri) {
            const area = document.createElement("div");
            area.className = "wx-webapp-editor-image-upload mb-3";

            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.hidden = true;
            input.addEventListener("change", () => {
                this._upload(modal, input.files && input.files[0]);
                input.value = "";
            });

            const button = document.createElement("button");
            button.type = "button";
            button.className = "btn btn-outline-primary";
            const icon = document.createElement("i");
            icon.className = webexpress.webui.IconSet.resolve("upload") + " me-2";
            button.appendChild(icon);
            button.appendChild(document.createTextNode(webexpress.webui.I18N.translate("webexpress.webapp:editor.image.upload.button")));
            button.addEventListener("click", () => input.click());

            const hint = document.createElement("span");
            hint.className = "form-text ms-2";
            hint.textContent = webexpress.webui.I18N.translate("webexpress.webapp:editor.image.upload.hint");

            area.addEventListener("dragover", (e) => {
                e.preventDefault();
                area.classList.add("wx-webapp-editor-image-upload-over");
            });
            area.addEventListener("dragleave", () => area.classList.remove("wx-webapp-editor-image-upload-over"));
            area.addEventListener("drop", (e) => {
                e.preventDefault();
                area.classList.remove("wx-webapp-editor-image-upload-over");
                this._upload(modal, e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
            });

            area.appendChild(input);
            area.appendChild(button);
            area.appendChild(hint);
            area.appendChild(status);
            pane.appendChild(area);
        } else {
            pane.appendChild(status);
        }

        page.library = new webexpress.webapp.EditorLibrary({
            uri: editor.imageLibraryUri,
            className: "wx-webapp-editor-library wx-webapp-editor-image-library mb-3",
            accept: (item) => !!modal.editorDialog.address(item.uri),
            activate: () => modal.submit?.(),
            render: (item) => {
                const figure = document.createElement("span");
                figure.className = "wx-webapp-editor-image-item";
                const image = document.createElement("img");
                image.src = item.image || item.uri;
                image.alt = "";
                image.loading = "lazy";
                const caption = document.createElement("span");
                caption.className = "wx-webapp-editor-image-name";
                caption.textContent = webexpress.webapp.EditorLibrary.label(item);
                figure.appendChild(image);
                figure.appendChild(caption);
                return figure;
            }
        });
        pane.appendChild(page.library.element);

        const altLabel = document.createElement("label");
        altLabel.className = "form-label d-block";
        altLabel.textContent = webexpress.webui.I18N.translate("webexpress.webapp:editor.image.alt");
        page.alt = document.createElement("input");
        page.alt.type = "text";
        page.alt.className = "form-control";
        page.alt.placeholder = webexpress.webui.I18N.translate("webexpress.webapp:editor.image.alt.placeholder");
        altLabel.appendChild(page.alt);
        pane.appendChild(altLabel);
    },

    /**
     * Starts each opening without a choice; an edited image is chosen once the library lists it.
     * @param {object} modal - The dialog.
     */
    onShow: function (modal) {
        const page = modal._webappImage;
        const dialog = modal.editorDialog;
        if (!page || !dialog) {
            return;
        }
        page.status.textContent = "";
        page.alt.value = dialog.mode === "edit" ? dialog.prefill.alt : "";
        page.library.reset(dialog.mode === "edit" ? dialog.prefill.url : null);
        page.library.load();
    },

    /**
     * Requires a chosen image and no upload still running.
     * @param {object} modal - The dialog.
     * @returns {true|{valid:false,message:string}}
     */
    validate: function (modal) {
        const page = modal._webappImage;
        if (page.uploading > 0) {
            return { valid: false, message: webexpress.webui.I18N.translate("webexpress.webapp:editor.image.upload.pending") };
        }
        if (!page.library.selected) {
            return { valid: false, message: webexpress.webui.I18N.translate("webexpress.webapp:editor.image.library.select") };
        }
        return true;
    },

    /**
     * Inserts or replaces the image with the chosen one; the dialog closes once this returns.
     * @param {object} modal - The dialog.
     */
    onSubmit: function (modal) {
        const page = modal._webappImage;
        const item = page.library.selected;
        const alt = page.alt.value.trim() || webexpress.webapp.EditorLibrary.label(item);
        if (!modal.editorDialog.apply({ src: item.uri, alt })) {
            throw new Error(webexpress.webui.I18N.translate("webexpress.webapp:editor.image.invalid"));
        }
    },

    /**
     * Uploads an image file and chooses the stored image.
     * @param {object} modal - The dialog.
     * @param {File} file - The chosen or dropped file.
     * @returns {Promise<void>|undefined} Settles once the upload finished.
     */
    _upload: function (modal, file) {
        const page = modal._webappImage;
        const dialog = modal.editorDialog;
        const say = (key, suffix = "") => {
            page.status.textContent = webexpress.webui.I18N.translate("webexpress.webapp:" + key) + suffix;
        };
        if (!file) {
            return;
        }
        if (!/^image\//.test(file.type || "")) {
            say("editor.image.upload.type");
            return;
        }

        const body = new FormData();
        body.append("file", file);
        page.uploading++;
        say("editor.image.upload.progress", " 0 %");

        return webexpress.webui.Transport.upload(dialog.editor.imageUploadUri, body, {
            onProgress: (percent) => say("editor.image.upload.progress", " " + Math.round(percent) + " %")
        }).then((result) => {
            page.uploading--;
            if (!result.ok) {
                say("editor.image.upload.failed");
                return;
            }
            const item = webexpress.webapp.EditorLibrary.items(result.data && result.data.uri ? [result.data] : result.data)[0];
            if (!item || !dialog.address(item.uri)) {
                say("editor.image.upload.noaddress");
                return;
            }
            page.status.textContent = "";
            page.library.add(Object.assign({ name: file.name }, item));
        });
    }
});
