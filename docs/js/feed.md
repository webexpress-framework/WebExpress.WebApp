![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# FeedCtrl

The `FeedCtrl` component renders **entries stacked one under the other, newest first**, with a **button under them that fetches the next page and appends it**. Each entry carries a heading, a quiet line of context under it, the text itself, and — beside the text — the pictures the entry brought with it. More than one picture turns that column into a **slideshow**. At the foot of an entry sit its **tags** on one side and its **figures** (likes, replies, reads) on the other.

It is the counterpart of the `ListCtrl` for content that is **read** rather than scanned. A list pages: it replaces its rows and the reader walks pages, which suits a working set somebody looks something up in. A feed grows: what has been read stays on the page and more is added under it, which suits a stream somebody reads down — posts, announcements, activity. The difference is one of reading, not of rendering, which is why it is a control of its own rather than a mode of the list.

```
   ┌────────────────────────────────────────────────────────────────┐
   │  Maintenance Window                                            │  ← title, links to the entry
   │  04.09.2026 · Admin User                                       │  ← meta
   │  ┌─────────┐  The ticket system will be unavailable Saturday   │
   │  │ ▓▓▓▓▓▓▓ │  night for database maintenance. Lorem ipsum…     │  ← text
   │  │ ▓ img ▓ │  → more                                           │
   │  │ ▓▓▓▓▓▓▓ │                                                   │
   │  │ · ● ·   │                                                   │  ← slideshow dots
   │  └─────────┘                                                   │
   │  ┌─────────┐ ┌───────────┐                    6 👍     0 💬   │  ← tags / figures
   │  │ Backend │ │ Frontend  │                                     │
   │  └─────────┘ └───────────┘                                     │
   ├────────────────────────────────────────────────────────────────┤
   │  New VPN Portal                                                │
   │  …                                                             │
   └────────────────────────────────────────────────────────────────┘
                        [  Show more  ]                                ← hidden on the last page
```

## Declarative Configuration

The control is bootstrapped from a single host element carrying the `wx-webapp-feed` CSS class. It reads its configuration from `data-` attributes on that element and from the `wx-service` island, then builds its own contents: the list of entries, the placeholder shown while there are none, and the button.

The **first page is fetched, not rendered on the server**. Rendering the first page in C# and every page after it on the client would mean two implementations of an entry, which is the arrangement that drifts.

The boot class is consumed at initialization — the controller registry removes the class it instantiated the control by — so the control re-adds **`wx-feed`**, which is the hook the stylesheet is written against.

### Container Element Attributes

|Attribute         |Description                                                                                                                   | Example
|------------------|------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------
|`data-page-size`  |How many entries a page holds, and therefore how many are shown before the reader asks for more. Defaults to `5`.              | `data-page-size="5"`
|`data-more-label` |Caption of the button that fetches the next page. Falls back to `webexpress.webapp:feed.more`.                                 | `data-more-label="Show more"`
|`data-empty-text` |Text shown in place of the entries when the feed is empty. Falls back to `webexpress.webapp:feed.empty`.                       | `data-empty-text="Nothing here yet."`
|`data-open-label` |Caption of the link each entry carries to what it stands for. Entries without an address carry none.                           | `data-open-label="more"`

The column is inset from the edges it runs between — `padding` left and right — but not from what is above or below it: the page already spaces the feed vertically, and adding to that would push the first entry away from the heading it belongs to.

### REST Contract

One endpoint, one page per request. It reads the same paging parameters as the list family and answers the same envelope, so nothing about *fetching* a page differs between the two.

|Method |URL                        |Response     |Purpose
|-------|---------------------------|-------------|-------------------------------------
|`GET`  |`{service}?p={n}&l={size}` |`FeedResult` |One page of entries, newest first.

```json
{
  "title": "Blogs",
  "items": [
    {
      "id": "043fcdb1-…",
      "title": "Maintenance Window",
      "meta": "04.09.2026 · Admin User",
      "text": "The ticket system will be unavailable …",
      "icon": null,
      "images": ["/assets/img/teaser.svg", "data:image/svg+xml;base64,…"],
      "uri": "/blog/SD-45000",
      "tags": ["Backend", "Frontend"],
      "read": false,
      "metrics": [
        {
          "icon": "wx-icon-light wx-icon-light-thumbs-up",
          "value": "6",
          "label": "Likes",
          "uri": "/api/1/objects/like",
          "payload": "{\"object\":\"SD-45000\"}",
          "active": false
        },
        { "icon": "wx-icon-light wx-icon-light-comment", "value": "0", "label": "Comments" }
      ]
    }
  ],
  "pagination": { "page": 0, "pageSize": 5, "total": 20, "totalPages": 4 }
}
```

`text` is rendered through `webexpress.webui.ContentFormat`, the same reading view the rest of the product uses, so an entry may carry rich text and it arrives without its editing scaffolding. How much of it is sent is the **endpoint's** decision — a teaser is cut on the server, where the whole text is.

The server side is provided by the abstract `WebExpress.WebApp.WebRestApi.RestApiFeed<TIndexItem>` base class: derive from it and implement `RetrieveItems`, optionally `RetrieveTotal`, `CreateContext` and the `Filter` overloads.

### Knowing when to stop

`RetrieveTotal` matters more here than it does for a list. A pager without a total offers one page and merely looks short; a feed without one cannot know whether anything is left. The control therefore reads the total when it is there and hides the button as soon as it has shown that many entries; where the endpoint does not count, it keeps offering "more" until a page comes back **shorter than it asked for**. Counting the result gives the reader a button that disappears exactly when it should.

## Read and unread

`read` has **three** states, and that is the point of it. `false` marks the entry as new to this
reader — a dot before the heading and a heavier heading; `true` leaves it undecorated; and `null`,
which is what an endpoint that does not track reading leaves it as, means the control draws no
distinction at all. Two states would force such an endpoint to call every entry either read or
new, and the marker would then say nothing.

Only the unread are marked. Somebody following a stream wants to see what is new to them, and
decorating everything they have already read would mark the whole page.

## Figures the reader can join

A figure with a `uri` becomes a button. Clicking it `POST`s `payload` to that address and expects
back the new state of the figure:

```json
{ "value": "7", "active": true }
```

The count comes **from the server** rather than being counted up in the browser: two readers
clicking at once would otherwise each see their own click and neither the other's, and the number
would drift from the one the next page load shows. The endpoint therefore *toggles* — it is called
by a control that is showing the current state to somebody who just clicked it.

`active` is what the figure is drawn as, not merely what it says: an active figure is coloured and
carries `aria-pressed`. A figure without a `uri` stays a figure, and an endpoint that wants to show
a count to a reader who may not act on it — nobody signed in, no permission — simply leaves the
address out rather than offering a click that can only fail.

The control emits `webexpress.webui.Event.CHANGE_VALUE_EVENT` after a successful toggle, with
`{ metric, active }`.

## Slideshow

An entry with several pictures gets a slideshow rather than only its first picture: an entry that has several has them for a reason, and showing one would be choosing on the author's behalf.

The markup is the framework's own carousel — the same Bootstrap contract `ControlCarousel` emits server-side — so a feed slideshow and a carousel authored in C# look and behave alike. Because entries are built after the page was parsed, the element is **handed** to `bootstrap.Carousel` rather than left to be discovered. Where Bootstrap is absent the controls still work: they fall back to moving the active slide themselves.

The controls and the indicator dots appear on hover or focus only, so a column of teasers is not a column of blinking arrows.

## Programmatic Control

Once initialized, the `FeedCtrl` instance is retrievable via `getInstanceByElement(element)`.

```javascript
// find the host element in the DOM; the wx-webapp-feed boot selector is
// consumed at initialization, wx-feed is the hook the control re-adds
const feedElement = document.querySelector(".wx-feed");

// retrieve the controller instance associated with the element
const feedCtrl = webexpress.webui.Controller.getInstanceByElement(feedElement);
```

## Events

The component dispatches an event on the host element after **every** page, the first one included. It bubbles.

- **`webexpress.webui.Event.DATA_ARRIVED_EVENT`** — fired once a page has been appended. `event.detail` contains `{ response, page }`, where `page` is the zero-based number of the page that just arrived.

```javascript
feedElement.addEventListener(webexpress.webui.Event.DATA_ARRIVED_EVENT, (e) => {
    console.log("page", e.detail.page, "of the feed arrived");
});
```

## Failure

A page that could not be fetched leaves what is already read on the screen and the button in place, so asking again is the whole recovery. Nothing is torn down and no placeholder replaces the entries — a stream that emptied itself because the fifth page failed would lose the reader their place.
