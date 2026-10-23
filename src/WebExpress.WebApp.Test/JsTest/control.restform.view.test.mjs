/**
 * Headless tests for the view of the REST form and the REST wizard: the banners and the
 * wizard chrome are rendered from the state ahead of the server rendered content, which
 * keeps its nodes; the marks of invalid fields and the lock of the fields are applied to
 * that markup; the steps of the wizard are state.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadControl } from "./controls.harness.mjs";

const DEPS = [
    "i18n/en.js",
    "webexpress.webapp.restform.model.js",
    "webexpress.webapp.restform.js",
    "webexpress.webapp.restwizard.model.js"
];

/**
 * Gives a form the parts of the browser form API the control reads: the list of its
 * controls and the validity of each, which follows a required attribute.
 * @param {object} form - The form element.
 */
function formApi(form) {
    Object.defineProperty(form, "elements", {
        get: () => form.querySelectorAll("input, textarea, select, button")
    });
    for (const el of form.querySelectorAll("input, textarea, select")) {
        Object.defineProperty(el, "validity", {
            get: () => ({ valid: !(el.hasAttribute("required") && !el.value) })
        });
        el.validationMessage = "required";
    }
}

/**
 * Builds an input of a form.
 * @param {object} rt - The loaded runtime.
 * @param {string} name - The field name.
 * @param {object} [attributes={}] - Further attributes.
 * @returns {object} The input.
 */
function input(rt, name, attributes = {}) {
    const el = rt.createElement("input");
    el.setAttribute("name", name);
    el.name = name;
    el.type = "text";
    for (const [key, value] of Object.entries(attributes)) {
        el.setAttribute(key, value);
    }
    return el;
}

/**
 * Builds a REST form with a main section of fields and a submit button.
 * @param {object} [options={}] - modal: put the fields into a dialog body.
 * @returns {object} The runtime, the form, its parts and the control.
 */
function form(options = {}) {
    const rt = loadControl({ deps: DEPS.slice(0, 3), file: "webexpress.webapp.restform.js" });
    const host = rt.createElement("form");
    const main = rt.createElement("div");
    main.className = "wx-form-main";
    const title = input(rt, "title", { required: "" });
    const locked = input(rt, "id", { disabled: "disabled" });
    main.appendChild(title);
    main.appendChild(locked);
    const submit = rt.createElement("button");
    submit.setAttribute("type", "submit");
    const buttons = rt.createElement("div");
    buttons.appendChild(submit);

    let body = host;
    if (options.modal) {
        const header = rt.createElement("div");
        header.className = "modal-header";
        body = rt.createElement("div");
        body.className = "modal-body";
        const footer = rt.createElement("div");
        footer.className = "modal-footer";
        footer.appendChild(buttons);
        host.appendChild(header);
        host.appendChild(body);
        host.appendChild(footer);
    } else {
        host.appendChild(buttons);
    }
    body.insertBefore(main, body.firstChild);

    rt.document.body.appendChild(host);
    formApi(host);
    const ctrl = new rt.wxapp.RestFormCtrl(host);
    return { rt, host, body, main, title, locked, submit, ctrl };
}

test("the banners lead the form body and the server rendered content keeps its nodes", () => {
    const { host, main, ctrl } = form();
    const classes = host.children.map((el) => el.className);

    assert.deepEqual(classes.slice(0, 3), ["wx-restform-error-container", "wx-restform-confirm alert alert-success", "wx-restform-prolog-container"]);
    assert.equal(host.children[3], main, "the fields follow, as the server rendered them");

    ctrl._displayProlog("<b>Read this first</b>");
    ctrl._showConfirm("<p>Saved</p>");
    ctrl.store.flush();
    const prolog = host.querySelector(".wx-restform-prolog-container");
    assert.equal(prolog.style.display, "");
    assert.equal(prolog.innerHTML, "<b>Read this first</b>");
    assert.equal(host.querySelector(".wx-restform-confirm").style.display, "block");
    assert.equal(host.children[3], main);
});

test("in a dialog the banners lead the dialog body, and header and footer stay as they are", () => {
    const { host, body, main } = form({ modal: true });

    assert.deepEqual(host.children.map((el) => el.className), ["modal-header", "modal-body", "modal-footer"]);
    assert.equal(body.children[0].className, "wx-restform-error-container");
    assert.equal(body.children[3], main);
});

