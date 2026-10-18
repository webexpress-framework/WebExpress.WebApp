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
 * The surface is a pure function of the state (render), patched into the host by the keyed
 * reconciler of the Data base. The comments and everything the reader opens on them - a
 * collapsed comment, the inline editor, a reply draft, a delete confirmation, the reaction
 * picker - are state, so a like or a reload never throws away what the reader was doing. The
 * WYSIWYG editor of a comment in edit mode is a nested control on a node the reconciler keeps.
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
     * Per-affordance icon mapping. The names are symbolic; the active icon set turns them
     * into css classes at lookup time, so an affordance keeps working when the drawing
     * behind the name changes.
     */
    static ICONS = {
        likeFilled: "heart",
        likeOutline: "heart",
        pin: "thumbtack",
        chevronDown: "angle-down",
        chevronRight: "chevron-right",
        edit: "pen",
        delete: "trash",
        reply: "share-nodes",
        plus: "plus"
    };

    /**
     * Resolves an affordance name to a concrete CSS class string.
     * @param {string} name - Affordance key into {@link CommentCtrl.ICONS}.
     * @returns {string} The CSS class string for an <c>&lt;i&gt;</c> element.
     */
    _affordanceIconClass(name) {
        return this._iconClass(webexpress.webapp.CommentCtrl.ICONS[name] || "question");
    }

    /**
     * Construct a new CommentCtrl.
     * @param {HTMLElement} element - host element.
     */
    constructor(element) {
        // the toolbar ui state is seeded from the persisted sort preference and the
        // optional wx-state island; the services come from the wx-service
        // islands. both are resolved before super so the component owns the
        // store and the service map. The wx-state island may also carry the
        // comments themselves, in which case the first paint needs no round
        // trip.
        const persistedSortDir = webexpress.webui.LocalStorage.getItem("wx_comment_sort_dir");
        const initialState = Object.assign({
            sortBy: "date",          // "date" | "likes"
            sortDir: (persistedSortDir === "asc" || persistedSortDir === "desc") ? persistedSortDir : "desc",
            filterCat: "all",
            editingId: null,         // id of comment currently in edit-mode
            editDraft: null,         // { category, labels } of the comment in edit-mode
            comments: [],
            categories: {},
            users: {},               // userId -> user record
            collapsed: {},           // commentId -> true
            replyDrafts: {},         // commentId -> reply text, present while a reply is open
            confirmDelete: {},       // commentId -> true while the delete strip shows
            reactionPicker: null     // commentId whose reaction picker is open
        }, webexpress.webapp.Data.readState(element));
        const services = webexpress.webapp.ServiceRegistry.fromElement(element);

        // categories are sourced from the REST API ({uri}/categories) unless
        // a static override is supplied via the data-categories attribute
        // (used for offline / read-only embeds).
        let categoriesPreset = false;
        if (element.dataset.categories) {
            try {
                initialState.categories = webexpress.webapp.commentModel.normalizeCategories(JSON.parse(element.dataset.categories));
                categoriesPreset = true;
            } catch (_) {
                categoriesPreset = false;
            }
        }

        super(element, { state: initialState, services: services });

        const usersService = this.useService("users");
        this._usersUri = usersService ? usersService.baseUri : null;

        const uploadService = this.useService("upload");
        this._imageUploadUri = uploadService ? uploadService.baseUri : null;

        const imagesService = this.useService("images");
        this._imageLibraryUri = imagesService ? imagesService.baseUri : null;

        const linksService = this.useService("links");
        this._linkLibraryUri = linksService ? linksService.baseUri : null;

        this._currentUser = element.dataset.currentUser || null;
        this._readonly = element.dataset.readonly === "true";
        this._categoriesPreset = categoriesPreset;

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

        // the editor of the comment in edit mode, a nested control
        this._editorEditRef = null;
        this._editorHost = null;
        this._sortDirBtn = null;
        // reply fields that have just opened and still wait for the focus
        this._focusReplies = new Set();
        this._replyInputs = new Map();

        // stable handlers, so a render does not swap the listeners of unchanged nodes
        this._onFilter = (e) => this.setState({ filterCat: e.target.value });
        this._onSort = (e) => this.setState({ sortBy: e.target.value });
        this._onSortDir = () => {
            const sortDir = this._sortDir === "asc" ? "desc" : "asc";
            webexpress.webui.LocalStorage.setItem("wx_comment_sort_dir", sortDir);
            this.setState({ sortDir: sortDir });
        };
        this._onEditCategory = (e) => this.setState({ editDraft: Object.assign({}, this.state.editDraft, { category: e.target.value }) });
        this._onEditLabels = (e) => this.setState({ editDraft: Object.assign({}, this.state.editDraft, { labels: e.target.value }) });
        this._onCommentAdded = (event) => this._handleCommentAdded(event);
        this._onDocumentMouseDown = (e) => this._closeReactionPicker(e);

        // clean host
        element.textContent = "";
        element.removeAttribute("data-current-user");
        element.removeAttribute("data-readonly");
        element.removeAttribute("data-categories");
        element.classList.add("wx-comment");

        this.mount();
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
     * The comments, backed by the store so a change re-renders.
     * @returns {Array<object>} The comments.
     */
    get _comments() {
        return this.state.comments || [];
    }

    set _comments(value) {
        this.setState({ comments: value });
    }

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

        // when the server seeded the comments through the data-wx-state island,
        // render them without a round trip; otherwise load from the endpoint
        if (this._comments.length > 0) {
            await this._preloadUsers();
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

        // the secondary services (mention resolution, image upload, image and link libraries)
        // stay on the surface as its own islands; a ViewState that declares them by name wins
        const usersService = viewState.useService("users");
        if (usersService) {
            this._usersUri = usersService.baseUri;
        }
        const uploadService = viewState.useService("upload");
        if (uploadService) {
            this._imageUploadUri = uploadService.baseUri;
        }
        const imagesService = viewState.useService("images");
        if (imagesService) {
            this._imageLibraryUri = imagesService.baseUri;
        }
        const linksService = viewState.useService("links");
        if (linksService) {
            this._linkLibraryUri = linksService.baseUri;
        }

        if (!this._categoriesPreset) {
            await this._loadCategories();
        }

        const unsubscribe = viewState.watch((state) => viewState.slice(this._resource, state), (slice) => this._applySlice(slice));
        (element._wxCleanup = element._wxCleanup || []).push(unsubscribe);

        this._applySlice(viewState.slice(this._resource));
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
        void this._preloadUsers();
    }

    /**
     * Loads the category set from the REST API. Failures fall back to an
     * empty set; the filter will then show only "All categories".
     */
    async _loadCategories() {
        if (!this._uri || !this._service) {
            this.setState({ categories: {} });
            return;
        }
        const result = await this._service.request(
            webexpress.webapp.commentModel.categoriesUrl(this._uri),
            { headers: { "Accept": "application/json" } });
        if (result.ok) {
            this.setState({ categories: this._normalizeCategories(result.data) });
        } else {
            console.warn("CommentCtrl: categories load failed", webexpress.webapp.ServiceResult.describe(result));
            this.setState({ categories: {} });
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
     * Listens for comments authored by the separate composer control and for clicks that
     * close the reaction picker, for as long as the control is mounted.
     */
    onMount() {
        document.addEventListener(webexpress.webapp.Event.COMMENT_ADDED_EVENT, this._onCommentAdded);
        document.addEventListener("mousedown", this._onDocumentMouseDown);
    }

    /**
     * Creates the editor of a comment that just entered edit mode and focuses a reply field
     * that just opened; both are side effects the tree cannot express.
     * @param {object} state - The rendered state.
     */
    onUpdate(state) {
        if (state.editingId && this._editorHost && !this._editorEditRef) {
            try {
                this._editorEditRef = new webexpress.webui.EditorCtrl(this._editorHost);
            } catch (e) {
                console.warn("CommentCtrl: edit-editor init failed", e);
            }
        }
        for (const id of this._focusReplies) {
            this._replyInputs.get(id)?.focus?.();
        }
        this._focusReplies.clear();
    }

    /**
     * Releases the document listeners.
     */
    onUnmount() {
        document.removeEventListener(webexpress.webapp.Event.COMMENT_ADDED_EVENT, this._onCommentAdded);
        document.removeEventListener("mousedown", this._onDocumentMouseDown);
    }

    /**
     * Counts comments per category for the toolbar display.
     * @param {object} [state=this.state] - The state to count in.
     * @returns {Object<string, number>}
     */
    _counts(state = this.state) {
        const comments = state.comments || [];
        const c = { all: comments.length };
        for (const k of Object.keys(state.categories)) {
            c[k] = comments.filter(x => x.category === k).length;
        }
        return c;
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
        this._comments = this._comments.concat([detail.comment]);
        void this._preloadUsers();
    }

    /**
     * Loads the comments from the configured URI and renders them.
     */
    async _load() {
        if (!this._uri || !this._service) {
            this._comments = [];
            return;
        }
        const result = await this._service.request(this._uri, { headers: { "Accept": "application/json" } });
        if (result.ok) {
            this._comments = Array.isArray(result.data) ? result.data : [];
        } else {
            console.warn("CommentCtrl: load failed", webexpress.webapp.ServiceResult.describe(result));
            this._comments = [];
        }
        // pre-warm user cache for everyone referenced
        await this._preloadUsers();
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
        const known = this.state.users;
        const missing = [...ids].filter(id => typeof id !== "object" && !known[id]);
        if (missing.length === 0) {
            return;
        }
        const result = await this._service.request(
            webexpress.webapp.commentModel.buildUsersUrl(this._usersUri, missing),
            { headers: { "Accept": "application/json" } });
        if (result.ok) {
            const users = Object.assign({}, this.state.users);
            for (const u of result.data) {
                users[u.id] = u;
            }
            this.setState({ users: users });
        } else {
            console.warn("CommentCtrl: user preload failed", webexpress.webapp.ServiceResult.describe(result));
        }
    }

    /**
     * Returns a user record from the cache, or a placeholder when the cache hasn't seen the
     * id yet. A server that embeds the author record instead of its id is answered with it.
     * @param {string|object} id - The user id, or the user record.
     * @param {object} [users=this.state.users] - The user cache.
     * @returns {Object}
     */
    _user(id, users = this.state.users) {
        if (id && typeof id === "object") {
            return id;
        }
        return users[id] || { id, name: id, initials: String(id).slice(0, 2).toUpperCase(), color: "#888", team: "" };
    }

    /**
     * Returns the comments the list shows: the selected category, pinned comments first, then
     * in the selected order.
     * @param {object} state - The state.
     * @returns {Array<object>} The comments to render.
     */
    _visibleComments(state) {
        let arr = (state.comments || []).slice();
        if (state.filterCat !== "all") {
            arr = arr.filter(c => c.category === state.filterCat);
        }
        return arr.sort((a, b) => {
            // pinned first regardless of sort
            if ((a.pinned ? 1 : 0) !== (b.pinned ? 1 : 0)) {
                return a.pinned ? -1 : 1;
            }
            let cmp = 0;
            if (state.sortBy === "likes") {
                cmp = (a.likes?.length || 0) - (b.likes?.length || 0);
            } else {
                cmp = String(a.when || "").localeCompare(String(b.when || ""));
            }
            return state.sortDir === "asc" ? cmp : -cmp;
        });
    }

    /**
     * Renders an icon from a resolved class string; icons are decoration next to a label.
     * @param {string} iconClass - The resolved icon classes.
     * @returns {object} The icon virtual node.
     */
    _icon(iconClass) {
        return webexpress.webui.h("i", { class: iconClass, "aria-hidden": "true" });
    }

    /**
     * Renders the toolbar and the list. Unchanged comments keep their nodes, so an action on
     * one comment neither rebuilds the others nor moves the page.
     * @param {object} state - The current state.
     * @returns {Array<object>} The virtual node tree of the host.
     */
    render(state) {
        const h = webexpress.webui.h;
        const counts = this._counts(state);
        const comments = this._visibleComments(state);

        return [
            h("div", { key: "toolbar", class: "wx-comment-toolbar" },
                h("span", { class: "wx-comment-toolbar-label" }, this._i18n("webexpress.webapp:comment.filter", "Filter") + ":"),
                h("select", { class: "wx-comment-filter", value: state.filterCat, on: { change: this._onFilter } },
                    h("option", { key: "all", value: "all" },
                        this._i18n("webexpress.webapp:comment.filter.all", "All categories") + ` (${counts.all})`),
                    Object.values(state.categories).map((cat) => h("option", { key: cat.id, value: cat.id },
                        `${this._i18n(cat.i18n, cat.id)} (${counts[cat.id] || 0})`))),
                h("span", { class: "wx-comment-toolbar-label" }, this._i18n("webexpress.webapp:comment.sort", "Sort") + ":"),
                h("select", { class: "wx-comment-sort", value: state.sortBy, on: { change: this._onSort } },
                    h("option", { value: "date" }, this._i18n("webexpress.webapp:comment.sort.date", "Date")),
                    h("option", { value: "likes" }, this._i18n("webexpress.webapp:comment.sort.likes", "Likes"))),
                h("button", {
                    type: "button",
                    class: "wx-comment-sort-dir",
                    on: { click: this._onSortDir },
                    ref: (el) => { this._sortDirBtn = el; }
                }, state.sortDir === "asc"
                    ? this._i18n("webexpress.webapp:comment.sort.asc", "Ascending")
                    : this._i18n("webexpress.webapp:comment.sort.desc", "Descending")),
                h("span", { class: "wx-comment-pinned-note" },
                    this._icon(this._affordanceIconClass("pin")),
                    " " + this._i18n("webexpress.webapp:comment.pinned-on-top", "Pinned comments stay on top"))),
            h("div", { key: "list", class: "wx-comment-list" }, comments.length === 0
                ? h("div", { key: "empty", class: "wx-comment-empty" }, state.filterCat === "all"
                    ? this._i18n("webexpress.webapp:comment.empty", "No comments yet")
                    : this._i18n("webexpress.webapp:comment.empty.filtered", "No comments in this category"))
                : comments.map((comment) => this._renderComment(comment, state)))
        ];
    }

    /**
     * Renders a single comment.
     * @param {Object} comment - The comment.
     * @param {object} state - The current state.
     * @returns {object} The comment virtual node.
     */
    _renderComment(comment, state) {
        const h = webexpress.webui.h;
        const author = this._user(comment.author, state.users);
        const cat = state.categories[comment.category]
            || state.categories.general
            || webexpress.webapp.CommentCtrl._fallbackCategory(comment.category);
        const isMe = (author.id ?? comment.author) === this._currentUser;
        const liked = (comment.likes || []).includes(this._currentUser);
        const collapsed = !!state.collapsed[comment.id];
        const editing = state.editingId === comment.id;
        const replies = comment.replies || [];
        const classes = ["wx-comment-item"];
        if (comment.pinned) classes.push("wx-comment-item-pinned");
        if (collapsed) classes.push("wx-comment-item-collapsed");
        if (isMe) classes.push("wx-comment-item-me");

        return h("article", { key: comment.id, class: classes.join(" "), dataset: { commentId: comment.id } },
            h("header", { class: "wx-comment-head" },
                h("span", {
                    class: "wx-comment-avatar wx-comment-avatar-lg",
                    style: { background: author.color || "#888" },
                    title: author.name
                }, author.initials || "?"),
                h("div", { class: "wx-comment-head-main" },
                    h("div", { class: "wx-comment-author-row" },
                        h("span", { class: "wx-comment-author" }, author.name),
                        author.team && h("span", { class: "wx-comment-team" }, "· " + author.team),
                        h("span", { class: comment.edited ? "wx-comment-when wx-comment-when-edited" : "wx-comment-when" }, comment.when),
                        comment.pinned && h("span", { class: "wx-comment-pinned" },
                            this._icon(this._affordanceIconClass("pin")),
                            " " + this._i18n("webexpress.webapp:comment.pinned", "Pinned"))),
                    h("div", { class: "wx-comment-labels" },
                        h("span", { class: "wx-comment-category", style: { color: cat.color, background: cat.bg } },
                            this._i18n(cat.i18n, cat.id)),
                        (comment.labels || []).map((label) => h("span", { key: label, class: "wx-comment-label" }, label)))),
                h("div", { class: "wx-comment-head-actions" },
                    this._actionButton("like", liked ? "likeFilled" : "likeOutline", liked
                        ? this._i18n("webexpress.webapp:comment.like.remove", "Unlike")
                        : this._i18n("webexpress.webapp:comment.like", "Like"),
                    () => this._toggleLike(comment), liked ? "wx-comment-action-liked" : null,
                    h("span", { class: "wx-comment-like-count" }, String((comment.likes || []).length))),
                    this._actionButton("pin", "pin", comment.pinned
                        ? this._i18n("webexpress.webapp:comment.pin.remove", "Unpin")
                        : this._i18n("webexpress.webapp:comment.pin", "Pin"),
                    () => this._togglePin(comment), comment.pinned ? "wx-comment-action-pinned" : null),
                    this._actionButton("collapse", collapsed ? "chevronRight" : "chevronDown", collapsed
                        ? this._i18n("webexpress.webapp:comment.expand", "Expand")
                        : this._i18n("webexpress.webapp:comment.collapse", "Collapse"),
                    () => this._toggleCollapsed(comment.id)),
                    isMe && !this._readonly && this._actionButton("edit", "edit",
                        this._i18n("webexpress.webapp:comment.edit", "Edit"), () => this._toggleEdit(comment)),
                    isMe && !this._readonly && this._actionButton("delete", "delete",
                        this._i18n("webexpress.webapp:comment.delete", "Delete"), () => this._setFlag("confirmDelete", comment.id, true)))),
            editing
                ? this._renderEditor(comment, state)
                : [h("div", { key: "body", class: "wx-comment-body", html: comment.body || "" }), this._renderReactions(comment, state)],
            h("footer", { key: "footer", class: "wx-comment-footer" },
                !this._readonly && h("button", {
                    type: "button",
                    class: "wx-comment-reply-btn",
                    on: { click: () => this._startReply(comment.id) }
                }, this._icon(this._affordanceIconClass("reply")), " " + this._i18n("webexpress.webapp:comment.reply", "Reply")),
                replies.length > 0 && h("span", { class: "wx-comment-reply-count" },
                    this._i18n(replies.length === 1 ? "webexpress.webapp:comment.replies.singular" : "webexpress.webapp:comment.replies.plural",
                        replies.length === 1 ? "{count} reply" : "{count} replies").replace("{count}", replies.length)),
                comment.edited && h("span", { class: "wx-comment-edited-note" },
                    this._i18n("webexpress.webapp:comment.edited.at", "edited {when}").replace("{when}", comment.edited.when || ""))),
            replies.length > 0 && h("div", { key: "replies", class: "wx-comment-replies" },
                replies.map((reply, index) => this._renderReply(reply, index, state))),
            comment.id in state.replyDrafts && this._renderReplyCompose(comment, state),
            state.confirmDelete[comment.id] && this._renderDeleteConfirm(comment));
    }

    /**
     * Renders a small icon-only action button of a comment's header.
     * @param {string} key - The key of the button within the header.
     * @param {string} icon - The affordance name of the icon.
     * @param {string} title - Accessible label.
     * @param {Function} onClick - The action.
     * @param {string|null} [state] - A class marking an active state.
     * @param {object} [extra] - A further child, such as a count.
     * @returns {object} The button virtual node.
     */
    _actionButton(key, icon, title, onClick, state, extra) {
        return webexpress.webui.h("button", {
            key: key,
            type: "button",
            class: state ? "wx-comment-action " + state : "wx-comment-action",
            title: title,
            "aria-label": title,
            on: { click: onClick }
        }, this._icon(this._affordanceIconClass(icon)), extra);
    }

    /**
     * Renders the reactions row with the reaction picker.
     * @param {Object} comment - The comment.
     * @param {object} state - The current state.
     * @returns {object} The reactions virtual node.
     */
    _renderReactions(comment, state) {
        const h = webexpress.webui.h;
        const entries = Object.entries(comment.reactions || {}).filter(([, users]) => users.length > 0);
        const pickerOpen = state.reactionPicker === comment.id;
        const addLabel = this._i18n("webexpress.webapp:comment.reaction.add", "Add reaction");

        return h("div", { key: "reactions", class: "wx-comment-reactions" },
            entries.map(([emoji, users]) => {
                const mine = users.includes(this._currentUser);
                const names = users.map(uid => this._user(uid, state.users).name).join(", ");
                return h("button", {
                    key: emoji,
                    type: "button",
                    class: mine ? "wx-comment-reaction wx-comment-reaction-mine" : "wx-comment-reaction",
                    title: names + (mine ? " · " + this._i18n("webexpress.webapp:comment.reaction.you-too", "and you") : ""),
                    on: { click: () => this._toggleReaction(comment, emoji) }
                }, h("span", { class: "wx-comment-reaction-emoji" }, emoji), " " + users.length);
            }),
            !this._readonly && h("span", { key: "add", class: "wx-comment-reaction-add-wrap" },
                h("button", {
                    type: "button",
                    class: "wx-comment-reaction-add",
                    title: addLabel,
                    "aria-label": addLabel,
                    on: { click: (e) => { e.stopPropagation(); this.setState({ reactionPicker: pickerOpen ? null : comment.id }); } }
                }, this._icon(this._affordanceIconClass("plus"))),
                h("div", { class: "wx-comment-reaction-popup", style: { display: pickerOpen ? "flex" : "none" } },
                    webexpress.webapp.CommentCtrl.REACTIONS.map((emoji) => h("button", {
                        key: emoji,
                        type: "button",
                        on: { click: () => { this.setState({ reactionPicker: null }); this._toggleReaction(comment, emoji); } }
                    }, emoji)))));
    }

    /**
     * Closes an open reaction picker when the pointer goes down outside of it.
     * @param {Event} e - The mousedown event.
     */
    _closeReactionPicker(e) {
        const open = this.state.reactionPicker;
        if (!open) {
            return;
        }
        const wrap = e.target && e.target.closest ? e.target.closest(".wx-comment-reaction-add-wrap") : null;
        const article = wrap && wrap.closest ? wrap.closest("[data-comment-id]") : null;
        if (!article || article.dataset.commentId !== open) {
            this.setState({ reactionPicker: null });
        }
    }

    /**
     * Renders the inline editor used when a comment is being edited. The editor host is kept
     * from the reconciler: the WYSIWYG editor created on it owns everything inside.
     * @param {Object} comment - The comment.
     * @param {object} state - The current state.
     * @returns {object} The editor virtual node.
     */
    _renderEditor(comment, state) {
        const h = webexpress.webui.h;
        const draft = state.editDraft || { category: comment.category, labels: (comment.labels || []).join(", ") };
        // an edited comment offers the same images and link targets as a new one
        const editorData = {};
        if (this._imageUploadUri) {
            editorData.imageUploadUri = this._imageUploadUri;
        }
        if (this._imageLibraryUri) {
            editorData.imageLibraryUri = this._imageLibraryUri;
        }
        if (this._linkLibraryUri) {
            editorData.linkLibraryUri = this._linkLibraryUri;
        }

        return h("div", { key: "edit", class: "wx-comment-edit" },
            // intentionally without the auto-registered "wx-webui-editor" class: the
            // controller registry would otherwise instantiate a second EditorCtrl
            h("div", {
                key: "editor-" + comment.id,
                class: "wx-comment-edit-editor",
                keep: true,
                dataset: editorData,
                ref: (el) => this._mountEditorHost(el, comment)
            }),
            h("div", { class: "wx-comment-edit-actions" },
                h("select", { class: "wx-comment-edit-cat", value: draft.category, on: { change: this._onEditCategory } },
                    Object.values(state.categories).map((cat) => h("option", { key: cat.id, value: cat.id }, this._i18n(cat.i18n, cat.id)))),
                h("input", {
                    type: "text",
                    class: "wx-comment-edit-labels",
                    placeholder: this._i18n("webexpress.webapp:comment.labels.placeholder", "Labels (comma-separated)"),
                    value: draft.labels,
                    on: { input: this._onEditLabels }
                }),
                h("span", { class: "wx-comment-spacer" }),
                h("button", {
                    type: "button",
                    class: "btn btn-primary btn-sm",
                    on: { click: () => this._saveEdit(comment, this._editPatch(comment)) }
                }, this._i18n("webexpress.webui:save", "Save")),
                h("button", {
                    type: "button",
                    class: "btn btn-secondary btn-sm",
                    on: { click: () => this._endEdit() }
                }, this._i18n("webexpress.webui:cancel", "Cancel"))));
    }

    /**
     * Collects what the edit mode changed: the editor's body and the drafted category and labels.
     * @param {Object} comment - The comment being edited.
     * @returns {object} The patch as { body, category, labels }.
     */
    _editPatch(comment) {
        const draft = this.state.editDraft || { category: comment.category, labels: (comment.labels || []).join(", ") };
        return {
            body: this._editorEditRef ? this._editorEditRef.exportHtml({ layout: false }) : (this._editorHost ? this._editorHost.innerHTML : comment.body || ""),
            category: draft.category,
            labels: String(draft.labels || "").split(",").map(s => s.trim()).filter(Boolean)
        };
    }

    /**
     * Fills a newly rendered editor host with the comment's body; the editor is created on it
     * once the render is in place.
     * @param {HTMLElement} host - The editor host.
     * @param {Object} comment - The comment being edited.
     */
    _mountEditorHost(host, comment) {
        if (this._editorHost === host) {
            return;
        }
        this._editorHost = host;
        this._editorEditRef = null;
        host.innerHTML = comment.body || "";
    }

    /**
     * Renders one reply of a comment.
     * @param {Object} reply - The reply.
     * @param {number} index - Its position, the key of a reply without an id.
     * @param {object} state - The current state.
     * @returns {object} The reply virtual node.
     */
    _renderReply(reply, index, state) {
        const h = webexpress.webui.h;
        const user = this._user(reply.author, state.users);

        return h("div", { key: reply.id || "r" + index, class: "wx-comment-reply" },
            h("span", { class: "wx-comment-avatar wx-comment-avatar-sm", style: { background: user.color || "#888" } }, user.initials || "?"),
            h("div", null,
                h("div", { class: "wx-comment-reply-head" },
                    h("span", { class: "wx-comment-reply-author" }, user.name),
                    h("span", { class: "wx-comment-reply-when" }, reply.when || "")),
                h("div", { class: "wx-comment-reply-body", html: reply.body || "" })));
    }

    /**
     * Renders the inline reply field below a comment.
     * @param {Object} comment - The comment.
     * @param {object} state - The current state.
     * @returns {object} The reply field virtual node.
     */
    _renderReplyCompose(comment, state) {
        const h = webexpress.webui.h;

        return h("div", { key: "reply-compose", class: "wx-comment-reply-compose" },
            h("textarea", {
                placeholder: this._i18n("webexpress.webapp:comment.reply.placeholder", "Write a reply…"),
                value: state.replyDrafts[comment.id],
                on: { input: (e) => this._setFlag("replyDrafts", comment.id, e.target.value) },
                ref: (el) => { this._replyInputs.set(comment.id, el); }
            }),
            h("div", { class: "wx-comment-reply-compose-actions" },
                h("button", {
                    type: "button",
                    class: "btn btn-primary btn-sm",
                    on: { click: () => this._sendReply(comment) }
                }, this._i18n("webexpress.webapp:comment.reply.send", "Reply")),
                h("button", {
                    type: "button",
                    class: "btn btn-secondary btn-sm",
                    on: { click: () => this._setFlag("replyDrafts", comment.id, undefined) }
                }, this._i18n("webexpress.webui:cancel", "Cancel"))));
    }

    /**
     * Renders the inline delete confirmation strip of a comment.
     * @param {Object} comment - The comment.
     * @returns {object} The strip virtual node.
     */
    _renderDeleteConfirm(comment) {
        const h = webexpress.webui.h;

        return h("div", { key: "delete-confirm", class: "wx-comment-delete-confirm" },
            h("span", null,
                h("strong", null, this._i18n("webexpress.webapp:comment.delete.confirm.title", "Delete comment?")),
                " " + this._i18n("webexpress.webapp:comment.delete.confirm.body", "This action cannot be undone.")),
            h("span", { class: "wx-comment-spacer" }),
            h("button", {
                type: "button",
                class: "btn btn-danger btn-sm",
                on: { click: () => this._delete(comment) }
            }, this._i18n("webexpress.webapp:comment.delete", "Delete")),
            h("button", {
                type: "button",
                class: "btn btn-secondary btn-sm",
                on: { click: () => this._setFlag("confirmDelete", comment.id, undefined) }
            }, this._i18n("webexpress.webui:cancel", "Cancel")));
    }

    /**
     * Sets or clears the entry of one comment in a per-comment state map.
     * @param {string} map - The state key, such as "collapsed" or "replyDrafts".
     * @param {string} id - The comment id.
     * @param {*} value - The value; undefined removes the entry.
     */
    _setFlag(map, id, value) {
        const next = Object.assign({}, this.state[map]);
        if (value === undefined) {
            delete next[id];
        } else {
            next[id] = value;
        }
        this.setState({ [map]: next });
    }

    /**
     * Collapses or expands a comment.
     * @param {string} id - The comment id.
     */
    _toggleCollapsed(id) {
        this._setFlag("collapsed", id, this.state.collapsed[id] ? undefined : true);
    }

    /**
     * Opens the reply field of a comment, or focuses the one that is already open.
     * @param {string} id - The comment id.
     */
    _startReply(id) {
        this._focusReplies.add(id);
        if (id in this.state.replyDrafts) {
            this._replyInputs.get(id)?.focus?.();
            this._focusReplies.delete(id);
            return;
        }
        this._setFlag("replyDrafts", id, "");
    }

    /**
     * Sends the reply draft of a comment and closes the field on success.
     * @param {Object} comment - The comment.
     */
    async _sendReply(comment) {
        const body = String(this.state.replyDrafts[comment.id] || "").trim();
        if (!body) {
            return;
        }
        if (await this._postReply(comment, body)) {
            this._setFlag("replyDrafts", comment.id, undefined);
        }
    }

    /**
     * Enters or leaves the edit mode of a comment.
     * @param {Object} comment - The comment.
     */
    _toggleEdit(comment) {
        if (this.state.editingId === comment.id) {
            this._endEdit();
            return;
        }
        this._editorEditRef = null;
        this._editorHost = null;
        this.setState({
            editingId: comment.id,
            editDraft: { category: comment.category, labels: (comment.labels || []).join(", ") }
        });
    }

    /**
     * Leaves the edit mode and drops the editor with its host.
     */
    _endEdit() {
        this._editorEditRef = null;
        this._editorHost = null;
        this.setState({ editingId: null, editDraft: null });
    }

    /**
     * Replaces one comment with an updated copy, keeping the list immutable.
     * @param {string} id - The comment id.
     * @param {object} patch - The changed fields, or a whole comment.
     * @returns {object|null} The updated comment.
     */
    _patchComment(id, patch) {
        let updated = null;
        this._comments = this._comments.map((c) => {
            if (c.id !== id) {
                return c;
            }
            updated = Object.assign({}, c, patch);
            return updated;
        });
        return updated;
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
            this._endEdit();
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
            this._setFlag("confirmDelete", comment.id, undefined);
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
            const updated = this._patchComment(comment.id, { likes: result.data.likes });
            this._dispatch(webexpress.webapp.Event.COMMENT_UPDATED_EVENT, { comment: updated });
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
            const updated = this._patchComment(comment.id, { pinned: result.data.pinned });
            this._dispatch(webexpress.webapp.Event.COMMENT_UPDATED_EVENT, { comment: updated });
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
            const updated = this._patchComment(comment.id, { reactions: result.data.reactions });
            this._dispatch(webexpress.webapp.Event.COMMENT_REACTION_EVENT, { commentId: comment.id, emoji, reactions: updated.reactions });
        } else {
            console.warn("CommentCtrl: reaction failed", webexpress.webapp.ServiceResult.describe(result));
        }
    }

    /**
     * Posts a reply to a comment.
     * @param {Object} comment
     * @param {string} body
     * @returns {Promise<boolean>} True when the reply was stored.
     */
    async _postReply(comment, body) {
        if (!this._service) {
            return false;
        }
        const result = await this._service.create({ body }, {
            path: webexpress.webapp.commentModel.commentSubPath(comment.id, "replies")
        });
        if (result.ok) {
            const reply = result.data;
            const current = this._comments.find((c) => c.id === comment.id) || comment;
            this._patchComment(comment.id, { replies: (current.replies || []).concat([reply]) });
            this._dispatch(webexpress.webapp.Event.COMMENT_REPLY_EVENT, { commentId: comment.id, reply });
            return true;
        }
        console.warn("CommentCtrl: reply failed", webexpress.webapp.ServiceResult.describe(result));
        return false;
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
