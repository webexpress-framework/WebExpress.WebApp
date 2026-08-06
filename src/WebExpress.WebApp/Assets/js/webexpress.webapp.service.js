var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Helpers that build the normalised result shape used by every service
 * operation. A result is { ok, data, error, status }, where error is null on
 * success and { kind, status, message, retriable } on failure.
 */
webexpress.webapp.ServiceResult = {
    /**
     * Builds a successful result.
     * @param {*} data - The payload.
     * @param {number} [status=200] - The http status.
     * @returns {object} The normalised success result.
     */
    ok(data, status = 200) {
        return { ok: true, data: data, error: null, status: status };
    },

    /**
     * Builds a failed result.
     * @param {string} kind - One of "network", "http", "parse", "abort", "validation".
     * @param {number} [status=0] - The http status when applicable.
     * @param {string} [message=""] - A human readable message.
     * @param {boolean} [retriable=false] - Whether retrying may succeed.
     * @returns {object} The normalised failure result.
     */
    fail(kind, status = 0, message = "", retriable = false) {
        return {
            ok: false,
            data: null,
            error: { kind: kind, status: status, message: message, retriable: retriable },
            status: status
        };
    },

    /**
     * Builds the diagnostic view of a failed result for a log. The message alone
     * says nothing about a failure the server reported - and is empty for some -
     * so the kind and the status travel along, together with whatever the caller
     * adds about the request that caused it.
     * @param {object} result - The normalised failure result.
     * @param {object} [context={}] - What the caller knows: uri, params, id, ...
     * @returns {object} The diagnostic view.
     */
    describe(result, context = {}) {
        const error = (result && result.error) || {};

        return Object.assign({
            kind: error.kind || "unknown",
            status: error.status || 0,
            message: error.message || ""
        }, context);
    }
};

/**
 * The global error channel of the service layer. Every service reports its
 * non abort failures here, which dispatches the
 * "webexpress.webapp.service.error" CustomEvent on the document so that an
 * unexpected failure is observable in one place without crashing a component.
 * An optional toast presents the failure through the existing popup
 * notification pipeline; it is opt in through the toast flag because
 * components that render their error state inline would otherwise present the
 * failure twice.
 */
webexpress.webapp.ErrorChannel = new class {
    /**
     * Creates the channel.
     */
    constructor() {
        this.toast = false;
    }

    /**
     * Reports a failed service result. Dispatches the
     * "webexpress.webapp.service.error" event and optionally shows a toast.
     * @param {object} result - The normalised failure result.
     * @param {object} [context={}] - The reporting context: service, operation.
     */
    report(result, context = {}) {
        const error = (result && result.error) || {};
        const detail = {
            service: context.service || null,
            operation: context.operation || null,
            kind: error.kind || "unknown",
            status: error.status || 0,
            message: error.message || "",
            retriable: !!error.retriable,
            result: result
        };

        document.dispatchEvent(new CustomEvent("webexpress.webapp.service.error", { detail: detail }));

        if (this.toast) {
            this._notify(detail);
        }
    }

    /**
     * Shows the failure as a popup notification through the local message
     * queue, reusing the PopupNotificationCtrl pipeline.
     * @param {object} detail - The reported error detail.
     */
    _notify(detail) {
        const queue = webexpress.webapp.MessageQueue;

        if (!queue || typeof queue.dispatchLocal !== "function") {
            return;
        }

        queue.dispatchLocal({
            type: "webexpress.webapp.popup.show",
            notification: {
                id: "service-error-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
                heading: detail.service ? "Service \"" + detail.service + "\"" : "Service",
                message: detail.message || "request failed",
                type: "alert-danger",
                icon: null,
                durability: 5000,
                progress: -1,
                created: new Date().toISOString()
            }
        });
    }
};

/**
 * Base class for services. It holds the descriptor configuration and provides
 * a no operation abort. Concrete services implement the operations they
 * support and call into the network.
 */
