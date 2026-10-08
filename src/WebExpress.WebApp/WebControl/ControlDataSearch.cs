using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a search box whose suggestions come from a REST endpoint: the user types into the
    /// box and the matches drop down underneath it, each opening its target directly. With an empty
    /// term the endpoint decides what to offer — the recently opened entries, for example — so the
    /// menu is useful before the first keystroke.
    /// </summary>
    /// <remarks>
    /// This is the data bound counterpart of <see cref="WebUI.WebControl.ControlSearch"/>, whose
    /// suggestions are static and filtered on the client. The endpoint is authored through the
    /// fluent data surface and emitted as a wx-service island, which the
    /// <c>webexpress.webapp.SearchSuggestionCtrl</c> controller consumes.
    /// </remarks>
    public class ControlDataSearch : ControlSearch, IControlData, IDataIsland
    {
        /// <summary>
        /// Gets the data service descriptors of the control, emitted as wx-service island
        /// elements. The data service supplies the suggestions.
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
        /// Gets or sets the maximum number of suggestions to display (default 10).
        /// </summary>
        public Func<IRenderControlContext, int> MaxItems { get; set; } = _ => -1;

        /// <summary>
        /// Gets or sets the name of the query parameter the search term is sent in (default 'q').
        /// </summary>
        public Func<IRenderControlContext, string> QueryParameter { get; set; }

        /// <summary>
        /// Gets or sets the page the search term is submitted to when the user presses enter. When
        /// null, enter opens the highlighted suggestion and otherwise does nothing.
        /// </summary>
        public Func<IRenderControlContext, IUri> SubmitUri { get; set; }

        /// <summary>
        /// Gets or sets the text shown in place of the suggestions when the term matches nothing.
        /// </summary>
        public Func<IRenderControlContext, string> EmptyText { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataSearch(string id = null)
            : base(id)
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var maxItems = MaxItems?.Invoke(renderContext) ?? -1;
            var queryParameter = QueryParameter?.Invoke(renderContext);
            var submitUri = SubmitUri?.Invoke(renderContext);
            var emptyText = EmptyText?.Invoke(renderContext);

            // the marker class decides which controller mounts the host, so the static one of the
            // base control gives way to the data bound one
            return base.Render(renderContext, visualTree)
                .AddClass("wx-webapp-search-suggestion")
                .RemoveClass("wx-webui-search")
                .EmitDataIslands(this, renderContext)
                .AddUserAttribute("data-maxitems", maxItems > 0 ? maxItems.ToString() : null)
                .AddUserAttribute("data-queryparam", queryParameter)
                .AddUserAttribute("data-submituri", submitUri?.ToString())
                .AddUserAttribute("data-emptytext", I18N.Translate(renderContext, emptyText));
        }
    }
}
