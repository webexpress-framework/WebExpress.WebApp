![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# CommentCtrl

The `CommentCtrl` component renders a fully-featured discussion thread for a domain object: a filter/sort toolbar at the top, a list of comments in the middle, and a composer at the bottom. Each comment carries a typed **category** (color-coded), a free-form list of **labels**, **reactions** (emoji), **likes**, optional **pin** state, threaded **replies**, and per-item **edit / delete** actions for the author. The composer reuses the WebExpress `EditorCtrl`, so authors get the same WYSIWYG affordances they enjoy elsewhere — slash commands (`/`), mentions (`@`), markdown shortcuts (`**bold**`, `` `code` ``), and inline link/image insertion.

```
   ┌─────────────────────────────────────────────────────────────────┐
   │ Comments (6)                          2 pinned · 17 likes       │
   ├─────────────────────────────────────────────────────────────────┤
   │ [Filter ▼] [Sort: Date ▼] [↓ Desc]      📌 Pinned stay on top   │
   ├─────────────────────────────────────────────────────────────────┤
   │ ┌─────────────────────────────────────────────────────────────┐ │
   │ │ (MP) Max Power · IT Ops · 2026-05-12 09:18      ♥3 ★ ▾ ✎ 🗑 │ │
   │ │ [Status Update] [Triage] [P1]                 📌 Pinned     │ │
   │ │ ─────────────────────────────────────────────────────────── │ │
   │ │ Issue recorded and escalated to Network…                    │ │
   │ │ ─────────────────────────────────────────────────────────── │ │
   │ │ 👍 3   🙏 1   [+]                                           │ │
   │ │ ─────────────────────────────────────────────────────────── │ │
   │ │ ↳ Replies · 2 replies                                       │ │
   │ │   (EM) Erika Mustermann · 2026-05-12 09:25                  │ │
   │ │        Issue recorded and watchers added.                   │ │
   │ └─────────────────────────────────────────────────────────────┘ │
   │ … more comments …                                               │
   ├─────────────────────────────────────────────────────────────────┤
   │ (MP) Write a new comment                [General ▼]             │
   │ ┌─────────────────────────────────────────────────────────────┐ │
   │ │ [EditorCtrl — / for commands, @ for mentions]               │ │
   │ └─────────────────────────────────────────────────────────────┘ │
   │ [Labels…]              ⌘/Ctrl+Enter           [ Send ]          │
   └─────────────────────────────────────────────────────────────────┘
```

## Declarative Configuration

The control is bootstrapped from a single host element carrying the `wx-webapp-comment` CSS class. The control reads its configuration from `data-` attributes on that element, then rewrites the element's contents to render the toolbar, list, and composer.

### Container Element Attributes

| Attribute                | Description                                                                                                                                                                       | Example
|--------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------
| `data-uri`               | REST endpoint for the comment collection of the current object. Required.                                                                                                          | `data-uri="/api/comments/INC-00123"`
| `data-users-uri`         | REST endpoint used to resolve author IDs to display names and to power the `@`-mention picker inside the composer. Required for author resolution and mentions.                    | `data-users-uri="/api/users"`
| `data-current-user`      | ID of the currently authenticated user. Drives the "this is mine" visual treatment and gates the edit / delete affordances.                                                       | `data-current-user="u1"`
| `data-image-upload-uri`  | Optional. When set, the composer's WYSIWYG editor enables image uploads via this endpoint.                                                                                          | `data-image-upload-uri="/api/upload"`
| `data-readonly`          | When `"true"`, the composer is hidden and per-item actions (like, pin, reactions, replies, edit, delete) are disabled. The list is rendered for reading only.                       | `data-readonly="true"`
| `data-categories`        | Optional JSON string overriding the default category set. Each entry needs `id`, `i18n` (i18n key for the label), `color` (CSS color), and `bg` (CSS background).                   | see [Categories](#categories) below

### REST Contract

| Method   | URL                                              | Body                                                          | Response          | Purpose
|----------|--------------------------------------------------|---------------------------------------------------------------|-------------------|-----------------------------------------
| `GET`    | `{data-uri}`                                     | —                                                             | `Comment[]`       | Initial load and refresh.
| `POST`   | `{data-uri}`                                     | `{ body, category, labels }`                                  | `Comment`         | Add a new top-level comment.
| `PUT`    | `{data-uri}/{id}`                                | `{ body, category, labels }`                                  | `Comment`         | Edit an existing comment (author only).
| `DELETE` | `{data-uri}/{id}`                                | —                                                             | `204 No Content`  | Delete a comment (author only).
| `POST`   | `{data-uri}/{id}/likes`                          | `{ on: true \| false }`                                       | `Comment`         | Toggle the current user's like.
| `POST`   | `{data-uri}/{id}/pin`                            | `{ on: true \| false }`                                       | `Comment`         | Toggle pin state.
| `POST`   | `{data-uri}/{id}/reactions`                      | `{ emoji: "👍" }`                                              | `Comment`         | Toggle the current user's reaction for that emoji.
| `POST`   | `{data-uri}/{id}/replies`                        | `{ body }`                                                    | `Reply`           | Add a reply to a comment.
| `GET`    | `{data-users-uri}?ids=u1,u2,u3`                  | —                                                             | `User[]`          | Batch-resolve author IDs for rendering.
| `GET`    | `{data-users-uri}?q={search}`                    | —                                                             | `User[]`          | Search candidates for the `@`-mention picker inside the composer.

`Comment` objects are expected to carry `id`, `author`, `when`, `category`, `labels`, `body` (HTML), `pinned`, `likes` (array of user IDs), `reactions` (`{ "👍": ["u1","u2"], … }`), `edited` (`{ by, when }` or `null`), `collapsed`, and `replies` (`Reply[]`). `Reply` objects need `id`, `author`, `when`, and `body`. `User` objects need at least `id`, `name`, `initials`, `team`, and `color`.

### Categories

Each comment carries a category that drives its accent color and is offered as a filter in the toolbar. The default set covers `general`, `question`, `hint`, `status`, `decision`, and `solution`. The label text is resolved via i18n (`webexpress.webapp:comment.cat.general`, …); the colors are read from CSS variables (`--wx-webapp-cat-general`, `--wx-webapp-cat-general-bg`, …) so they can be re-themed without touching JavaScript.

To use a custom category set, pass a JSON array via `data-categories`:

```html
<div class="wx-webapp-comment"
     data-uri="/api/comments/CHG-00045"
     data-users-uri="/api/users"
     data-current-user="u1"
     data-categories='[
        {"id":"impl","i18n":"my.app:comment.cat.impl","color":"#1e40af","bg":"#dbeafe"},
        {"id":"risk","i18n":"my.app:comment.cat.risk","color":"#b45309","bg":"#fef3c7"},
        {"id":"signoff","i18n":"my.app:comment.cat.signoff","color":"#047857","bg":"#d1fae5"}
     ]'></div>
```

## Programmatic Control

Once initialized, the `CommentCtrl` instance is retrievable via `getInstanceByElement(element)` for refreshing, filtering, or attaching event listeners.

```javascript
// find the host element in the DOM
const cmtElement = document.querySelector(".wx-webapp-comment");

// retrieve the controller instance associated with the element
const cmtCtrl = webexpress.webui.Controller.getInstanceByElement(cmtElement);

// force a re-fetch from the server
if (cmtCtrl) {
    cmtCtrl.refresh();
}
```

## Events

The component dispatches events on the host element whenever the comment thread changes. All events bubble.

- **`webexpress.webapp.Event.COMMENT_ADDED_EVENT`** — fired after a successful `POST` to the collection. `event.detail` contains `{ comment }`.
- **`webexpress.webapp.Event.COMMENT_UPDATED_EVENT`** — fired after edit, like-toggle, or pin-toggle. `event.detail` contains `{ comment }`.
- **`webexpress.webapp.Event.COMMENT_DELETED_EVENT`** — fired after a successful `DELETE`. `event.detail` contains `{ id }`.
- **`webexpress.webapp.Event.COMMENT_REACTION_EVENT`** — fired after the current user toggles a reaction. `event.detail` contains `{ commentId, emoji, reactions }`.
- **`webexpress.webapp.Event.COMMENT_REPLY_EVENT`** — fired after a successful reply `POST`. `event.detail` contains `{ commentId, reply }`.

```javascript
cmtElement.addEventListener(webexpress.webapp.Event.COMMENT_ADDED_EVENT, (e) => {
    console.log("New comment by", e.detail.comment.author, ":", e.detail.comment.body);
});
```

## Composer

The composer is built around the WebExpress `EditorCtrl`. That means authors get every feature the editor offers out of the box:

- **Slash commands (`/`)** — insert headings, lists, code blocks, dates, horizontal rules, links, images, and addons.
- **Mentions (`@`)** — pick a user from the live picker fed by `data-users-uri`.
- **Markdown shortcuts** — `**bold**`, `` `code` ``, `# Heading`, `- item`, `1. item`, `> quote`, `---`.
- **Bubble menu** — appears on selection for quick formatting.
- **Placeholder text** — sourced from the i18n key `webexpress.webapp:comment.compose.placeholder`.

Press `⌘/Ctrl + Enter` to submit. The submit button is disabled while the editor is empty.

## Use Case Examples

A typical setup at the bottom of an object detail page:

```html
<section class="obj-section">
    <div class="obj-section__head">
        <h3>Kommentare</h3>
    </div>

    <!-- The comment control: bootstraps itself from data-* -->
    <div class="wx-webapp-comment"
         data-uri="/api/comments/INC-00123"
         data-users-uri="/api/users"
         data-current-user="u1"
         data-image-upload-uri="/api/upload"></div>
</section>
```

A read-only thread embedded in a historical / archived view:

```html
<div class="wx-webapp-comment"
     data-uri="/api/comments/INC-00123"
     data-users-uri="/api/users"
     data-readonly="true"></div>
```

A thread with a domain-specific category set (e.g. for change requests):

```html
<div class="wx-webapp-comment"
     data-uri="/api/comments/CHG-00045"
     data-users-uri="/api/users"
     data-current-user="u1"
     data-categories='[
        {"id":"impl","i18n":"my.app:comment.cat.impl","color":"var(--wx-webapp-cat-hint)","bg":"var(--wx-webapp-cat-hint-bg)"},
        {"id":"risk","i18n":"my.app:comment.cat.risk","color":"var(--wx-webapp-cat-question)","bg":"var(--wx-webapp-cat-question-bg)"},
        {"id":"signoff","i18n":"my.app:comment.cat.signoff","color":"var(--wx-webapp-cat-solution)","bg":"var(--wx-webapp-cat-solution-bg)"}
     ]'></div>
```