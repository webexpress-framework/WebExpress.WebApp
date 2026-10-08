/**
 * The dialog a document is written in: the writing surface as the whole of its content, the
 * document's name on its title bar, and on the footer bar - beside the publish button - the
 * switch to the reading view, who else is here, the save state and the overflow menu.
 *
 * It is the dialog's controller rather than a guest on the form, because everything it does is
 * about the dialog: the save state sits on the dialog's bar, the reading view stands in for the
 * dialog's content, publishing and discarding end with the dialog closing, and abandoning means
 * closing it. The rest form controller stays on the form and keeps what is the form's - loading,
 * validating, publishing - and the editor keeps the text; this class reaches both through the
 * registry rather than owning them.
 *
 * Two of its concerns are optional, and independent of each other.
 *
 * Draft. The rest form is a single transaction: it loads once, it submits once, and everything
 * typed in between exists only in the DOM. For an issue that is right - the form is short and
 * the save is one click away. For a document it is not: the text is the work, a lost tab is a
 * lost afternoon, and the save that matters ("publish") is a decision about readers rather than
 * about storage. So every change is written to the "draft" service the form declares - no
 * commit, no revision, nothing the readers see - while the submit goes to the "data" service,
 * whose PUT applies the text and ends the draft in its own transaction. The dialog never deletes
 * a draft as part of publishing: a delete racing a publish that failed would destroy the only
 * copy of the text. Without a declared draft service the dialog is an ordinary edit form.
 *
 * Preview. The editor shows its working surface, not the document: add-ons sit in the frame
 * that names and configures them, tables keep their column resizers, and what cannot be typed
 * into is fenced by the empty paragraphs the caret needs. The switch on the bar puts the reading
 * view the content control builds from the same value in the place of the surface, filled at
 * the moment of the switch, so an author sees what publishing would show without publishing to
 * find out.
 *
 * Events dispatched on the dialog, all bubbling, beside the modal's own show and hide:
 *   webexpress.webapp.Event.EDITOR_DRAFT_SAVED      detail: { values, updated }
 *   webexpress.webapp.Event.EDITOR_DRAFT_DISCARDED  detail: { }
 *   webexpress.webapp.Event.EDITOR_PUBLISHED        detail: { response }
 *   webexpress.webapp.Event.EDITOR_STATE            detail: { state }
 *   webexpress.webui.Event.CHANGE_VISIBILITY_EVENT  detail: { view }
 */
