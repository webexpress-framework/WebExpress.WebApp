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
     * Returns the base address the service calls, from its descriptor. Controls
     * derive their data uri from this instead of the legacy data-uri attribute.
     * @returns {string} The base address, or an empty string.
     */
    get baseUri() {
        return this._descriptor.baseUri || "";
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
 *     errors: { "404": "webexpress.webapp:error.notfound" },
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
                const message = mapped || ("request failed with status " + response.status);
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
                const message = mapped || ("request failed with status " + response.status);
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
 * a host element's data-wx-service island is turned into a map of named
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
     * Reads the data-wx-service island of a host element and returns a map of
     * named services. The island is a json object or an array of descriptors,
     * each of which carries a name.
     * @param {HTMLElement} element - The host element.
     * @returns {object} A map of service name to service instance.
     */
    fromElement(element) {
        const services = {};

        if (!element || typeof element.getAttribute !== "function") {
            return services;
        }

        const raw = element.getAttribute("data-wx-service");

        if (!raw) {
            return services;
        }

        let parsed = null;

        try {
            parsed = JSON.parse(raw);
        } catch (error) {
            console.warn("invalid data-wx-service island", error);
            return services;
        }

        const descriptors = Array.isArray(parsed) ? parsed : [parsed];

        for (const descriptor of descriptors) {
            if (!descriptor || typeof descriptor !== "object") {
                continue;
            }
            const service = this.create(descriptor);
            if (service) {
                services[descriptor.name || "default"] = service;
            }
        }

        return services;
    }

    /**
     * Removes all factories. Useful for tests.
     */
    clear() {
        this._factories.clear();
    }
};