test("a validation marks the invalid field and lists the error; clearing puts the field back", () => {
    const { host, main, title, ctrl } = form();

    assert.equal(ctrl.validate(), false);

    const wrapper = title.parentNode;
    assert.equal(wrapper.className, "wx-restform-field-wrapper", "the mark is in place when validate returns");
    assert.equal(wrapper.parentNode, main);
    assert.equal(title.getAttribute("aria-invalid"), "true");
    assert.equal(host.querySelector(".wx-restform-error").querySelectorAll("li").map((li) => li.textContent).join(), "required");

    title.value = "Monkey Island";
    assert.equal(ctrl.validate(), true);
    assert.equal(title.parentNode, main, "the field leaves the wrapper again");
    assert.equal(title.hasAttribute("aria-invalid"), false);
    assert.equal(host.querySelector(".wx-restform-error"), null);
});

test("a field the server reports by name is marked, and a submit focuses the first marked field", () => {
    const { title, ctrl } = form();
    let focused = null;
    title.focus = () => { focused = title; };

    ctrl._handleResult({ ok: false, status: 400, data: { errors: { title: "taken" } } });
    ctrl.store.flush();
    assert.equal(title.getAttribute("aria-invalid"), "true");

    ctrl.clearErrors();
    ctrl._onSubmit({ preventDefault() { }, stopImmediatePropagation() { } });
    assert.equal(focused, title, "the marks are rendered before the focus looks for them");
});

test("the lock enables only what it disabled, so a field the server disabled stays disabled", () => {
    const { title, locked, submit, ctrl } = form();

    ctrl._setSubmitting(true);
    ctrl.store.flush();
    assert.equal(title.disabled, true);
    assert.equal(submit.disabled, true);

    ctrl._setSubmitting(false);
    ctrl.store.flush();
    assert.equal(title.disabled, false);
    assert.equal(submit.disabled, false);
    assert.equal(locked.disabled, true, "the server rendered it disabled");
});

test("a delete confirmation holds the submit back until the item is typed", () => {
    const { host, submit, ctrl } = form();

    ctrl._displayDeletePrompt("Guybrush");
    ctrl.store.flush();
    const field = host.querySelector(".wx-restform-delete-confirm input");
    assert.ok(field.getAttribute("aria-label").includes("Guybrush"));
    assert.equal(submit.disabled, true);

    field.value = "Guy";
    field.dispatchEvent({ type: "input" });
    ctrl.store.flush();
    assert.equal(host.querySelector(".wx-restform-delete-confirm .text-danger").style.display, "", "a mismatch is told");
    assert.equal(submit.disabled, true);

    field.value = "Guybrush";
    field.dispatchEvent({ type: "input" });
    ctrl.store.flush();
    assert.equal(submit.disabled, false);
    assert.equal(host.querySelector(".wx-restform-delete-confirm input"), field, "the field keeps its node while it is typed in");
});

test("a server side data change does not reload a form the user is typing in", () => {
    const rt = loadControl({ deps: DEPS.slice(0, 3), file: "webexpress.webapp.restform.js" });
    let attached = 0;
    rt.wxapp.DataChangeSubscription.attachReload = () => { attached++; return { detach() { } }; };
    const host = rt.createElement("form");
    rt.document.body.appendChild(host);
    formApi(host);

    const ctrl = new rt.wxapp.RestFormCtrl(host);

    assert.equal(ctrl._mounted, true);
    assert.equal(attached, 0);
});

// ----------------------------------------------------------------- wizard

/**
 * Builds a wizard of three static steps, the first with a required field.
 * @returns {object} The runtime, the form, its pages and the control.
 */
function wizard() {
    const rt = loadControl({ deps: DEPS, file: "webexpress.webapp.restwizard.js" });
    // the payload tells a multiple select by its class, which the sandbox lacks
    rt.sandbox.HTMLSelectElement = class { };
    const host = rt.createElement("form");
    const pages = ["Ship", "Crew", "Voyage"].map((title) => {
        const page = rt.createElement("div");
        page.className = "wx-wizard-page";
        page.setAttribute("data-title", title);
        host.appendChild(page);
        return page;
    });
    const ship = input(rt, "ship", { required: "" });
    pages[0].appendChild(ship);
    rt.document.body.appendChild(host);
    formApi(host);
    const ctrl = new rt.wxapp.RestWizardCtrl(host);
    return { rt, host, pages, ship, ctrl };
}

