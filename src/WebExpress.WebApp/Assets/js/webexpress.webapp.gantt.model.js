var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the REST gantt control. These functions carry no DOM
 * or network dependency, so they can be unit tested in isolation. The control
 * composes them with a store and a RestService whose query loads the project
 * and whose create, update and remove persist task and link mutations.
 *
 * The wire format separates data from presentation: a project is
 * { tasks: [...], links: [...] }, where a task carries id, label, start, end,
 * duration (days), progress (0..100), resources and an optional parentId that
 * forms the container hierarchy, and a link carries id, from, to and a type
 * out of FS, SS, FF and SF.
 *
 * All date arithmetic runs on UTC midnights, so daylight saving transitions
 * never shift a bar by an hour and the day distance stays exact.
 */
webexpress.webapp.ganttModel = {
    LINK_TYPES: ["FS", "SS", "FF", "SF"],
    DAY_MS: 24 * 60 * 60 * 1000,

    // horizontal density in pixels per day, before zoom, per time scale
    SCALE_BASE: { day: 36, week: 12, month: 4 },
    MIN_ZOOM: 0.4,
    MAX_ZOOM: 4,

    /**
     * Parses a date value into a UTC midnight Date. Accepts a Date, an ISO
     * date string (yyyy-mm-dd) or a full ISO timestamp; the time portion is
     * discarded because the model resolves in whole days.
     * @param {*} value - The raw date value.
     * @returns {Date|null} The UTC midnight date, or null when unparsable.
     */
    parseDate(value) {
        if (value instanceof Date) {
            return isNaN(value.getTime())
                ? null
                : new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
        }
        if (typeof value !== "string" || value === "") {
            return null;
        }

        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) {
            return null;
        }

        const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
        return isNaN(date.getTime()) ? null : date;
    },

    /**
     * Formats a date as an ISO date string (yyyy-mm-dd), the canonical wire
     * and state representation of the model.
     * @param {Date} date - The date.
     * @returns {string} The ISO date string.
     */
    formatIso(date) {
        return date.toISOString().slice(0, 10);
    },

    /**
     * Returns a new date the given number of days after the given date.
     * @param {Date} date - The base date.
     * @param {number} days - The day distance, may be negative.
     * @returns {Date} The shifted date.
     */
    addDays(date, days) {
        return new Date(date.getTime() + days * this.DAY_MS);
    },

    /**
     * Returns the whole day distance from the first to the second date.
     * @param {Date} from - The earlier date.
     * @param {Date} to - The later date.
     * @returns {number} The signed day count.
     */
    diffDays(from, to) {
        return Math.round((to.getTime() - from.getTime()) / this.DAY_MS);
    },

    /**
     * Returns the Monday of the week the date falls in, matching the ISO week
     * definition used by the week scale.
     * @param {Date} date - The date.
     * @returns {Date} The Monday of that week.
     */
    startOfWeek(date) {
        // getUTCDay is 0 for sunday, the iso week starts on monday
        const shift = (date.getUTCDay() + 6) % 7;
        return this.addDays(date, -shift);
    },

    /**
     * Returns the first day of the month the date falls in.
     * @param {Date} date - The date.
     * @returns {Date} The first of that month.
     */
    startOfMonth(date) {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    },

    /**
     * Computes the ISO 8601 week number of a date, used to label the week
     * scale units.
     * @param {Date} date - The date.
     * @returns {number} The ISO week number (1..53).
     */
    isoWeek(date) {
        const thursday = this.addDays(this.startOfWeek(date), 3);
        const firstThursday = this.addDays(this.startOfWeek(new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4))), 3);
        return 1 + Math.round(this.diffDays(firstThursday, thursday) / 7);
    },

    /**
     * Normalises a raw task into the internal shape. Missing pieces are
     * derived from each other: the end from start plus duration, the duration
     * from the start/end distance and a one day default otherwise, so a caller
     * may author any two of the three. A task with a zero duration is a
     * milestone. Progress is clamped to 0..100 and resources are coerced to a
     * string array, accepting a comma separated string or objects with a name.
     * @param {object} raw - The raw task.
     * @returns {object|null} The normalised task, or null without an id.
     */
    normalizeTask(raw) {
        raw = raw || {};
        if (raw.id === undefined || raw.id === null || raw.id === "") {
            return null;
        }

        let start = this.parseDate(raw.start);
        let end = this.parseDate(raw.end);
        let duration = Number(raw.duration);
        duration = isNaN(duration) ? null : Math.max(0, Math.round(duration));

        if (raw.type === "milestone") {
            duration = 0;
        }

        if (!start && end) {
            start = duration !== null ? this.addDays(end, -duration) : end;
        }
        if (!start) {
            start = end || null;
        }
        if (start && end) {
            duration = Math.max(0, this.diffDays(start, end));
        } else if (start && duration !== null) {
            end = this.addDays(start, duration);
        } else if (start) {
            duration = 1;
            end = this.addDays(start, duration);
        }

        const progress = Math.min(100, Math.max(0, Number(raw.progress) || 0));

        let resources = raw.resources;
        if (typeof resources === "string") {
            resources = resources.split(",");
        }
        resources = Array.isArray(resources)
            ? resources
                .map((r) => (typeof r === "string" ? r : (r && r.name) || "").trim())
                .filter((r) => r !== "")
            : [];

        return {
            id: String(raw.id),
            label: raw.label || raw.name || "",
            start: start ? this.formatIso(start) : null,
            end: end ? this.formatIso(end) : null,
            duration: duration === null ? 1 : duration,
            progress: Math.round(progress),
            resources: resources,
            parentId: raw.parentId !== undefined && raw.parentId !== null && raw.parentId !== ""
                ? String(raw.parentId)
                : null,
            type: duration === 0 ? "milestone" : "task",
            color: raw.color || null,
            icon: raw.icon || null,
            collapsed: raw.collapsed === true
        };
    },

    /**
     * Normalises a raw link into the internal shape, accepting source/target
     * as aliases for from/to. An unknown type falls back to finish-to-start,
     * the overwhelmingly common dependency.
     * @param {object} raw - The raw link.
     * @returns {object|null} The normalised link, or null without endpoints.
     */
    normalizeLink(raw) {
        raw = raw || {};
        const from = raw.from !== undefined ? raw.from : raw.source;
        const to = raw.to !== undefined ? raw.to : raw.target;

        if (from === undefined || from === null || to === undefined || to === null) {
            return null;
        }

        const type = String(raw.type || "FS").toUpperCase();

        return {
            id: raw.id !== undefined && raw.id !== null ? String(raw.id) : String(from) + "-" + String(to),
            from: String(from),
            to: String(to),
            type: this.LINK_TYPES.includes(type) ? type : "FS"
        };
    },

    /**
     * Normalises a project response into internal tasks and links. Tasks
     * without an id and links whose endpoints are absent, self-referential,
     * duplicated or cycle-forming are dropped, so the render pipeline can rely
     * on a consistent graph.
     * @param {object} data - The raw project response.
     * @returns {object} An object with tasks and links.
     */
    normalizeProject(data) {
        data = data || {};

        const rawTasks = Array.isArray(data.tasks) ? data.tasks : (Array.isArray(data.items) ? data.items : []);
        const tasks = rawTasks
            .map((raw) => this.normalizeTask(raw))
            .filter((task) => task !== null);

        const ids = new Set(tasks.map((task) => task.id));

        // orphaned parents would hide the task from the tree walk entirely
        for (const task of tasks) {
            if (task.parentId !== null && !ids.has(task.parentId)) {
                task.parentId = null;
            }
        }

        const links = [];
        const seen = new Set();
        for (const raw of Array.isArray(data.links) ? data.links : []) {
            const link = this.normalizeLink(raw);
            if (!link || link.from === link.to || !ids.has(link.from) || !ids.has(link.to)) {
                continue;
            }
            const key = link.from + ">" + link.to;
            if (seen.has(key) || this.wouldCycle(links, link.from, link.to)) {
                continue;
            }
            seen.add(key);
            links.push(link);
        }

        return { tasks: tasks, links: links };
    },

    /**
     * Returns the direct children of a task in array order.
     * @param {Array<object>} tasks - The task list.
     * @param {string|null} parentId - The parent id, or null for roots.
     * @returns {Array<object>} The children.
     */
    childrenOf(tasks, parentId) {
        return tasks.filter((task) => task.parentId === parentId);
    },

    /**
     * Returns whether a task is a container, which is any task with children.
     * A container derives its dates and progress from its subtree, see rollup.
     * @param {Array<object>} tasks - The task list.
     * @param {string} taskId - The task id.
     * @returns {boolean} True when the task has children.
     */
    isSummary(tasks, taskId) {
        return tasks.some((task) => task.parentId === taskId);
    },

    /**
     * Derives the dates and progress of every container from its subtree,
     * bottom-up: the start is the earliest child start, the end the latest
     * child end and the progress the duration-weighted mean of the leaves.
     * The tasks are mutated in place and returned, because the rollup runs
     * right after a normalisation or a mutation on data the caller owns.
     * @param {Array<object>} tasks - The task list.
     * @returns {Array<object>} The same list with the containers updated.
     */
    rollup(tasks) {
        const roll = (parentId) => {
            const children = this.childrenOf(tasks, parentId);
            let start = null;
            let end = null;
            let weight = 0;
            let done = 0;

            for (const child of children) {
                const sub = roll(child.id);

                if (sub) {
                    // the child is itself a container and carries its subtree
                    child.start = sub.start !== null ? this.formatIso(sub.start) : child.start;
                    child.end = sub.end !== null ? this.formatIso(sub.end) : child.end;
                    child.duration = sub.start !== null && sub.end !== null
                        ? this.diffDays(sub.start, sub.end)
                        : child.duration;
                    child.progress = sub.weight > 0 ? Math.round(sub.done / sub.weight) : child.progress;
                    child.type = "summary";

                    if (sub.start !== null && (start === null || sub.start < start)) { start = sub.start; }
                    if (sub.end !== null && (end === null || sub.end > end)) { end = sub.end; }
                    weight += sub.weight;
                    done += sub.done;
                } else {
                    const childStart = this.parseDate(child.start);
                    const childEnd = this.parseDate(child.end);
                    if (childStart && (start === null || childStart < start)) { start = childStart; }
                    if (childEnd && (end === null || childEnd > end)) { end = childEnd; }

                    // a milestone carries no duration, weigh it as a single day
                    const childWeight = Math.max(1, child.duration);
                    weight += childWeight;
                    done += childWeight * child.progress;
                }
            }

            return children.length > 0 ? { start: start, end: end, weight: weight, done: done } : null;
        };

        roll(null);
        return tasks;
    },

    /**
     * Flattens the task tree into the visible row order: children directly
     * after their parent, subtrees of collapsed containers omitted. Each row
     * carries the task, its depth and whether it has children, which is all
     * the two synchronised panes need to render.
     * @param {Array<object>} tasks - The task list.
     * @returns {Array<object>} The visible rows { task, depth, hasChildren }.
     */
    flatten(tasks) {
        const rows = [];
        const walk = (parentId, depth) => {
            for (const task of this.childrenOf(tasks, parentId)) {
                const hasChildren = this.isSummary(tasks, task.id);
                rows.push({ task: task, depth: depth, hasChildren: hasChildren });
                if (hasChildren && !task.collapsed) {
                    walk(task.id, depth + 1);
                }
            }
        };
        walk(null, 0);
        return rows;
    },

    /**
     * Computes the overall date range of the project, padded on both sides so
     * bars never touch the chart edge and there is room to drag beyond the
     * current extremes. An empty project ranges over the current month.
     * @param {Array<object>} tasks - The task list.
     * @param {number} [padDays=7] - The padding in days.
     * @returns {object} The range { start, end } as UTC dates.
     */
    projectRange(tasks, padDays = 7) {
        let start = null;
        let end = null;

        for (const task of tasks) {
            const taskStart = this.parseDate(task.start);
            const taskEnd = this.parseDate(task.end);
            if (taskStart && (start === null || taskStart < start)) { start = taskStart; }
            if (taskEnd && (end === null || taskEnd > end)) { end = taskEnd; }
        }

        if (start === null || end === null) {
            const today = this.parseDate(new Date());
            start = this.startOfMonth(today);
            end = this.addDays(start, 31);
        }

        return { start: this.addDays(start, -padDays), end: this.addDays(end, padDays) };
    },

    /**
     * Returns whether adding a dependency from one task to another would close
     * a cycle in the successor graph, which would make the schedule unsound.
     * @param {Array<object>} links - The existing links.
     * @param {string} fromId - The predecessor task id.
     * @param {string} toId - The successor task id.
     * @returns {boolean} True when the link would form a cycle.
     */
    wouldCycle(links, fromId, toId) {
        // a cycle exists exactly when the predecessor is reachable from the successor
        const visited = new Set();
        const queue = [toId];

        while (queue.length > 0) {
            const id = queue.shift();
            if (id === fromId) {
                return true;
            }
            if (visited.has(id)) {
                continue;
            }
            visited.add(id);
            for (const link of links) {
                if (link.from === id) {
                    queue.push(link.to);
                }
            }
        }

        return false;
    },

    /**
     * Validates a prospective dependency and names the first violated rule, so
     * the control can refuse the drop with a reason. Rules: both endpoints
     * exist, no self reference, no duplicate pair and no cycle.
     * @param {Array<object>} tasks - The task list.
     * @param {Array<object>} links - The existing links.
     * @param {string} fromId - The predecessor task id.
     * @param {string} toId - The successor task id.
     * @returns {object} The verdict { ok, reason }.
     */
    canLink(tasks, links, fromId, toId) {
        const ids = new Set(tasks.map((task) => task.id));

        if (!ids.has(fromId) || !ids.has(toId)) {
            return { ok: false, reason: "missing" };
        }
        if (fromId === toId) {
            return { ok: false, reason: "self" };
        }
        if (links.some((link) => link.from === fromId && link.to === toId)) {
            return { ok: false, reason: "duplicate" };
        }
        if (this.wouldCycle(links, fromId, toId)) {
            return { ok: false, reason: "cycle" };
        }

        return { ok: true, reason: null };
    },

    /**
     * Returns the horizontal density in pixels per day for a scale and zoom
     * factor. The zoom is clamped so a bar can neither degenerate below a
     * pixel nor explode the scroll range.
     * @param {string} scale - The scale: day, week or month.
     * @param {number} zoom - The zoom factor.
     * @returns {number} The pixels per day.
     */
    pxPerDay(scale, zoom) {
        const base = this.SCALE_BASE[scale] || this.SCALE_BASE.day;
        const factor = Math.min(this.MAX_ZOOM, Math.max(this.MIN_ZOOM, Number(zoom) || 1));
        return base * factor;
    },

    /**
     * Maps a date to its horizontal pixel offset within the chart range.
     * @param {Date} date - The date.
     * @param {Date} rangeStart - The chart range start.
     * @param {number} pxDay - The pixels per day.
     * @returns {number} The offset in pixels.
     */
    dateToOffset(date, rangeStart, pxDay) {
        return this.diffDays(rangeStart, date) * pxDay;
    },

    /**
     * Maps a horizontal pixel offset back to the day it falls in, the inverse
     * of dateToOffset used by drop and double-click positioning.
     * @param {number} px - The offset in pixels.
     * @param {Date} rangeStart - The chart range start.
     * @param {number} pxDay - The pixels per day.
     * @returns {Date} The date at that offset.
     */
    offsetToDate(px, rangeStart, pxDay) {
        return this.addDays(rangeStart, Math.floor(px / pxDay));
    },

    /**
     * Builds the two tier timeline header for a scale over a range: the units
     * are the small cells (days, weeks or months) and the groups the coarse
     * cells above them (months or years). Each entry carries its day span so
     * the renderer multiplies with the pixel density and stays scale agnostic.
     * Unit labels are numeric (day of month, iso week, month number) and the
     * caller localises the group labels, so the model stays locale free.
     * @param {string} scale - The scale: day, week or month.
     * @param {Date} start - The range start.
     * @param {Date} end - The range end.
     * @returns {object} The header { units, groups }, entries { start, days, label, weekend? }.
     */
    buildScale(scale, start, end) {
        const units = [];
        const groups = [];
        const total = this.diffDays(start, end);

        const pushGroup = (groupStart, days) => {
            groups.push({ start: new Date(groupStart), days: days });
        };

        if (scale === "month") {
            let cursor = this.startOfMonth(start);
            let yearStart = cursor;
            let yearDays = 0;

            while (cursor < end) {
                const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
                const from = cursor < start ? start : cursor;
                const to = next > end ? end : next;
                const days = this.diffDays(from, to);

                units.push({ start: from, days: days, label: String(cursor.getUTCMonth() + 1) });

                if (cursor.getUTCFullYear() !== yearStart.getUTCFullYear()) {
                    pushGroup(yearStart, yearDays);
                    yearStart = cursor;
                    yearDays = 0;
                }
                yearDays += days;
                cursor = next;
            }
            if (yearDays > 0) {
                pushGroup(yearStart, yearDays);
            }
        } else if (scale === "week") {
            let cursor = this.startOfWeek(start);
            while (cursor < end) {
                const next = this.addDays(cursor, 7);
                const from = cursor < start ? start : cursor;
                const to = next > end ? end : next;
                units.push({ start: from, days: this.diffDays(from, to), label: String(this.isoWeek(cursor)) });
                cursor = next;
            }
            this._monthGroups(start, end, pushGroup);
        } else {
            for (let i = 0; i < total; i++) {
                const day = this.addDays(start, i);
                const weekday = day.getUTCDay();
                units.push({
                    start: day,
                    days: 1,
                    label: String(day.getUTCDate()),
                    weekend: weekday === 0 || weekday === 6
                });
            }
            this._monthGroups(start, end, pushGroup);
        }

        return { units: units, groups: groups };
    },

    /**
     * Emits one group per month clipped to the range, shared by the day and
     * week scales.
     * @param {Date} start - The range start.
     * @param {Date} end - The range end.
     * @param {Function} push - The receiver (groupStart, days).
     */
    _monthGroups(start, end, push) {
        let cursor = this.startOfMonth(start);
        while (cursor < end) {
            const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
            const from = cursor < start ? start : cursor;
            const to = next > end ? end : next;
            push(from, this.diffDays(from, to));
            cursor = next;
        }
    },

    /**
     * Computes the date patch of a bar moved by whole days. The duration is
     * preserved, which is the drag-to-reschedule contract.
     * @param {object} task - The task.
     * @param {number} deltaDays - The signed day distance.
     * @returns {object|null} The patch { start, end }, or null for no-op.
     */
    moveTask(task, deltaDays) {
        const start = this.parseDate(task.start);
        if (!start || deltaDays === 0) {
            return null;
        }

        const newStart = this.addDays(start, deltaDays);
        return {
            start: this.formatIso(newStart),
            end: this.formatIso(this.addDays(newStart, task.duration))
        };
    },

    /**
     * Computes the date patch of a bar edge dragged by whole days. The
     * duration never falls below one day, so a resize cannot silently turn a
     * task into a milestone; milestones are not resizable at all.
     * @param {object} task - The task.
     * @param {string} edge - The dragged edge: "start" or "end".
     * @param {number} deltaDays - The signed day distance.
     * @returns {object|null} The patch { start, end, duration }, or null for no-op.
     */
    resizeTask(task, edge, deltaDays) {
        const start = this.parseDate(task.start);
        if (!start || deltaDays === 0 || task.duration === 0) {
            return null;
        }

        let duration;
        let newStart = start;

        if (edge === "start") {
            duration = Math.max(1, task.duration - deltaDays);
            newStart = this.addDays(start, task.duration - duration);
        } else {
            duration = Math.max(1, task.duration + deltaDays);
        }

        return {
            start: this.formatIso(newStart),
            end: this.formatIso(this.addDays(newStart, duration)),
            duration: duration
        };
    },

    /**
     * Projects a task onto the wire payload, dropping the derived and view
     * only fields so the server sees the data model, not the presentation.
     * @param {object} task - The internal task.
     * @returns {object} The wire task.
     */
    taskToWire(task) {
        return {
            id: task.id,
            label: task.label,
            start: task.start,
            end: task.end,
            duration: task.duration,
            progress: task.progress,
            resources: task.resources.slice(),
            parentId: task.parentId,
            icon: task.icon
        };
    },

    /**
     * Projects a link onto the wire payload.
     * @param {object} link - The internal link.
     * @returns {object} The wire link.
     */
    linkToWire(link) {
        return { id: link.id, from: link.from, to: link.to, type: link.type };
    }
};