webexpress.webapp.Service = class {
    /**
     * Creates a service from a descriptor.
     * @param {object} [descriptor={}] - The service descriptor.
     */
    constructor(descriptor = {}) {
        this._descriptor = descriptor || {};
        this._name = this._descriptor.name || null;
    }

    /**
     * Returns the service name.
     * @returns {string|null} The name.
     */
    get name() {
        return this._name;
    }

    /**
     * Returns the base address the service calls, from its descriptor.
     * @returns {string} The base address, or an empty string.
     */
    get baseUri() {
        return this._descriptor.baseUri || "";
    }

    /**
     * Returns the wire names of the logical domains whose data the service
     * serves, from its descriptor. A ViewState subscribes these domains
     * on the message queue and re-queries the service's resources when the
     * server announces a data change.
     * @returns {Array<string>} The domain names, or an empty array.
     */
    get domains() {
        return this._descriptor.domains || [];
    }

    /**
     * Aborts any request that is in flight. The base implementation does
     * nothing.
     */
    abort() {
    }
};

/**
 * The default REST service. It maps logical parameters to wire parameters,
 * builds a url against the document base, performs the request with fetch,
 * cancels a superseded query through an AbortController and normalises both
 * success and failure.
 *
 * Descriptor shape:
 *   {
 *     name: "data",
 *     kind: "rest",
 *     baseUri: "/api/orders",
 *     method: "GET",
 *     updateMethod: "PUT",
 *     query: { search: "q", page: "p", pageSize: "l" },
 *     response: { items: "items", total: "total" },
 *     headers: { ... },
 *     errors: { "404": "webexpress.webapp:error.not_found" },
 *     retry: { count: 2, delayMs: 300 }
 *   }
 */
