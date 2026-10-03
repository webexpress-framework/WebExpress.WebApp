# Headless tests for the View, State and Service engine

This folder holds the headless unit tests of the JavaScript control model of
WebExpress.WebApp. The engine modules live in
`WebExpress.WebApp/src/WebExpress.WebApp/Assets/js` - the service layer, the
renderer, the template registry, the intents, the `Data` base and the
`ViewState` - and are described in
`WebExpress/docs/view-state-service.md`, whose section 0 is
the entry point: the modules, the vocabulary and the migration state of the
controls.

The tests load the real, shipped modules through a Node `vm` context with a
minimal DOM stub, so they exercise the same files that the framework embeds,
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
pass summary and an exit code of zero. A single file runs with
`node --test <file>`, a single case with `--test-name-pattern="<part of its name>"`.

When node is not on the PATH, for example when it ships only with Visual Studio,
use the helper script, which locates node automatically:

```
./run.ps1
```

## Layout

Two harnesses load the code; every test file imports one of them.

| File                    | Purpose
|-------------------------|-----------------------------------------------------------------
| `harness.mjs`           | `loadEngine()`: the engine modules and, through `extraFiles`, a control and its model, in an isolated context with a minimal `Ctrl` base, an empty event map and a fetch the test supplies. `appendStateIsland`, `appendServiceIsland` and `appendResourceIsland` build the islands the C# `ControlViewState` emits. For a control whose base class lives in WebUI, a `bootstrap` stubs that base.
| `controls.harness.mjs`  | `loadControl()`: the real WebUI runtime (`webexpress.webui.js` and the base controls), the engine and one control with its `deps`, for a test that needs the real events, binds and actions rather than stubs.
| `dom-stub.mjs`, `controls.dom-stub.mjs`, `controls.dom-stub.svg.mjs` | The DOM stubs the two harnesses use. They report every layout dimension as zero and keep `dataset` and attributes apart; a behavioural hook is set with `setAttribute` and read with `getAttribute` (see the JavaScript testing section of `CLAUDE.md`).
| `controls.contract.mjs` | The shared contract every control test starts with: the control registers its selector and survives a construct / teardown cycle without a swallowed error.

The tests fall into three groups, told apart by their file names.

| Group                    | Files                        | What they pin
|--------------------------|------------------------------|-----------------------------------------------------------
| Engine                   | `engine.test.mjs`, `viewstate.test.mjs`, `viewstate.resources.test.mjs`, `viewstate.datachanged.test.mjs`, `bind.viewstate.test.mjs`, `bind.source.test.mjs`, `service.result.test.mjs` | The service result contract, retry, cancellation per channel and abort; the `ViewState` (patches, batching, slices, resources with their targets and tickets, the registry and its teardown); the intents; the `state` and `model` binds; the live update channel.
| Model helpers            | `<control>.model.test.mjs`   | The pure logic beside a control - normalisation, request shaping, response classification - and one end to end path through a service.
| Controls                 | `control.<name>.test.mjs`    | The control on the DOM stub: the contract above, and its behaviour where it is worth pinning - a ViewState-bound load, a re-query through the shared state, a refused change taken back and reported (`control.rejected-changes.test.mjs`).

A test that changes an `Assets/js` file's behaviour on purpose updates the
assertion and proves the assertion means something by running it against the
previous file once (`git show HEAD:<path> > <path>` keeps a copy first).

## Relationship to the .NET test suite

The .NET test `WebExpress.WebApp.Test/WebInclude/UnitTestEngineAssets` verifies
that the engine modules are embedded as resources and registered in the correct
load order through the `IncludeJavaScript` Asset attributes; the
`UnitTest<Control>ModelAsset` tests beside it do the same for the model files.
Those tests run in the normal xUnit suite and guard the build pipeline, and
`JsTest/UnitTestJavaScript` surfaces every `*.test.mjs` file of this folder as an
xUnit case, so the headless tests run with the suite as well. On their own they run
wherever Node is available, for example on a developer machine or in continuous
integration.

## AI transparency notice

Parts of this software, its documentation, and its assets were created with the assistance of AI-based tools, including large language models. AI-assisted contributions are reviewed by the project maintainer before they are included.
