using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
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
    /// <see cref="ControlDataComment"/> on the same page picks it up.
    /// </summary>
    public class ControlDataCommentComposer : Control, IDataIsland, IViewStateModelBound
    {
        /// <summary>
        /// Gets or sets the resolver of the ViewState comments resource the composer
        /// drives. When set through Resource&lt;TResource&gt;(), a posted comment
        /// re-queries this resource so a ViewState-bound comment list re-renders;
        /// when null, the composer is standalone and coordinates through the
        /// comment added event.
        /// </summary>
        public Func<IRenderControlContext, string> ResourceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional ViewState id the composer binds to. When null,
        /// the composer resolves its ViewState by the resource it drives.
        /// </summary>
        public Func<IRenderControlContext, string> ViewState { get; set; }

        /// <summary>
        /// Gets or sets the resolver of an optional state path the composer writes,
        /// set through Model(...). The composer's write is primarily a re-query
        /// after a successful post, so this is usually left unset.
        /// </summary>
        public Func<IRenderControlContext, string> ModelFactory { get; set; }
        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements: the data service receives the new
        /// comment, the optional users service resolves mentions and the
        /// optional upload service receives inline images.
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
        /// data-wx-template attribute.
        /// </summary>
        public Func<IRenderControlContext, string> TemplateFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional initial state, emitted as the wx-state island.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Gets or sets the id of the currently signed-in user. Forwarded
        /// to the JS controller so the dispatched <c>COMMENT_ADDED_EVENT</c>
        /// can be filtered per user.
        /// </summary>
        public Func<IRenderControlContext, string> CurrentUser { get; set; }

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
        public ControlDataCommentComposer(string id = null)
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

            return new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-comment-composer", GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = Role?.Invoke(renderContext)
            }
                .EmitDataIslands(this, renderContext)
                .AddUserAttribute("data-current-user", CurrentUser?.Invoke(renderContext))
                .AddUserAttribute("data-default-category", DefaultCategory?.Invoke(renderContext))
                .AddUserAttribute("data-placeholder", Placeholder?.Invoke(renderContext))
                .AddUserAttribute("data-categories", Categories?.Invoke(renderContext));
        }
    }
}
