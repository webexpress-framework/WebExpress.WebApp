/**
 * Keeps a document form saved as an unpublished draft while it is being written, and reports
 * that on the footer bar the publish button sits on.
 *
 * The rest form is a single transaction: it loads once, it submits once, and everything typed
 * in between exists only in the DOM. For an issue that is right - the form is short and the
 * save is one click away. For a document it is not: the text is the work, a lost tab is a lost
 * afternoon, and the save that matters ("publish") is a decision about readers rather than
 * about storage.
 *
 * So the two are split across the two services the form declares. Every change is written to
 * the "draft" service - no commit, no revision, nothing the readers see - while the submit
 * goes to the "data" service, whose PUT applies the text and ends the draft in its own
 * transaction. This controller never deletes a draft as part of publishing: a delete racing a
 * publish that failed would destroy the only copy of the text.
 *
 * The host is the save indicator in the footer, not the form. The controller registry keeps one
 * instance per element and the form already carries the RestFormCtrl that loads and publishes,
 * so a second class registered on it would replace the first in the registry and never be torn
 * down. The indicator carries the whole configuration instead, and reaches the form and the
 * services by walking up to it.
 *
 * Events dispatched on the host element, all bubbling:
 *   webexpress.webapp.Event.EDITOR_DRAFT_SAVED      detail: { values, updated }
 *   webexpress.webapp.Event.EDITOR_DRAFT_DISCARDED  detail: { }
 *   webexpress.webapp.Event.EDITOR_PUBLISHED        detail: { response }
 *   webexpress.webapp.Event.EDITOR_STATE            detail: { state }
 */
