using System;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Renders the host element for a threaded comment surface. The control
    /// only emits the placeholder div; the actual toolbar, list and composer
    /// are built by the client-side <c>webexpress.webapp.CommentCtrl</c>,
    /// which talks to the configured REST endpoint to load, post, edit,
    /// delete, like, pin and reply to comments.
    /// </summary>
    public class ControlRestComment : Control
    {
        /// <summary>
        /// Gets or sets the REST URI that backs this comment surface. The
        /// JS controller issues
        /// <c>GET/POST {Uri}</c>,
        /// <c>PUT/DELETE {Uri}/{id}</c>,
        /// <c>POST {Uri}/{id}/reactions</c>,
        /// <c>POST {Uri}/{id}/likes</c>,
        /// <c>POST {Uri}/{id}/pin</c> and
        /// <c>POST {Uri}/{id}/replies</c>.
        /// </summary>
        public Func<IRenderControlContext, IUri> RestUri { get; set; }

        /// <summary>
        /// Gets or sets the URI used to resolve user records referenced by
        /// authors, likes, reactions and replies. The JS controller calls
        /// <c>{UsersUri}?ids=u1,u2,…</c> to warm its user cache.
        /// </summary>
        public Func<IRenderControlContext, IUri> UsersUri { get; set; }

        /// <summary>
        /// Gets or sets the id of the currently signed-in user. It is used
        /// to highlight the user's own comments, reactions and likes.
        /// </summary>
        public Func<IRenderControlContext, string> CurrentUser { get; set; }

        /// <summary>
        /// Gets or sets the URI of an upload endpoint that the embedded
        /// rich-text editor can post images to.
        /// </summary>
        public Func<IRenderControlContext, IUri> ImageUploadUri { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the surface is read-only.
        /// When <see langword="true"/>, the composer and inline actions
        /// (reply, like, edit, delete, react) are suppressed.
        /// </summary>
        public Func<IRenderControlContext, bool> Readonly { get; set; }

        /// <summary>
        /// Gets or sets an optional JSON string overriding the default
        /// category palette. The JSON must match the
        /// <c>webexpress.webapp.CommentCtrl.CATEGORIES</c> shape.
        /// </summary>
        public Func<IRenderControlContext, string> Categories { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">Optional host element id.</param>
        public ControlRestComment(string id = null)
            : base(id)
        {
        }

        /// <summary>
        /// Converts the control to its HTML representation.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>The rendered HTML node.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var enable = Enable?.Invoke(renderContext) ?? true;
            if (!enable)
            {
                return null;
            }

            var restUri = RestUri?.Invoke(renderContext)?.BindParameters(renderContext.Request);
            var usersUri = UsersUri?.Invoke(renderContext)?.BindParameters(renderContext.Request);
            var imageUploadUri = ImageUploadUri?.Invoke(renderContext)?.BindParameters(renderContext.Request);
            var readOnly = Readonly?.Invoke(renderContext) ?? false;

            return new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-comment", GetClasses()),
                Style = GetStyles(),
                Role = Role?.Invoke(renderContext)
            }
                .AddUserAttribute("data-uri", restUri?.ToString())
                .AddUserAttribute("data-users-uri", usersUri?.ToString())
                .AddUserAttribute("data-current-user", CurrentUser?.Invoke(renderContext))
                .AddUserAttribute("data-image-upload-uri", imageUploadUri?.ToString())
                .AddUserAttribute("data-readonly", readOnly ? "true" : null)
                .AddUserAttribute("data-categories", Categories?.Invoke(renderContext));
        }
    }
}
