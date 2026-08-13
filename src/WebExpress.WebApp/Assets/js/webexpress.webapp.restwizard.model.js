var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the REST wizard control (phase two of the View, State
 * and Service migration). These functions carry no DOM or network dependency,
 * so they can be unit tested in isolation. The control composes them with the
 * RestService inherited from the form control and a Store for the step state.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.restWizardModel = {
    /**
     * Builds the fetch init for loading a dynamic step. The step is posted as a
     * json payload and an html fragment is requested, matching the historical
     * behaviour. A 204 No Content response signals that the step is skipped.
     * @param {string} payloadStr - The serialised form payload.
     * @returns {object} The fetch init.
     */
    buildStepRequestInit(payloadStr) {
        return {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "text/html"
            },
            body: payloadStr
        };
    },

    /**
     * Determines whether a dynamic step can be served from its cache, which is
     * the case when it was already loaded successfully and the payload has not
     * changed since.
     * @param {object} page - The page object.
     * @param {string} payloadStr - The current serialised payload.
     * @returns {boolean} True when the cached step is still valid.
     */
    shouldUseCache(page, payloadStr) {
        return !!(page && page.isLoaded && page.payloadHash === payloadStr && !page.hasError);
    },

    /**
     * Determines whether the page at the current index is the last active step,
     * which is the case when every following page is skipped or none follow.
     * @param {Array<object>} pages - The wizard pages.
     * @param {number} currentIndex - The current page index.
     * @returns {boolean} True when no active page follows.
     */
    isLastPage(pages, currentIndex) {
        pages = pages || [];
        for (let j = currentIndex + 1; j < pages.length; j++) {
            if (!pages[j].skipped) {
                return false;
            }
        }
        return true;
    },

    /**
     * Describes the position of the current step among the active ones, counting
     * skipped steps out of both the position and the total. This is what the step
     * counter in the footer reads back to the user.
     * @param {Array<object>} pages - The wizard pages.
     * @param {number} currentIndex - The current page index.
     * @returns {{position: number, total: number}} The one-based position and the total.
     */
    describePosition(pages, currentIndex) {
        pages = pages || [];

        let position = 0;
        let total = 0;

        for (let i = 0; i < pages.length; i++) {
            if (pages[i].skipped) {
                continue;
            }
            total++;
            if (i <= currentIndex) {
                position = total;
            }
        }

        return { position: position, total: total };
    },

    /**
     * Derives the progress state of a step from its position relative to the
     * current one.
     * @param {number} index - The index of the step.
     * @param {number} currentIndex - The current page index.
     * @returns {"completed"|"active"|"pending"} The state of the step.
     */
    stateOf(index, currentIndex) {
        if (index < currentIndex) {
            return "completed";
        }
        return index === currentIndex ? "active" : "pending";
    }
};
