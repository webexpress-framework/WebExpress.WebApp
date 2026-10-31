var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the link surface. They carry no DOM and no network
 * dependency, so the rules that decide what a link says - which end is the
 * opposite one, which category a system belongs to, how the relations become a
 * graph - can be tested in isolation and are stated once for the surface, the
 * add dialog and the graph view alike.
 *
 * See WebExpress.WebApp/docs/js/relation.view.md.
 */
webexpress.webapp.relationViewModel = {
    /**
     * The key the panels of the add dialog are registered under in
     * webexpress.webui.DialogPanels. It lives on the model rather than on a
     * control, because the panels read it while they register themselves and
     * the model is the one file that is loaded before all of them.
     */
    PANELS_KEY: "webexpress.webapp.relation",

    /**
     * The category of the links between two objects of the application.
     */
    KIND_OBJECT: "object",

    /**
     * The category of the links to an address outside the application.
     */
    KIND_EXTERNAL: "external",

    /**
     * Normalises the answer of the link endpoint, tolerating a missing or
     * malformed payload so the renderer always receives the full shape.
     * @param {*} data - The raw response payload.
     * @returns {object} The result as { groups, total, objectCount, externalCount }.
     */
    normalizeResult(data) {
        const groups = (data && Array.isArray(data.groups) ? data.groups : []).map((group) => this.normalizeGroup(group));

        return {
            groups: groups,
            total: Number.isFinite(data && data.total) ? data.total : groups.reduce((sum, group) => sum + group.items.length, 0),
            objectCount: Number.isFinite(data && data.objectCount) ? data.objectCount : 0,
            externalCount: Number.isFinite(data && data.externalCount) ? data.externalCount : 0
        };
    },

    /**
     * Normalises one relation group.
     * @param {object} group - The raw group.
     * @returns {object} The normalised group.
     */
    normalizeGroup(group) {
        group = group || {};
        const items = (Array.isArray(group.items) ? group.items : []).map((item) => this.normalizeItem(item));

        return {
            type: group.type || "",
            inverse: group.inverse === true,
            label: group.label || group.type || "",
            counterpart: group.symmetric ? "" : (group.counterpart || ""),
            icon: group.icon || "link",
            effect: group.effect || "none",
            symmetric: group.symmetric === true,
            count: Number.isFinite(group.count) ? group.count : items.length,
            items: items
        };
    },

    /**
     * Normalises one link, filling in the two ends so the renderer never has to
     * guard against a missing reference.
     * @param {object} item - The raw link.
     * @returns {object} The normalised link.
     */
    normalizeItem(item) {
        item = item || {};

        return {
            id: item.id || "",
            system: item.system || "",
            type: item.type || "",
            direction: item.direction || "bidirectional",
            status: item.status || "active",
            inverse: item.inverse === true,
            comment: item.comment || "",
            created: item.created || null,
            createdBy: item.createdBy || "",
            source: this.normalizeReference(item.source),
            target: this.normalizeReference(item.target),
            metadata: item.metadata && typeof item.metadata === "object" ? item.metadata : null
        };
    },

    /**
     * Normalises one end of a link.
     * @param {object} reference - The raw reference.
     * @returns {object} The normalised reference.
     */
    normalizeReference(reference) {
        reference = reference || {};

        return {
            key: reference.key || "",
            class: reference.class || "",
            title: reference.title || "",
            uri: reference.uri || "",
            status: reference.status || "",
            statusColor: reference.statusColor || ""
        };
    },

    /**
     * Returns the end of a link that is not the object the surface renders. A
     * link read from its target shows its source, which is what turns one stored
     * relation into the two readings the two objects show.
     * @param {object} item - The normalised link.
     * @returns {object} The opposite end.
     */
    opposite(item) {
        return item && item.inverse ? item.source : item.target;
    },

    /**
     * Builds the path segment that addresses one link below the endpoint base.
     * @param {string} id - The link id.
     * @returns {string} The path.
     */
    linkPath(id) {
        return "/" + encodeURIComponent(id);
    },

    /**
     * Builds the query of the surface from its state. Only the criteria that
     * are set travel, so an unfiltered surface asks an unfiltered question.
     * @param {object} state - The surface state.
     * @returns {object} The logical query parameters.
     */
    query(state) {
        state = state || {};
        const query = {};

        if (state.type) {
            query.type = state.type;
        }
        if (state.system) {
            query.system = state.system;
        }
        if (state.status) {
            query.status = state.status;
        }
        if (state.search) {
            query.search = state.search;
        }

        return query;
    },

    /**
     * Builds the body that establishes a link from a draft the dialog collected.
     * The empty fields are dropped rather than sent as null, so an object link
     * and a web link produce the two different bodies the endpoint expects from
     * one shape.
     * @param {object} draft - The draft as { system, type, target, address, title, comment, metadata }.
     * @returns {object} The request body.
     */
    createBody(draft) {
        draft = draft || {};
        const target = draft.target || {};
        const body = {
            system: draft.system || "",
            type: draft.type || ""
        };

        if (target.key) {
            body.targetKey = target.key;
            body.targetClass = target.class || "";
        }
        if (draft.address) {
            body.address = draft.address;
        }
        if (draft.title || target.title) {
            body.title = draft.title || target.title;
        }
        if (draft.comment) {
            body.comment = draft.comment;
        }
        if (draft.metadata) {
            body.metadata = draft.metadata;
        }

        return body;
    },

    /**
     * Normalises the answer of the systems endpoint.
     * @param {*} data - The raw response payload.
     * @returns {Array<object>} The systems.
     */
    normalizeSystems(data) {
        const systems = Array.isArray(data) ? data : ((data && data.items) || []);

        return systems.filter((system) => system && system.id).map((system) => ({
            id: system.id,
            label: system.label || system.id,
            description: system.description || "",
            kind: system.kind === this.KIND_EXTERNAL ? this.KIND_EXTERNAL : this.KIND_OBJECT,
            badge: system.badge || (system.label || system.id).slice(0, 2).toUpperCase(),
            color: system.color || "",
            plugin: system.plugin || null,
            version: system.version || "",
            enabled: system.enabled !== false,
            panel: system.panel || system.id,
            types: Array.isArray(system.types) ? system.types.filter((type) => type && type.id) : []
        }));
    },

    /**
     * Splits the systems into the sections the dialog sidebar renders: the ones
     * the application itself brings and the ones a plugin contributed. The
     * split is by origin rather than by category, because that is the
     * distinction the user needs when they wonder where a system came from.
     * @param {Array<object>} systems - The normalised systems.
     * @returns {Array<object>} The sections as { plugin, items }.
     */
    sections(systems) {
        const list = Array.isArray(systems) ? systems : [];
        const native = list.filter((system) => !system.plugin);
        const contributed = list.filter((system) => system.plugin);
        const sections = [];

        if (native.length > 0) {
            sections.push({ plugin: false, items: native });
        }
        if (contributed.length > 0) {
            sections.push({ plugin: true, items: contributed });
        }

        return sections;
    },

    /**
     * Returns the system a link belongs to, or null when it was removed while
     * links of it still exist.
     * @param {Array<object>} systems - The normalised systems.
     * @param {string} id - The system id.
     * @returns {object|null} The system.
     */
    systemOf(systems, id) {
        return (Array.isArray(systems) ? systems : []).find((system) => system.id === id) || null;
    },

    /**
     * Returns the scratch state a panel keeps for one system inside a dialog.
     * The panels are shared definitions rendered once per system, so their
     * state cannot live on the definition; it hangs off the modal instead, keyed
     * by the system, which also lets a user switch systems back and forth
     * without losing what they typed.
     * @param {object} modal - The dialog the panel renders in.
     * @param {string} systemId - The system the panel renders.
     * @returns {object} The scratch state.
     */
    panelState(modal, systemId) {
        modal._linkPanelState = modal._linkPanelState || {};
        modal._linkPanelState[systemId] = modal._linkPanelState[systemId] || {};

        return modal._linkPanelState[systemId];
    },

    /**
     * Returns the panel that renders a system: the one registered for it, or
     * the generic panel of its category. It is the fallback that lets a plugin
     * contribute a link system without shipping any JavaScript.
     * @param {object} system - The normalised system.
     * @returns {object|null} The panel definition.
     */
    panelOf(system) {
        const panels = (webexpress.webui.DialogPanels && webexpress.webui.DialogPanels.get(this.PANELS_KEY)) || [];

        return panels.find((panel) => panel.id === (system && system.panel))
            || panels.find((panel) => panel.generic && panel.kind === (system && system.kind))
            || null;
    },

    /**
     * The css class that paints the node of the object the surface belongs to.
     * The graph viewer resolves a node's backgroundCss inside its own scope, so
     * the accent is a class rather than a colour and follows the theme.
     */
    SUBJECT_NODE_CSS: "wx-relation-view-node-subject",

    /**
     * The css class that paints the label of that node.
     */
    SUBJECT_LABEL_CSS: "wx-relation-view-node-subject-label",

    /**
     * Builds the node and edge model of the graph view from the groups the
     * surface loaded. Every end is a rectangle carrying what the list row
     * carries - the icon of its relation, the key, the type and title of the
     * object and its state - so the graph is the same reading, laid out by
     * connection instead of by relation. The rendering object is the centre and
     * is marked, so the reader sees at once whose relations they are looking at.
     * @param {object} subject - The rendering object as { key, title, class }.
     * @param {Array<object>} groups - The normalised groups.
     * @returns {object} The model as { nodes, edges }.
     */
    graph(subject, groups) {
        const centre = (subject && subject.key) || "";
        const nodes = [];
        const edges = [];
        const seen = new Set();

        if (centre) {
            nodes.push({
                id: centre,
                label: centre,
                description: this._describe(subject),
                shape: "rect",
                icon: this._icon("link"),
                backgroundCss: this.SUBJECT_NODE_CSS,
                foregroundCss: this.SUBJECT_LABEL_CSS
            });
            seen.add(centre);
        }

        for (const group of Array.isArray(groups) ? groups : []) {
            for (const item of group.items) {
                const other = this.opposite(item);
                const id = other.key || other.uri;

                if (!id) {
                    continue;
                }

                if (!seen.has(id)) {
                    seen.add(id);
                    nodes.push({
                        id: id,
                        // an external end has no key, so its address carries the
                        // name and the title becomes the description
                        label: other.key || this._host(other.uri),
                        description: this._describe(other),
                        state: other.status,
                        stateCss: this.statusNodeClass(other.statusColor),
                        // the same icon the list puts in front of the row, so the
                        // two presentations read alike
                        icon: this._icon(group.icon),
                        uri: other.uri || "",
                        shape: "rect"
                    });
                }

                // the edge always points the way the relation is read on this
                // object, so an inverted link is drawn from the other end
                edges.push({
                    id: item.id || `${centre}-${id}-${group.type}`,
                    from: item.inverse ? id : centre,
                    to: item.inverse ? centre : id,
                    label: group.inverse ? group.counterpart || group.label : group.label
                });
            }
        }

        return { nodes: nodes, edges: edges };
    },

    /**
     * Builds the description line of a node: what the object is, followed by
     * what it is called.
     * @param {object} reference - The end the node stands for.
     * @returns {string} The description.
     */
    _describe(reference) {
        reference = reference || {};

        // the graph viewer cuts what does not fit its rectangle, so the
        // description is composed here and fitted there
        return [reference.class, reference.title]
            .filter((part) => !!part)
            .join(" · ");
    },

    /**
     * Returns the host of an address, which is what names an external end when
     * it has no key.
     * @param {string} uri - The address.
     * @returns {string} The host, or the address when it cannot be read.
     */
    _host(uri) {
        const match = /^https?:\/\/([^/?#]+)/i.exec(uri || "");

        return match ? match[1] : (uri || "");
    },

    /**
     * Resolves a symbolic icon name to the class string the graph viewer draws
     * it from.
     * @param {string} name - The symbolic icon name.
     * @returns {string} The class string.
     */
    _icon(name) {
        return webexpress.webui.IconSet.resolve(name);
    },

    /**
     * Returns the css class that paints the state of a node. The graph viewer
     * scopes its own fills, so the state travels as a class rather than as a
     * colour and follows the theme.
     * @param {string} token - The semantic colour token.
     * @returns {string} The css class.
     */
    statusNodeClass(token) {
        switch (token) {
            case "success":
                return "wx-relation-view-node-success";
            case "info":
                return "wx-relation-view-node-info";
            case "warning":
                return "wx-relation-view-node-warning";
            case "danger":
                return "wx-relation-view-node-danger";
            default:
                return "";
        }
    },

    /**
     * Returns the contextual css class of a status token, so the status of a
     * linked object is coloured through the framework palette rather than
     * through a colour the endpoint dictates.
     * @param {string} token - The semantic colour token.
     * @returns {string} The css class.
     */
    statusClass(token) {
        switch (token) {
            case "success":
                return "wx-relation-view-status-success";
            case "info":
                return "wx-relation-view-status-info";
            case "warning":
                return "wx-relation-view-status-warning";
            case "danger":
                return "wx-relation-view-status-danger";
            default:
                return "wx-relation-view-status-secondary";
        }
    },

    /**
     * Determines whether a value is an address a web link may point at. Only
     * http and https are accepted, because the address is rendered as a link
     * the user follows.
     * @param {string} value - The candidate address.
     * @returns {boolean} True when the address is usable.
     */
    isValidAddress(value) {
        return /^https?:\/\/[^\s]+$/i.test(String(value || "").trim());
    },

    /**
     * Reports a refused write through the popup notification pipeline. The
     * framework dialogs submit synchronously and close, so a rejection only the
     * server can see arrives after the dialog is gone; this is the channel that
     * still carries the reason to the user.
     * @param {object} ctrl - The control that issued the request.
     * @param {object} result - The failed service result.
     * @param {string} fallback - The message to use when the server named none.
     */
    notifyFault(ctrl, result, fallback) {
        const message = this.faultMessage(result, ctrl) || fallback;

        console.warn("link: request refused", webexpress.webapp.ServiceResult.describe(result));

        const queue = webexpress.webapp.MessageQueue;

        if (!queue || typeof queue.dispatchLocal !== "function") {
            return;
        }

        queue.dispatchLocal({
            type: "webexpress.webapp.popup.show",
            notification: {
                id: `link-fault-${Date.now().toString(36)}`,
                heading: ctrl._i18n("webexpress.webapp:relation.title", "Links"),
                message: message,
                type: "alert-danger",
                durability: 6000,
                progress: -1,
                created: new Date().toISOString()
            }
        });
    },

    /**
     * Reads the reason of a rejected request. The link endpoints answer a
     * refused link as { code, message }, so the surface reports what the server
     * objected to instead of a bare status.
     * @param {object} result - The failed service result.
     * @param {object} ctrl - The control, whose _i18n carries the fallback.
     * @returns {string} The message to show.
     */
    faultMessage(result, ctrl) {
        const data = result && result.data;

        if (data && data.code) {
            const translated = ctrl ? ctrl._i18n("webexpress.webapp:" + data.code, data.message || data.code) : null;
            return translated || data.message || data.code;
        }

        return (result && result.error && result.error.message) || "";
    }
};