webexpress.webapp.RestService = class extends webexpress.webapp.Service {
    /**
     * Creates a REST service from a descriptor.
     * @param {object} descriptor - The service descriptor.
     */
    constructor(descriptor) {
        super(descriptor);
        this._abort = null;
        this._generation = 0;
    }

    /**
     * Aborts the query that is currently in flight, if any.
     */
    abort() {
        if (this._abort) {
            this._abort.abort("aborted");
            this._abort = null;
        }
    }

    /**
     * Loads data with a GET request. Alias of query with a load semantic.
     * @param {object} [params={}] - Logical query parameters.
     * @param {object} [options={}] - Request options such as path.
     * @returns {Promise<object>} A normalised result.
     */
    load(params = {}, options = {}) {
        return this.query(params, options);
    }

    /**
     * Queries data with a GET request. A new query aborts the previous one.
     * @param {object} [params={}] - Logical query parameters.
     * @param {object} [options={}] - Request options such as path.
     * @returns {Promise<object>} A normalised result.
     */
    query(params = {}, options = {}) {
        return this._send(this._descriptor.method || "GET", {
            params: params,
            path: options.path,
            abortable: true
        });
    }

    /**
     * Creates a resource with a POST request.
     * @param {*} body - The request body, serialised as JSON.
     * @param {object} [options={}] - Request options such as path and params.
     * @returns {Promise<object>} A normalised result.
     */
    create(body, options = {}) {
        return this._send("POST", {
            params: options.params,
            path: options.path,
            body: body,
            abortable: false
        });
    }

    /**
     * Updates a resource with a PUT or PATCH request.
     * @param {*} body - The request body, serialised as JSON.
     * @param {object} [options={}] - Request options such as path, params and method.
     * @returns {Promise<object>} A normalised result.
     */
    update(body, options = {}) {
        return this._send(options.method || this._descriptor.updateMethod || "PUT", {
            params: options.params,
            path: options.path,
            body: body,
            abortable: false
        });
    }

    /**
     * Removes a resource with a DELETE request.
     * @param {object} [options={}] - Request options such as path and params.
     * @returns {Promise<object>} A normalised result.
     */
    remove(options = {}) {
        return this._send("DELETE", {
            params: options.params,
            path: options.path,
            abortable: false
        });
    }

    /**
     * Performs an arbitrary request with a caller supplied url and fetch init,
     * and normalises the outcome. The response body is parsed by content type,
     * as json when the content type is application/json and as { text }
     * otherwise. The parsed body is returned on both success and failure, so a
     * control can inspect a validation response. This lets controls with a
     * bespoke request shape, for example forms, route their network access
     * through the service layer. The result also carries the raw response and
     * the content type.
     * @param {string} url - The request url.
     * @param {object} [init={}] - The fetch init, used as provided.
     * @returns {Promise<object>} A normalised result with response and contentType.
     */
    async request(url, init = {}) {
        try {
            const response = await fetch(url, init);
            const contentType = (response.headers && typeof response.headers.get === "function"
                ? response.headers.get("content-type")
                : "") || "";

            let data = null;
            if (response.status !== 204) {
                if (contentType.includes("application/json")) {
                    try { data = await response.json(); } catch (parseError) { data = null; }
                } else {
                    try { data = { text: await response.text() }; } catch (parseError) { data = null; }
                }
            }

            if (!response.ok) {
                const mapped = this._descriptor.errors && this._descriptor.errors[String(response.status)];
                // a mapped entry may be an i18n key (see the descriptor doc); plain text falls through untouched
                const message = (mapped && (webexpress?.webui?.I18N?.translate(mapped) ?? mapped)) || ("request failed with status " + response.status);
                const result = {
                    ok: false,
                    data: data,
                    error: { kind: "http", status: response.status, message: message, retriable: response.status >= 500 },
                    status: response.status,
                    response: response,
                    contentType: contentType
                };
                webexpress.webapp.ErrorChannel.report(result, { service: this._name, operation: (init && init.method) || "GET" });
                return result;
            }

            return { ok: true, data: data, error: null, status: response.status, response: response, contentType: contentType };
        } catch (networkError) {
            const kind = (networkError && networkError.name === "AbortError") ? "abort" : "network";
            const result = webexpress.webapp.ServiceResult.fail(kind, 0, networkError ? networkError.message : "network error", kind === "network");
            result.response = null;
            result.contentType = "";
            if (kind !== "abort") {
                webexpress.webapp.ErrorChannel.report(result, { service: this._name, operation: (init && init.method) || "GET" });
            }
            return result;
        }
    }

    /**
     * Projects a raw response into the configured shape, returning the items
     * and the total when a response mapping is present in the descriptor.
     * @param {object} data - The raw response payload.
     * @returns {object} An object with items and total.
     */
    project(data) {
        const map = this._descriptor.response || {};
        const itemsKey = map.items || "items";
        const totalKey = map.total || "total";
        const items = data && Array.isArray(data[itemsKey]) ? data[itemsKey] : [];
        const total = data && data[totalKey] != null ? Number(data[totalKey]) : items.length;

        return { items: items, total: total };
    }

    /**
     * The default wire names of the closed logical query vocabulary (see the
     * naming table in WebExpress/docs/view-state-service.md). A descriptor
     * without an explicit query mapping speaks the common REST interaction
     * model of WebExpress.WebApp, so the logical names map to the historical
     * wire names rather than leaking onto the wire verbatim.
     */
    static get defaultQueryMap() {
        return {
            search: "q",
            wql: "wql",
            filter: "f",
            page: "p",
            pageSize: "l",
            orderBy: "o",
            orderDir: "d",
            id: "id"
        };
    }

    /**
     * Builds the request url from the base uri and the mapped query
     * parameters. The descriptor mapping wins, the default vocabulary covers
     * the rest, and an unknown logical name passes through verbatim.
     * @param {object} params - Logical query parameters.
     * @param {string} [path] - An optional path segment appended to the base.
     * @returns {string} The request url, absolute or root relative.
     */
    _buildUrl(params, path) {
        const base = (this._descriptor.baseUri || "") + (path ? path : "");
        const url = new URL(base, document.baseURI);
        const map = this._descriptor.query || {};
        const defaults = webexpress.webapp.RestService.defaultQueryMap;

        for (const logical of Object.keys(params || {})) {
            const value = params[logical];
            if (value === undefined || value === null) {
                continue;
            }
            const wire = map[logical] || defaults[logical] || logical;
            url.searchParams.set(wire, String(value));
        }

        return base.startsWith("http") ? url.href : url.pathname + url.search;
    }

    /**
     * Performs a request, honours the declared retry policy and reports the
     * final failure to the error channel. A retriable failure, which is a
     * network error or an http 5xx response, is retried up to the configured
     * count with the configured delay. A retry that has been superseded by a
     * newer abortable request gives up with an abort result, so a stale retry
     * never races a fresh query. Aborts are never reported, because an abort
     * is the expected consequence of a newer request replacing an older one.
     * @param {string} method - The http method.
     * @param {object} request - The request descriptor.
     * @returns {Promise<object>} A normalised result.
     */
    async _send(method, request) {
        const retry = this._descriptor.retry || {};
        const attempts = 1 + Math.max(0, Number(retry.count) || 0);
        const delay = Math.max(0, Number(retry.delayMs) || 0);
        const generation = request.abortable ? ++this._generation : null;

        let result = null;

        for (let attempt = 0; attempt < attempts; attempt++) {
            if (attempt > 0 && delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }

            if (generation !== null && generation !== this._generation) {
                result = webexpress.webapp.ServiceResult.fail("abort", 0, "request was superseded", false);
                break;
            }

            result = await this._sendOnce(method, request);

            if (result.ok || !result.error || !result.error.retriable || result.error.kind === "abort") {
                break;
            }
        }

        if (!result.ok && result.error && result.error.kind !== "abort") {
            webexpress.webapp.ErrorChannel.report(result, { service: this._name, operation: method });
        }

        return result;
    }

    /**
     * Performs a single request and normalises the outcome. A superseded
     * abortable request is cancelled, and the abort channel is only cleared
     * when the request that owns it completes, so that a newer request is not
     * affected.
     * @param {string} method - The http method.
     * @param {object} request - The request descriptor.
     * @returns {Promise<object>} A normalised result.
     */
    async _sendOnce(method, request) {
        let abort = null;

        if (request.abortable) {
            if (this._abort) {
                this._abort.abort("replaced");
            }
            abort = new AbortController();
            this._abort = abort;
        }

        const url = this._buildUrl(request.params, request.path);
        const headers = Object.assign({ "Accept": "application/json" }, this._descriptor.headers || {});
        const init = { method: method, headers: headers };

        if (request.body !== undefined) {
            headers["Content-Type"] = "application/json";
            init.body = JSON.stringify(request.body);
        }

        if (abort) {
            init.signal = abort.signal;
        }

        try {
            const response = await fetch(url, init);

            if (!response.ok) {
                const mapped = this._descriptor.errors && this._descriptor.errors[String(response.status)];
                // a mapped entry may be an i18n key (see the descriptor doc); plain text falls through untouched
                const message = (mapped && (webexpress?.webui?.I18N?.translate(mapped) ?? mapped)) || ("request failed with status " + response.status);
                return webexpress.webapp.ServiceResult.fail("http", response.status, message, response.status >= 500);
            }

            if (response.status === 204 || method === "DELETE") {
                return webexpress.webapp.ServiceResult.ok(null, response.status);
            }

            try {
                const data = await response.json();
                return webexpress.webapp.ServiceResult.ok(data, response.status);
            } catch (parseError) {
                return webexpress.webapp.ServiceResult.fail("parse", response.status, "response was not valid json", false);
            }
        } catch (networkError) {
            if (networkError && networkError.name === "AbortError") {
                return webexpress.webapp.ServiceResult.fail("abort", 0, "request was aborted", false);
            }
            return webexpress.webapp.ServiceResult.fail("network", 0, networkError ? networkError.message : "network error", true);
        } finally {
            if (abort && this._abort === abort) {
                this._abort = null;
            }
        }
    }
};