webexpress.webapp.ModalEditorCtrl = class extends webexpress.webui.ModalCtrl {

    /**
     * The user events that count as "the author is working in here". Hydrating the form from
     * the server fires the same input and change events typing does, and saving on those would
     * report "saved" to someone who has written nothing.
     */
    static TOUCH_EVENTS = ["keydown", "paste", "cut", "drop", "pointerdown"];

    /**
     * The class that hides the overflow menu. There is nothing to discard until a draft exists,
     * and the server cannot know whether one does - only the draft endpoint can.
     */
    static MENU_EMPTY_CLASS = "wx-editor-form-menu-empty";

    /**
     * The message a shared surface announces a stored draft with. It travels with the
     * collaborative family because it means what those messages mean: something one author did
     * has to reach the others looking at the same document.
     */
    static DRAFT_TYPE = "webexpress.webapp.collaborative.draft";

    /** The presentation the dialog opens on: the writing surface. */
    static WRITE = "write";

    /** The presentation showing what publishing would show. */
    static PREVIEW = "preview";

    /**
     * Create a new ModalEditorCtrl instance.
     * @param {HTMLElement} element - The dialog, carrying the configuration.
     */
    constructor(element) {
        super(element);

        this._form = element.closest("form");
        this._listeners = [];
        this._destroyed = false;

        this._service = null;
        this._timer = null;
        this._deadline = null;
        this._inFlight = false;
        this._touched = false;
        this._sealed = false;
        this._last = null;
        this._draft = false;
        this._updated = null;
        this._state = "idle";
        this._indicator = null;
        this._menu = null;
        this._queue = null;
        this._onAnnouncement = null;

        this._surface = null;
        this._preview = null;
        this._switcher = null;
        this._view = webexpress.webapp.ModalEditorCtrl.WRITE;

        this._debounce = this._duration(element.getAttribute("data-wx-debounce"), 900);
        this._maxDelay = this._duration(element.getAttribute("data-wx-max-delay"), 5000);
        this._channel = element.getAttribute("data-wx-channel") || null;
        this._showState = element.getAttribute("data-wx-show-state") !== "false";

        const preview = element.getAttribute("data-wx-preview") === "true";

        element.removeAttribute("data-wx-debounce");
        element.removeAttribute("data-wx-max-delay");
        element.removeAttribute("data-wx-channel");
        element.removeAttribute("data-wx-show-state");
        element.removeAttribute("data-wx-preview");

        // the announcements carry who sent them, because the queue hands a message to every
        // listener including the one that sent it
        this._author = "a-" + Math.random().toString(36).slice(2, 10);

        // the bar the form contributed to the dialog's footer, lifted there by the base, with
        // the presence slot, the menu and the publish button already on it in that order; and
        // the box holding the writing surface, lifted into the body
        this._bar = this._footerDiv.querySelector(".wx-editor-form-footer");
        this._box = this._bodyDiv.querySelector(".wx-editor-form-content");

        if (preview && this._bar && this._box) {
            this._initPreview();
        }

        // a form that declared no draft service carries no autosave; the dialog is then an
        // ordinary edit form, which is a supported way to author the control rather than an error
        this._service = this._form ? (webexpress.webapp.ServiceRegistry.fromElement(this._form).draft || null) : null;

        if (this._service && this._bar) {
            this._initDraft();
        }
    }

    /**
     * Returns the save state the indicator is showing.
     * @returns {string} One of idle, draft, pending, saving, saved, error, publishing, discarding.
     */
    get state() {
        return this._state;
    }

    /**
     * Returns the presentation the dialog is showing.
     * @returns {string} One of write, preview.
     */
    get view() {
        return this._view;
    }

    /**
     * Shows one presentation in the place of the other.
     *
     * The reading view is revealed before it is filled, because the add-ons it brings to life
     * measure themselves, and a chart laid out at zero width stays that way. The hidden
     * attribute rather than an inline display, so what the two are laid out as stays the
     * stylesheet's decision - an inline value outranks every rule that could say otherwise,
     * including the dialog's fill contract.
     * @param {string} name - The presentation, one of write, preview.
     */
    set view(name) {
        const previewing = name === webexpress.webapp.ModalEditorCtrl.PREVIEW;

        if (!this._preview || name === this._view) {
            return;
        }

        this._view = name;

        this._reveal(this._surface, !previewing);
        this._reveal(this._preview, previewing);

        if (previewing) {
            this.refresh();
        }

        this._switcher.active = name;
        this._dispatch(webexpress.webui.Event.CHANGE_VISIBILITY_EVENT, { view: name });
    }

    /**
     * Rebuilds the reading view from what the editor holds now. Nothing happens while the
     * surface is showing; the view is filled at the moment it is asked for.
     */
    refresh() {
        if (this._view !== webexpress.webapp.ModalEditorCtrl.PREVIEW) {
            return;
        }

        const content = webexpress.webui.Controller.getInstanceByElement(this._preview);

        if (content) {
            content.value = this._value();
        }
    }

    /**
     * Drops the unpublished draft and returns the surface to the published text.
     *
     * The discard goes through here rather than through a link, because this is what owns the
     * endpoint: a pending autosave would otherwise land after the delete and open the draft
     * again. Saving is stopped first, then the row is dropped, then the form re-loads so the
     * author sees what the readers see. The page is deliberately not reloaded - a framework
     * control does not get to navigate its host.
     * @returns {Promise<void>} Resolves when the draft is gone and the form has been asked to
     * reload.
     */
    async discard() {
        if (!this._service) {
            return;
        }

        this._sealed = true;
        this._cancel();
        this._setState("discarding");

        const result = await this._service.remove();

        this._sealed = false;

        if (!result.ok) {
            this._setState("error");
            return;
        }

        // the text on screen is about to be replaced by the published one, so nothing of the
        // discarded draft may be carried into the next save
        this._last = null;
        this._touched = false;
        this._draft = false;
        this._updated = null;

        this._revealMenu(false);
        this._setState("idle");
        this._dispatch(webexpress.webapp.Event.EDITOR_DRAFT_DISCARDED, {});

        // the form is re-loaded even though the dialog is about to close, because the dialog is
        // not rebuilt when it is opened again: without this the next open would show the text
        // that was just thrown away
        this._formCtrl()?.load?.();
        this.hide();
    }

    /**
     * Writes the current text as the draft now, without waiting for the debounce.
     * @returns {Promise<void>} Resolves when the write is done or was skipped.
     */
    async save() {
        await this._flush(false);
    }

    /**
     * Removes every listener and clears the pending save.
     */
    destroy() {
        this._destroyed = true;
        this._cancel();
        this._unbind();

        if (this._queue && this._onAnnouncement) {
            this._queue.unregister(this._onAnnouncement);
        }

        this._service?.abort?.();
    }

    /**
     * Builds the reading view beside the writing surface and the switch between the two onto
     * the bar.
     *
     * The box holds one thing - the main section, or the collaborative container around it -
     * and the reading view is placed beside it rather than inside it, so the two can stand in
     * for each other. The view goes through the registry rather than being constructed here, so
     * it is the same content control a page renders, tracked and torn down like one. The switch
     * is the shared one every surface with several views of one subject uses.
     */
    _initPreview() {
        this._surface = this._box.firstElementChild;

        this._preview = document.createElement("div");
        this._preview.className = "wx-webui-content wx-editor-form-preview";
        this._preview.setAttribute("data-fill", "true");
        this._preview.setAttribute("data-placeholder", this._i18n("webexpress.webapp:editorform.preview.empty", ""));
        this._preview.setAttribute("hidden", "");
        this._box.appendChild(this._preview);

        webexpress.webui.Controller.createInstances(this._preview);

        this._switcher = new webexpress.webui.ViewSwitcher({
            views: [
                {
                    name: webexpress.webapp.ModalEditorCtrl.WRITE,
                    label: this._i18n("webexpress.webapp:editorform.view.write", "Write"),
                    icon: "pen"
                },
                {
                    name: webexpress.webapp.ModalEditorCtrl.PREVIEW,
                    label: this._i18n("webexpress.webapp:editorform.view.preview", "Preview"),
                    icon: "eye"
                }
            ],
            active: this._view,
            onSelect: (name) => { this.view = name; }
        });

        // at the left end of the bar, ahead of who is here: it is the mode of the whole
        // surface, so it reads before anything that comments on the text
        const slot = document.createElement("div");
        slot.className = "wx-editor-form-switch";
        slot.appendChild(this._switcher.element);
        this._bar.prepend(slot);

        if (this._form) {
            // a shared document keeps changing under a reading view - the peers type on - and
            // a form that re-loads after a discard replaces the text; both reach the form as the
            // editor's change event, which bubbles, so one listener covers the editor however
            // deeply it nests
            this._listen(this._form, webexpress.webui.Event.CHANGE_VALUE_EVENT, () => this.refresh());
        }

        // whoever comes back to a document comes to write, and a reading view left open would
        // greet them with a text they cannot type into
        this._listen(this._element, webexpress.webui.Event.MODAL_HIDE_EVENT, () => { this.view = webexpress.webapp.ModalEditorCtrl.WRITE; });
    }

    /**
     * Builds the save indicator onto the bar and starts the autosave.
     *
     * The indicator goes between who is here and the overflow menu, so what it says reads as a
     * comment on the publish button the menu is the alternative to. It is built hidden rather
     * than left out when the host wants a quiet bar: the state is still tracked and announced,
     * it just says nothing. The menu and its discard entry are found by the ids derived from the
     * dialog's own, which is how the control renders them.
     */
    _initDraft() {
        this._indicator = document.createElement("div");
        this._indicator.className = "wx-editor-form-state";

        if (!this._showState) {
            this._indicator.setAttribute("hidden", "");
        }

        // looked up on the bar rather than on the document: a page that renders the same
        // control twice - a tutorial stage does - carries the id twice, and the document would
        // answer with the other dialog's menu
        this._menu = this._bar.querySelector("#" + CSS.escape(this._element.id + "_menu"));
        this._bar.insertBefore(this._indicator, this._menu);

        this._bindDraft();
        this._share();
        this._paintState();
        void this._resume();
    }

    /**
     * Subscribes to what the author does in the form, to the publication the form performs, and
     * to the page going away.
     */
    _bindDraft() {
        const touch = () => { this._touched = true; };

        for (const type of webexpress.webapp.ModalEditorCtrl.TOUCH_EVENTS) {
            this._listen(this._form, type, touch, true);
        }

        this._listen(this._form, "input", () => this._schedule());

        // the wysiwyg control moves the field name off its host onto a hidden input it creates
        // inside it and reports the change with this event, which bubbles - so one listener on
        // the form covers the editor however deeply it nests
        this._listen(this._form, webexpress.webui.Event.CHANGE_VALUE_EVENT, () => this._schedule());

        // publishing ends the draft on the server, so the queued save is dropped rather than
        // raced against it: it would otherwise land after the publication and re-open the draft
        this._listen(this._form, "submit", () => {
            this._sealed = true;
            this._cancel();
            this._setState("publishing");
        });

        this._listen(this._form, webexpress.webui.Event.UPLOAD_SUCCESS_EVENT, (event) => this._published(event));

        // a publication that failed leaves the draft standing and the author still writing, so
        // the autosave has to come back
        this._listen(this._form, webexpress.webui.Event.DATA_ERROR_EVENT, () => {
            if (this._sealed) {
                this._sealed = false;
                this._setState(this._draft ? "draft" : "idle");
            }
        });

        this._listen(this._element, "click", (event) => this._onClick(event));

        // a tab closed mid-sentence still lands, because a keepalive request outlives the
        // document an ordinary one would be cancelled with
        this._listen(window, "pagehide", () => this._leave());
        this._listen(document, "visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                this._leave();
            }
        });
    }

    /**
     * Subscribes to the draft announcements of the other authors of this document.
     *
     * A shared surface mirrors what is being typed through the collaborative control, which is
     * live but skips a field the local author is in and coalesces the rest. The stored draft is
     * where the document actually converges, so a save is announced and the peers pick it up -
     * from the endpoint rather than from the message, so what they load is exactly what was
     * stored.
     */
    _share() {
        this._queue = this._channel ? webexpress.webapp.MessageQueue : null;

        if (!this._queue) {
            return;
        }

        this._onAnnouncement = (message) => {
            if (!message || message.type !== webexpress.webapp.ModalEditorCtrl.DRAFT_TYPE) {
                return;
            }

            if (message.containerId !== this._channel || message.author === this._author) {
                return;
            }

            this._adopt();
        };

        this._queue.register(this._onAnnouncement);
    }

    /**
     * Announces that this author stored the draft.
     */
    _announce() {
        if (!this._queue || this._queue.status !== "online") {
            return;
        }

        this._queue.send({
            type: webexpress.webapp.ModalEditorCtrl.DRAFT_TYPE,
            containerId: this._channel,
            author: this._author,
            ts: Date.now()
        });
    }

    /**
     * Loads what another author stored, unless this one is in the middle of writing.
     *
     * A reload replaces the text on screen, so it must not happen over somebody's shoulder: a
     * queued or in-flight save of our own means this author is still writing, and their next
     * save is what the others will adopt instead. The form is re-loaded rather than fed from the
     * message, because the record endpoint answers the draft where there is one - so the peer
     * ends up with exactly what was stored.
     */
    _adopt() {
        if (this._sealed || this._inFlight || this._timer) {
            return;
        }

        this._last = null;
        this._touched = false;
        this._draft = true;

        this._revealMenu(true);
        this._setState("draft");
        this._formCtrl()?.load?.();
    }

    /**
     * Registers a listener and remembers it for the teardown.
     * @param {EventTarget} target - The target to listen on.
     * @param {string} type - The event type.
     * @param {Function} handler - The handler.
     * @param {boolean} [capture] - Whether to listen in the capture phase.
     */
    _listen(target, type, handler, capture) {
        target.addEventListener(type, handler, capture);
        this._listeners.push({ target, type, handler, capture });
    }

    /**
     * Removes every registered listener.
     */
    _unbind() {
        for (const entry of this._listeners) {
            entry.target.removeEventListener(entry.type, entry.handler, entry.capture);
        }

        this._listeners = [];
    }

    /**
     * Flushes a pending save as the page goes away.
     */
    _leave() {
        if (this._destroyed) {
            return;
        }

        void this._flush(true);
    }

    /**
     * Reacts to the successful publication the form reports: the draft is over, and it was the
     * endpoint that ended it.
     * @param {CustomEvent} event - The upload success event of the form.
     */
    _published(event) {
        this._sealed = false;
        this._touched = false;
        this._last = null;
        this._draft = false;
        this._updated = null;

        this._revealMenu(false);
        this._setState("idle");
        this._dispatch(webexpress.webapp.Event.EDITOR_PUBLISHED, { response: event?.detail?.response ?? null });

        // the decision the dialog was opened for has been taken, so it has nothing left to ask.
        // Closing is done here rather than left to the form controller, which only closes when
        // the endpoint's answer happens to say so - publishing always ends the editing.
        this.hide();
    }

    /**
     * Handles a click anywhere in the dialog, looking for the discard entry.
     *
     * The entry is found by walking up from the target rather than by a selector, because a
     * dropdown rebuilds its entries into fresh anchors: only the id and the data attributes of
     * the authored entry survive that, and the element the server rendered is gone.
     * @param {MouseEvent} event - The click.
     */
    _onClick(event) {
        const discardId = this._element.id + "_discard";

        for (let node = event.target; node && node !== this._element; node = node.parentElement) {
            if (node.id === discardId) {
                event.preventDefault();
                void this.discard();
                return;
            }
        }
    }

    /**
     * Asks the draft endpoint whether the editor is resuming an unpublished draft.
     *
     * Only the two reserved keys of the answer are read. Which text the editor opens on is the
     * record endpoint's decision, and the form has already loaded it; merging a second copy in
     * here would make the control the arbiter of something it deliberately is not.
     * @returns {Promise<void>} Resolves when the indicator reflects the answer.
     */
    async _resume() {
        const result = await this._service.load();

        if (this._destroyed || !result.ok) {
            return;
        }

        const data = result.data || {};

        this._draft = data.draft === true;
        this._updated = data.updated ? new Date(data.updated) : null;

        this._revealMenu(this._draft);
        this._setState(this._draft ? "draft" : "idle");
    }

    /**
     * Queues a save behind the typing.
     *
     * The deadline is what keeps a long paragraph from being held hostage to the pause that
     * never comes: the first change of a run fixes the latest moment the run may be written,
     * and every change after it is queued for the earlier of the two.
     */
    _schedule() {
        if (!this._touched || this._sealed || !this._service) {
            return;
        }

        this._setState("pending");

        const now = Date.now();
        this._deadline = this._deadline || (now + this._maxDelay);

        this._cancelTimer();
        this._timer = setTimeout(() => void this._flush(false), Math.max(0, Math.min(this._debounce, this._deadline - now)));
    }

    /**
     * Drops the queued save and its deadline.
     */
    _cancel() {
        this._cancelTimer();
        this._deadline = null;
    }

    /**
     * Drops the queued save, keeping the deadline of the current typing run.
     */
    _cancelTimer() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }

    /**
     * Writes the current values as the draft.
     * @param {boolean} beacon - True to send the request so that it survives the page going
     * away, at the cost of not being able to read the answer.
     * @returns {Promise<void>} Resolves when the write is done or was skipped.
     */
    async _flush(beacon) {
        this._cancel();

        if (!this._touched || this._sealed || !this._service || this._inFlight) {
            return;
        }

        const values = this._payload();

        if (values === null) {
            return;
        }

        const body = JSON.stringify(values);

        // an unchanged payload is not written again; the editor reports a change for a caret
        // move through a formatting command as readily as for a typed character
        if (body === this._last) {
            return;
        }

        if (beacon) {
            this._last = body;

            this._service.request(this._service.baseUri, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: body,
                keepalive: true
            });

            return;
        }

        this._inFlight = true;
        this._setState("saving");

        const result = await this._service.update(values);

        this._inFlight = false;

        if (!result.ok) {
            // the text is still in the dom and the next change retries, so a failed save is
            // reported rather than raised
            this._setState("error");
            return;
        }

        this._last = body;
        this._draft = true;
        this._updated = new Date();

        this._revealMenu(true);
        this._setState("saved");
        this._announce();
        this._dispatch(webexpress.webapp.Event.EDITOR_DRAFT_SAVED, { values: values, updated: this._updated });

        // a change that arrived while the request was open is written now
        if (JSON.stringify(this._payload()) !== this._last) {
            this._schedule();
        }
    }

    /**
     * Returns what the publish would send, which is what the draft stores.
     *
     * The form controller builds it, so the two writes cannot drift into two contracts for the
     * endpoints behind them. Without that controller there is no publish either, and therefore
     * nothing whose shape a draft would have to match.
     * @returns {Object|null} The payload, or null when the form carries no controller.
     */
    _payload() {
        const ctrl = this._formCtrl();

        return ctrl && typeof ctrl.serialize === "function" ? ctrl.serialize() : null;
    }

    /**
     * Resolves the form controller.
     *
     * It is looked up on each use rather than cached at construction, because the controller
     * registry initializes children before their parents: the dialog is inside the form, so this
     * controller exists before the one on the form does.
     * @returns {Object|null} The form controller, or null.
     */
    _formCtrl() {
        return this._form ? webexpress.webui.Controller.getInstanceByElement(this._form) : null;
    }

    /**
     * Returns what the editor holds, in the format it stores.
     *
     * The editor is looked up on each use rather than cached, because the registry initializes
     * children before their parents and the surface is only marked as one once its own
     * controller has run.
     * @returns {string} The raw editor value, or an empty string without an editor.
     */
    _value() {
        const editor = this._element.querySelector(".wx-editor");
        const ctrl = editor ? webexpress.webui.Controller.getInstanceByElement(editor) : null;

        return ctrl?.value ?? "";
    }

    /**
     * Shows or hides the overflow menu.
     *
     * A class rather than an inline display, so what the menu is laid out as stays the
     * stylesheet's decision - an inline value outranks every rule that could say otherwise.
     * @param {boolean} show - Whether there is a draft to act on.
     */
    _revealMenu(show) {
        this._menu?.classList.toggle(webexpress.webapp.ModalEditorCtrl.MENU_EMPTY_CLASS, !show);
    }

    /**
     * Shows or hides one of the two presentations.
     * @param {HTMLElement} element - The presentation.
     * @param {boolean} shown - Whether it is the one on screen.
     */
    _reveal(element, shown) {
        if (shown) {
            element.removeAttribute("hidden");
        } else {
            element.setAttribute("hidden", "");
        }
    }

    /**
     * Moves the indicator to a state and paints it.
     * @param {string} state - The new state.
     */
    _setState(state) {
        this._state = state;
        this._paintState();
    }

    /**
     * Writes the current state into the indicator and announces it.
     *
     * The state is one attribute rather than a set of classes, so a stylesheet selects on a
     * value and this method swaps one instead of juggling a set.
     */
    _paintState() {
        this._indicator.setAttribute("data-wx-state", this._state);
        this._indicator.textContent = this._text(this._state);

        this._dispatch(webexpress.webapp.Event.EDITOR_STATE, { state: this._state });
    }

    /**
     * Returns the text of one save state, with the {0} placeholder filled by the local time of
     * the last write.
     * @param {string} state - The state token, matching the suffix of the i18n key.
     * @returns {string} The text.
     */
    _text(state) {
        const template = this._i18n("webexpress.webapp:editorform.state." + state, "");
        const time = this._updated || new Date();

        return String(template ?? "").replace("{0}", time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }));
    }

    /**
     * Reads a duration from the host configuration.
     * @param {string} value - The authored value.
     * @param {number} fallback - The value used when none was authored.
     * @returns {number} The duration in milliseconds.
     */
    _duration(value, fallback) {
        const parsed = Number(value);

        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    }
};

// register for declarative auto-init
webexpress.webui.Controller.registerClass("wx-webapp-modal-editor", webexpress.webapp.ModalEditorCtrl);
