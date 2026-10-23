/**
 * Headless tests for the REST form as the reference of the saving side of the control
 * contract (WebExpress.WebUI/docs/js/contract.md): unsaved changes are told by dirty and
 * undone by reset, save validates, can be vetoed or have its payload replaced, resolves with
 * the normalized result and reports a failure on the data error event, the validity of the
 * fields is announced when it turns, and a field control inside the form adds its own rules.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadControl } from "./controls.harness.mjs";

const DEPS = [
    "i18n/en.js",
    "webexpress.webapp.restform.model.js"
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
 * Builds a named text input.
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
    el.value = "";
    for (const [key, value] of Object.entries(attributes)) {
        el.setAttribute(key, value);
    }
    return el;
}

/**
 * Builds a REST form posting to its action, with a required title and, optionally, a field
 * control that submits through a hidden input and knows a rule of its own.
 * @param {object} [options={}] - control: add the field control; rule: its validate result;
 *     respond: answers the request.
 * @returns {object} The runtime, the form, its fields, the control and the recorded requests.
 */
function form(options = {}) {
    const rt = loadControl({ deps: DEPS, file: "webexpress.webapp.restform.js" });
    const requests = [];
    rt.wxapp.ServiceRegistry.request = async (url, init) => {
        requests.push({ url: String(url), body: init.body });
        return options.respond ? options.respond() : { ok: true, status: 200, data: { message: "Saved" }, error: null };
    };

    const host = rt.createElement("form");
    host.action = "/ships";
    const title = input(rt, "title", { required: "" });
    host.appendChild(title);

    let field = null;
    if (options.control) {
        class RangeCtrl extends rt.wx.Ctrl {
            constructor(element) {
                super(element);
                this._hidden = input(rt, "range");
                this._hidden.type = "hidden";
                element.appendChild(this._hidden);
            }
            get value() { return this._hidden.value; }
            set value(value) { this._hidden.value = value == null ? "" : String(value); }
            validate() { return options.rule || []; }
        }
        rt.wx.Controller.registerClass("wx-test-range", RangeCtrl);
        const fieldHost = rt.createElement("div");
        fieldHost.classList.add("wx-test-range");
        host.appendChild(fieldHost);
        rt.wx.Controller.createInstances(fieldHost);
        field = rt.wx.Controller.getInstanceByElement(fieldHost);
    }

    rt.document.body.appendChild(host);
    formApi(host);
    const ctrl = new rt.wxapp.RestFormCtrl(host);
    const events = [];
    for (const name of ["BEFORE_SAVE_EVENT", "SAVED_EVENT", "DATA_ERROR_EVENT", "CHANGE_VALIDITY_EVENT"]) {
        host.addEventListener(rt.wx.Event[name], (e) => events.push({ name: name, detail: e.detail }));
    }
    return { rt, host, title, field, ctrl, requests, events };
}

const names = (events) => events.map((event) => event.name);

test("the form tells unsaved changes and reset takes them back", () => {
    const { title, ctrl } = form();

    assert.equal(ctrl.dirty, false, "a rendered form is pristine");

    title.value = "Sea Monkey";
    assert.equal(ctrl.dirty, true);

    ctrl.reset();
    assert.equal(title.value, "");
    assert.equal(ctrl.dirty, false);
});

test("a save of invalid fields sends nothing and answers with a validation result", async () => {
    const { ctrl, requests, events } = form();

    const result = await ctrl.save();

    assert.equal(result.ok, false);
    assert.equal(result.error.kind, "validation");
    assert.equal(requests.length, 0);
    assert.deepEqual(names(events), ["CHANGE_VALIDITY_EVENT"]);
    assert.equal(events[0].detail.valid, false);
});

test("a save is announced, may get another payload, and makes what was saved the baseline", async () => {
    const { rt, host, title, ctrl, requests, events } = form();
    title.value = "Sea Monkey";
    host.addEventListener(rt.wx.Event.BEFORE_SAVE_EVENT, (e) => {
        e.detail.payload = Object.assign({}, e.detail.payload, { crew: 3 });
    });

    const result = await ctrl.save();

    assert.equal(result.ok, true);
    assert.equal(requests.length, 1);
    assert.deepEqual(JSON.parse(requests[0].body), { title: "Sea Monkey", crew: 3 }, "the replaced payload is sent");
    assert.deepEqual(names(events), ["BEFORE_SAVE_EVENT", "SAVED_EVENT"]);
    assert.equal(ctrl.dirty, false, "the saved state is the new baseline");
});