/**
 * Registry of service factories keyed by descriptor kind. The default kind is
 * "rest". A descriptor is turned into a configured service through create, and
 * a host element's wx-service island elements are turned into a map of named
 * services through fromElement.
 */
webexpress.webapp.ServiceRegistry = new class {
    /**
     * Creates the registry.
     */
    constructor() {
        this._factories = new Map();
        this._shared = null;
    }

    /**
     * Registers a factory for a descriptor kind.
     * @param {string} kind - The descriptor kind, for example "rest".
     * @param {Function} factory - Receives a descriptor and returns a service.
     * @returns {this} The registry for chaining.
     */
    register(kind, factory) {
        if (typeof kind === "string" && typeof factory === "function") {
            this._factories.set(kind, factory);
        }
        return this;
    }

    /**
     * Returns whether a factory exists for the given kind.
     * @param {string} kind - The descriptor kind.
     * @returns {boolean} True when registered.
     */
    has(kind) {
        return this._factories.has(kind);
    }

    /**
     * Creates a configured service from a descriptor.
     * @param {object} descriptor - The service descriptor.
     * @returns {webexpress.webapp.Service|null} The service or null.
     */
    create(descriptor) {
        if (!descriptor || typeof descriptor !== "object") {
            return null;
        }

        const kind = descriptor.kind || "rest";
        const factory = this._factories.get(kind);

        if (!factory) {
            console.warn(`Service kind "${kind}" is not registered.`);
            return null;
        }

        return factory(descriptor);
    }

    /**
     * Performs a single arbitrary request through a shared rest service, so that
     * one off calls (for example a bespoke autocomplete, theme or validator
     * endpoint) route through the service layer without the caller configuring a
     * dedicated service. The shared service is created lazily on first use and
     * reused afterwards. The url is taken as given, so callers pass an absolute
     * or already resolved path. Returns the same normalised result as
     * RestService.request.
     * @param {string} url - The request url.
     * @param {object} [init={}] - The fetch init, for example method and body.
     * @returns {Promise<object>} A normalised result.
     */
    request(url, init) {
        if (!this._shared) {
            this._shared = this.create({ kind: "rest", name: "shared", baseUri: "" });
        }

        return this._shared.request(url, init);
    }

    /**
     * Reads the wx-service island elements of a host element and returns a map
     * of named services. Each island carries the scalar descriptor parts as
     * attributes and the query, response, header and error mappings as child
     * elements. The islands are consumed on the first read and the parsed
     * descriptors are cached on the element, so a control and its component
     * base can both resolve the same services.
     * @param {HTMLElement} element - The host element.
     * @returns {object} A map of service name to service instance.
     */
    fromElement(element) {
        const services = {};

        if (!element || typeof element.removeChild !== "function") {
            return services;
        }

        if (element._wxServiceDescriptors === undefined) {
            element._wxServiceDescriptors = this._consumeServiceIslands(element);
        }

        for (const descriptor of element._wxServiceDescriptors) {
            const service = this.create(descriptor);
            if (service) {
                services[descriptor.name || "default"] = service;
            }
        }

        return services;
    }

    /**
     * Parses and removes the wx-service island elements of a host element.
     * Only direct children are read, so a nested data bound control keeps its
     * own islands.
     * @param {HTMLElement} element - The host element.
     * @returns {Array<object>} The parsed descriptors.
     */
    _consumeServiceIslands(element) {
        const descriptors = [];
        const islands = Array.from(element.childNodes || [])
            .filter((node) => node.nodeType === 1 && node.tagName === "WX-SERVICE");

        for (const island of islands) {
            descriptors.push(this._parseServiceIsland(island));
            element.removeChild(island);
        }

        return descriptors;
    }

    /**
     * Parses one wx-service island element into the descriptor shape the
     * service factories consume. Absent parts stay absent in the descriptor,
     * so the service defaults apply exactly as with a hand written descriptor.
     * @param {HTMLElement} island - The island element.
     * @returns {object} The descriptor.
     */
    _parseServiceIsland(island) {
        const descriptor = {
            name: island.getAttribute("name") || "default",
            kind: island.getAttribute("kind") || "rest",
            baseUri: island.getAttribute("base-uri") || ""
        };

        const method = island.getAttribute("method");
        if (method) {
            descriptor.method = method;
        }

        const updateMethod = island.getAttribute("update-method");
        if (updateMethod) {
            descriptor.updateMethod = updateMethod;
        }

        const domains = island.getAttribute("domains");
        if (domains) {
            descriptor.domains = domains.split(";")
                .map((domain) => domain.trim().toLowerCase())
                .filter((domain) => domain.length > 0);
        }

        const retryCount = island.getAttribute("retry-count");
        if (retryCount !== null && retryCount !== "") {
            descriptor.retry = {
                count: Number(retryCount),
                delayMs: Number(island.getAttribute("retry-delay") || 0)
            };
        }

        const mappings = [
            ["WX-QUERY", "query", "name", "wire"],
            ["WX-RESPONSE", "response", "name", "wire"],
            ["WX-HEADER", "headers", "name", "value"],
            ["WX-ERROR", "errors", "status", "message"]
        ];

        for (const [tag, part, keyAttribute, valueAttribute] of mappings) {
            for (const child of Array.from(island.childNodes || [])) {
                if (child.nodeType !== 1 || child.tagName !== tag) {
                    continue;
                }
                const key = child.getAttribute(keyAttribute);
                if (!key) {
                    continue;
                }
                (descriptor[part] || (descriptor[part] = {}))[key] = child.getAttribute(valueAttribute) || "";
            }
        }

        return descriptor;
    }

    /**
     * Builds a wx-service island element from a descriptor, so client side
     * composed hosts configure their nested controls through the same single
     * channel the server emits. Only the scalar descriptor parts are carried,
     * which is all the internal handoffs need.
     * @param {object} descriptor - The service descriptor.
     * @returns {HTMLElement} The island element.
     */
    islandElement(descriptor) {
        descriptor = descriptor || {};

        const island = document.createElement("wx-service");
        island.setAttribute("hidden", "");
        island.setAttribute("name", descriptor.name || "data");
        island.setAttribute("kind", descriptor.kind || "rest");
        island.setAttribute("base-uri", descriptor.baseUri || "");

        if (descriptor.method) {
            island.setAttribute("method", descriptor.method);
        }
        if (descriptor.updateMethod) {
            island.setAttribute("update-method", descriptor.updateMethod);
        }
        if (Array.isArray(descriptor.domains) && descriptor.domains.length > 0) {
            island.setAttribute("domains", descriptor.domains.join(";"));
        }

        return island;
    }

    /**
     * Removes all factories. Useful for tests.
     */
    clear() {
        this._factories.clear();
    }
};

