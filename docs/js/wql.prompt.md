![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# WqlPromptCtrl

`webexpress.webapp.WqlPromptCtrl` is the editing surface for WebExpress Query Language (WQL)
expressions. The C# `ControlDataWqlPrompt` renders its host; the client control provides syntax
highlighting, server-driven completion, submit-time validation and a shell-like query history.

A DOM-independent text model owns the text and the selection. Everything else — the highlighted
surface, tokens, suggestions, diagnostics, the form field — is derived from it and never writes
back into it. Incomplete or invalid WQL (an open string, a missing operand, a dangling `and`) is an
ordinary editing state and is kept exactly as typed.

## Usage

```html
<div id="issue-query" class="wx-webapp-wql-prompt" name="query">
    <wx-service hidden name="data" kind="rest" base-uri="/api/issues/wql" method="GET"></wx-service>
</div>
```

```javascript
const prompt = webexpress.webui.Controller.getInstanceByElement(document.getElementById("issue-query"));
prompt.value = "State = 'open'";        // programmatic: no event, clears the undo stack
const query = prompt.value;              // the normalized WQL text
```

Without the service island the prompt is a highlighting editor only (no suggestions, history or
validation). Submitting (Enter) dispatches `webexpress.webui.Event.CHANGE_FILTER_EVENT` with
`detail.value` set to the trimmed query.

## Architecture

| Part | File | Responsibility |
|------|------|----------------|
| `WqlPromptModel` | `webexpress.webapp.wql.prompt.model.js` | the text, the selection (`anchor`/`focus`), the schema version and the text revision; range replacement and the operations built on it; frozen snapshots; JSON import/export. No DOM |
| `WqlPromptUndo` | `webexpress.webapp.wql.prompt.model.js` | the undo and redo stacks of editing transactions (snapshot before and after), with typing groups. No DOM |
| `WqlPromptView` | `webexpress.webapp.wql.prompt.view.js` | renders a model state with syntax highlighting, maps DOM boundaries, target ranges and drop points to model positions, shows and reads the selection, publishes the suggestions as a listbox. Holds no text |
| `WqlPromptCtrl` | `webexpress.webapp.wql.prompt.js` | turns browser input into model operations, records them as transactions, derives rendering, form field, analysis and hints from the model, and keeps the public interface |
| highlighter | `syntax/wql.js` | WQL tokens to escaped markup, one `.wx-code-line` per line |

The scripts load in this order (model, view, control); `IncludeJavaScript` declares them so.

Every content change runs through one path, `_edit(kind, operation)`: the operation changes the
model, a text change is recorded for undo, invalidates pending analysis and validation, updates
the form field and re-renders; a selection-only change moves the caret and drops stale suggestions.
A programmatic value (`value`, ViewState, form reset) goes through `_setText` instead, which
replaces the text and clears the undo stack.

## Text model

State, as `model.state` (frozen) or `model.toJSON()`:

```json
{ "version": 1, "text": "State = 'open'\norder by Id", "selection": { "anchor": 15, "focus": 8 }, "revision": 3 }
```

* **Positions** count UTF-16 code units — the unit of JavaScript strings and of the C# offsets the
  service reports. A position inside a surrogate pair moves to the start of the pair; a replaced
  range widens over a pair instead of splitting it. Positions are clamped to the text.
* **Line breaks** are normalized (`\r\n`, `\r` → `\n`) only where text enters the model: setting,
  inserting and importing. Offsets sent to the server refer to the normalized text.
* **Operations**: `replace(from, to, text, selection?)` is the base; `insertText`,
  `insertLineBreak`, `delete(direction, unit)` (units `character`, `grapheme`, `word`, `line`; never
  splitting a surrogate pair) and `setText` build on it; `select(anchor, focus)` moves the selection.
  A content change updates text and selection together and increments the revision; a selection
  change or a replacement that leaves the text equal does not.
* **Snapshots**: `model.state` is frozen and shared until the next change. JSON is produced only by
  `export()`; `WqlPromptModel.parse()` validates an import (schema version, normalized text, mapped
  and clamped offsets). `import()` into a live model advances its own revision rather than adopting
  the stored one, so a pending request can never match again.
* `WqlPromptModel.diff(before, after, cursor)` finds the one range replacement between two texts by
  their common prefix and suffix; the cursor places an insertion among repeated characters.

## Browser input

| Source | Handling |
|--------|----------|
| `beforeinput` `insertText`, `insertLineBreak` | prevented, applied as a model replacement of the browser's target range (or the selection) |
| `beforeinput` `delete*` | prevented; the target range when given, otherwise `delete` with the unit of the input type |
| `beforeinput` `insertParagraph` | prevented, submits (Enter of a virtual keyboard) |
| `beforeinput` `format*`, `insertFromDrop` | prevented |
| `beforeinput` `historyUndo`, `historyRedo` | prevented, the prompt's own undo/redo |
| any other input | left to the browser, then taken over by `input`: the surface is read back and its difference to the model applied as one replacement |
| `compositionstart` … `compositionend` | the surface leads: no rendering, no completion, no analysis request; at the end the composed text becomes one edit |
| `paste` | plain text only (`text/plain`), line breaks normalized |
| `copy`, `cut` | the model text of the selection, free of caret placeholders |
| `dragstart`, `drop` | plain text inserted at the drop point; a drag inside the prompt moves its text unless Ctrl/Alt is held |
| `selectionchange` | taken into the model only when it differs, so restoring the selection after a render starts no new analysis |

## Undo and redo

* Every edit is a transaction holding the model snapshot before and after; undo and redo restore
  text and selection together. Up to 200 transactions are kept.
* Typing and deleting at a continuous position form one group. A group ends when the kind of edit
  changes, the selection moves (also away and back), the user pauses for more than one second, a
  blank or line break is typed (it belongs to the word it completes), or a query is submitted.
* A completion, a paste, a cut, a drop, the clear button and loading a submitted query from the
  query history (PageUp/PageDown) are transactions of their own. Undoing a loaded query also
  restores the place in the query history.
* Shortcuts: Ctrl+Z (Cmd+Z), Ctrl+Y, Ctrl+Shift+Z; Ctrl+Alt (AltGr) is left to typing. Undo is
  ignored during a composition.
* A programmatic value — `value`, a ViewState change, a form reset — clears the stacks.
* The editing history is separate from the history of submitted queries: undo never submits and
  never changes that list.

## Asynchronous processing

* Analysis is debounced (200 ms after an edit, 100 ms after a cursor move, at once after a
  completion or a loaded query). Each request carries the model's revision and cursor (the focus);
  a response is applied only while both are unchanged and its request was not aborted. A moved
  cursor therefore invalidates suggestions even for unchanged text.
* Validation on submit is tied to the revision as well: an edit or an undo while it runs discards
  its verdict, and a newer submission aborts the older one.
* The query history keeps its own version counter, because no edit changes it.
* `destroy()` aborts every request, clears every timer and removes every listener; nothing arriving
  later is applied.

## Compatibility baseline

Recorded from `webexpress.webapp.wql.prompt.js`, `ControlDataWqlPrompt`, `RestApiWqlPrompt<T>`,
`wql.prompt.test.mjs`, `control.wql-prompt.test.mjs` and the known consumers, before any change.
Every item listed here must keep working after the rework.

### Registration and construction

| Item | Contract |
|------|----------|
| Class | `webexpress.webapp.WqlPromptCtrl extends webexpress.webui.Ctrl` |
| Marker | `webexpress.webui.Controller.registerClass("wx-webapp-wql-prompt", …)` constructs every `.wx-webapp-wql-prompt` host |
| Manual construction | `new webexpress.webapp.WqlPromptCtrl(host)` on a host without the marker class (`SearchCtrl`, kanban settings dialog) |
| `destroy()` | idempotent; aborts analysis, validation and history requests, clears the debounce and history timers, removes every listener (including the `selectionchange` listener on `document`), cancels a pending ViewState registration and its subscription, then calls `super.destroy()` |

### Public properties

| Member | Contract |
|--------|----------|
| `value` (get) | the WQL text as a string; lines joined with `\n`, no editor placeholders (zero-width spaces), no trailing newline added by highlighting |
| `value` (set) | `null`/`undefined` become `""`, anything else is coerced with `String()`. Replaces the text, cancels pending analysis and validation, resets the validation status to `unchecked`, re-highlights and mirrors the text into the form field. Dispatches **no** event and does not touch the query history |

Members with an underscore that are reached from outside the control and therefore stay stable:
`_input` (the editable element; `SearchCtrl` focuses it), `_onClearInput()` (documented in
`WebExpress.WebUI/docs/js/wql.md` as the programmatic clear), `_clearBtn`, `_hint`, `_field`.
The JavaScript tests additionally drive many internals (`_submitInput`, `_navigateHistory`,
`_refreshContextAndSuggestions`, `_applySuggestion`, `_currentContext`, `_suggestions`, `_history`,
`_historyIndex`, `_validationStatus`, `_lastError`, …); these are test hooks, not public API.

### Host attributes and data islands

| Source | Use |
|--------|-----|
| `name` | makes the prompt a form field: the attribute moves from the host to a hidden `<input type="hidden" name="…">` appended to the host |
| `<wx-service name="data">` | the WQL service (`ServiceRegistry.fromElement(host).data`); its `baseUri`, headers and error mappings apply to every request. Without it the prompt runs standalone |
| `data-wx-model-query` / `data-wx-resource` | ViewState resource the prompt re-queries on submit (`data-wx-model-query` wins) |
| `data-wx-model` | dotted state path of the query, default `wql` (e.g. `query.wql`) |
| `data-wx-viewstate` | optional ViewState id |

`data-uri`, still mentioned in `WebExpress.WebUI/docs/js/wql.md`, is not read by the control.

### Rendered DOM

```
host.wx-wql (style position: relative)
├── div.form-group.mb-0
│   ├── div.input-group
│   │   ├── div.form-control.wx-wql-input.wx-code-line   (the editable surface)
│   │   └── button.btn.wx-wql-clear[type=button]           (<i> xmark icon)
│   └── small.form-text.text-muted.wx-wql-hint.mt-1        (hint / error line)
└── input[type=hidden][name]                               (only for a named prompt)
```

The editable surface carries `role="textbox"`, `aria-multiline="true"`, `aria-label`
(`wql.input.label`), `contenteditable="true"`, `spellcheck="false"`, `data-language="wql"`,
`data-placeholder` (`wql.placeholder`), inline `min-height: 2em` and `font-family: monospace`.
Its content is the HTML of `webexpress.webui.Syntax.get("wql")` (one `.wx-code-line` per line, an
empty line holds a zero-width space as caret target), or plain text when no highlighter is loaded.

State markers: `.is-invalid` on the surface, `data-validation` = `unchecked` | `valid` | `invalid`,
`aria-invalid` = `"true"` | `"false"`; the hint switches between `text-muted` and `text-danger`.
The clear button has `title` and `aria-label` (`wql.clear`).

### Events

| Direction | Event | Contract |
|-----------|-------|----------|
| out | `webexpress.webui.Event.CHANGE_FILTER_EVENT` on the host, `detail.value` = trimmed text | after a submit that is valid or unchecked, including the empty submit and the clear button (filter reset). Never for an invalid submit, never for a programmatic `value`, ViewState or form write |
| out | — | no `CHANGE_VALUE_EVENT`, no `input`/`change` on the hidden field |
| in | `click` on the clear button | clear + submit of the empty filter |
| in | `input`, `keydown`, `click`, `keyup` on the surface; `selectionchange` on `document` | editing, shortcuts, cursor tracking |

### Keyboard

| Key | Behavior |
|-----|----------|
| `Tab` | accepts the highlighted suggestion when suggestions and a context exist; otherwise default focus navigation |
| `Shift+Tab` | always default focus navigation |
| `Enter` | submits (also with Shift) |
| `Ctrl+Enter` | inserts one `\n`, replacing the selection |
| `ArrowUp` / `ArrowDown` | cycle suggestions while any are shown, otherwise default caret movement |
| `PageUp` / `PageDown` | previous / next submitted query; the unsent draft returns past the newest entry |
| `ArrowLeft/Right`, `Home`, `End` (keyup), click | invalidate suggestions for the old caret position and re-analyse |
| `Ctrl+Z` / `Ctrl+Y` | not handled: the browser's native history applies (and is disturbed by re-highlighting) |

### Form integration

* A named prompt keeps its hidden field in step on every input and every programmatic write.
* `RestFormCtrl._buildPayload` reads the hidden field (no controller is registered on the field
  itself, so its `value` is taken).
* `RestFormCtrl` loading data finds the field by name and assigns through
  `Controller.getClosestInstance(field).value = value`, i.e. into the prompt.
* Form `reset`: not handled. A hidden input is not reset natively, so the prompt keeps its text.

### ViewState

* Resolved through `ViewStateRegistry.whenReady(host, viewStateId, …)`; the registration is
  cancelled on `destroy()`.
* `watch(selector, apply)` on the model path; `apply` ignores a value `Object.is`-equal to the last
  one, assigns it through `value` (no event), moves the history cursor behind the newest entry and
  takes the value as the unsent draft. A removed path reads as `""`.
* A submit dispatches `viewstate/query` with `{ resource, patch: { page: 0, search: null, <path>: text } }`;
  nested paths are copied immutably, sibling keys survive.

### WQL service

| Request | Contract |
|---------|----------|
| `GET <baseUri>/analyze?wql=<text>&c=<cursor>` | live analysis, debounced 200 ms after input and 100 ms after a cursor move; also used for submit-time validation with the trimmed text and `c` = its length |
| `GET <baseUri>/history` | 200 ms after construction; up to 10 retries every 500 ms, then `wql.error.history.unavailable` |

Endpoint paths are appended to the base path; base query parameters survive, the hash is dropped.
Response fields consumed: `isValidSoFar`, `errorMessage`, `currentExpressionType`, `prefix`,
`attribute`, `quoted`, `suggestions`; history: `history[]` (non-empty strings, merged with local
submissions, browsed entry kept).

Asynchronous safety: separate version counters for analysis, submission and history; one
`AbortController` per kind; an analysis result is applied only while text and cursor are unchanged;
a validation result only while the submitted draft is unchanged; nothing is applied after `destroy()`.

Completion replaces `[tokenStart, tokenEnd)` of the analysed context: `prefix` anchors the start
when it matches the text before the cursor; the end extends over the token suffix
(`[\p{L}\p{M}\p{N}_.-]`), or for a quoted context to the closing quote, skipping a character after
`\`. Smart formatting: values are quoted unless already inside a literal, `(` after `in` opens a
quoted set, `,` and `)` take back the blank the previous value left, and a trailing blank is added
unless one follows.

### Standalone mode

Without a service island the prompt is a highlighting editor only: hint `wql.status.ready`, no
requests, submit dispatches `CHANGE_FILTER_EVENT` with status `unchecked`. Used in the kanban
settings dialog (`prompt.value` written and read) and in dialogs generally.

### Accessibility

Only the textbox semantics listed under *Rendered DOM*. The suggestion list is rendered as text in
the hint line; there is **no** combobox or listbox semantics (`role="combobox"`, `aria-expanded`,
`aria-controls`, `aria-activedescendant`) and the hint is not a live region.

### i18n keys

`wql.input.label`, `wql.placeholder`, `wql.clear`, `wql.status.initializing`, `wql.status.ready`,
`wql.status.sent`, `wql.status.unchecked`, `wql.status.cleared`, `wql.error.label`,
`wql.error.history.unavailable`, `wql.no.suggestions`, `wql.tab.label`, `wql.cursor.label`,
`wql.type.*`.

### Server side

`ControlDataWqlPrompt` renders `div.wx-webapp-wql-prompt[id]` with the optional `name` and the data
islands (`wx-service`, `wx-state`, template, ViewState resource/model/viewstate attributes).
`RestApiWqlPrompt<T>` serves `analyze` and `history` as described above.

## Deliberate changes against the baseline

Decided during the rework; everything else in the baseline stays as recorded.

| Area | Baseline | Now |
|------|----------|-----|
| Accessibility | `role="textbox"`, `aria-multiline="true"`, no suggestion semantics | ARIA 1.2 combobox: `role="combobox"`, `aria-autocomplete="list"`, `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls` pointing to a `ul.visually-hidden.wx-wql-suggestions[role=listbox]` with one `role="option"` per suggestion, `aria-activedescendant` following Tab/arrow selection. `aria-multiline` is dropped because a combobox does not support it. The listbox id is generated per instance, not derived from the host id. New i18n key `wql.suggestions.label`. The visible hint line is unchanged |
| Form reset | not handled | a `reset` of an enclosing form returns the prompt to its last programmatic value (`value`, ViewState, form load), without an event |
| Literal escapes | completion skipped a character after `\` | a doubled quote (`'O''Brien'`) is the escape, as in the server tokenizer; a completed value containing the literal's quote is written with that quote doubled |
| Highlighter (`syntax/wql.js`) | source text was inserted into the markup unescaped (`a <b` became an element; injected history or ViewState values were rendered as HTML) | text is escaped through `webexpress.webui.Syntax.escape`; string literals use the doubled-quote rule |
| Undo/redo | the browser's native history, disturbed by re-rendering | the prompt's own transactions (see *Undo and redo*); the native history is intercepted |
| Async versions | separate counters for analysis and submission | the model's text revision plus the cursor, together with the abort controllers |
| Copy / cut | the browser copied the surface, including caret placeholders | the model text of the selection is copied as plain text |

## Server offsets and line breaks

Checked against `RestApiWqlPrompt<T>`, `WqlParser<T>.Tokenize` and the WebCore parameter parsing:

* Token offsets are C# `string` indices, i.e. UTF-16 code units — the same unit as JavaScript
  string offsets. `c` and every returned offset therefore align without conversion.
* The query string is decoded exactly once (`HttpUtility.UrlDecode` in `Parameter`), which reverses
  `URLSearchParams` encoding (`+` for blanks, UTF-8 percent escapes). The server sees the string the
  client sent. A lone surrogate turns into U+FFFD on the way, which keeps the length and so the
  offsets.
* The tokenizer does not normalize line breaks; `\r` and `\n` are plain whitespace
  (`char.IsWhiteSpace`). Offsets refer to the exact string received. Because the model normalizes
  `\r\n` and `\r` to `\n` at its input boundaries and sends only its own text, every offset the
  server sees refers to the normalized text. No server change is needed.
* The server escapes a quote inside a literal by doubling it (`'O''Brien'`); `\` has no escape
  meaning. The client's completion and the highlighter follow the same rule (see above).

The server-side WQL API (`RestApiWqlPrompt<T>`, `ControlDataWqlPrompt`) is unchanged: it still
receives WQL text and a cursor position.

## Changed components

| Component | Change |
|-----------|--------|
| `Assets/js/webexpress.webapp.wql.prompt.model.js` | new: `WqlPromptModel`, `WqlPromptUndo` |
| `Assets/js/webexpress.webapp.wql.prompt.view.js` | new: `WqlPromptView` |
| `Assets/js/webexpress.webapp.wql.prompt.js` | text and selection through the model; `beforeinput`/`input`/composition/clipboard/drag handling; undo and redo; revision-based async checks; combobox semantics; form reset; doubled-quote escapes. The DOM-based text reading (`_getInputText`, `_setInputText`, `_highlightSyntax`, `_restoreCursor`, `_getCursorOffset`, `_lastSelection`) and the `click`/`keyup` cursor listeners are gone |
| `Assets/js/syntax/wql.js` | escapes the source text; doubled-quote string literals |
| `Assets/js/i18n/de.js`, `en.js` | `wql.suggestions.label` |
| `WebInclude/IncludeJavaScript.cs` | declares model and view before the control |

## Tests

| File | Covers |
|------|--------|
| `JsTest/wql.prompt.model.test.mjs` | the model and the undo stacks in a context without any DOM: positions, surrogate pairs, normalization, operations, revisions, snapshots, import/export, `diff`, grouping rules |
| `JsTest/wql.prompt.view.test.mjs` | the view alone: rendering, selection ownership and direction, position mapping, target ranges, drop points, listbox |
| `JsTest/wql.prompt.test.mjs` | the control: input paths, IME, clipboard, drag and drop, selection feedback, multiline and incomplete input, Unicode offsets, completion and escapes, undo/redo, form, ViewState, stale and late server responses, destroy |
| `JsTest/syntax.wql.test.mjs` | highlighting reads back as the source |
| `JsTest/control.wql-prompt.test.mjs`, `control.search.test.mjs` | registration and the embedding in `SearchCtrl` |

IME, clipboard, selection stability and undo were additionally checked in headless Chrome over the
DevTools protocol (real key events, `Input.imeSetComposition`, copy command) against the
`DataWqlPrompt` tutorial page.
