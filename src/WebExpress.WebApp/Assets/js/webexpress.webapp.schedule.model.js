var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the REST schedule control (View, State and Service
 * migration). These functions carry no DOM or network dependency, so they can
 * be unit tested in isolation. The control composes them with a RestService
 * whose query loads the items of a period and whose create, update and remove
 * persist their mutations; the helpers read the wire format with its aliases,
 * key the range and holiday caches, merge a freshly loaded range into the model
 * and build the payload of a write.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.scheduleModel = {
    /**
     * Reads a period response into the items and holidays the schedule renders,
     * accepting the items/events and holidays/publicHolidays aliases and
     * tolerating a missing or malformed payload.
     * @param {*} response - The raw response.
     * @returns {{items: Array<object>, holidays: Array<object>}} The normalised period.
     */
    normalizePeriod(response) {
        response = response || {};

        const itemsIn = Array.isArray(response.items)
            ? response.items
            : (Array.isArray(response.events) ? response.events : []);
        const holidaysIn = Array.isArray(response.holidays)
            ? response.holidays
            : (Array.isArray(response.publicHolidays) ? response.publicHolidays : []);

        return {
            items: itemsIn
                .filter((item) => item && typeof item === "object")
                .map((item) => this.normalizeItem(item)),
            holidays: this.normalizeHolidays(holidaysIn)
        };
    },

    /**
     * Reads a holiday response, which a dedicated holiday endpoint answers as a
     * bare array and a combined endpoint as an object carrying one.
     * @param {*} response - The raw response.
     * @returns {Array<object>} The normalised holidays.
     */
    normalizeHolidays(response) {
        const list = Array.isArray(response)
            ? response
            : (response && Array.isArray(response.holidays) ? response.holidays : []);

        return list
            .filter((holiday) => holiday && typeof holiday === "object")
            .map((holiday) => this.normalizeHoliday(holiday))
            .filter((holiday) => holiday.date !== "");
    },

    /**
     * Completes a single item into the shape the schedule renders. The start and
     * end are left as text: they are parsed by the control, which is the one
     * place the local-time convention is implemented.
     * @param {object} item - The raw item.
     * @returns {object} The normalised item.
     */
    normalizeItem(item) {
        item = item || {};

        return {
            id: item.id != null ? String(item.id) : "",
            title: this._text(item.title),
            start: this._text(item.start),
            end: this._text(item.end),
            allDay: item.allDay === true || item.allDay === "true",
            category: this._text(item.category),
            colorCss: this._text(item.colorCss),
            colorStyle: this._text(item.colorStyle),
            icon: this._text(item.icon),
            uri: this._text(item.uri),
            meta: item.meta && typeof item.meta === "object" ? item.meta : {}
        };
    },

    /**
     * Completes a single holiday. The date is trimmed to its day, because a
     * source that delivers a full timestamp would otherwise never match the day
     * key the schedule looks holidays up by.
     * @param {object} holiday - The raw holiday.
     * @returns {object} The normalised holiday.
     */
    normalizeHoliday(holiday) {
        holiday = holiday || {};
        const date = this._text(holiday.date);

        return {
            date: /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : "",
            name: this._text(holiday.name),
            region: this._text(holiday.region),
            type: this._text(holiday.type).toLowerCase()
        };
    },

    /**
     * Builds the cache key of a range.
     * @param {string} from - The first day, as yyyy-mm-dd.
     * @param {string} to - The day after the range, as yyyy-mm-dd.
     * @returns {string} The key.
     */
    rangeKey(from, to) {
        return `${from || ""}..${to || ""}`;
    },

    /**
     * Builds the cache key of the holidays of a year and a region.
     * @param {number|string} year - The year.
     * @param {string} region - The region, may be empty.
     * @returns {string} The key.
     */
    holidayKey(year, region) {
        return `${year}@${region || ""}`;
    },

    /**
     * Returns the years a range touches, which is what the holiday endpoint is
     * queried per. A range crossing new year needs both years, or the January
     * days of a December view would come back without their holidays.
     * @param {string} from - The first day, as yyyy-mm-dd.
     * @param {string} to - The day after the range, as yyyy-mm-dd.
     * @returns {Array<number>} The years, ascending.
     */
    yearsInRange(from, to) {
        const first = parseInt(String(from || "").slice(0, 4), 10);
        // the range is half-open, so the last day is the one before "to"
        const lastDay = String(to || "").slice(0, 10);
        const last = parseInt(lastDay.slice(0, 4), 10);

        if (!Number.isFinite(first)) {
            return [];
        }
        if (!Number.isFinite(last) || last <= first) {
            return [first];
        }

        // a range ending exactly on 1 January does not reach into that year
        const upper = lastDay.slice(5) === "01-01" ? last - 1 : last;
        const years = [];
        for (let year = first; year <= Math.max(first, upper); year++) {
            years.push(year);
        }

        return years;
    },

    /**
     * Merges a freshly loaded range into the items already held: everything
     * that starts inside the range is replaced by what the server just sent,
     * everything outside it is kept.
     *
     * Without the range restriction a schedule that pages through months would
     * either lose the months it already loaded or accumulate stale copies of
     * the ones it reloaded.
     * @param {Array<object>} existing - The items currently held.
     * @param {Array<object>} loaded - The items of the loaded range.
     * @param {string} from - The first day of the range, as yyyy-mm-dd.
     * @param {string} to - The day after the range, as yyyy-mm-dd.
     * @returns {Array<object>} The merged items.
     */
    mergeRange(existing, loaded, from, to) {
        const kept = (Array.isArray(existing) ? existing : [])
            .filter((item) => !this.startsWithin(item, from, to));
        const incoming = Array.isArray(loaded) ? loaded : [];
        const ids = new Set(incoming.map((item) => item.id).filter(Boolean));

        // an item that moved out of the range would otherwise survive twice
        return kept.filter((item) => !item.id || !ids.has(item.id)).concat(incoming);
    },

    /**
     * Determines whether an item starts inside a half-open range. The start is
     * decisive rather than the overlap, so a multi-day item belongs to exactly
     * one range and cannot be replaced twice.
     * @param {object} item - The item, carrying a textual start.
     * @param {string} from - The first day, as yyyy-mm-dd.
     * @param {string} to - The day after the range, as yyyy-mm-dd.
     * @returns {boolean} True when the item starts inside the range.
     */
    startsWithin(item, from, to) {
        const start = this._day(item && (item.start || (item.startDate && this._day(item.startDate))));
        if (!start) {
            return false;
        }

        return (!from || start >= from) && (!to || start < to);
    },

    /**
     * Builds the wire payload of a create or update.
     * @param {object} item - The item, in either the wire or the rendered shape.
     * @returns {object} The payload.
     */
    toPayload(item) {
        item = item || {};

        return {
            id: item.id != null ? String(item.id) : "",
            title: this._text(item.title),
            start: this._text(item.start),
            end: this._text(item.end),
            allDay: item.allDay === true,
            category: this._text(item.category),
            colorCss: this._text(item.colorCss),
            colorStyle: this._text(item.colorStyle),
            icon: this._text(item.icon),
            uri: this._text(item.uri),
            meta: item.meta && typeof item.meta === "object" ? item.meta : {}
        };
    },

    /**
     * Extracts the day part of a timestamp.
     * @param {*} value - The timestamp.
     * @returns {string} The day as yyyy-mm-dd, or an empty string.
     */
    _day(value) {
        const text = this._text(value);

        return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
    },

    /**
     * Coerces a raw field into a string, mapping every other value onto the
     * empty string so a numeric or null field never reaches the renderer as a
     * class name or a colour.
     * @param {*} value - The raw value.
     * @returns {string} The text.
     */
    _text(value) {
        if (typeof value === "string") {
            return value;
        }

        return value != null && typeof value === "number" ? String(value) : "";
    }
};
