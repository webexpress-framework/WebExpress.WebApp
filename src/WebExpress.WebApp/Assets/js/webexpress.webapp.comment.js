/**
 * A rich, threaded comment display control. Renders a toolbar (category
 * filter + sort), a list of comments with reactions / replies /
 * edit-in-place. Authoring of new top-level comments is delegated to the
 * separate webexpress.webapp.CommentComposerCtrl, which dispatches a
 * COMMENT_ADDED_EVENT on the document; this control listens for that event
 * (when the comment matches the same REST endpoint) and appends the new
 * comment without an additional roundtrip.
 *
 * Each comment carries an author, a category (general / question / hint /
 * status / decision / solution), free-form labels, a body in HTML, a list of
 * likes, a reactions map (emoji → user-ids), and a flat replies array.
 *
 * Declarative configuration: the host carries wx-service islands named
 * "data" (comments endpoint), "users" (mention resolution) and "upload"
 * (inline image upload), plus the data-current-user attribute.
 *
 * REST contract (against the data service):
 *   GET    {uri}                                       → [Comment]
 *   GET    {uri}/categories                            → [Category]
 *   PUT    {uri}/{id}           body { body, category, labels }     → Comment
 *   DELETE {uri}/{id}                                  → 204
 *   POST   {uri}/{id}/reactions body { emoji }         → { reactions }
 *   POST   {uri}/{id}/likes                            → { likes }
 *   POST   {uri}/{id}/pin                              → { pinned }
 *   POST   {uri}/{id}/replies   body { body }          → Reply
 *
 * Events dispatched on the host element:
 *   webexpress.webapp.Event.COMMENT_UPDATED_EVENT   detail: { comment }
 *   webexpress.webapp.Event.COMMENT_DELETED_EVENT   detail: { id }
 *   webexpress.webapp.Event.COMMENT_REACTION_EVENT  detail: { commentId, emoji, reactions }
 *   webexpress.webapp.Event.COMMENT_REPLY_EVENT     detail: { commentId, reply }
 *
 * Events listened for on the document:
 *   webexpress.webapp.Event.COMMENT_ADDED_EVENT     detail: { comment, uri }
 *     - When detail.uri matches this control's REST URI (or is missing),
 *       the new comment is appended to the list and re-rendered.
 */