webexpress.webapp.EditorFormCtrl = class extends webexpress.webui.Ctrl {

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

    /**
     * Create a new EditorFormCtrl instance.
     * @param {HTMLElement} element - The save indicator, which carries the configuration.
     */
    constructor(element) {
        super(element);

        this._form = element.closest("form");
        this._service = null;
        this._listeners = [];
        this._timer = null;
        this._deadline = null;
        this._inFlight = false;
        this._touched = false;
        this._sealed = false;
        this._last = null;
        this._draft = false;
        this._updated = null;
        this._state = "idle";
        this._menu = null;
        this._destroyed = false;

        // an indicator outside a form, or a form that declared no draft service, carries no
        // autosave; the surface then behaves like an ordinary edit form, which is a supported
        // way to author the control rather than an error
        if (!this._form) {
            return;
        }

        const ds = element.dataset;

        this._debounce = this._duration(ds.wxDebounce, 900);
        this._maxDelay = this._duration(ds.wxMaxDelay, 5000);
        this._menuId = ds.wxMenu || null;
        this._discardId = ds.wxDiscard || null;
        this._channel = ds.wxChannel || null;

        // the announcements carry who sent them, because the queue hands a message to every
        // listener including the one that sent it
        this._author = "a-" + Math.random().toString(36).slice(2, 10);

        this._service = webexpress.webapp.ServiceRegistry.fromElement(this._form).draft || null;

        if (!this._service) {
            return;
        }

        this._bind();
        this._share();
        this.render();
        void this._resume();
    }

    /**
     * Returns the save state the indicator is showing.
     * @returns {string} One of idle, draft, pending, saving, saved, error, publishing, discarding.
     */
    get state() {
        return this._state;
    }

    /**
     * Writes the current state into the indicator and announces it.
     *
     * The state is one attribute rather than a set of classes, so a stylesheet selects on a
     * value and this method swaps one instead of juggling a set.
     */
    render() {
        this._element.setAttribute("data-wx-state", this._state);
        this._element.textContent = this._text(this._state);

        this._dispatch(webexpress.webapp.Event.EDITOR_STATE, { state: this._state });
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
        this._render("discarding");

        const result = await this._service.remove();

        this._sealed = false;

        if (!result.ok) {
            this._render("error");
            return;
        }

        // the text on screen is about to be replaced by the published one, so nothing of the
        // discarded draft may be carried into the next save
        this._last = null;
        this._touched = false;
        this._draft = false;
        this._updated = null;

        this._revealMenu(false);
        this._render("idle");
        this._dispatch(webexpress.webapp.Event.EDITOR_DRAFT_DISCARDED, {});

        // the form is re-loaded even though the dialog is about to close, because the dialog is
        // not rebuilt when it is opened again: without this the next open would show the text
        // that was just thrown away
        this._formCtrl()?.load?.();
        this._closeDialog();
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
     * Subscribes to what the author does in the form, to the publication the form performs, and
     * to the page going away.
     */
    _bind() {
        const touch = () => { this._touched = true; };

        for (const type of webexpress.webapp.EditorFormCtrl.TOUCH_EVENTS) {
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
            this._render("publishing");
        });

        this._listen(this._form, webexpress.webui.Event.UPLOAD_SUCCESS_EVENT, (event) => this._published(event));

        // a publication that failed leaves the draft standing and the author still writing, so
        // the autosave has to come back
        this._listen(this._form, webexpress.webui.Event.DATA_ERROR_EVENT, () => {
            if (this._sealed) {
                this._sealed = false;
                this._render(this._draft ? "draft" : "idle");
            }
        });

        this._listen(this._form, "click", (event) => this._onClick(event));

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
            if (!message || message.type !== webexpress.webapp.EditorFormCtrl.DRAFT_TYPE) {
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
            type: webexpress.webapp.EditorFormCtrl.DRAFT_TYPE,
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
        this._render("draft");
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
     * Flushes a pending save as the page goes away, and takes the page level listeners off when
     * the surface is gone.
     *
     * The modal marks the footer it lifts onto the dialog bar as intentionally detached, and the
     * controller registry skips a detached subtree when it tears an element down - so a
     * controller living on that bar can outlive its dialog without ever being destroyed. The
     * listeners that are not on the form check for that themselves.
     */
    _leave() {
        if (this._destroyed || this._element.isConnected === false) {
            this._unbind();
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
        this._render("idle");
        this._dispatch(webexpress.webapp.Event.EDITOR_PUBLISHED, { response: event?.detail?.response ?? null });

        // the decision the dialog was opened for has been taken, so it has nothing left to ask.
        // Closing is done here rather than left to the form controller, which only closes when
        // the endpoint's answer happens to say so - publishing always ends the editing.
        this._closeDialog();
    }

    /**
     * Closes the dialog the editor is rendered as.
     *
     * The close goes through the dialog's own controller rather than through the underlying
     * dialog library, so the framework's hide event is dispatched and a host that listens for it
     * is told. A surface rendered outside a dialog has nothing to close.
     */
    _closeDialog() {
        const dialog = this._element.closest(".modal, .wx-webui-modal");
        const ctrl = dialog ? webexpress.webui.Controller.getInstanceByElement(dialog) : null;

        if (ctrl && typeof ctrl.hide === "function") {
            ctrl.hide();
        }
    }

    /**
     * Handles a click anywhere in the form, looking for the discard entry.
     *
     * The entry is found by walking up from the target rather than by a selector, because a
     * dropdown rebuilds its entries into fresh anchors: only the id and the data attributes of
     * the authored entry survive that, and the element the server rendered is gone.
     * @param {MouseEvent} event - The click.
     */
    _onClick(event) {
        if (!this._discardId) {
            return;
        }

        for (let node = event.target; node && node !== this._form; node = node.parentElement) {
            if (node.id === this._discardId) {
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
        this._render(this._draft ? "draft" : "idle");
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

        this._render("pending");

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
        this._render("saving");

        const result = await this._service.update(values);

        this._inFlight = false;

        if (!result.ok) {
            // the text is still in the dom and the next change retries, so a failed save is
            // reported rather than raised
            this._render("error");
            return;
        }

        this._last = body;
        this._draft = true;
        this._updated = new Date();

        this._revealMenu(true);
        this._render("saved");
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
     * registry initializes children before their parents: this controller exists before the one
     * on the form does.
     * @returns {Object|null} The form controller, or null.
     */
    _formCtrl() {
        return webexpress.webui.Controller.getInstanceByElement(this._form);
    }

    /**
     * Shows or hides the overflow menu.
     *
     * A class rather than an inline display, so what the menu is laid out as stays the
     * stylesheet's decision - an inline value outranks every rule that could say otherwise.
     * @param {boolean} show - Whether there is a draft to act on.
     */
    _revealMenu(show) {
        if (!this._menu && this._menuId) {
            this._menu = document.getElementById(this._menuId);
        }

        this._menu?.classList.toggle(webexpress.webapp.EditorFormCtrl.MENU_EMPTY_CLASS, !show);
    }

    /**
     * Moves the indicator to a state and paints it.
     * @param {string} state - The new state.
     */
    _render(state) {
        this._state = state;
        this.render();
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
webexpress.webui.Controller.registerClass("wx-webapp-editor-form", webexpress.webapp.EditorFormCtrl);
