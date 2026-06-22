# Headless tests for the View, State and Service engine

This folder contains the headless unit tests for the phase zero engine of the
View, State and Service architecture. The engine modules live in
`src/WebExpress.WebUI/Assets/js` (store, service, renderer, intent and
component) and are described in
`WebExpress.WebApp/docs/architecture/view-state-service.md`.

The tests load the real, shipped engine modules through a Node `vm` context with
a minimal DOM stub, so they exercise the same files that the framework embeds,
not a copy.

## Requirements

Node 18 or newer. No npm packages are installed; the harness uses only the Node
standard library (`node:test`, `node:assert`, `node:vm`, `node:fs`). The Node
that ships with the Visual Studio "Node.js development" component works as well,
even though it is not added to the system PATH.

## Running

From this folder, when node is on the PATH:

```
node --test
```

Node discovers and runs every `*.test.mjs` file. The expected output ends with a
pass summary and an exit code of zero.

When node is not on the PATH, for example when it ships only with Visual Studio,
use the helper script, which locates node automatically:

```
./run.ps1
```

## Layout

| File                  | Purpose
|-----------------------|-----------------------------------------------------------------
| `harness.mjs`         | Loads the engine modules (and optional application modules) into an isolated context with host stubs.
| `dom-stub.mjs`        | A minimal DOM used by the renderer and the component tests.
| `engine.test.mjs`      | Unit tests for the store, the service, the renderer, the intents and the component.
| `list.model.test.mjs`  | Unit tests for the REST list model helpers (phase one), including an end to end path through a service.
| `table.model.test.mjs` | Unit tests for the REST table model helpers (phase two), including the query and the put update through a service.
| `restform.model.test.mjs` | Unit tests for the REST form model helpers (phase two): request shaping, response classification and error normalisation.
| `restwizard.model.test.mjs` | Unit tests for the REST wizard model helpers (phase two): step request shaping, cache decision and last step detection.
| `tab.model.test.mjs`   | Unit tests for the REST tab model helpers (phase two): the list, create, reorder and close operations through a service.
| `comment.model.test.mjs` | Unit tests for the REST comment model helpers (phase two): endpoint url and path building and category normalisation.
| `kanban.model.test.mjs` | Unit tests for the REST kanban model helpers (phase two): board normalisation and the load and persist operations through a service.
| `watcher.model.test.mjs` | Unit tests for the watcher model helpers: list normalisation, user search url, candidate filtering, removal helpers and the load, add and remove operations through a service.
| `scrum.backlog.model.test.mjs` | Unit tests for the scrum backlog model helpers: board and sprint normalisation, sprint and item paths, rank bodies, the group filter and sort, the rank rewrite, the active sprint crossing and the persist operations through a service.
| `tile.model.test.mjs`  | Unit tests for the REST tile model helpers: the page slice, the total reduction, the item to tile mapping and the load and persist operations through a service.
| `dashboard.model.test.mjs` | Unit tests for the REST dashboard model helpers: the column and widget normalisation and the load and persist operations through a service.
| `workflow.editor.model.test.mjs` | Unit tests for the workflow editor model helpers: the meta and catalog normalisation, the wire format read with its aliases and the wire payload build, plus the load and persist operations through a service.
| `comment.composer.model.test.mjs` | Unit tests for the comment composer model helpers: the categories url, the categories normalisation and the label parsing, plus the categories load and the comment post through a service.
| `input.unique.model.test.mjs` | Unit tests for the unique input model helpers: the header parsing, the request body shaping and the availability extraction with its field and status and code heuristics, plus a uniqueness check through the shared request.
| `selection.model.test.mjs` | Unit tests for the REST selection model helpers: the request url and init shaping and the response item mapping, plus a search through the shared request.
| `input.selection.model.test.mjs` | Unit tests for the REST input selection model helpers: the request url and init shaping and the item mapping with its data and aria tuples, plus a search through the shared request.
| `dropdown.theme.model.test.mjs` | Unit tests for the theme dropdown model helpers: the theme item mapping and the theme list normalisation, plus a themes load through the shared request.

## Relationship to the .NET test suite

The .NET test `WebExpress.WebUI.Test/WebInclude/UnitTestEngineAssets` verifies
that the engine modules are embedded as resources and registered in the correct
load order through the `IncludeJavaScript` Asset attributes. That test runs in
the normal xUnit suite and guards the build pipeline. The headless tests in this
folder guard the runtime behaviour of the engine and are intended to run wherever
Node is available, for example on a developer machine or in continuous
integration.
