# RestFormCtrl

`RestFormCtrl` is a controller that modernizes a traditional HTML form by replacing standard submit behavior with an asynchronous JSON request. It offers client-side validation, inline validation messages, and integrates with the `webexpress` event system. Additionally, the form can be initially populated with data from an API.

Decoupling form presentation from data processing provides significant advantages over classic server-side form submits:

- **Single-Page Application (SPA) Feeling:** The page does not need to reload upon submission. The user retains context, scroll position, and focus.
- **Structured Data:** Data is sent as a typed JSON object. This facilitates backend processing compared to `x-www-form-urlencoded` and enables complex, nested structures.
- **Precise Feedback:** Validation errors from the server can be mapped exactly to the affected fields without re-rendering the form.
- **Status Feedback:** Events allow easy visualization of loading states (e.g., "Saving...") while the form is locked to prevent duplicate entries.

## Data Population Strategies

The controller supports two ways to load data into the form. These can also be combined (hybrid approach).

1.  **Server-Side Rendering (Recommended for Initial Load):** The most performant method is to deliver the HTML form already populated from the server. Here, the template engine sets the `value` attributes of inputs and the `checked` status of checkboxes directly in the HTML.
2.  **Population via REST API (Client-Side):** Using the `data-api` attribute, the controller can be instructed to execute a GET request after initialization to retrieve the data.

## Declarative Configuration

The behavior of REST-based forms is defined entirely through declarative configuration using `data-*` attributes on the `<form>` element. By attaching the class `wx-webapp-restform`, the controller automatically interprets these attributes to determine how the form should load, validate, submit, and handle errors. This approach minimizes the need for custom JavaScript and ensures a consistent, predictable workflow across different forms. The following table outlines the available attributes and their specific roles in controlling form functionality.

| Attribute                 | Description
|---------------------------|--------------------------------------------------------------------------------------
| `data-api`                | URL of the endpoint to which data is sent. If not set, `action` is used.
| `data-method`             | HTTP method for submission. Overrides the form's `method` attribute.
| `data-json`               | Determines whether data is sent as JSON (`true`) or `x-www-form-urlencoded` (`false`).
| `data-validate-on-submit` | Enables client-side validation before sending.
| `data-show-inline-errors` | Displays error messages directly below the affected fields.
| `data-mode`               | Force `new`, `edit` or `delete`
| `data-id`                 | Primary key for Edit/Delete; appended as query parameter.

## Functionality and Behavior

The form controller manages the complete lifecycle of user interactions, from initialization to error handling. Its behavior ensures that forms are consistently prepared, validated, and submitted in a reliable way, while providing meaningful feedback to users. The following points outline the core aspects of how the controller operates, including setup, validation, submission flow, and error management.

- **Initialization & Hydration**
  - Upon loading, a container for global error messages (`.restform-error-container`) is created if it does not yet exist.
  - The controller retrieves the data and automatically populates the form fields.

- **Validation**
  - The controller uses the native HTML5 validation API (`required`, `pattern`, `min`/`max`, `type="email"`, etc.).
  - In case of errors, submission is prevented, the first invalid field is focused, and an error message is displayed.
  - Specific validations for email patterns are additionally checked to compensate for browser inconsistencies.

- **Submission**
  - The browser's standard submit is prevented.
  - All form fields (except `type="file"`) are serialized into a JSON object.
  - Checkbox groups and multi-selects are correctly processed as arrays or booleans.
  - During the submission process, the form is locked (`disabled`) and receives the CSS class `.restform-submitting`.

- **Error Handling**
  - **Client-side:** Inline error messages are displayed directly at the field (`aria-invalid="true"`).
  - **Server-side:** If the server responds with status `400` and a JSON object `{ errors: { fieldName: "Message" } }`, these errors are assigned to the corresponding fields.
  - **Global:** Other errors (network, Server 500) are displayed in a global alert box above the form.

## Programmatic Control

The instance can be retrieved to manually control the form or register external hooks.

### Accessing an Automatically Created Instance

For forms declared in HTML, the associated RestFormCtrl instance is retrieved via the `getInstanceByElement(element)` method of the central `webexpress.webui.Controller`.

```javascript
// find the host form element in the DOM
const formEl = document.getElementById('my-form');

// retrieve the RestFormCtrl instance associated with the element
const restForm = webexpress.webui.Controller.getInstanceByElement(formEl);

// change options and register hooks programmatically
if (restForm) {
    // set onSuccess hook to run after a successful submit
    // note: hooks run inside try/catch in the controller; avoid throwing here
    restForm.options.onSuccess = function(json, response) {
        // navigate or show a notification
        window.location.href = '/success';
    };

    // add a beforeSend hook to mutate or cancel the payload
    restForm.options.beforeSend = function(payload, element) {
        // attach a timestamp and return the modified payload
        payload.ts = Date.now();
        return payload; // return false to cancel submit
    };

    // trigger validation manually
    const valid = restForm.validate();
    if (valid) {
        // submit programmatically
        restForm.submit();
    }

    // clear visible errors
    restForm.clear();
}
```