/**
 * The client side of the live data update channel. A subscription is created
 * with the domains a component's services declare and a callback; it registers
 * on the message queue, subscribes the domains on the server (so the server
 * addresses this connection when data of those domains changes - including
 * changes made by other users) and invokes the callback with the changed
 * domains after a short coalescing window, so a burst of changes (for example
 * a bulk operation) triggers one reaction instead of one per message. The
 * ViewState and the Data component base share this class; without a
 * message queue (for example in a headless test) the subscription stays
 * detached and attach is a no-op.
 */
webexpress.webapp.DataChangeSubscription = class {
    /**
     * The wire type of the server message that announces a data change of a
     * domain. Must match DataChangedMessageTypes.Changed on the server.
     * @type {string}
     */
    static CHANGED_TYPE = "webexpress.webapp.data.changed";

    /**
     * How long incoming change messages are coalesced before the callback
     * runs.
     * @type {number}
     */
    static COALESCE_MS = 50;

    /**
     * The class that plays the change flash animation on a control whose data
     * was re-queried because of an external change.
     * @type {string}
     */
    static FLASH_CLASS = "wx-data-changed";

    /**
     * How long the flash class stays on the element. Matches the css
     * animation duration, so the class is gone when the animation ends and a
     * later flash can restart it.
     * @type {number}
     */
    static FLASH_MS = 1200;

    /**
     * Plays the change flash on an element, so the user sees that its data
     * was refreshed by an external change rather than by an own action. A
     * flash that arrives while the previous one is still playing restarts the
     * animation by removing and re-adding the class across a reflow.
     * @param {HTMLElement} element - The element to flash.
     */
    static flash(element) {
        if (!element || !element.classList) {
            return;
        }

        const cls = webexpress.webapp.DataChangeSubscription.FLASH_CLASS;

        if (element._wxFlashTimer) {
            clearTimeout(element._wxFlashTimer);
            element._wxFlashTimer = null;
            element.classList.remove(cls);
            // reading a layout property commits the removal, so re-adding the
            // class restarts the css animation instead of being coalesced
            void element.offsetWidth;
        }

        element.classList.add(cls);
        element._wxFlashTimer = setTimeout(() => {
            element._wxFlashTimer = null;
            element.classList.remove(cls);
        }, webexpress.webapp.DataChangeSubscription.FLASH_MS);
    }

    /**
     * Wires a component reload to the data change channel: the domains are
     * collected from the given services, an external change of one of them
     * runs the reload, and once the reload settles the element plays the
     * change flash, so the user sees the content changed because of an
     * outside action. This is the one wiring the Data base and the standalone
     * data controls share. Components whose services declare no domains stay
     * detached and receive null.
     * @param {Array<webexpress.webapp.Service>|object} services - The services, as an array or a name map.
     * @param {Function} reload - Reloads the component; may return a promise.
     * @param {HTMLElement} element - The host element to flash.
     * @returns {webexpress.webapp.DataChangeSubscription|null} The attached subscription or null.
     */
    static attachReload(services, reload, element) {
        const list = Array.isArray(services) ? services : Object.values(services || {});
        const domains = list.flatMap((service) => (service && service.domains) || []);

        if (domains.length === 0 || typeof reload !== "function") {
            return null;
        }

        return new webexpress.webapp.DataChangeSubscription(domains, () => {
            let outcome;
            try {
                outcome = reload();
            } catch (error) {
                console.error("data change reload failed", error);
                return;
            }

            Promise.resolve(outcome).then(() => {
                webexpress.webapp.DataChangeSubscription.flash(element);
            }).catch(() => {
                // a failed reload already surfaced through the error channel
            });
        }).attach();
    }

    /**
     * Creates a subscription.
     * @param {Array<string>} domains - The wire names of the domains to react to.
     * @param {Function} onChanged - Receives a Set of the changed domain names.
     */
    constructor(domains, onChanged) {
        this._domains = new Set((domains || []).map((domain) => String(domain).toLowerCase()));
        this._onChanged = onChanged;
        this._listener = null;
        this._pending = new Set();
        this._timer = null;
    }

    /**
     * Registers on the message queue and subscribes the domains. Without a
     * queue or without domains the subscription stays detached.
     * @returns {this} The subscription for chaining.
     */
    attach() {
        const queue = webexpress.webapp.MessageQueue;
        if (!queue || this._domains.size === 0 || this._listener) {
            return this;
        }

        if (typeof queue.register === "function") {
            this._listener = (payload) => this._onMessage(payload);
            queue.register(this._listener);
        }

        if (typeof queue.subscribeDomains === "function") {
            queue.subscribeDomains(Array.from(this._domains));
        }

        return this;
    }

    /**
     * Unregisters the queue listener and cancels a pending callback. The
     * server side domain subscription stays with the connection, because an
     * unmatched change message is simply ignored.
     */
    detach() {
        const queue = webexpress.webapp.MessageQueue;
        if (queue && this._listener && typeof queue.unregister === "function") {
            queue.unregister(this._listener);
        }
        this._listener = null;

        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
        this._pending.clear();
    }

    /**
     * Handles a message from the queue. A change message whose domain matches
     * marks the domain and schedules the coalesced callback; every other
     * message is ignored.
     * @param {*} payload - The message payload.
     */
    _onMessage(payload) {
        if (!payload || typeof payload !== "object"
            || payload.type !== webexpress.webapp.DataChangeSubscription.CHANGED_TYPE) {
            return;
        }

        const domain = typeof payload.domain === "string" ? payload.domain.toLowerCase() : null;
        if (!domain || !this._domains.has(domain)) {
            return;
        }

        this._pending.add(domain);

        if (this._timer) {
            return;
        }

        this._timer = setTimeout(() => {
            this._timer = null;
            const changed = this._pending;
            this._pending = new Set();
            try {
                this._onChanged(changed);
            } catch (error) {
                console.error("data change callback failed", error);
            }
        }, webexpress.webapp.DataChangeSubscription.COALESCE_MS);
    }
};
