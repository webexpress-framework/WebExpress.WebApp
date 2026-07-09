var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the scrum team workload control (View, State and
 * Service migration). These functions carry no DOM or network dependency, so
 * they can be unit tested in isolation. The control composes them with a
 * RestService whose query loads the people working in the current sprint and
 * the story points assigned to each of them.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.scrumTeamModel = {
    /**
     * Normalises a team response into an array of complete member records,
     * tolerating a missing or malformed payload so the renderer always receives
     * a list with derived initials, a fallback colour and a numeric point value.
     * @param {*} data - The raw response payload.
     * @returns {Array<object>} The normalised member array.
     */
    normalizeList(data) {
        return (Array.isArray(data) ? data : []).map((member) => this.normalizeMember(member));
    },

    /**
     * Completes a single member record with the fields the renderer relies on,
     * deriving the initials from the name when the server omits them and
     * clamping both the planned and the completed points to non-negative
     * integers. The completed points can never exceed the planned load, so an
     * oversized or malformed value collapses to the planned total.
     * @param {object} member - The raw member record.
     * @returns {object} The normalised member.
     */
    normalizeMember(member) {
        member = member || {};
        const name = member.name || "";
        const planned = this._coercePoints(member.points);
        const completed = Math.min(planned, this._coercePoints(member.completed != null ? member.completed : member.completedPoints));

        return {
            id: member.id != null ? String(member.id) : "",
            name: name,
            team: member.team || "",
            initials: member.initials || this.deriveInitials(name),
            color: member.color || "#888",
            image: member.image || null,
            points: planned,
            completed: completed
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
     * Derives the avatar initials from a display name, taking the first letter
     * of the first and last word so "Guybrush Threepwood" becomes "GT".
     * @param {string} name - The display name.
     * @returns {string} One or two uppercase letters, or "?" when empty.
     */
    deriveInitials(name) {
        const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) {
            return "?";
        }
        if (parts.length === 1) {
            return parts[0].slice(0, 2).toUpperCase();
        }
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    },

    /**
     * Sums the planned story points across all members, tolerating non-array
     * input and malformed point values so the total is always a finite number.
     * @param {Array<object>} members - The members.
     * @returns {number} The total planned story points.
     */
    totalPoints(members) {
        return this._sumField(members, "points");
    },

    /**
     * Sums the completed story points across all members.
     * @param {Array<object>} members - The members.
     * @returns {number} The total completed story points.
     */
    completedPoints(members) {
        return this._sumField(members, "completed");
    },

    /**
     * Sums a numeric field across all members, tolerating non-array input and
     * malformed values so the total is always a finite number.
     * @param {Array<object>} members - The members.
     * @param {string} field - The field to sum.
     * @returns {number} The total.
     */
    _sumField(members, field) {
        return (Array.isArray(members) ? members : []).reduce((sum, m) => {
            const points = Number(m && m[field]);
            return sum + (Number.isFinite(points) ? points : 0);
        }, 0);
    },

    /**
     * Returns a new list ordered by descending story points, breaking ties on
     * the name so the modal table always presents the heaviest load first.
     * @param {Array<object>} members - The members.
     * @returns {Array<object>} A new, sorted list.
     */
    sortByPoints(members) {
        return (Array.isArray(members) ? members.slice() : []).sort((a, b) => {
            const pa = Number(a && a.points) || 0;
            const pb = Number(b && b.points) || 0;
            if (pa !== pb) {
                return pb - pa;
            }
            return String((a && a.name) || "").localeCompare(String((b && b.name) || ""));
        });
    }
};
