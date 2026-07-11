using System;
using System.Collections.Generic;
using System.Net;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
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
    public class ControlDataComment : Control, IDataIsland, IViewStateBound
    {

        /// <summary>
        /// Gets or sets the name of the enclosing ViewState resource the comments
        /// render. When set, the comments are a central resource the
        /// ViewState owns; when null, the control owns its state and service
        /// islands and loads itself.
        /// </summary>
        public Func<IRenderControlContext, string> ResourceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional ViewState id the control binds to. When null, it
        /// resolves the nearest enclosing ViewState by ancestry.
        /// </summary>
        public Func<IRenderControlContext, string> ViewState { get; set; }

        /// <summary>
        /// Gets or sets the id of the currently signed-in user. It is used
        /// to highlight the user's own comments, reactions and likes.
        /// </summary>
        public Func<IRenderControlContext, string> CurrentUser { get; set; }


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
        /// Gets the data service descriptors of the control, emitted together as
        /// the data-wx-service island that the JavaScript engine consumes in
        /// preference to the legacy data-uri fallback, which keeps the endpoint
        /// and parameter knowledge authored in C#. When empty, the control
        /// behaves exactly as before and the client uses its legacy descriptor.
        /// See WebExpress/docs/view-state-service.md.
        /// </summary>
        public IList<Func<IRenderControlContext, DataServiceDescriptor>> ServiceFactories { get; } = [];

        /// <summary>
        /// Gets or sets the single data service descriptor, as a convenience for
        /// the common control with exactly one service. Reading returns the
        /// first declared service, assigning replaces all declared services.
        /// </summary>
        public Func<IRenderControlContext, DataServiceDescriptor> ServiceFactory
        {
            get => ServiceFactories.Count > 0 ? ServiceFactories[0] : null;
            set
            {
                ServiceFactories.Clear();

                if (value != null)
                {
                    ServiceFactories.Add(value);
                }
            }
        }

        /// <summary>
        /// Gets or sets the optional template reference, emitted as the
        /// data-wx-template attribute that the client Templates registry
        /// resolves into a registered view.
        /// </summary>
        public Func<IRenderControlContext, string> TemplateFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional initial state, emitted as the data-wx-state island.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">Optional host element id.</param>
        public ControlDataComment(string id = null)
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

            var readOnly = Readonly?.Invoke(renderContext) ?? false;

            return new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-comment", GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = Role?.Invoke(renderContext)
            }
                .AddUserAttribute("data-current-user", CurrentUser?.Invoke(renderContext))
                .AddUserAttribute("data-readonly", readOnly ? "true" : null)
                .AddUserAttribute("data-categories", Categories?.Invoke(renderContext))
                .EmitDataIslands(this, renderContext);
        }
    }
}
