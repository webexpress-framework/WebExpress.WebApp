var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the scrum velocity control (View, State and Service
 * migration). These functions carry no DOM or network dependency, so they can
 * be unit tested in isolation. The control composes them with a RestService
 * whose query loads the recent sprints; the helpers normalise the payload,
 * trim it to the most recent sprints and derive the rolling average and the
 * chart scale that the columns are drawn against.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.scrumVelocityModel = {
    /**
     * Normalises a velocity response into an array of complete sprint records,
     * tolerating a missing or malformed payload so the renderer always receives
     * a list with numeric committed and completed points.
     * @param {*} data - The raw response payload.
     * @returns {Array<object>} The normalised sprint array.
     */
    normalizeList(data) {
        return (Array.isArray(data) ? data : []).map((sprint) => this.normalizeSprint(sprint));
    },

    /**
     * Completes a single sprint record with the fields the renderer relies on,
     * coercing the committed and completed points to non-negative integers.
     * @param {object} sprint - The raw sprint record.
     * @returns {object} The normalised sprint.
     */
    normalizeSprint(sprint) {
        sprint = sprint || {};

        return {
            id: sprint.id != null ? String(sprint.id) : "",
            name: sprint.name || "",
            committed: this._coercePoints(sprint.committed != null ? sprint.committed : sprint.committedPoints),
            completed: this._coercePoints(sprint.completed != null ? sprint.completed : sprint.completedPoints)
        };
    },

    /**
     * Coerces a raw points value into a non-negative integer, mapping malformed
     * or negative input to zero.
     * @param {*} value - The raw value.
     * @returns {number} The coerced points.
     */
    _coercePoints(value) {
        const points = Math.trunc(Number(value));
        return Number.isFinite(points) && points > 0 ? points : 0;
    },

    /**
     * Returns the last n sprints, preserving their chronological order. A
     * non-positive or oversized count returns the whole list, so the chart never
     * drops data it was asked to show.
     * @param {Array<object>} sprints - The sprints, oldest first.
     * @param {number} n - The maximum number of most recent sprints to keep.
     * @returns {Array<object>} The trailing slice.
     */
    lastN(sprints, n) {
        const list = Array.isArray(sprints) ? sprints : [];
        if (!Number.isFinite(n) || n <= 0 || n >= list.length) {
            return list.slice();
        }
        return list.slice(list.length - n);
    },

    /**
     * Computes the average velocity, the mean of the completed points across the
     * sprints. Empty input yields zero.
     * @param {Array<object>} sprints - The sprints.
     * @returns {number} The average completed points.
     */
    average(sprints) {
        const list = Array.isArray(sprints) ? sprints : [];
        if (list.length === 0) {
            return 0;
        }
        const sum = list.reduce((s, x) => s + (Number(x && x.completed) || 0), 0);
        return sum / list.length;
    },

    /**
     * Returns the largest committed or completed value across the sprints, used
     * to scale the chart. Never returns less than one so a flat or empty series
     * still produces a valid scale.
     * @param {Array<object>} sprints - The sprints.
     * @returns {number} The maximum value, at least one.
     */
    maxValue(sprints) {
        const list = Array.isArray(sprints) ? sprints : [];
        let max = 1;
        for (const s of list) {
            max = Math.max(max, Number(s && s.committed) || 0, Number(s && s.completed) || 0);
        }
        return max;
    }
};