### Manual Instantiation

A RestFormCtrl can also be created entirely programmatically and attached to a host element. This is useful for dynamic UI scenarios.

```javascript
// find or create a container element for the form
const container = document.getElementById('dynamic-form-container');

// create a form element and append it to the container
const form = document.createElement('form');
form.className = 'wx-webapp-restform';
form.setAttribute('data-api', '/api/items');
container.appendChild(form);

// instantiate RestFormCtrl manually for the newly created form
const dynamicRestForm = new webexpress.webapp.RestFormCtrl(form);

// set hooks and call methods as needed
if (dynamicRestForm) {
    dynamicRestForm.options.onSuccess = function(json, response) {
        // show a confirmation or update UI
        console.log('saved', json);
    };

    // optionally prefill and then submit
    dynamicRestForm.load().then(function() {
        // submit after load completes if desired
        dynamicRestForm.submit();
    }).catch(function(e) {
        // handle load errors
        console.error(e);
    });
}
```

## Accessibility

To ensure that forms are usable and inclusive for all users, accessibility features are integrated directly into the interaction flow. These measures help screen readers, assistive technologies, and keyboard navigation provide clear feedback and maintain a consistent user experience. The following points outline how error handling, status management, and focus control are implemented to meet accessibility standards.

- **Error Messages:**
  - Invalid fields receive the attribute `aria-invalid="true"`.
  - The error message is linked to the input field via `aria-describedby`.
- **Status:**
  - During loading or submission, all interactive elements are disabled to prevent inconsistent states.
- **Focus Management:**
  - In the event of validation errors, focus is automatically set to the first affected field.

## Events

The form controller communicates its internal lifecycle through a series of dispatched webexpress.webui.Event types. These events provide hooks for developers to monitor and react to key stages such as data requests, asynchronous operations, successful submissions, or error handling. Each event constant is triggered at a specific point in the process and carries a detailed payload that can be used for logging, UI updates, or custom logic. The following table summarizes the available events, their triggers, and the associated payload structure.

| Event Constant         | Trigger                           | Detail Payload
|------------------------|-----------------------------------|------------------------------------
| `DATA_REQUESTED_EVENT` | Start of load/submit.             | `{ type: "load"|"submit", url }`
| `TASK_START_EVENT`     | Async start.                      | `{ name: "loading"|"submitting" }`
| `TASK_FINISH_EVENT`    | Async end.                        | `{ name: "loading"|"submitting" }`
| `DATA_ARRIVED_EVENT`   | Data received.                    | `{ data, status, type: "load"|"submit" }`
| `CHANGE_VALUE_EVENT`   | Form populated (load).            | `{ source: "load", data }`
| `UPLOAD_SUCCESS_EVENT` | Submit succeeded (2xx).           | `{ response, status, form }`
| `UPLOAD_ERROR_EVENT`   | Error (network, validation, 5xx). | `{ error|response, type: "validation"|undefined }` 

## Examples

The following examples illustrate how to use REST-based forms within a web application. They show different scenarios, such as automatically loading and updating user profile data with the PUT method, or handling deletion requests with a static confirmation message.

**Form with Automatic Loading and PUT Method:**

This example demonstrates a form that automatically loads the current profile data and submits updates to the API using the PUT method. It is ideal for edit functions such as updating user information. In addition to validating the username, the user can also manage newsletter subscription preferences. Errors are displayed in a dedicated container, and changes are saved via a clearly marked button.

```html
<form id="profile-edit"
      class="wx-webapp-restform"
      data-api="/api/profile"
      data-method="PUT">
  <div class="restform-error-container"></div>
  <div class="mb-3">
    <label for="username">Username</label>
    <input type="text" name="username" class="form-control" required minlength="3">
  </div>
  <div class="form-check">
    <input class="form-check-input" type="checkbox" name="newsletter" id="newsletter">
    <label class="form-check-label" for="newsletter">Subscribe to newsletter</label>
  </div>
  <button type="submit" class="btn btn-success">Save</button>
</form>
```

**Delete form without data load (static notice only, with `<confirm>`):**

The second example illustrates a delete form that does not require loading data beforehand. Instead, a static confirmation message is shown through the <confirm> element once the action has been successfully completed. Before deletion, the user is prompted with a clear confirmation question and can proceed deliberately using the red Delete button.

```html
<form id="user-delete"
      class="wx-webapp-restform"
      data-api="/api/users"
      data-mode="delete"
      data-id="42">
  <confirm>
    <div class="alert alert-success">User was successfully deleted.</div>
  </confirm>
  <p>Do you really want to delete this user?</p>
  <button type="submit" class="btn btn-danger">Delete</button>
</form>
```