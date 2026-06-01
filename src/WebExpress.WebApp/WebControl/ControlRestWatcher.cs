using System;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Renders the host element for an watcher avatar row. The
    /// control only emits the placeholder div; the actual avatar row, the
    /// "+" affordance and the search dropdown are built by the client-side
    /// <c>webexpress.webapp.WatcherCtrl</c>, which talks to the configured
    /// REST endpoint to load, add and remove watchers.
    /// </summary>
    public class ControlRestWatcher : Control
    {
        /// <summary>
        /// Gets or sets the REST URI that backs this watcher surface. The
        /// JS controller issues
        /// <c>GET/POST {Uri}</c> and
        /// <c>DELETE {Uri}/{userId}</c>.
        /// </summary>
        public Func<IRenderControlContext, IUri> RestUri { get; set; }

        /// <summary>
        /// Gets or sets the URI used to resolve candidate users in the
        /// "+" dropdown. The JS controller calls <c>{UsersUri}?q=…</c> to
        /// list candidates as the user types.
        /// </summary>
        public Func<IRenderControlContext, IUri> UsersUri { get; set; }

        /// <summary>
        /// Gets or sets the maximum number of avatars shown inline before
        /// they are collapsed into a <c>+N</c> overflow chip. Defaults to
        /// <c>6</c> on the client side when not provided.
        /// </summary>
        public Func<IRenderControlContext, int?> MaxVisible { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the surface is read-only.
        /// When <see langword="true"/>, the "+" affordance and the
        /// click-to-remove behavior on the avatars are suppressed.
        /// </summary>
        public Func<IRenderControlContext, bool> Readonly { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">Optional host element id.</param>
        public ControlRestWatcher(string id = null)
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
            var maxVisible = MaxVisible?.Invoke(renderContext);
            var readOnly = Readonly?.Invoke(renderContext) ?? false;

            return new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-watcher", GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = Role?.Invoke(renderContext)
            }
                .AddUserAttribute("data-uri", restUri?.ToString())
                .AddUserAttribute("data-users-uri", usersUri?.ToString())
                .AddUserAttribute("data-max-visible", maxVisible?.ToString())
                .AddUserAttribute("data-readonly", readOnly ? "true" : null);
        }
    }
}
