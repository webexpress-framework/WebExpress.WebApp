![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# Architecture: the disjunctive normal form control family

This document records the decisions behind the DNF controls — why the family is
shaped the way it is, and which constraints a change has to respect. The API
surface is documented in
[WebUI/js/dnf.md](../../../WebExpress.WebUI/docs/js/dnf.md) and
[WebApp/js/dnf.md](../js/dnf.md).

## 1. The problem

Almost every non-trivial filter a user builds by hand has the same shape: *show
me the rows that match any of these combinations*. Written out, that is a
disjunction of conjunctions — a disjunctive normal form:

```
(A AND B) OR (C) OR (D AND E)
```

Every boolean expression can be brought into this form, so a DNF editor covers
the whole space of boolean filters while asking the user to understand only two
operators, and never a nesting depth greater than two. That bounded depth is the
reason the family exists at all: an arbitrary expression tree needs a tree
editor, and a tree editor is a specialist tool. A DNF needs a stack of lists.

## 2. The shape of the family

```
                       ControlFormInputValueDnf          the notation, in C#
                                  ▲
                                  │  parse / serialize / evaluate
                                  │
   ControlFormItemInputDnf ───────┴─────── ControlDnf         static (WebUI)
        wx-webui-input-dnf                 wx-webui-dnf
              ▲                                  ▲
              │ extends                          │ extends
              │                                  │
   ControlDataFormItemInputDnf            ControlDataDnf       REST (WebApp)
        wx-webapp-input-dnf                wx-webapp-dnf

   ControlTableTemplateDnf  /  ControlTableTemplateRestDnf     in a table
```

The JavaScript half mirrors it exactly: `webexpress.webui.DnfValue` carries the
notation, `InputDnfCtrl` and `DnfCtrl` implement the two states, and the WebApp
classes extend them.

Four states, one declaration. The read control and the input control take the
same options in the same shape, which is what lets the smart edit turn one into
the other without the page declaring the field twice.

## 3. Decision: the notation is one string, with `;` and `|`

A two-dimensional value has to reach a hidden form field, a table cell and a
`data-` attribute — all of which are single strings. The alternative, embedded
JSON, would have made every cell value a parse target and every form field a
JSON document.

```
a;b|c   ->   [["a","b"],["c"]]   ->   (a AND b) OR (c)
```

The separators were chosen so that **a one-group expression is byte for byte the
semicolon list every other selection control already speaks.** That is not
cosmetic: it means a plain selection value can be adopted by a DNF control
without conversion, a DNF value with one conjunction can be read by anything
that only understands selections, and a column can be migrated from `selection`
to `dnf` without touching the stored data.

**Constraint:** term ids may not contain `;` or `|`. The notation carries no
escaping. Ids are entity keys in practice, so this is a constraint rather than a
restriction — but it is the one invariant a caller can violate, and it is stated
in both public docs for that reason.

**Normalization is part of parsing**, not of the callers: a blank term, a term
repeated inside one conjunction (`A AND A` is `A`) and a conjunction that ended
up empty all describe nothing and are dropped. Both halves normalize identically,
which is what makes a round trip through a form value-preserving.
`UnitTestControlFormInputValueDnf` and `control.dnf.test.mjs` mirror each other
case for case to keep them from drifting.

## 4. Decision: a conjunction is an ordinary selection control

The picker is not reinvented. Each conjunction is a multi-select
`InputSelectionCtrl`, so filtering, icons, colors, chip rendering, keyboard
handling and the accessibility work all come for free and stay consistent with
every other selection field on the page.

What the DNF control owns is only what the selection cannot express:

- the list of conjunctions and their order,
- the operator rendering (the AND marker, the OR rule),
- the add and close affordances,
- the single value the whole thing submits.

### The group seam

`_createGroupControl(editor)` is the one method a variant replaces:

```javascript
_createGroupControl(editor) {
    return new webexpress.webui.InputSelectionCtrl(editor);   // WebUI
}
```

**Pitfall:** it is called from the base constructor, so an override runs before
its own class fields are initialized (JavaScript initializes subclass fields
after `super()` returns). State an override needs must be reachable through the
host element. `webexpress.webapp.InputDnfCtrl` stashes its service descriptor on
the element before calling `super()` for exactly this reason, and the seam
documents the constraint at the point where it bites.

## 5. Decision: one picker per conjunction, not one shared list

The REST variant gives every conjunction its own REST backed selection rather
than fetching once into a shared list.

**Why:** two conjunctions are searched independently. If the picker of group 1
filters for "ber", the list of group 2 must not change. A shared list cannot
express that; a picker per group gets it for free, along with lazy loading on
open, debounced server-side search and abort of superseded requests.

**Cost:** one request per conjunction on construction. This is the accepted
trade-off. It is mitigated rather than eliminated: a conjunction added *later*
is seeded from the terms already received, so its list is on screen before its
own request returns. Only the unfiltered answer seeds the cache — a filtered one
is the answer to one group's search and would seed the next group with a list
the user never asked it to show.

If the request count ever becomes the binding constraint, the fix is to make the
base REST selection's constructor-time fetch opt-in, not to collapse the groups
onto a shared list.

## 6. Decision: change events describe the expression, never a group

A write to any group is a change of a selection control, and every such write
reports itself. A host listening on the DNF control must hear **the one change
that happened to the expression**, not one event per group the control touched.

Two mechanisms enforce this:

- the group's own `CHANGE_VALUE_EVENT` is absorbed at the group it came from
  (`stopPropagation`) and answered with a change of the whole expression;
- a change that touches several groups runs inside `_batch`, which suspends the
  sync until the whole change is applied.

Building the control is not a change, and re-assigning an equal expression is
not a change. `control.input-dnf.test.mjs` pins all three cases; the batching
guard in particular is verified by a test that counts events across a two-group
rewrite, because a test that only counts values would pass without it.

## 7. Decision: the first conjunction is permanent

An expression is *made of* conjunctions, so the first one cannot be removed —
there would be nothing left to edit and no affordance to get back. Its close
icon empties it instead. Every further group's close icon removes the whole
conjunction. The icon's tooltip says which of the two it does, and is refreshed
whenever the group order changes.

## 8. Decision: the operators are nodes, the AND marker is conditional

In the read view the operator words are **real DOM nodes**, not CSS
pseudo-elements: they are then part of the accessible text and survive a copy of
the rendered expression. A pseudo-element would have looked identical and read as
nothing.

In the input the chips are rendered by the selection control, whose DOM the DNF
control does not own — so the conjunction is marked at the group frame instead,
as a legend. The marker is shown **only while the group actually holds more than
one term**, so it states a fact about the current expression rather than
decorating every group with an operator it does not use.

## 9. Decision: a term id always renders as something

A view whose options have not arrived renders the term ids themselves, and a
failed request leaves the expression standing rather than blanking it.

This is a correctness property, not a nicety: **a filter that renders as nothing
claims the rows are unfiltered.** That is the one thing it must never say
falsely. An unreadable filter still tells the reader that a filter is in effect.

## 10. Smart edit

`DnfCtrl` is the read view `SmartEditCtrl` builds for an `InputDnfCtrl`. The raw
value is the serialized expression — separators and term ids — which is exactly
what a reader of a filter should not be shown.

For the REST variant the terms arrive after the read view was first built, so
`webexpress.webapp.InputDnfCtrl` re-announces `DATA_ARRIVED_EVENT` on itself
when a group's unfiltered load completes. The smart edit already rebuilds its
read view on that event, so the display is not frozen as a snapshot taken before
the terms existed. This is also why the REST control's `options` getter answers
with the received terms rather than the (empty) declared ones — the read view
asks the control for the labels.

The control's hidden field carries the whole expression under the configured
name, so the smart edit drops the field it would otherwise reserve for the value
and the expression travels exactly once in the form data.

## 11. In a table

A cell is far narrower than the expression it may hold, so the read state clips
to one line by default and keeps the full expression in the `title`. The
alternative — letting it wrap — makes the row heights of a table depend on the
complexity of one cell.

Two templates, one decision:

| Template   | Terms travel                | Use when
|------------|-----------------------------|-------------------------------------------
| `dnf`      | embedded in the column      | a short, table specific term list
| `rest_dnf` | queried from an endpoint    | a term set shared across rows, or large

`TableTemplates.dnfOptions` reads both the server rendered form (the template's
child elements) and the REST rendered form (embedded JSON), so the two templates
differ only in where the terms come from. A malformed option list costs the
labels, not the expression.

## 12. Testing

| Layer                | Where
|----------------------|--------------------------------------------------------
| Notation (C#)        | `UnitTestControlFormInputValueDnf`
| Notation (JS)        | `control.dnf.test.mjs`
| Rendering (C#)       | `UnitTestControlFormItemInputDnf`, `UnitTestControlDnf`, `UnitTestControlTableTemplateDnf`
| Rendering (REST, C#) | `UnitTestControlDataFormItemInputDnf`, `UnitTestControlDataDnf`
| Wire contract        | `UnitTestRestApiTableColumnTemplate.Dnf` / `.RestDnf`
| Behaviour (JS)       | `control.input-dnf.test.mjs` (WebUI and WebApp)

The C# and JavaScript notation tests mirror each other case for case. That
duplication is intentional: the notation is the contract between the two halves,
and a divergence there silently rewrites a user's filter on the way through a
form.
