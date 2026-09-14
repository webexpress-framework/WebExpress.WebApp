/**
 * Guards that the login dialog of WebUI frames the REST login of the application
 * layer unchanged: the dialog only takes the submit button the mounted login hands
 * over, so the REST login - its service island, its error container, its rate
 * limiting - is the one that ends up inside the dialog. This is what lets an
 * application sign its users in through the session endpoint on top of the page
 * they are on.
 *
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";

// the dialog drives the bootstrap modal; headless it only has to exist


/**
 * Builds the host the REST login dialog renders: the dialog sections around a REST
 * login host carrying its service island.
 * @param {object} rt - The loaded runtime.
 * @returns {object} The dialog host and the login host inside it.
 */
function renderHost(rt) {
    const host = rt.createElement("dialog");
    host.id = "signin";
    host.classList.add("wx-webui-modal-login");

    const header = rt.createElement("div");
    header.classList.add("wx-modal-header");
    header.textContent = "Login";

    const content = rt.createElement("div");
    content.classList.add("wx-modal-content");

    const login = rt.createElement("div");
    login.id = "signin_login";
    login.classList.add("wx-webapp-login");

    const island = rt.document.createElement("wx-service");
    island.setAttribute("name", "data");
    island.setAttribute("kind", "rest");
    island.setAttribute("base-uri", "/api/session");
    island.setAttribute("method", "POST");
    login.appendChild(island);

    content.appendChild(login);

    const footer = rt.createElement("div");
    footer.classList.add("wx-modal-footer");

    host.appendChild(header);
    host.appendChild(content);
    host.appendChild(footer);
    rt.document.body.appendChild(host);

    return { host, login };
}

test("the login dialog frames the REST login with its service and its error container", () => {
    const rt = loadControl({ file: "webexpress.webapp.login.js" });
    const { host, login } = renderHost(rt);

    rt.wx.Controller.createInstances(host);
    const dialog = rt.wx.Controller.instanceMap.get(host);

    assert.ok(dialog instanceof rt.wx.ModalLoginCtrl);
    assert.ok(dialog.login instanceof rt.wxapp.LoginCtrl, "the REST login is what the dialog frames");
    assert.equal(dialog.login, rt.wx.Controller.getInstanceByElement(login));

    // what is the REST login's stays the REST login's
    assert.equal(dialog.login._apiEndpoint, "/api/session", "the session endpoint reached it through its island");
    assert.equal(dialog.login._errorContainer.parentNode, dialog.login._form, "its error container leads the form");
    assert.equal(dialog._bodyDiv.querySelector("form"), dialog.login._form, "and the form is the body of the dialog");

    // what the dialog lends: plain rendering and the submit button on the footer
    assert.ok(login.classList.contains("wx-login-plain"));
    assert.equal(dialog._bodyDiv.querySelector(".card"), null);

    const bar = dialog._footerDiv.children;
    assert.equal(bar[bar.length - 2], dialog.login._loginBtn, "the submit stands ahead of the close button");
    assert.equal(bar[bar.length - 1], dialog._cancelButton);
    assert.equal(dialog.login._loginBtn.getAttribute("form"), "signin_login-form", "the lifted button still submits the form");
});
