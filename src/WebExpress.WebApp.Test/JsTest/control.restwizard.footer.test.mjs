/**
 * Footer layout test for the REST wizard.
 *
 * The wizard does not render its own footer; it adds its navigation to the one the
 * dialog already has, next to the dismiss button ControlModal put there. Where it
 * inserts them decides the button order the user sees, so the order is pinned here
 * against the one ControlModalForm gives every other dialog: the primary action
 * first, the dismiss button last.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";

const DEPS = [
    "webexpress.webapp.restform.model.js",
    "webexpress.webapp.restform.js",
    "webexpress.webapp.restwizard.model.js"
];

/**
 * Builds the dialog the wizard enhances: a form with a body of steps and a footer
 * that already carries the dialog's dismiss button. The body matters - without it
 * the wizard treats the footer as static content and moves it into its own layout.
 * @param {object} rt - The loaded runtime.
 * @param {boolean} withDismiss - Whether the dialog put a dismiss button in the footer.
 * @returns {object} The form, its footer and the dismiss button.
 */
function build(rt, withDismiss = true) {
    const form = rt.createElement("form");
    form.classList.add("wx-webapp-restwizard");

    const body = rt.createElement("div");
    body.className = "modal-body";

    for (const title of ["Template", "Details"]) {
        const page = rt.createElement("div");
        page.className = "wx-wizard-page";
        page.setAttribute("data-title", title);
        body.appendChild(page);
    }

    const footer = rt.createElement("div");
    footer.className = "modal-footer";

    let dismiss = null;
    if (withDismiss) {
        dismiss = rt.createElement("button");
        dismiss.className = "btn btn-secondary";
        dismiss.setAttribute("data-wx-dismiss", "modal");
        footer.appendChild(dismiss);
    }

    form.appendChild(body);
    form.appendChild(footer);
    rt.document.body.appendChild(form);

    new rt.wxapp.RestWizardCtrl(form);

    return { form, footer, dismiss };
}

test("the wizard puts its primary action ahead of the dialog's dismiss button", () => {
    const rt = loadControl({ deps: DEPS, file: "webexpress.webapp.restwizard.js" });

    const { footer, dismiss } = build(rt);

    const children = footer.children;
    const at = (selector) => children.indexOf(footer.querySelector(selector));

    assert.ok(at(".wx-restwizard-next") >= 0, "the wizard added its next button to the dialog footer");
    assert.ok(at(".wx-restwizard-finish") >= 0, "the wizard added its finish button to the dialog footer");

    const dismissIndex = children.indexOf(dismiss);

    assert.ok(at(".wx-restwizard-next") < dismissIndex, "next comes before the dismiss button");
    assert.ok(at(".wx-restwizard-finish") < dismissIndex, "finish comes before the dismiss button");
    assert.equal(dismissIndex, children.length - 1, "the dismiss button is last");
});

test("the step navigation stays at the leading edge of the footer", () => {
    const rt = loadControl({ deps: DEPS, file: "webexpress.webapp.restwizard.js" });

    const { footer } = build(rt);

    assert.ok(
        footer.children[0].classList.contains("wx-restwizard-nav"),
        "back and the step counter lead the footer"
    );
});

test("a dialog without a dismiss button still receives the wizard buttons", () => {
    const rt = loadControl({ deps: DEPS, file: "webexpress.webapp.restwizard.js" });

    // insertBefore with no reference node appends, so a footer that carries no dismiss
    // button gets the navigation at its end rather than losing it
    const { footer } = build(rt, false);

    assert.ok(footer.querySelector(".wx-restwizard-next"), "the next button is still placed");
    assert.ok(footer.querySelector(".wx-restwizard-finish"), "the finish button is still placed");
});