const shown = (pages) => pages.findIndex((page) => page.style.display === "block");
const steps = (host) => host.querySelectorAll(".wx-steps-item").map((item) => item.className.replace("wx-steps-item ", ""));

test("the wizard renders its steps from the state and keeps the pages", () => {
    const { host, pages, ctrl } = wizard();
    const root = host.querySelector(".wx-restwizard-root");

    assert.equal(host.children[3], root, "the wizard follows the banners");
    assert.deepEqual(host.querySelector(".wx-restwizard-pages-container").children, pages);
    assert.equal(shown(pages), 0);
    assert.equal(pages[1].getAttribute("aria-hidden"), "true");
    assert.deepEqual(steps(host), ["wx-steps-item-active", "wx-steps-item-pending", "wx-steps-item-pending"]);
    assert.equal(host.querySelector(".wx-restwizard-counter").textContent, "Step 1 of 3");
    assert.equal(host.querySelector(".wx-restwizard-prev").style.display, "none");
    assert.equal(host.querySelector(".wx-restwizard-finish").style.display, "none");
    assert.equal(ctrl.state.pages.length, 3);
});

test("next validates the step, moves on, and a passed step can be clicked to return", async () => {
    const { host, pages, ship, ctrl } = wizard();
    const next = host.querySelector(".wx-restwizard-next");

    next.dispatchEvent({ type: "click" });
    await Promise.resolve();
    ctrl.store.flush();
    assert.equal(shown(pages), 0, "an invalid step is not left");
    assert.equal(ship.getAttribute("aria-invalid"), "true");

    ship.value = "Sea Monkey";
    next.dispatchEvent({ type: "click" });
    await Promise.resolve();
    ctrl.store.flush();
    assert.equal(shown(pages), 1);
    assert.equal(ship.hasAttribute("aria-invalid"), false);
    assert.deepEqual(steps(host), ["wx-steps-item-completed wx-steps-item-clickable", "wx-steps-item-active", "wx-steps-item-pending"]);
    assert.equal(host.querySelector(".wx-restwizard-prev").style.display, "");
    assert.equal(host.querySelector(".wx-restwizard-next"), next, "the button keeps its node");

    host.querySelectorAll(".wx-steps-item")[0].dispatchEvent({ type: "click" });
    ctrl.store.flush();
    assert.equal(shown(pages), 0);
});

test("a dynamic step the server answers with 204 is skipped and leaves the indicator", async () => {
    const { host, pages, ship, ctrl } = wizard();
    pages[1].setAttribute("data-uri", "/api/wizard/crew");
    ctrl._patchPage(1, { uri: "/api/wizard/crew", isLoaded: false });
    ctrl._service = { request: async () => ({ ok: true, status: 204, data: null }) };
    ship.value = "Sea Monkey";

    await ctrl._navigate(1);
    ctrl.store.flush();

    assert.equal(shown(pages), 2, "the skipped step is passed over");
    assert.equal(ctrl.state.pages[1].skipped, true);
    assert.equal(host.querySelectorAll(".wx-steps-item").length, 2);
    assert.equal(host.querySelector(".wx-restwizard-counter").textContent, "Step 2 of 2");
    assert.equal(host.querySelector(".wx-restwizard-finish").style.display, "", "the last active step submits");
    assert.equal(ctrl.state.wizardLoading, false);
});

test("a form authored without a data service posts to its action through the service layer", async () => {
    const rt = loadControl({ deps: DEPS.slice(0, 3), file: "webexpress.webapp.restform.js" });
    const requests = [];
    rt.wxapp.ServiceRegistry.request = async (url, init) => {
        requests.push({ url: String(url), method: init.method });
        return { ok: true, status: 200, data: { message: "Saved" } };
    };
    const host = rt.createElement("form");
    host.action = "/greetings";
    rt.document.body.appendChild(host);
    formApi(host);
    const ctrl = new rt.wxapp.RestFormCtrl(host);

    await ctrl.submit();
    ctrl.store.flush();

    assert.equal(requests.length, 1);
    assert.ok(requests[0].url.endsWith("/greetings"));
    assert.equal(requests[0].method, "POST");
    assert.deepEqual(Array.from(ctrl.state.errors), []);
    assert.equal(ctrl.state.confirm, "Saved");
});
