var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the assignment control (View, State and Service). They carry no
 * DOM or network dependency, so they can be unit tested in isolation. The control
 * composes them with a RestService whose query loads the assignment, whose update
 * assigns and whose remove unassigns, plus an optional users service for the search.
 *
 * See WebExpress/docs/view-state-service.md.
 */
webexpress.webapp.assignmentModel = {
    /**
     * Normalises an answer of the assignment endpoint, tolerating a missing or malformed
     * payload so the renderer always receives the same shape.
     * @param {*} data - The raw response payload { assignee, self, mayChange }.
     * @returns {{assignee: object|null, self: object|null, mayChange: boolean}} The state.
     */
    normalize(data) {
        const source = data && typeof data === "object" ? data : {};
        return {
            assignee: this._person(source.assignee),
            self: this._person(source.self),
            mayChange: source.mayChange === true
        };
    },

    /**
     * Tells whether the caller is the assignee.
     * @param {object} state - The normalised state.
     * @returns {boolean} True when assignee and caller are the same person.
     */
    isSelf(state) {
        return !!(state && state.assignee && state.self && state.assignee.id === state.self.id);
    },

    /**
     * Returns the action that sits first in the row: unassign for the assignee, assign to
     * me for anyone else. A caller who is unknown or may not change the assignment gets
     * none, because the endpoint would refuse it.
     * @param {object} state - The normalised state.
     * @returns {"assign"|"unassign"|null} The action.
     */
    primaryAction(state) {
        if (!state || !state.mayChange || !state.self) {
            return null;
        }
        return this.isSelf(state) ? "unassign" : "assign";
    },

    /**
     * Returns the badge text of a person without a portrait: the given initials, else the
     * first letters of the first two words of the name.
     * @param {object} person - The person.
     * @returns {string} The initials.
     */
    initials(person) {
        if (!person) {
            return "";
        }
        if (person.initials) {
            return person.initials;
        }
        return String(person.name || "")
            .split(/\s+/)
            .filter((word) => word.length > 0)
            .slice(0, 2)
            .map((word) => word[0].toUpperCase())
            .join("");
    },

    /**
     * Returns the search results without the current assignee, who cannot be assigned again.
     * @param {Array<object>} users - The raw search results.
     * @param {object|null} assignee - The current assignee.
     * @returns {Array<object>} The users that can be assigned.
     */
    candidates(users, assignee) {
        const id = assignee ? assignee.id : null;
        return (Array.isArray(users) ? users : []).filter((user) => user && user.id != null && user.id !== id);
    },

    /**
     * Tells whether two assignees differ, so a write that ends where it began announces
     * no change.
     * @param {object|null} previous - The assignee before the write.
     * @param {object|null} next - The assignee after the write.
     * @returns {boolean} True when the assignment changed.
     */
    changed(previous, next) {
        return (previous ? previous.id : null) !== (next ? next.id : null);
    },

    /**
     * Keeps a person record only when it carries an id.
     * @param {*} value - The raw person.
     * @returns {object|null} The person or null.
     */
    _person(value) {
        return value && typeof value === "object" && value.id != null ? value : null;
    }
};
