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
 * Declarative configuration:
 *   <div class="wx-webapp-comment"
 *        data-uri="/api/comments/INC-00123"
 *        data-users-uri="/api/users"
 *        data-current-user="u1"
 *        data-image-upload-uri="/api/upload"></div>
 *
 * REST contract:
 *   GET    {uri}                                       → [Comment]
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
webexpress.webapp.CommentCtrl = class extends webexpress.webui.Ctrl {

    /**
     * Default comment categories. Consumers can override via data-categories
     * (JSON string) or by replacing the CATEGORIES static property.
     */
    static CATEGORIES = {
        general:  { id: "general",  i18n: "webexpress.webapp:comment.cat.general",  color: "var(--wx-webapp-cat-general,  #6b7280)", bg: "var(--wx-webapp-cat-general-bg,  #f3f4f6)" },
        question: { id: "question", i18n: "webexpress.webapp:comment.cat.question", color: "var(--wx-webapp-cat-question, #b45309)", bg: "var(--wx-webapp-cat-question-bg, #fef3c7)" },
        hint:     { id: "hint",     i18n: "webexpress.webapp:comment.cat.hint",     color: "var(--wx-webapp-cat-hint,     #1e40af)", bg: "var(--wx-webapp-cat-hint-bg,     #dbeafe)" },
        status:   { id: "status",   i18n: "webexpress.webapp:comment.cat.status",   color: "var(--wx-webapp-cat-status,   #6d28d9)", bg: "var(--wx-webapp-cat-status-bg,   #ede9fe)" },
        decision: { id: "decision", i18n: "webexpress.webapp:comment.cat.decision", color: "var(--wx-webapp-cat-decision, #0e7490)", bg: "var(--wx-webapp-cat-decision-bg, #cffafe)" },
        solution: { id: "solution", i18n: "webexpress.webapp:comment.cat.solution", color: "var(--wx-webapp-cat-solution, #047857)", bg: "var(--wx-webapp-cat-solution-bg, #d1fae5)" }
    };

    /**
     * Default reaction emoji palette.
     */
    static REACTIONS = ["👍", "❤️", "🎉", "😄", "🙏", "👀", "🔥"];

    /**
     * Construct a new CommentCtrl.
     * @param {HTMLElement} element - host element.
     */
    constructor(element) {
        super(element);

        this._uri = element.dataset.uri || null;
        this._usersUri = element.dataset.usersUri || null;
        this._currentUser = element.dataset.currentUser || null;
        this._imageUploadUri = element.dataset.imageUploadUri || null;
        this._readonly = element.dataset.readonly === "true";

        // categories can be overridden through a JSON attribute
        if (element.dataset.categories) {
            try {
                this._categories = JSON.parse(element.dataset.categories);
            } catch (_) {
                this._categories = webexpress.webapp.CommentCtrl.CATEGORIES;
            }
        } else {
            this._categories = webexpress.webapp.CommentCtrl.CATEGORIES;
        }

        // state
        this._comments = [];
        this._sortBy = "date";   // "date" | "likes"
        this._sortDir = "desc";  // "asc" | "desc"
        this._filterCat = "all";
        this._editingId = null;  // id of comment currently in edit-mode
        this._editorEditRef = null; // EditorCtrl instance while editing
        this._userCache = {};    // userId -> user record

        // clean host
        element.textContent = "";
        element.removeAttribute("data-uri");
        element.removeAttribute("data-users-uri");
        element.removeAttribute("data-current-user");
        element.removeAttribute("data-image-upload-uri");
        element.removeAttribute("data-readonly");
        element.removeAttribute("data-categories");
        element.classList.add("wx-webapp-comment");

        this._buildDom();
        this._attachEventHandlers();
        this._load();
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
        this._toolbar.className = "wx-webapp-comment-toolbar";

        // category filter
        this._filterSelect = document.createElement("select");
        this._filterSelect.className = "wx-webapp-comment-filter";
        this._rebuildFilterOptions();

        // sort selector
        this._sortSelect = document.createElement("select");
        this._sortSelect.className = "wx-webapp-comment-sort";
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
        this._sortDirBtn.className = "wx-webapp-comment-sort-dir";
        this._updateSortDirBtn();

        const filterLabel = document.createElement("span");
        filterLabel.className = "wx-webapp-comment-toolbar-label";
        filterLabel.textContent = this._i18n("webexpress.webapp:comment.filter", "Filter") + ":";

        const sortLabel = document.createElement("span");
        sortLabel.className = "wx-webapp-comment-toolbar-label";
        sortLabel.textContent = this._i18n("webexpress.webapp:comment.sort", "Sort") + ":";

        this._toolbar.appendChild(filterLabel);
        this._toolbar.appendChild(this._filterSelect);
        this._toolbar.appendChild(sortLabel);
        this._toolbar.appendChild(this._sortSelect);
        this._toolbar.appendChild(this._sortDirBtn);

        const pinnedNote = document.createElement("span");
        pinnedNote.className = "wx-webapp-comment-pinned-note";
        pinnedNote.innerHTML = "<i class='wx-icon-light wx-icon-light-pin'></i>" + this._i18n("webexpress.webapp:comment.pinned-on-top", "Pinned comments stay on top");
        this._toolbar.appendChild(pinnedNote);

        // list area
        this._list = document.createElement("div");
        this._list.className = "wx-webapp-comment-list";

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
        if (!this._uri) {
            this._comments = [];
            this._renderList();
            return;
        }
        try {
            const res = await fetch(this._uri, { headers: { "Accept": "application/json" } });
            if (!res.ok) throw new Error(res.statusText);
            this._comments = await res.json();
        } catch (e) {
            console.warn("CommentCtrl: load failed", e);
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
        if (!this._usersUri) {
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
        try {
            const url = this._usersUri + (this._usersUri.includes("?") ? "&" : "?") + "ids=" + missing.map(encodeURIComponent).join(",");
            const res = await fetch(url, { headers: { "Accept": "application/json" } });
            if (!res.ok) throw new Error(res.statusText);
            const users = await res.json();
            for (const u of users) {
                this._userCache[u.id] = u;
            }
        } catch (e) {
            console.warn("CommentCtrl: user preload failed", e);
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
     */
    _renderList() {
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
            empty.className = "wx-webapp-comment-empty";
            empty.textContent = this._filterCat === "all"
                ? this._i18n("webexpress.webapp:comment.empty", "No comments yet")
                : this._i18n("webexpress.webapp:comment.empty.filtered", "No comments in this category");
            this._list.appendChild(empty);
            return;
        }
        for (const c of arr) {
            this._list.appendChild(this._renderComment(c));
        }
    }

    /**
     * Builds the DOM for a single comment.
     * @param {Object} comment
     * @returns {HTMLElement}
     */
    _renderComment(comment) {
        const author = this._user(comment.author);
        const cat = this._categories[comment.category] || this._categories.general;
        const isMe = comment.author === this._currentUser;
        const liked = (comment.likes || []).includes(this._currentUser);
        const collapsed = !!comment.collapsed;
        const editing = this._editingId === comment.id;

        const wrap = document.createElement("article");
        wrap.className = "wx-webapp-comment-item"
            + (comment.pinned ? " wx-webapp-comment-item--pinned" : "")
            + (collapsed ? " wx-webapp-comment-item--collapsed" : "")
            + (isMe ? " wx-webapp-comment-item--me" : "");
        wrap.dataset.commentId = comment.id;

        // header
        const head = document.createElement("header");
        head.className = "wx-webapp-comment-head";
        head.innerHTML = `
            <span class="wx-webapp-comment-avatar wx-webapp-comment-avatar--lg" style="background:${author.color || "#888"}" title="${this._esc(author.name)}">${this._esc(author.initials || "?")}</span>
            <div class="wx-webapp-comment-head-main">
                <div class="wx-webapp-comment-author-row">
                    <span class="wx-webapp-comment-author">${this._esc(author.name)}</span>
                    ${author.team ? `<span class="wx-webapp-comment-team">· ${this._esc(author.team)}</span>` : ""}
                    <span class="wx-webapp-comment-when${comment.edited ? " wx-webapp-comment-when--edited" : ""}">${this._esc(comment.when)}</span>
                    ${comment.pinned ? `<span class="wx-webapp-comment-pinned">★ ${this._esc(this._i18n("webexpress.webapp:comment.pinned", "Pinned"))}</span>` : ""}
                </div>
                <div class="wx-webapp-comment-labels">
                    <span class="wx-webapp-comment-category" style="color:${cat.color};background:${cat.bg}">${this._esc(this._i18n(cat.i18n, cat.id))}</span>
                    ${(comment.labels || []).map(l => `<span class="wx-webapp-comment-label">${this._esc(l)}</span>`).join("")}
                </div>
            </div>
        `;

        // header actions
        const actions = document.createElement("div");
        actions.className = "wx-webapp-comment-head-actions";

        const likeBtn = this._iconBtn(liked ? "♥" : "♡", liked
            ? this._i18n("webexpress.webapp:comment.like.remove", "Unlike")
            : this._i18n("webexpress.webapp:comment.like", "Like"));
        likeBtn.classList.toggle("wx-webapp-comment-action--liked", liked);
        const likeCount = document.createElement("span");
        likeCount.className = "wx-webapp-comment-like-count";
        likeCount.textContent = String((comment.likes || []).length);
        likeBtn.appendChild(likeCount);
        likeBtn.addEventListener("click", () => this._toggleLike(comment));
        actions.appendChild(likeBtn);

        const pinBtn = this._iconBtn("★", comment.pinned
            ? this._i18n("webexpress.webapp:comment.pin.remove", "Unpin")
            : this._i18n("webexpress.webapp:comment.pin", "Pin"));
        pinBtn.classList.toggle("wx-webapp-comment-action--pinned", !!comment.pinned);
        pinBtn.addEventListener("click", () => this._togglePin(comment));
        actions.appendChild(pinBtn);

        const collapseBtn = this._iconBtn(collapsed ? "▶" : "▼", collapsed
            ? this._i18n("webexpress.webapp:comment.expand", "Expand")
            : this._i18n("webexpress.webapp:comment.collapse", "Collapse"));
        collapseBtn.addEventListener("click", () => {
            comment.collapsed = !collapsed;
            this._renderList();
        });
        actions.appendChild(collapseBtn);

        if (isMe && !this._readonly) {
            const editBtn = this._iconBtn("✎", this._i18n("webexpress.webapp:comment.edit", "Edit"));
            editBtn.addEventListener("click", () => {
                this._editingId = editing ? null : comment.id;
                this._renderList();
            });
            actions.appendChild(editBtn);

            const delBtn = this._iconBtn("🗑", this._i18n("webexpress.webapp:comment.delete", "Delete"));
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
            body.className = "wx-webapp-comment-body";
            body.innerHTML = comment.body || "";
            wrap.appendChild(body);

            // reactions
            wrap.appendChild(this._renderReactions(comment));
        }

        // footer
        const footer = document.createElement("footer");
        footer.className = "wx-webapp-comment-footer";

        const replyBtn = document.createElement("button");
        replyBtn.type = "button";
        replyBtn.className = "wx-webapp-comment-reply-btn";
        replyBtn.textContent = "↳ " + this._i18n("webexpress.webapp:comment.reply", "Reply");
        replyBtn.addEventListener("click", () => this._startReply(comment, wrap));
        if (!this._readonly) {
            footer.appendChild(replyBtn);
        }

        if ((comment.replies || []).length > 0) {
            const count = document.createElement("span");
            count.className = "wx-webapp-comment-reply-count";
            const n = comment.replies.length;
            const key = n === 1
                ? "webexpress.webapp:comment.replies.singular"
                : "webexpress.webapp:comment.replies.plural";
            count.textContent = this._i18n(key, n === 1 ? "{n} reply" : "{n} replies").replace("{n}", n);
            footer.appendChild(count);
        }

        if (comment.edited) {
            const ed = document.createElement("span");
            ed.className = "wx-webapp-comment-edited-note";
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
     * Builds a small icon-only action button.
     * @param {string} text - The glyph to show.
     * @param {string} title - Accessible label.
     * @returns {HTMLButtonElement}
     */
    _iconBtn(text, title) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "wx-webapp-comment-action";
        b.title = title;
        b.setAttribute("aria-label", title);
        b.textContent = text;
        return b;
    }

    /**
     * Builds the reactions row.
     * @param {Object} comment
     * @returns {HTMLElement}
     */
    _renderReactions(comment) {
        const row = document.createElement("div");
        row.className = "wx-webapp-comment-reactions";

        const entries = Object.entries(comment.reactions || {}).filter(([, users]) => users.length > 0);
        for (const [emoji, users] of entries) {
            const mine = users.includes(this._currentUser);
            const names = users.map(uid => this._user(uid).name).join(", ");
            const b = document.createElement("button");
            b.type = "button";
            b.className = "wx-webapp-comment-reaction" + (mine ? " wx-webapp-comment-reaction--mine" : "");
            b.title = names + (mine ? " · " + this._i18n("webexpress.webapp:comment.reaction.you-too", "and you") : "");
            b.innerHTML = `<span class="wx-webapp-comment-reaction-emoji">${emoji}</span> ${users.length}`;
            b.addEventListener("click", () => this._toggleReaction(comment, emoji));
            row.appendChild(b);
        }

        if (!this._readonly) {
            const wrap = document.createElement("span");
            wrap.className = "wx-webapp-comment-reaction-add-wrap";

            const addBtn = document.createElement("button");
            addBtn.type = "button";
            addBtn.className = "wx-webapp-comment-reaction-add";
            addBtn.title = this._i18n("webexpress.webapp:comment.reaction.add", "Add reaction");
            addBtn.setAttribute("aria-label", addBtn.title);
            addBtn.textContent = "+";

            const popup = document.createElement("div");
            popup.className = "wx-webapp-comment-reaction-popup";
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
        wrap.className = "wx-webapp-comment-edit";

        const editorHost = document.createElement("div");
        editorHost.className = "wx-webui-editor wx-webapp-comment-edit-editor";
        editorHost.innerHTML = comment.body || "";

        const actions = document.createElement("div");
        actions.className = "wx-webapp-comment-edit-actions";

        const catSelect = document.createElement("select");
        catSelect.className = "wx-webapp-comment-edit-cat";
        for (const cat of Object.values(this._categories)) {
            const opt = document.createElement("option");
            opt.value = cat.id;
            opt.textContent = this._i18n(cat.i18n, cat.id);
            if (comment.category === cat.id) opt.selected = true;
            catSelect.appendChild(opt);
        }

        const labelsInput = document.createElement("input");
        labelsInput.type = "text";
        labelsInput.className = "wx-webapp-comment-edit-labels";
        labelsInput.placeholder = this._i18n("webexpress.webapp:comment.labels.placeholder", "Labels (comma-separated)");
        labelsInput.value = (comment.labels || []).join(", ");

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "btn btn-link btn-sm";
        cancelBtn.textContent = this._i18n("cancel", "Cancel");
        cancelBtn.addEventListener("click", () => {
            this._editingId = null;
            this._editorEditRef = null;
            this._renderList();
        });

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "btn btn-primary btn-sm";
        saveBtn.textContent = this._i18n("save", "Save");
        saveBtn.addEventListener("click", () => {
            const newBody = this._editorEditRef ? this._editorEditRef.value : editorHost.innerHTML;
            this._saveEdit(comment, {
                body: newBody,
                category: catSelect.value,
                labels: labelsInput.value.split(",").map(s => s.trim()).filter(Boolean)
            });
        });

        actions.appendChild(catSelect);
        actions.appendChild(labelsInput);
        const spacer = document.createElement("span");
        spacer.className = "wx-webapp-comment-spacer";
        actions.appendChild(spacer);
        actions.appendChild(cancelBtn);
        actions.appendChild(saveBtn);

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
        wrap.className = "wx-webapp-comment-replies";
        for (const r of comment.replies) {
            const ru = this._user(r.author);
            const row = document.createElement("div");
            row.className = "wx-webapp-comment-reply";
            row.innerHTML = `
                <span class="wx-webapp-comment-avatar wx-webapp-comment-avatar--sm" style="background:${ru.color || "#888"}">${this._esc(ru.initials || "?")}</span>
                <div>
                    <div class="wx-webapp-comment-reply-head">
                        <span class="wx-webapp-comment-reply-author">${this._esc(ru.name)}</span>
                        <span class="wx-webapp-comment-reply-when">${this._esc(r.when || "")}</span>
                    </div>
                    <div class="wx-webapp-comment-reply-body">${r.body || ""}</div>
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
        const existing = wrap.querySelector(".wx-webapp-comment-reply-compose");
        if (existing) {
            existing.querySelector("textarea")?.focus();
            return;
        }
        const box = document.createElement("div");
        box.className = "wx-webapp-comment-reply-compose";

        const ta = document.createElement("textarea");
        ta.placeholder = this._i18n("webexpress.webapp:comment.reply.placeholder", "Write a reply…");

        const actions = document.createElement("div");
        actions.className = "wx-webapp-comment-reply-compose-actions";

        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "btn btn-link btn-sm";
        cancel.textContent = this._i18n("cancel", "Cancel");
        cancel.addEventListener("click", () => box.remove());

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

        actions.appendChild(cancel);
        actions.appendChild(send);
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
        if (wrap.querySelector(".wx-webapp-comment-delete-confirm")) {
            return;
        }
        const strip = document.createElement("div");
        strip.className = "wx-webapp-comment-delete-confirm";
        strip.innerHTML = `
            <span><strong>${this._esc(this._i18n("webexpress.webapp:comment.delete.confirm.title", "Delete comment?"))}</strong> ${this._esc(this._i18n("webexpress.webapp:comment.delete.confirm.body", "This action cannot be undone."))}</span>
            <span class="wx-webapp-comment-spacer"></span>
        `;
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "btn btn-link btn-sm";
        cancel.textContent = this._i18n("cancel", "Cancel");
        cancel.addEventListener("click", () => strip.remove());

        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn btn-danger btn-sm";
        del.textContent = this._i18n("webexpress.webapp:comment.delete", "Delete");
        del.addEventListener("click", () => this._delete(comment));

        strip.appendChild(cancel);
        strip.appendChild(del);
        wrap.appendChild(strip);
    }

    // ============================================================ REST ops

    /**
     * Saves an inline edit for a comment.
     * @param {Object} comment
     * @param {Object} patch
     */
    async _saveEdit(comment, patch) {
        try {
            const res = await fetch(this._uri + "/" + encodeURIComponent(comment.id), {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify(patch)
            });
            if (!res.ok) throw new Error(res.statusText);
            const updated = await res.json();
            this._comments = this._comments.map(c => c.id === updated.id ? updated : c);
            this._editingId = null;
            this._editorEditRef = null;
            this._rebuildFilterOptions();
            this._renderList();
            this._dispatch(webexpress.webapp.Event.COMMENT_UPDATED_EVENT, { comment: updated });
        } catch (e) {
            console.warn("CommentCtrl: edit failed", e);
        }
    }

    /**
     * Deletes a comment.
     * @param {Object} comment
     */
    async _delete(comment) {
        try {
            const res = await fetch(this._uri + "/" + encodeURIComponent(comment.id), { method: "DELETE" });
            if (!res.ok && res.status !== 204) throw new Error(res.statusText);
            this._comments = this._comments.filter(c => c.id !== comment.id);
            this._rebuildFilterOptions();
            this._renderList();
            this._dispatch(webexpress.webapp.Event.COMMENT_DELETED_EVENT, { id: comment.id });
        } catch (e) {
            console.warn("CommentCtrl: delete failed", e);
        }
    }

    /**
     * Toggles a like on a comment.
     * @param {Object} comment
     */
    async _toggleLike(comment) {
        try {
            const res = await fetch(this._uri + "/" + encodeURIComponent(comment.id) + "/likes", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ userId: this._currentUser })
            });
            if (!res.ok) throw new Error(res.statusText);
            const updated = await res.json();
            comment.likes = updated.likes;
            this._renderList();
            this._dispatch(webexpress.webapp.Event.COMMENT_UPDATED_EVENT, { comment });
        } catch (e) {
            console.warn("CommentCtrl: like failed", e);
        }
    }

    /**
     * Toggles the pinned state of a comment.
     * @param {Object} comment
     */
    async _togglePin(comment) {
        try {
            const res = await fetch(this._uri + "/" + encodeURIComponent(comment.id) + "/pin", {
                method: "POST",
                headers: { "Accept": "application/json" }
            });
            if (!res.ok) throw new Error(res.statusText);
            const updated = await res.json();
            comment.pinned = updated.pinned;
            this._renderList();
            this._dispatch(webexpress.webapp.Event.COMMENT_UPDATED_EVENT, { comment });
        } catch (e) {
            console.warn("CommentCtrl: pin failed", e);
        }
    }

    /**
     * Toggles a reaction emoji for the current user.
     * @param {Object} comment
     * @param {string} emoji
     */
    async _toggleReaction(comment, emoji) {
        try {
            const res = await fetch(this._uri + "/" + encodeURIComponent(comment.id) + "/reactions", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ emoji, userId: this._currentUser })
            });
            if (!res.ok) throw new Error(res.statusText);
            const updated = await res.json();
            comment.reactions = updated.reactions;
            this._renderList();
            this._dispatch(webexpress.webapp.Event.COMMENT_REACTION_EVENT, { commentId: comment.id, emoji, reactions: comment.reactions });
        } catch (e) {
            console.warn("CommentCtrl: reaction failed", e);
        }
    }

    /**
     * Posts a reply to a comment.
     * @param {Object} comment
     * @param {string} body
     */
    async _postReply(comment, body) {
        try {
            const res = await fetch(this._uri + "/" + encodeURIComponent(comment.id) + "/replies", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ body })
            });
            if (!res.ok) throw new Error(res.statusText);
            const reply = await res.json();
            comment.replies = comment.replies || [];
            comment.replies.push(reply);
            this._renderList();
            this._dispatch(webexpress.webapp.Event.COMMENT_REPLY_EVENT, { commentId: comment.id, reply });
        } catch (e) {
            console.warn("CommentCtrl: reply failed", e);
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
     * Gets the current list of comments.
     * @returns {Array<Object>}
     */
    get value() {
        return this._comments.slice();
    }
};

// register for declarative auto-init
webexpress.webui.Controller.registerClass("wx-webapp-comment", webexpress.webapp.CommentCtrl);