test("a vetoed save sends nothing and answers with an abort", async () => {
    const { rt, host, title, ctrl, requests } = form();
    title.value = "Sea Monkey";
    host.addEventListener(rt.wx.Event.BEFORE_SAVE_EVENT, (e) => e.preventDefault());

    const result = await ctrl.save();

    assert.equal(result.error.kind, "abort");
    assert.equal(requests.length, 0);
    assert.equal(ctrl.dirty, true, "the change is still unsaved");
});

test("a refusal of the server marks the fields and is reported with them", async () => {
    const { title, ctrl, events } = form({
        respond: () => ({ ok: false, status: 400, data: { errors: { title: "taken" } }, error: { kind: "http", status: 400, message: "", retriable: false } })
    });
    title.value = "Sea Monkey";

    const result = await ctrl.save();
    ctrl.store.flush();

    assert.equal(result.ok, false);
    const failure = events.find((event) => event.name === "DATA_ERROR_EVENT").detail;
    assert.equal(failure.action, "save");
    assert.equal(failure.error.kind, "validation");
    assert.equal(failure.fields[0].field, "title");
    assert.equal(title.getAttribute("aria-invalid"), "true");
    assert.equal(events.find((event) => event.name === "CHANGE_VALIDITY_EVENT").detail.valid, false);
    assert.equal(ctrl.dirty, true, "a refused change stays unsaved");
});

test("a failed request resolves with its result and is reported once", async () => {
    const { title, ctrl, events } = form({
        respond: () => ({ ok: false, status: 500, data: null, error: { kind: "http", status: 500, message: "boom", retriable: true } })
    });
    title.value = "Sea Monkey";

    const result = await ctrl.save();

    assert.equal(result.status, 500);
    const failures = events.filter((event) => event.name === "DATA_ERROR_EVENT");
    assert.equal(failures.length, 1);
    assert.equal(failures[0].detail.error.kind, "http");
    assert.equal(failures[0].detail.error.retriable, true);
    assert.equal(ctrl.state.errors.length, 1, "the failure is shown above the fields");
});

test("an aborted request is no failure to show", async () => {
    const { title, ctrl, events } = form({
        respond: () => ({ ok: false, status: 0, data: null, error: { kind: "abort", status: 0, message: "", retriable: false } })
    });
    title.value = "Sea Monkey";

    await ctrl.save();

    assert.equal(events.some((event) => event.name === "DATA_ERROR_EVENT"), false);
    assert.equal(ctrl.state.errors.length, 0);
});

test("a field control inside the form adds its own rule to the validation", () => {
    const { title, ctrl, field } = form({ control: true, rule: ["the bounds are inverted"] });
    title.value = "Sea Monkey";

    assert.equal(ctrl.validate(), false);
    assert.deepEqual(Array.from(ctrl.state.errors), ["the bounds are inverted"]);
    assert.equal(ctrl.state.fieldErrors[0].field, field._hidden);
});

test("a disabled field control is not validated, although its hidden input does not tell", () => {
    const { title, ctrl, field } = form({ control: true, rule: ["the bounds are inverted"] });
    title.value = "Sea Monkey";
    field._hidden.dataset.wxRequired = "true";
    field._element.setAttribute("disabled", "");

    assert.equal(ctrl.validate(), true);
});

test("loading the fields makes them the baseline of the form and of its field controls", async () => {
    const { rt, ctrl, field, title } = form({ control: true });
    ctrl.options.api = "/ships/1";
    ctrl._service = { request: async () => ({ ok: true, status: 200, data: { title: "Sea Monkey", range: "1;5" }, error: null }) };

    await ctrl.load();

    assert.equal(title.value, "Sea Monkey");
    assert.equal(field.value, "1;5");
    assert.equal(ctrl.dirty, false);
    assert.equal(rt.wx.Field.isDirty(field), false);
});