webexpress.webapp.CommentCtrl = class extends webexpress.webapp.Data {

    /**
     * Default reaction emoji palette.
     */
    static REACTIONS = ["👍", "❤️", "🎉", "😄", "🙏", "👀", "🔥"];

    /**
     * Fallback category descriptor used when a comment references a category
     * the server has not (yet) advertised. Keeps the renderer robust against
     * server / client drift.
     * @param {string} id
     * @returns {Object}
     */
    static _fallbackCategory(id) {
        return { id: id || "general", i18n: "", color: "#6b7280", bg: "#f3f4f6" };
    }

    /**
     * Per-affordance icon mapping. The active theme is resolved at lookup
     * time through {@link webexpress.webui.Ctrl#_iconClass}, which reads the
     * page-wide <c>&lt;html data-icon-theme&gt;</c> attribute and falls back
     * to whichever variant is supplied when one is missing.
     */
    static ICONS = {
        likeFilled:   { fa: "fas fa-heart",         light: "wx-icon-light wx-icon-light-heart" },
        likeOutline:  { fa: "far fa-heart",         light: "wx-icon-light wx-icon-light-heart" },
        pin:          { fa: "fas fa-thumbtack",     light: "wx-icon-light wx-icon-light-thumbtack" },
        chevronDown:  { fa: "fas fa-chevron-down",  light: "wx-icon-light wx-icon-light-chevron-down" },
        chevronRight: { fa: "fas fa-chevron-right", light: "wx-icon-light wx-icon-light-chevron-right" },
        edit:         { fa: "fas fa-pen",           light: "wx-icon-light wx-icon-light-pen" },
        delete:       { fa: "fas fa-trash",         light: "wx-icon-light wx-icon-light-trash" },
        reply:        { fa: "fas fa-reply",         light: "wx-icon-light wx-icon-light-share-nodes" },
        plus:         { fa: "fas fa-plus",          light: "wx-icon-light wx-icon-light-plus" }
    };

    /**
     * Resolves an affordance name to a concrete CSS class string for the
     * active icon theme.
     * @param {string} name - Affordance key into {@link CommentCtrl.ICONS}.
     * @returns {string} The CSS class string for an <c>&lt;i&gt;</c> element.
     */
    _affordanceIconClass(name) {
        const entry = webexpress.webapp.CommentCtrl.ICONS[name];
        if (!entry) {
            return "fas fa-question";
        }
        return this._iconClass(entry.fa, entry.light);
    }

    /**
     * Construct a new CommentCtrl.
     * @param {HTMLElement} element - host element.
     */
    constructor(element) {
        // the toolbar ui state is seeded from the persisted sort cookie and the
        // optional wx-state island; the services come from the wx-service
        // islands. both are resolved before super so the component owns the
        // store and the service map. The wx-state island may also carry the
        // comments themselves, in which case the first paint needs no round
        // trip.
        const cookieMatch = document.cookie.match(new RegExp("(^| )wx_comment_sort_dir=([^;]*)"));
        const persistedSortDir = cookieMatch ? decodeURIComponent(cookieMatch[2]) : null;
        const initialState = Object.assign({
            sortBy: "date",          // "date" | "likes"
            sortDir: (persistedSortDir === "asc" || persistedSortDir === "desc") ? persistedSortDir : "desc",
            filterCat: "all",
            editingId: null          // id of comment currently in edit-mode
        }, webexpress.webapp.Data.readState(element));
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);
        const services = islandServices;

        super(element, { state: initialState, services: services });

        const usersService = this.useService("users");
        this._usersUri = usersService ? usersService.baseUri : null;

        const uploadService = this.useService("upload");
        this._imageUploadUri = uploadService ? uploadService.baseUri : null;

        this._currentUser = element.dataset.currentUser || null;
        this._readonly = element.dataset.readonly === "true";

        // categories are sourced from the REST API ({uri}/categories) unless
        // a static override is supplied via the data-categories attribute
        // (used for offline / read-only embeds).
        this._categoriesPreset = false;
        this._categories = {};
        if (element.dataset.categories) {
            try {
                this._categories = this._normalizeCategories(JSON.parse(element.dataset.categories));
                this._categoriesPreset = true;
            } catch (_) {
                this._categoriesPreset = false;
            }
        }

        // the data service backs the categories, comments, users, edit, delete,
        // like, pin, reaction and reply requests
        this._service = this.useService("data");
        this._uri = this._service ? this._service.baseUri : null;

        // the resource a ViewState renders. when present, the comments themselves are
        // a central resource the enclosing ViewState owns and loads; this control
        // still keeps its own store for the local toolbar state (sort, filter,
        // edit), which is per-control and must not be shared across the ViewState.
        this._resource = (element.dataset && element.dataset.wxResource) || null;
        this._viewState = null;

        // data and caches (view state, not part of the store)
        this._comments = [];
        this._editorEditRef = null; // EditorCtrl instance while editing
        this._userCache = {};    // userId -> user record

        // clean host
        element.textContent = "";
        element.removeAttribute("data-current-user");
        element.removeAttribute("data-readonly");
        element.removeAttribute("data-categories");
        element.classList.add("wx-comment");

        this._buildDom();
        this._attachEventHandlers();
        void this._init();
    }

    // toolbar and edit state accessors backed by the store, so the single
    // source of truth is the store

    get _sortBy() { return this._store.getState().sortBy; }
    set _sortBy(value) { this._store.setState({ sortBy: value }); }

    get _sortDir() { return this._store.getState().sortDir; }
    set _sortDir(value) { this._store.setState({ sortDir: value }); }

    get _filterCat() { return this._store.getState().filterCat; }
    set _filterCat(value) { this._store.setState({ filterCat: value }); }

    get _editingId() { return this._store.getState().editingId; }
    set _editingId(value) { this._store.setState({ editingId: value }); }

    /**
     * Bootstraps the control: loads categories from the REST API (unless
     * provided declaratively) and then performs the initial comment load.
     */
    async _init() {
        // ViewState mode: the enclosing ViewState owns the comments resource. resolve the
        // ViewState first, take its data service for the categories and the
        // mutations, then render the resource slice instead of loading the
        // comments here.
        if (this._resource) {
            await this._attachToViewState();
            return;
        }

        if (!this._categoriesPreset) {
            await this._loadCategories();
        }
        this._rebuildFilterOptions();

        // when the server seeded the comments through the data-wx-state island,
        // render them without a round trip; otherwise load from the endpoint
        const seeded = this.state.comments;
        if (Array.isArray(seeded) && seeded.length > 0) {
            this._comments = seeded.slice();
            await this._preloadUsers();
            this._rebuildFilterOptions();
            this._renderList();
        } else {
            await this._load();
        }
    }

    /**
     * Resolves the enclosing ViewState, adopts its data service, loads the
     * categories through it and subscribes to the comments resource slice, so the
     * comments are loaded once by the ViewState and the control re-renders from the
     * shared slice while its mutations still flow through the ViewState service.
     * @returns {Promise<void>} Resolves once the ViewState is attached.
     */
    async _attachToViewState() {
        const element = this._element;
        const viewStateId = (element.dataset && element.dataset.wxViewstate) || null;

        const viewState = await new Promise((resolve) => {
            webexpress.webapp.ViewStateRegistry.whenReady(element, viewStateId, resolve);
        });

        this._viewState = viewState;

        const service = viewState.serviceForResource(this._resource);
        if (service) {
            this._service = service;
            this._uri = service.baseUri;
        }

        // secondary services (mention resolution, inline image upload) also come
        // from the ViewState in ViewState mode, since the control emits no islands of its own
        const usersService = viewState.useService("users");
        if (usersService) {
            this._usersUri = usersService.baseUri;
        }
        const uploadService = viewState.useService("upload");
        if (uploadService) {
            this._imageUploadUri = uploadService.baseUri;
        }

        if (!this._categoriesPreset) {
            await this._loadCategories();
        }
        this._rebuildFilterOptions();

        const unsubscribe = viewState.watch((state) => state[this._resource], (slice) => this._applySlice(slice));
        (element._wxCleanup = element._wxCleanup || []).push(unsubscribe);

        this._applySlice(viewState.getState()[this._resource]);
    }

    /**
     * Renders a comments resource slice the ViewState loaded centrally. The comments
     * arrive as the raw response array; the toolbar and edit state stay in this
     * control's own store.
     * @param {object} slice The resource slice { items, total, data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};
        const data = slice.data;
        this._comments = Array.isArray(data) ? data : (Array.isArray(slice.items) ? slice.items : []);

        this._preloadUsers().then(() => {
            this._rebuildFilterOptions();
            this._renderList();
        });
    }

    /**
     * Loads the category set from the REST API. Failures fall back to an
     * empty set; the filter will then show only "All categories".
     */
    async _loadCategories() {
        if (!this._uri || !this._service) {
            this._categories = {};
            return;
        }
        const result = await this._service.request(
            webexpress.webapp.commentModel.categoriesUrl(this._uri),
            { headers: { "Accept": "application/json" } });
        if (result.ok) {
            this._categories = this._normalizeCategories(result.data);
        } else {
            console.warn("CommentCtrl: categories load failed", webexpress.webapp.ServiceResult.describe(result));
            this._categories = {};
        }
    }

    /**
     * Accepts either an array of category descriptors or an object keyed by
     * category id and returns the canonical object form keyed by id.
     * @param {Array|Object} input
     * @returns {Object<string, Object>}
     */
    _normalizeCategories(input) {
        return webexpress.webapp.commentModel.normalizeCategories(input);
    }

    /**
     * Tears down listeners.
     */
    destroy() {
        if (this._onCommentAdded) {
            document.removeEventListener(webexpress.webapp.Event.COMMENT_ADDED_EVENT, this._onCommentAdded);
            this._onCommentAdded = null;
        }
    }

    /**
     * Builds the static DOM scaffold: toolbar, list container.
     */
    _buildDom() {
        this._toolbar = document.createElement("div");
        this._toolbar.className = "wx-comment-toolbar";

        // category filter
        this._filterSelect = document.createElement("select");
        this._filterSelect.className = "wx-comment-filter";
        this._rebuildFilterOptions();

        // sort selector
        this._sortSelect = document.createElement("select");
        this._sortSelect.className = "wx-comment-sort";
        const optDate = document.createElement("option");
        optDate.value = "date";
        optDate.textContent = this._i18n("webexpress.webapp:comment.sort.date", "Date");
        const optLikes = document.createElement("option");
        optLikes.value = "likes";
        optLikes.textContent = this._i18n("webexpress.webapp:comment.sort.likes", "Likes");
        this._sortSelect.appendChild(optDate);
        this._sortSelect.appendChild(optLikes);

        this._sortDirBtn = document.createElement("button");
        this._sortDirBtn.type = "button";
        this._sortDirBtn.className = "wx-comment-sort-dir";
        this._updateSortDirBtn();

        const filterLabel = document.createElement("span");
        filterLabel.className = "wx-comment-toolbar-label";
        filterLabel.textContent = this._i18n("webexpress.webapp:comment.filter", "Filter") + ":";

        const sortLabel = document.createElement("span");
        sortLabel.className = "wx-comment-toolbar-label";
        sortLabel.textContent = this._i18n("webexpress.webapp:comment.sort", "Sort") + ":";

        this._toolbar.appendChild(filterLabel);
        this._toolbar.appendChild(this._filterSelect);
        this._toolbar.appendChild(sortLabel);
        this._toolbar.appendChild(this._sortSelect);
        this._toolbar.appendChild(this._sortDirBtn);

        const pinnedNote = document.createElement("span");
        pinnedNote.className = "wx-comment-pinned-note";
        const pinnedNoteIcon = document.createElement("i");
        pinnedNoteIcon.className = this._affordanceIconClass("pin");
        pinnedNoteIcon.setAttribute("aria-hidden", "true");
        pinnedNote.appendChild(pinnedNoteIcon);
        pinnedNote.appendChild(document.createTextNode(" " + this._i18n("webexpress.webapp:comment.pinned-on-top", "Pinned comments stay on top")));
        this._toolbar.appendChild(pinnedNote);

        // list area
        this._list = document.createElement("div");
        this._list.className = "wx-comment-list";

        this._element.appendChild(this._toolbar);
        this._element.appendChild(this._list);
    }

    /**
     * Re-populates the filter select options. Called on init and after each
     * load when category counts change.
     */
    _rebuildFilterOptions() {
        const prev = this._filterSelect.value;
        this._filterSelect.replaceChildren();
        const all = document.createElement("option");
        all.value = "all";
        const counts = this._counts();
        all.textContent = this._i18n("webexpress.webapp:comment.filter.all", "All categories") + ` (${counts.all})`;
        this._filterSelect.appendChild(all);
        for (const cat of Object.values(this._categories)) {
            const opt = document.createElement("option");
            opt.value = cat.id;
            const label = this._i18n(cat.i18n, cat.id);
            opt.textContent = `${label} (${counts[cat.id] || 0})`;
            this._filterSelect.appendChild(opt);
        }
        if (prev) {
            this._filterSelect.value = prev;
        }
    }

    /**
     * Counts comments per category for the toolbar display.
     * @returns {Object<string, number>}
     */
    _counts() {
        const c = { all: this._comments.length };
        for (const k of Object.keys(this._categories)) {
            c[k] = this._comments.filter(x => x.category === k).length;
        }
        return c;
    }

    /**
     * Wires UI event handlers.
     */
    _attachEventHandlers() {
        this._filterSelect.addEventListener("change", () => {
            this._filterCat = this._filterSelect.value;
            this._renderList();
        });
        this._sortSelect.addEventListener("change", () => {
            this._sortBy = this._sortSelect.value;
            this._renderList();
        });
        this._sortDirBtn.addEventListener("click", () => {
            this._sortDir = this._sortDir === "asc" ? "desc" : "asc";
            this._setCookie("wx_comment_sort_dir", this._sortDir, 365);
            this._updateSortDirBtn();
            this._renderList();
        });

        // pick up new comments authored by the separate composer control
        this._onCommentAdded = (event) => this._handleCommentAdded(event);
        document.addEventListener(webexpress.webapp.Event.COMMENT_ADDED_EVENT, this._onCommentAdded);
    }

    /**
     * Appends a comment authored by a sibling CommentComposerCtrl. The
     * composer carries its REST URI in the event detail so that multiple
     * comment surfaces on the same page do not pollute one another.
     * @param {CustomEvent} event
     */
    _handleCommentAdded(event) {
        const detail = event?.detail;
        if (!detail || !detail.comment) {
            return;
        }
        if (detail.uri && this._uri && detail.uri !== this._uri) {
            return;
        }
        if (this._comments.some(c => c.id === detail.comment.id)) {
            return;
        }
        this._comments.push(detail.comment);
        this._preloadUsers().then(() => {
            this._rebuildFilterOptions();
            this._renderList();
        });
    }

    /**
     * Updates the label of the sort-direction button.
     */
    _updateSortDirBtn() {
        if (this._sortDir === "asc") {
            this._sortDirBtn.textContent = this._i18n("webexpress.webapp:comment.sort.asc", "Ascending");
        } else {
            this._sortDirBtn.textContent = this._i18n("webexpress.webapp:comment.sort.desc", "Descending");
        }
    }

    /**
     * Loads the comments from the configured URI and renders them.
     */
    async _load() {
        if (!this._uri || !this._service) {
            this._comments = [];
            this._renderList();
            return;
        }
        const result = await this._service.request(this._uri, { headers: { "Accept": "application/json" } });
        if (result.ok) {
            this._comments = result.data;
        } else {
            console.warn("CommentCtrl: load failed", webexpress.webapp.ServiceResult.describe(result));
            this._comments = [];
        }
        // pre-warm user cache for everyone referenced
        await this._preloadUsers();
        this._rebuildFilterOptions();
        this._renderList();
    }

    /**
     * Pre-fetches every user referenced by a comment so the renderer can
     * resolve names + colors synchronously.
     */
    async _preloadUsers() {
        if (!this._usersUri || !this._service) {
            return;
        }
        const ids = new Set();
        for (const c of this._comments) {
            if (c.author) ids.add(c.author);
            for (const u of (c.likes || [])) ids.add(u);
            for (const [, users] of Object.entries(c.reactions || {})) {
                for (const u of users) ids.add(u);
            }
            for (const r of (c.replies || [])) {
                if (r.author) ids.add(r.author);
            }
        }
        if (this._currentUser) ids.add(this._currentUser);
        const missing = [...ids].filter(id => !this._userCache[id]);
        if (missing.length === 0) {
            return;
        }
        const result = await this._service.request(
            webexpress.webapp.commentModel.buildUsersUrl(this._usersUri, missing),
            { headers: { "Accept": "application/json" } });
        if (result.ok) {
            for (const u of result.data) {
                this._userCache[u.id] = u;
            }
        } else {
            console.warn("CommentCtrl: user preload failed", webexpress.webapp.ServiceResult.describe(result));
        }
    }

    /**
     * Returns a user record from the local cache, or a placeholder when
     * the cache hasn't seen the id yet.
     * @param {string} id
     * @returns {Object}
     */
    _user(id) {
        return this._userCache[id] || { id, name: id, initials: String(id).slice(0, 2).toUpperCase(), color: "#888", team: "" };
    }

    /**
     * Renders the comment list according to the current filter and sort.
     * Preserves the page scroll position across the rebuild so user actions
     * (like, pin, collapse, edit, reply, …) do not yank the viewport back to
     * the top.
     */
    _renderList() {
        const scrollEl = document.scrollingElement || document.documentElement;
        const savedScroll = scrollEl ? scrollEl.scrollTop : 0;

        this._list.replaceChildren();

        let arr = this._comments.slice();
        if (this._filterCat !== "all") {
            arr = arr.filter(c => c.category === this._filterCat);
        }
        arr.sort((a, b) => {
            // pinned first regardless of sort
            if ((a.pinned ? 1 : 0) !== (b.pinned ? 1 : 0)) {
                return a.pinned ? -1 : 1;
            }
            let cmp = 0;
            if (this._sortBy === "likes") {
                cmp = (a.likes?.length || 0) - (b.likes?.length || 0);
            } else {
                cmp = String(a.when || "").localeCompare(String(b.when || ""));
            }
            return this._sortDir === "asc" ? cmp : -cmp;
        });

        if (arr.length === 0) {
            const empty = document.createElement("div");
            empty.className = "wx-comment-empty";
            empty.textContent = this._filterCat === "all"
                ? this._i18n("webexpress.webapp:comment.empty", "No comments yet")
                : this._i18n("webexpress.webapp:comment.empty.filtered", "No comments in this category");
            this._list.appendChild(empty);
        } else {
            for (const c of arr) {
                this._list.appendChild(this._renderComment(c));
            }
        }

        // restore the viewport — both immediately (covers the common case) and
        // on the next frame to defeat any browser-side scroll adjustments that
        // happen after layout settles.
        if (scrollEl) {
            scrollEl.scrollTop = savedScroll;
            requestAnimationFrame(() => {
                if (scrollEl.scrollTop !== savedScroll) {
                    scrollEl.scrollTop = savedScroll;
                }
            });
        }
    }

    /**
     * Builds the DOM for a single comment.
     * @param {Object} comment
     * @returns {HTMLElement}
     */
    _renderComment(comment) {
        const author = this._user(comment.author);
        const cat = this._categories[comment.category]
            || this._categories.general
            || webexpress.webapp.CommentCtrl._fallbackCategory(comment.category);
        const isMe = comment.author === this._currentUser;
        const liked = (comment.likes || []).includes(this._currentUser);
        const collapsed = !!comment.collapsed;
        const editing = this._editingId === comment.id;

        const wrap = document.createElement("article");
        wrap.className = "wx-comment-item"
            + (comment.pinned ? " wx-comment-item-pinned" : "")
            + (collapsed ? " wx-comment-item-collapsed" : "")
            + (isMe ? " wx-comment-item-me" : "");
        wrap.dataset.commentId = comment.id;

        // header
        const head = document.createElement("header");
        head.className = "wx-comment-head";
        head.innerHTML = `
            <span class="wx-comment-avatar wx-comment-avatar-lg" style="background:${author.color || "#888"}" title="${this._esc(author.name)}">${this._esc(author.initials || "?")}</span>
            <div class="wx-comment-head-main">
                <div class="wx-comment-author-row">
                    <span class="wx-comment-author">${this._esc(author.name)}</span>
                    ${author.team ? `<span class="wx-comment-team">· ${this._esc(author.team)}</span>` : ""}
                    <span class="wx-comment-when${comment.edited ? " wx-comment-when-edited" : ""}">${this._esc(comment.when)}</span>
                    ${comment.pinned ? `<span class="wx-comment-pinned"><i class="${this._affordanceIconClass("pin")}" aria-hidden="true"></i> ${this._esc(this._i18n("webexpress.webapp:comment.pinned", "Pinned"))}</span>` : ""}
                </div>
                <div class="wx-comment-labels">
                    <span class="wx-comment-category" style="color:${cat.color};background:${cat.bg}">${this._esc(this._i18n(cat.i18n, cat.id))}</span>
                    ${(comment.labels || []).map(l => `<span class="wx-comment-label">${this._esc(l)}</span>`).join("")}
                </div>
            </div>
        `;

        // header actions
        const actions = document.createElement("div");
        actions.className = "wx-comment-head-actions";

        const likeBtn = this._iconBtn(this._affordanceIconClass(liked ? "likeFilled" : "likeOutline"), liked
            ? this._i18n("webexpress.webapp:comment.like.remove", "Unlike")
            : this._i18n("webexpress.webapp:comment.like", "Like"));
        likeBtn.classList.toggle("wx-comment-action-liked", liked);
        const likeCount = document.createElement("span");
        likeCount.className = "wx-comment-like-count";
        likeCount.textContent = String((comment.likes || []).length);
        likeBtn.appendChild(likeCount);
        likeBtn.addEventListener("click", () => this._toggleLike(comment));
        actions.appendChild(likeBtn);

        const pinBtn = this._iconBtn(this._affordanceIconClass("pin"), comment.pinned
            ? this._i18n("webexpress.webapp:comment.pin.remove", "Unpin")
            : this._i18n("webexpress.webapp:comment.pin", "Pin"));
        pinBtn.classList.toggle("wx-comment-action-pinned", !!comment.pinned);
        pinBtn.addEventListener("click", () => this._togglePin(comment));
        actions.appendChild(pinBtn);

        const collapseBtn = this._iconBtn(this._affordanceIconClass(collapsed ? "chevronRight" : "chevronDown"), collapsed
            ? this._i18n("webexpress.webapp:comment.expand", "Expand")
            : this._i18n("webexpress.webapp:comment.collapse", "Collapse"));
        collapseBtn.addEventListener("click", () => {
            comment.collapsed = !collapsed;
            this._renderList();
        });
        actions.appendChild(collapseBtn);

        if (isMe && !this._readonly) {
            const editBtn = this._iconBtn(this._affordanceIconClass("edit"), this._i18n("webexpress.webapp:comment.edit", "Edit"));
            editBtn.addEventListener("click", () => {
                this._editingId = editing ? null : comment.id;
                this._renderList();
            });
            actions.appendChild(editBtn);

            const delBtn = this._iconBtn(this._affordanceIconClass("delete"), this._i18n("webexpress.webapp:comment.delete", "Delete"));
            delBtn.addEventListener("click", () => this._confirmDelete(comment, wrap));
            actions.appendChild(delBtn);
        }
        head.appendChild(actions);
        wrap.appendChild(head);

        // body OR editor
        if (editing) {
            wrap.appendChild(this._renderEditor(comment));
        } else {
            const body = document.createElement("div");
            body.className = "wx-comment-body";
            body.innerHTML = comment.body || "";
            wrap.appendChild(body);

            // reactions
            wrap.appendChild(this._renderReactions(comment));
        }

        // footer
        const footer = document.createElement("footer");
        footer.className = "wx-comment-footer";

        const replyBtn = document.createElement("button");
        replyBtn.type = "button";
        replyBtn.className = "wx-comment-reply-btn";
        const replyIcon = document.createElement("i");
        replyIcon.className = this._affordanceIconClass("reply");
        replyIcon.setAttribute("aria-hidden", "true");
        replyBtn.appendChild(replyIcon);
        replyBtn.appendChild(document.createTextNode(" " + this._i18n("webexpress.webapp:comment.reply", "Reply")));
        replyBtn.addEventListener("click", () => this._startReply(comment, wrap));
        if (!this._readonly) {
            footer.appendChild(replyBtn);
        }

        if ((comment.replies || []).length > 0) {
            const count = document.createElement("span");
            count.className = "wx-comment-reply-count";
            const n = comment.replies.length;
            const key = n === 1
                ? "webexpress.webapp:comment.replies.singular"
                : "webexpress.webapp:comment.replies.plural";
            count.textContent = this._i18n(key, n === 1 ? "{count} reply" : "{count} replies").replace("{count}", n);
            footer.appendChild(count);
        }

        if (comment.edited) {
            const ed = document.createElement("span");
            ed.className = "wx-comment-edited-note";
            const w = comment.edited.when || "";
            ed.textContent = this._i18n("webexpress.webapp:comment.edited.at", "edited {when}").replace("{when}", w);
            footer.appendChild(ed);
        }
        wrap.appendChild(footer);

        // replies
        if ((comment.replies || []).length > 0) {
            wrap.appendChild(this._renderReplies(comment));
        }

        return wrap;
    }

    /**
     * Builds a small icon-only action button rendered with a Font Awesome
     * glyph.
     * @param {string} iconClass - The Font Awesome class (e.g. "fas fa-heart").
     * @param {string} title - Accessible label.
     * @returns {HTMLButtonElement}
     */
    _iconBtn(iconClass, title) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "wx-comment-action";
        b.title = title;
        b.setAttribute("aria-label", title);
        const icon = document.createElement("i");
        icon.className = iconClass;
        icon.setAttribute("aria-hidden", "true");
        b.appendChild(icon);
        return b;
    }

    /**
     * Builds the reactions row.
     * @param {Object} comment
     * @returns {HTMLElement}
     */
    _renderReactions(comment) {
        const row = document.createElement("div");
        row.className = "wx-comment-reactions";

        const entries = Object.entries(comment.reactions || {}).filter(([, users]) => users.length > 0);
        for (const [emoji, users] of entries) {
            const mine = users.includes(this._currentUser);
            const names = users.map(uid => this._user(uid).name).join(", ");
            const b = document.createElement("button");
            b.type = "button";
            b.className = "wx-comment-reaction" + (mine ? " wx-comment-reaction-mine" : "");
            b.title = names + (mine ? " · " + this._i18n("webexpress.webapp:comment.reaction.you-too", "and you") : "");
            b.innerHTML = `<span class="wx-comment-reaction-emoji">${emoji}</span> ${users.length}`;
            b.addEventListener("click", () => this._toggleReaction(comment, emoji));
            row.appendChild(b);
        }

        if (!this._readonly) {
            const wrap = document.createElement("span");
            wrap.className = "wx-comment-reaction-add-wrap";

            const addBtn = document.createElement("button");
            addBtn.type = "button";
            addBtn.className = "wx-comment-reaction-add";
            addBtn.title = this._i18n("webexpress.webapp:comment.reaction.add", "Add reaction");
            addBtn.setAttribute("aria-label", addBtn.title);
            const addBtnIcon = document.createElement("i");
            addBtnIcon.className = this._affordanceIconClass("plus");
            addBtnIcon.setAttribute("aria-hidden", "true");
            addBtn.appendChild(addBtnIcon);

            const popup = document.createElement("div");
            popup.className = "wx-comment-reaction-popup";
            popup.style.display = "none";
            for (const em of webexpress.webapp.CommentCtrl.REACTIONS) {
                const b = document.createElement("button");
                b.type = "button";
                b.textContent = em;
                b.addEventListener("click", () => {
                    popup.style.display = "none";
                    this._toggleReaction(comment, em);
                });
                popup.appendChild(b);
            }

            addBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const open = popup.style.display !== "none";
                popup.style.display = open ? "none" : "flex";
            });
            // outside-click close
            document.addEventListener("mousedown", (e) => {
                if (popup.style.display === "none") return;
                if (!wrap.contains(e.target)) popup.style.display = "none";
            });

            wrap.appendChild(addBtn);
            wrap.appendChild(popup);
            row.appendChild(wrap);
        }
        return row;
    }

    /**
     * Builds the inline editor used when a comment is being edited.
     * @param {Object} comment
     * @returns {HTMLElement}
     */
    _renderEditor(comment) {
        const wrap = document.createElement("div");
        wrap.className = "wx-comment-edit";

        const editorHost = document.createElement("div");
        // intentionally do NOT add the auto-registered "wx-webui-editor"
        // class here — the controller registry would otherwise instantiate
        // an EditorCtrl on insertion AND our queueMicrotask call below
        // would instantiate a second one, producing a nested editor inside
        // the edit pane.
        editorHost.className = "wx-comment-edit-editor";
        editorHost.innerHTML = comment.body || "";

        const actions = document.createElement("div");
        actions.className = "wx-comment-edit-actions";

        const catSelect = document.createElement("select");
        catSelect.className = "wx-comment-edit-cat";
        for (const cat of Object.values(this._categories)) {
            const opt = document.createElement("option");
            opt.value = cat.id;
            opt.textContent = this._i18n(cat.i18n, cat.id);
            if (comment.category === cat.id) opt.selected = true;
            catSelect.appendChild(opt);
        }

        const labelsInput = document.createElement("input");
        labelsInput.type = "text";
        labelsInput.className = "wx-comment-edit-labels";
        labelsInput.placeholder = this._i18n("webexpress.webapp:comment.labels.placeholder", "Labels (comma-separated)");
        labelsInput.value = (comment.labels || []).join(", ");

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "btn btn-primary btn-sm";
        saveBtn.textContent = this._i18n("webexpress.webui:save", "Save");
        saveBtn.addEventListener("click", () => {
            const newBody = this._editorEditRef ? this._editorEditRef.value : editorHost.innerHTML;
            this._saveEdit(comment, {
                body: newBody,
                category: catSelect.value,
                labels: labelsInput.value.split(",").map(s => s.trim()).filter(Boolean)
            });
        });

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "btn btn-secondary btn-sm";
        cancelBtn.textContent = this._i18n("webexpress.webui:cancel", "Cancel");
        cancelBtn.addEventListener("click", () => {
            this._editingId = null;
            this._editorEditRef = null;
            this._renderList();
        });

        actions.appendChild(catSelect);
        actions.appendChild(labelsInput);
        const spacer = document.createElement("span");
        spacer.className = "wx-comment-spacer";
        actions.appendChild(spacer);
        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);

        wrap.appendChild(editorHost);
        wrap.appendChild(actions);

        // instantiate the EditorCtrl after this fragment is connected to the DOM
        queueMicrotask(() => {
            try {
                this._editorEditRef = new webexpress.webui.EditorCtrl(editorHost);
            } catch (e) {
                console.warn("CommentCtrl: edit-editor init failed", e);
            }
        });

        return wrap;
    }

    /**
     * Builds the replies block for a comment.
     * @param {Object} comment
     * @returns {HTMLElement}
     */
    _renderReplies(comment) {
        const wrap = document.createElement("div");
        wrap.className = "wx-comment-replies";
        for (const r of comment.replies) {
            const ru = this._user(r.author);
            const row = document.createElement("div");
            row.className = "wx-comment-reply";
            row.innerHTML = `
                <span class="wx-comment-avatar wx-comment-avatar-sm" style="background:${ru.color || "#888"}">${this._esc(ru.initials || "?")}</span>
                <div>
                    <div class="wx-comment-reply-head">
                        <span class="wx-comment-reply-author">${this._esc(ru.name)}</span>
                        <span class="wx-comment-reply-when">${this._esc(r.when || "")}</span>
                    </div>
                    <div class="wx-comment-reply-body">${r.body || ""}</div>
                </div>
            `;
            wrap.appendChild(row);
        }
        return wrap;
    }

    /**
     * Inserts an inline reply textarea below the comment.
     * @param {Object} comment
     * @param {HTMLElement} wrap - The comment's host element.
     */
    _startReply(comment, wrap) {
        const existing = wrap.querySelector(".wx-comment-reply-compose");
        if (existing) {
            existing.querySelector("textarea")?.focus();
            return;
        }
        const box = document.createElement("div");
        box.className = "wx-comment-reply-compose";

        const ta = document.createElement("textarea");
        ta.placeholder = this._i18n("webexpress.webapp:comment.reply.placeholder", "Write a reply…");

        const actions = document.createElement("div");
        actions.className = "wx-comment-reply-compose-actions";

        const send = document.createElement("button");
        send.type = "button";
        send.className = "btn btn-primary btn-sm";
        send.textContent = this._i18n("webexpress.webapp:comment.reply.send", "Reply");
        send.addEventListener("click", async () => {
            const body = ta.value.trim();
            if (!body) return;
            await this._postReply(comment, body);
            box.remove();
        });

        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "btn btn-secondary btn-sm";
        cancel.textContent = this._i18n("webexpress.webui:cancel", "Cancel");
        cancel.addEventListener("click", () => box.remove());

        actions.appendChild(send);
        actions.appendChild(cancel);
        box.appendChild(ta);
        box.appendChild(actions);
        wrap.appendChild(box);
        ta.focus();
    }

    /**
     * Shows the inline delete-confirmation strip inside a comment.
     * @param {Object} comment
     * @param {HTMLElement} wrap
     */
    _confirmDelete(comment, wrap) {
        if (wrap.querySelector(".wx-comment-delete-confirm")) {
            return;
        }
        const strip = document.createElement("div");
        strip.className = "wx-comment-delete-confirm";
        strip.innerHTML = `
            <span><strong>${this._esc(this._i18n("webexpress.webapp:comment.delete.confirm.title", "Delete comment?"))}</strong> ${this._esc(this._i18n("webexpress.webapp:comment.delete.confirm.body", "This action cannot be undone."))}</span>
            <span class="wx-comment-spacer"></span>
        `;

        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn btn-danger btn-sm";
        del.textContent = this._i18n("webexpress.webapp:comment.delete", "Delete");
        del.addEventListener("click", () => this._delete(comment));

        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "btn btn-secondary btn-sm";
        cancel.textContent = this._i18n("webexpress.webui:cancel", "Cancel");
        cancel.addEventListener("click", () => strip.remove());

        strip.appendChild(del);
        strip.appendChild(cancel);
        wrap.appendChild(strip);
    }

    /**
     * Saves an inline edit for a comment.
     * @param {Object} comment
     * @param {Object} patch
     */
    async _saveEdit(comment, patch) {
        if (!this._service) {
            return;
        }
        const result = await this._service.update(patch, {
            path: webexpress.webapp.commentModel.commentPath(comment.id)
        });
        if (result.ok) {
            const updated = result.data;
            this._comments = this._comments.map(c => c.id === updated.id ? updated : c);
            this._editingId = null;
            this._editorEditRef = null;
            this._rebuildFilterOptions();
            this._renderList();
            this._dispatch(webexpress.webapp.Event.COMMENT_UPDATED_EVENT, { comment: updated });
        } else {
            console.warn("CommentCtrl: edit failed", webexpress.webapp.ServiceResult.describe(result));
        }
    }

    /**
     * Deletes a comment.
     * @param {Object} comment
     */
    async _delete(comment) {
        if (!this._service) {
            return;
        }
        const result = await this._service.remove({
            path: webexpress.webapp.commentModel.commentPath(comment.id)
        });
        if (result.ok) {
            this._comments = this._comments.filter(c => c.id !== comment.id);
            this._rebuildFilterOptions();
            this._renderList();
            this._dispatch(webexpress.webapp.Event.COMMENT_DELETED_EVENT, { id: comment.id });
        } else {
            console.warn("CommentCtrl: delete failed", webexpress.webapp.ServiceResult.describe(result));
        }
    }

    /**
     * Toggles a like on a comment.
     * @param {Object} comment
     */
    async _toggleLike(comment) {
        if (!this._service) {
            return;
        }
        const result = await this._service.create({ userId: this._currentUser }, {
            path: webexpress.webapp.commentModel.commentSubPath(comment.id, "likes")
        });
        if (result.ok) {
            comment.likes = result.data.likes;
            this._renderList();
            this._dispatch(webexpress.webapp.Event.COMMENT_UPDATED_EVENT, { comment });
        } else {
            console.warn("CommentCtrl: like failed", webexpress.webapp.ServiceResult.describe(result));
        }
    }

    /**
     * Toggles the pinned state of a comment.
     * @param {Object} comment
     */
    async _togglePin(comment) {
        if (!this._service) {
            return;
        }
        const result = await this._service.create(undefined, {
            path: webexpress.webapp.commentModel.commentSubPath(comment.id, "pin")
        });
        if (result.ok) {
            comment.pinned = result.data.pinned;
            this._renderList();
            this._dispatch(webexpress.webapp.Event.COMMENT_UPDATED_EVENT, { comment });
        } else {
            console.warn("CommentCtrl: pin failed", webexpress.webapp.ServiceResult.describe(result));
        }
    }

    /**
     * Toggles a reaction emoji for the current user.
     * @param {Object} comment
     * @param {string} emoji
     */
    async _toggleReaction(comment, emoji) {
        if (!this._service) {
            return;
        }
        const result = await this._service.create({ emoji, userId: this._currentUser }, {
            path: webexpress.webapp.commentModel.commentSubPath(comment.id, "reactions")
        });
        if (result.ok) {
            comment.reactions = result.data.reactions;
            this._renderList();
            this._dispatch(webexpress.webapp.Event.COMMENT_REACTION_EVENT, { commentId: comment.id, emoji, reactions: comment.reactions });
        } else {
            console.warn("CommentCtrl: reaction failed", webexpress.webapp.ServiceResult.describe(result));
        }
    }

    /**
     * Posts a reply to a comment.
     * @param {Object} comment
     * @param {string} body
     */
    async _postReply(comment, body) {
        if (!this._service) {
            return;
        }
        const result = await this._service.create({ body }, {
            path: webexpress.webapp.commentModel.commentSubPath(comment.id, "replies")
        });
        if (result.ok) {
            const reply = result.data;
            comment.replies = comment.replies || [];
            comment.replies.push(reply);
            this._renderList();
            this._dispatch(webexpress.webapp.Event.COMMENT_REPLY_EVENT, { commentId: comment.id, reply });
        } else {
            console.warn("CommentCtrl: reply failed", webexpress.webapp.ServiceResult.describe(result));
        }
    }

    /**
     * Minimal HTML escape.
     * @param {string} s
     * @returns {string}
     */
    _esc(s) {
        return String(s ?? "").replace(/[<>"&]/g, c => ({ "<": "&lt;", ">": "&gt;", '"': "&quot;", "&": "&amp;" }[c]));
    }

    /**
     * Writes a cookie with the specified name and value.
     * @param {string} name - The cookie name.
     * @param {string} value - The cookie value (will be URI-encoded).
     * @param {number} [days] - Lifetime in days; omit for a session cookie.
     */
    _setCookie(name, value, days) {
        const expires = days
            ? "; expires=" + new Date(Date.now() + days * 864e5).toUTCString()
            : "";
        document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Strict";
    }

    /**
     * Reads a cookie by name.
     * @param {string} name - The cookie name.
     * @returns {string|null} The decoded value, or null when not set.
     */
    _getCookie(name) {
        const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]*)"));
        return match ? decodeURIComponent(match[2]) : null;
    }

    /**
     * Gets the current list of comments.
     * @returns {Array<Object>}
     */
    get value() {
        return this._comments.slice();
    }
};

// register for declarative auto-init
webexpress.webui.Controller.registerClass("wx-webapp-comment", webexpress.webapp.CommentCtrl);
