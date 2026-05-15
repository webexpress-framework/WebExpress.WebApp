using System;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Renders the host element for the minimalist new-comment composer.
    /// The control only emits a placeholder div; the actual collapsed
    /// trigger and expanded form (category select, WYSIWYG editor, labels
    /// input, send / cancel) are built by the client-side
    /// <c>webexpress.webapp.CommentComposerCtrl</c>, which POSTs the
    /// authored comment to the configured REST endpoint and dispatches a
    /// <c>COMMENT_ADDED_EVENT</c> so that any sibling
    /// <see cref="ControlRestComment"/> on the same page picks it up.
    /// </summary>
    public class ControlRestCommentComposer : Control
    {
        /// <summary>
        /// Gets or sets the REST URI the composer POSTs new comments to.
        /// The JS controller issues <c>POST {Uri}</c> with the payload
        /// <c>{ body, category, labels }</c>.
        /// </summary>
        public Func<IRenderControlContext, IUri> RestUri { get; set; }

        /// <summary>
        /// Gets or sets the URI used to resolve user records for mentions
        /// inside the rich-text editor.
        /// </summary>
        public Func<IRenderControlContext, IUri> UsersUri { get; set; }

        /// <summary>
        /// Gets or sets the id of the currently signed-in user. Forwarded
        /// to the JS controller so the dispatched <c>COMMENT_ADDED_EVENT</c>
        /// can be filtered per user.
        /// </summary>
        public Func<IRenderControlContext, string> CurrentUser { get; set; }

        /// <summary>
        /// Gets or sets the URI of an upload endpoint that the embedded
        /// rich-text editor can post images to.
        /// </summary>
        public Func<IRenderControlContext, IUri> ImageUploadUri { get; set; }

        /// <summary>
        /// Gets or sets the id of the category that is pre-selected when
        /// the composer is expanded. Defaults to <c>"general"</c> on the
        /// client side when not provided.
        /// </summary>
        public Func<IRenderControlContext, string> DefaultCategory { get; set; }

        /// <summary>
        /// Gets or sets the text shown in the collapsed single-line
        /// trigger. Defaults to a localized "Write a comment…" when not
        /// provided.
        /// </summary>
        public Func<IRenderControlContext, string> Placeholder { get; set; }

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
        public ControlRestCommentComposer(string id = null)
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

            return new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-comment-composer", GetClasses()),
                Style = GetStyles(),
                Role = Role?.Invoke(renderContext)
            }
                .AddUserAttribute("data-uri", restUri?.ToString())
                .AddUserAttribute("data-users-uri", usersUri?.ToString())
                .AddUserAttribute("data-current-user", CurrentUser?.Invoke(renderContext))
                .AddUserAttribute("data-image-upload-uri", imageUploadUri?.ToString())
                .AddUserAttribute("data-default-category", DefaultCategory?.Invoke(renderContext))
                .AddUserAttribute("data-placeholder", Placeholder?.Invoke(renderContext))
                .AddUserAttribute("data-categories", Categories?.Invoke(renderContext));
        }
    }
}
