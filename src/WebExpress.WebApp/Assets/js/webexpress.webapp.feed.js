/**
 * A REST-backed feed: entries stacked newest first, with a button under them that fetches the
 * next page and appends it.
 *
 * It is the counterpart of ListCtrl for content that is read rather than scanned. A list replaces
 * its rows when the page changes; a feed keeps what is already on the page and adds under it, so
 * the reader never loses their place by asking for more.
 *
 * The endpoint is a RestApiFeed, declared through the data service island, and answers the
 * envelope every paged control family here reads: `items` beside a `pagination` block, resolved
 * through webexpress.webapp.pagingOf.
 *
 * Emits:
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT after every page, with the page number
 */
webexpress.webapp.FeedCtrl = class extends webexpress.webui.Ctrl {

    /**
     * Constructor.
     * @param {HTMLElement} element The host element.
     */
    constructor(element) {
        super(element);

        const services = webexpress.webapp.ServiceRegistry.fromElement(element);

        this._service = services ? services.data : null;
        this._pageSize = parseInt((element.dataset && element.dataset.pageSize) || "5", 10) || 5;
        this._moreLabel = (element.dataset && element.dataset.moreLabel) || this._i18n("webexpress.webapp:feed.more", "More");
        this._emptyText = (element.dataset && element.dataset.emptyText) || this._i18n("webexpress.webapp:feed.empty", "");
        this._openLabel = (element.dataset && element.dataset.openLabel) || "";

        this._page = 0;
        this._loaded = 0;
        this._total = null;
        this._loading = false;

        this._buildDom();
        this._load();
    }

    /**
     * Builds the parts the feed keeps for its whole life: the list of entries, the placeholder
     * shown while there are none, and the button.
     */
    _buildDom() {
        this._element.innerHTML = "";

        // the controller registry removes the class it instantiated the control by, so
        // "wx-webapp-feed" is gone by the time there is anything to style. The stylesheet is
        // written against the class the control gives itself here, exactly as the list is
        this._element.classList.add("wx-feed");

        this._entries = document.createElement("div");
        this._entries.className = "wx-feed-entries";

        this._empty = document.createElement("div");
        this._empty.className = "wx-feed-empty text-secondary";
        this._empty.textContent = this._emptyText;
        this._empty.hidden = true;

        this._footer = document.createElement("div");
        this._footer.className = "wx-feed-footer";

        this._more = document.createElement("button");
        this._more.type = "button";
        this._more.className = "btn btn-outline-secondary wx-feed-more";
        this._more.textContent = this._moreLabel;
        this._more.hidden = true;
        this._more.addEventListener("click", () => this._load());

        this._footer.appendChild(this._more);
        this._element.appendChild(this._entries);
        this._element.appendChild(this._empty);
        this._element.appendChild(this._footer);
    }

    /**
     * Fetches the next page and appends it.
     *
     * Nothing is torn down on the way: a failed page leaves what is already read on the screen and
     * the button in place, so asking again is the whole recovery.
     */
    async _load() {
        if (this._loading || !this._service) {
            return;
        }

        this._loading = true;
        this._more.disabled = true;

        const result = await this._service.query({ page: this._page, pageSize: this._pageSize });

        this._loading = false;
        this._more.disabled = false;

        if (!result.ok) {
            if (result.error.kind !== "abort") {
                console.error("the request could not be completed successfully:", webexpress.webapp.ServiceResult.describe(result));
            }

            return;
        }

        const response = result.data || {};
        const items = Array.isArray(response.items) ? response.items : [];
        const paging = webexpress.webapp.pagingOf(response);

        items.forEach((item) => this._entries.appendChild(this._buildEntry(item)));

        this._loaded += items.length;
        this._total = paging.total;
        this._page += 1;

        this._empty.hidden = this._loaded > 0;

        // there is more when the endpoint counted its result and we are short of it; when it did
        // not count, a page that came back full is the only reason to believe more exists
        const more = this._total !== null
            ? this._loaded < this._total
            : items.length === this._pageSize;

        this._more.hidden = !more;

        this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, { response: response, page: this._page - 1 });
    }

    /**
     * Builds one entry: a heading, the line of context under it, the pictures beside the teaser,
     * and a foot carrying the tags on one side and the figures on the other.
     * @param {object} item The entry as the endpoint sent it.
     * @returns {HTMLElement} The entry element.
     */
    _buildEntry(item) {
        const entry = document.createElement("article");
        entry.className = "wx-feed-entry";

        if (item.id) {
            entry.dataset.id = item.id;
        }

        // only what the reader has not seen is marked, and only when the endpoint says it knows:
        // "not read" and "not tracked" must not look alike
        if (item.read === false) {
            entry.classList.add("wx-feed-entry-unread");
        }

        const title = document.createElement("h3");
        title.className = "wx-feed-entry-title";

        if (item.read === false) {
            const unread = document.createElement("span");
            unread.className = "wx-feed-entry-unread-marker";
            unread.setAttribute("aria-hidden", "true");
            title.appendChild(unread);
        }

        if (item.icon) {
            const icon = document.createElement("span");
            icon.className = "wx-feed-entry-icon " + item.icon;
            icon.setAttribute("aria-hidden", "true");
            title.appendChild(icon);
        }

        if (item.uri) {
            const link = document.createElement("a");
            link.href = item.uri;
            link.textContent = item.title || "";
            title.appendChild(link);
        } else {
            title.appendChild(document.createTextNode(item.title || ""));
        }

        entry.appendChild(title);

        if (item.meta) {
            const meta = document.createElement("div");
            meta.className = "wx-feed-entry-meta";
            meta.textContent = item.meta;
            entry.appendChild(meta);
        }

        // the pictures and the teaser share a row: the pictures hold a column of their own so a
        // long text never wraps under them and leaves a ragged block
        const body = document.createElement("div");
        body.className = "wx-feed-entry-body";

        const media = this._buildMedia(item);

        if (media) {
            body.appendChild(media);
            entry.classList.add("wx-feed-entry-illustrated");
        }

        if (item.text) {
            const text = document.createElement("div");
            text.className = "wx-feed-entry-text";

            // the text is what the editor stored, so it is handed to the same reading view the
            // rest of the product uses rather than written into the page as markup
            if (webexpress.webui.ContentFormat) {
                text.appendChild(webexpress.webui.ContentFormat.toFragment(item.text));
            } else {
                text.textContent = item.text;
            }

            if (item.uri && this._openLabel) {
                const open = document.createElement("a");
                open.className = "wx-feed-entry-open";
                open.href = item.uri;
                open.textContent = this._openLabel;
                text.appendChild(open);
            }

            body.appendChild(text);
        }

        entry.appendChild(body);

        const footer = this._buildFooter(item);

        if (footer) {
            entry.appendChild(footer);
        }

        return entry;
    }

    /**
     * Builds the picture column of an entry: nothing, a single picture, or a slideshow.
     *
     * The slideshow is the framework's own carousel markup, driven by the bootstrap that is
     * already on the page, so a feed slideshow and a carousel authored in C# behave and look the
     * same. Where bootstrap is absent the controls still work: the buttons are wired to a
     * fallback that moves the active slide itself.
     *
     * @param {object} item The entry.
     * @returns {HTMLElement|null} The media element, or null when the entry has no picture.
     */
    _buildMedia(item) {
        const images = (Array.isArray(item.images) ? item.images : []).filter(Boolean);

        if (images.length === 0) {
            return null;
        }

        const media = document.createElement("div");
        media.className = "wx-feed-entry-media";

        if (images.length === 1) {
            media.appendChild(this._buildImage(images[0], item));

            return media;
        }

        const id = "wx-feed-carousel-" + (item.id || Math.random().toString(36).slice(2));

        const carousel = document.createElement("div");
        carousel.className = "carousel slide wx-feed-carousel";
        carousel.id = id;

        const indicators = document.createElement("div");
        indicators.className = "carousel-indicators";

        const inner = document.createElement("div");
        inner.className = "carousel-inner";

        images.forEach((source, index) => {
            const slide = document.createElement("div");
            slide.className = index === 0 ? "carousel-item active" : "carousel-item";
            slide.appendChild(this._buildImage(source, item));
            inner.appendChild(slide);

            const indicator = document.createElement("button");
            indicator.type = "button";
            indicator.className = index === 0 ? "active" : "";
            indicator.dataset.bsTarget = "#" + id;
            indicator.dataset.bsSlideTo = String(index);
            indicator.setAttribute("aria-label", String(index + 1));
            indicators.appendChild(indicator);
        });

        carousel.appendChild(inner);
        carousel.appendChild(indicators);
        carousel.appendChild(this._buildCarouselControl(carousel, id, "prev"));
        carousel.appendChild(this._buildCarouselControl(carousel, id, "next"));

        media.appendChild(carousel);

        if (window.bootstrap && typeof window.bootstrap.Carousel === "function") {
            // the entries are built after the page was parsed, so bootstrap never sees them
            // itself - it is handed the element rather than left to find it
            new window.bootstrap.Carousel(carousel, { interval: 6000, ride: "carousel" });
        }

        return media;
    }

    /**
     * Builds one picture of an entry.
     * @param {string} source The address of the picture.
     * @param {object} item The entry it belongs to.
     * @returns {HTMLElement} The picture, wrapped in a link when the entry leads somewhere.
     */
    _buildImage(source, item) {
        const image = document.createElement("img");
        image.className = "wx-feed-entry-image";
        image.src = source;
        image.alt = "";
        image.loading = "lazy";

        if (!item.uri) {
            return image;
        }

        const link = document.createElement("a");
        link.href = item.uri;
        link.className = "wx-feed-entry-image-link";
        link.setAttribute("tabindex", "-1");
        link.setAttribute("aria-hidden", "true");
        link.appendChild(image);

        return link;
    }

    /**
     * Builds one of the two slideshow buttons.
     * @param {HTMLElement} carousel The carousel the button belongs to.
     * @param {string} id The id of the carousel.
     * @param {string} direction Either "prev" or "next".
     * @returns {HTMLElement} The button.
     */
    _buildCarouselControl(carousel, id, direction) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "carousel-control-" + direction;
        button.dataset.bsTarget = "#" + id;
        button.dataset.bsSlide = direction;

        const icon = document.createElement("span");
        icon.className = "carousel-control-" + direction + "-icon";
        icon.setAttribute("aria-hidden", "true");
        button.appendChild(icon);

        button.addEventListener("click", () => {
            if (window.bootstrap && typeof window.bootstrap.Carousel === "function") {
                return;
            }

            this._slide(carousel, direction === "next" ? 1 : -1);
        });

        return button;
    }

    /**
     * Moves a slideshow by hand, for a page without bootstrap.
     * @param {HTMLElement} carousel The carousel to move.
     * @param {number} step How far to move, in slides.
     */
    _slide(carousel, step) {
        const slides = [...carousel.querySelectorAll(".carousel-item")];
        const indicators = [...carousel.querySelectorAll(".carousel-indicators button")];
        const current = slides.findIndex((x) => x.classList.contains("active"));

        if (slides.length === 0 || current < 0) {
            return;
        }

        const next = (current + step + slides.length) % slides.length;

        slides[current].classList.remove("active");
        slides[next].classList.add("active");

        if (indicators[current]) {
            indicators[current].classList.remove("active");
        }

        if (indicators[next]) {
            indicators[next].classList.add("active");
        }
    }

    /**
     * Builds the foot of an entry: the tags on one side, the figures on the other. Returns null
     * when the entry has neither.
     * @param {object} item The entry.
     * @returns {HTMLElement|null} The footer element, or null.
     */
    _buildFooter(item) {
        const tags = (Array.isArray(item.tags) ? item.tags : []).filter(Boolean);
        const metrics = (Array.isArray(item.metrics) ? item.metrics : []).filter(Boolean);

        if (tags.length === 0 && metrics.length === 0) {
            return null;
        }

        const footer = document.createElement("div");
        footer.className = "wx-feed-entry-footer";

        const tagRow = document.createElement("div");
        tagRow.className = "wx-feed-entry-tags";

        tags.forEach((value) => {
            const tag = document.createElement("span");
            tag.className = "wx-feed-entry-tag";
            tag.textContent = value;
            tagRow.appendChild(tag);
        });

        footer.appendChild(tagRow);

        const metricRow = document.createElement("div");
        metricRow.className = "wx-feed-entry-metrics";

        metrics.forEach((metric) => metricRow.appendChild(this._buildMetric(metric)));

        footer.appendChild(metricRow);

        return footer;
    }

    /**
     * Builds one figure. A figure the endpoint gave an address to is something the reader can
     * join - a button that posts and repaints itself from the answer; one without stays a figure.
     * @param {object} metric The figure as the endpoint sent it.
     * @returns {HTMLElement} The figure element.
     */
    _buildMetric(metric) {
        const actionable = !!metric.uri;
        const figure = document.createElement(actionable ? "button" : "span");

        figure.className = "wx-feed-entry-metric";

        if (metric.label) {
            figure.title = metric.label;
            figure.setAttribute("aria-label", metric.label);
        }

        const value = document.createElement("span");
        value.className = "wx-feed-entry-metric-value";
        value.textContent = metric.value ?? "";
        figure.appendChild(value);

        if (metric.icon) {
            const icon = document.createElement("span");
            icon.className = "wx-feed-entry-metric-icon " + metric.icon;
            icon.setAttribute("aria-hidden", "true");
            figure.appendChild(icon);
        }

        if (!actionable) {
            return figure;
        }

        figure.type = "button";
        figure.classList.add("wx-feed-entry-metric-action");
        figure.classList.toggle("wx-feed-entry-metric-active", !!metric.active);
        figure.setAttribute("aria-pressed", metric.active ? "true" : "false");

        figure.addEventListener("click", () => this._toggleMetric(figure, value, metric));

        return figure;
    }

    /**
     * Posts a figure's toggle and repaints it from the answer.
     *
     * The count comes back from the server rather than being counted up here: two readers
     * clicking at once would otherwise each see their own click and neither the other's, and the
     * number would drift from the one the next page load shows.
     *
     * @param {HTMLElement} figure The figure element.
     * @param {HTMLElement} value The element holding the number.
     * @param {object} metric The figure as the endpoint sent it.
     */
    async _toggleMetric(figure, value, metric) {
        if (figure.disabled) {
            return;
        }

        figure.disabled = true;

        try {
            const response = await fetch(metric.uri, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: metric.payload || "{}"
            });

            if (!response.ok) {
                console.error("the request could not be completed successfully:", response.status, metric.uri);

                return;
            }

            const result = await response.json();

            if (result && result.value !== undefined && result.value !== null) {
                value.textContent = result.value;
            }

            const active = !!(result && result.active);

            figure.classList.toggle("wx-feed-entry-metric-active", active);
            figure.setAttribute("aria-pressed", active ? "true" : "false");

            // the entry keeps what it was told, so a second click sends the same body and reads
            // the same state as the first
            metric.active = active;

            this._dispatch(webexpress.webui.Event.CHANGE_VALUE_EVENT, { metric: metric, active: active });
        } catch (error) {
            console.error("the request could not be completed successfully:", error);
        } finally {
            figure.disabled = false;
        }
    }

    /**
     * Dispatches an event on the host element.
     * @param {string} name The event name.
     * @param {object} detail The event detail.
     */
    _dispatch(name, detail) {
        this._element.dispatchEvent(new CustomEvent(name, { detail: detail, bubbles: true }));
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-feed", webexpress.webapp.FeedCtrl);
