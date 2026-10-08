![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# LikeCtrl

The `LikeCtrl` component turns a like figure into something a reader can join. It backs the `ControlLike` server control: a count with an icon, which the reader can click to add or withdraw their own like.

```
   ┌───────────────────────────────┐
   │  Lorem ipsum dolor sit amet…  │
   │                               │
   │                     (7 👍)  3 💬 │
   └───────────────────────────────┘
        ▲            ▲
        │            └── a plain figure: a count with nothing to click
        └── a figure the reader can join: posts the toggle and repaints
```

## What the server renders

Unlike most components of this assembly, **the value is rendered by the server**, not fetched by the client. The page already knows the count, so asking for it a second time would cost a round trip and show a figure that flickers into place. The controller adds the one thing markup cannot express: posting the toggle.

```html
<button id="like_1" class="wx-webapp-like wx-webapp-like-action wx-webapp-like-mount"
        type="button"
        title="Likes" aria-label="Likes" aria-pressed="false"
        data-uri="/api/1/objects/like"
        data-payload="{&quot;object&quot;:&quot;SD-43011&quot;}">
  <span class="wx-webapp-like-value">7</span>
  <i class="wx-icon-light wx-icon-light-thumbs-up wx-webapp-like-icon" aria-hidden="true"></i>
</button>
```

A figure **without an address** renders as a `<span>` carrying only `wx-webapp-like` and gets no controller at all. That is the case for a reader who is not signed in — a like belongs to somebody — and offering the click only to answer `401` is worse than not offering it. The same control serves both, so a surface does not have to choose between two of them depending on who is looking.

## Container Element Attributes

| Attribute       | Description                                                                                 | Example
|-----------------|---------------------------------------------------------------------------------------------|------------------------------------
| `data-uri`      | Address the toggle is posted to. Without it the figure is not joinable and stays a `<span>`. | `data-uri="/api/1/objects/like"`
| `data-payload`  | JSON body naming what is being liked. Sent verbatim; the control does not interpret it. The html writer escapes the quotes, so the browser hands the controller the json back as it was written. | `Payload = _ => @"{""object"":""SD-1""}"`
| `aria-pressed`  | Whether the reader is among the count. Kept in step with `wx-webapp-like-active`.             | `aria-pressed="true"`

## REST Contract

| Method | URL        | Body                    | Response                          | Purpose
|--------|------------|-------------------------|-----------------------------------|-----------------------------
| `POST` | `{data-uri}` | `{data-payload}`      | `{ "value": "8", "active": true }` | Flip the caller's like and answer the new state.

The endpoint **toggles** rather than taking a state: the only caller is a figure showing the current state and a reader clicking it, and a caller that wanted to set a state would have to read one first and would then be racing anybody else clicking.

The count comes back from the server rather than being counted up in the browser. Two readers clicking at once would otherwise each see their own click and neither the other's, and the number would drift from the one the next page load shows.

A request that fails leaves the figure exactly as it was: the next page load shows the truth, and a count that moved without the server agreeing would be worse than one that did not move at all.

## Events

| Event                                    | Detail                  | Raised when
|------------------------------------------|-------------------------|--------------------------------
| `webexpress.webui.Event.CHANGE_VALUE_EVENT` | `{ value, active }`  | The figure has been repainted from an answer.

## Relationship to the feed

The feed builds the same figures under its entries (`FeedCtrl._buildMetric`, see [FeedCtrl](feed.md)) and speaks the same REST contract. The difference is where the figure comes from: a feed builds its items from JSON, while `ControlLike` is placed on a server-rendered view that already holds the record. `LikeCtrl` is that behaviour lifted out of the feed so any view can use it.

## Styling

| Class                     | Description
|---------------------------|-----------------------------------------------------------------
| `wx-webapp-like`          | The figure. Present on both the joinable and the plain form.
| `wx-webapp-like-action`   | The joinable form.
| `wx-webapp-like-active`   | The reader is among the count.
| `wx-webapp-like-value`    | The element holding the number, which the controller repaints.
| `wx-webapp-like-icon`     | The glyph beside the number.
| `wx-webapp-like-mount`    | Mount marker. **Not** a styling hook — see below.

The controller registers on `wx-webapp-like-mount`, not on one of the styling classes, because the framework's controller *consumes* the registered class when it instantiates a control (which is what stops a later DOM scan from wiring the same host twice). Keying the look off that class would therefore strip the figure of its styling the moment it was wired. Controls that build their whole DOM client-side add their styling classes in the constructor instead (see `SystemMetricCtrl`); this one cannot, because the server already rendered the finished figure and a look that arrived only once the script had run would flash into place.
