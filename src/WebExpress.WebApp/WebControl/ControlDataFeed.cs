using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// A REST-backed feed: entries stacked one under the other, newest first, with a button under
    /// them that fetches the next page and appends it.
    /// </summary>
    /// <remarks>
    /// <para>
    /// It is the counterpart of <see cref="ControlDataList"/> for content that is read rather than
    /// scanned. A list pages: it replaces its rows and the reader walks pages, which suits a
    /// working set somebody is looking something up in. A feed grows: what was read stays on the
    /// page and more is added under it, which suits a stream somebody reads down - posts,
    /// announcements, activity. The difference is one of reading, not of rendering, which is why
    /// it is a control of its own rather than a mode of the list.
    /// </para>
    /// <para>
    /// The entries come from a <see cref="WebRestApi.RestApiFeed{TIndexItem}"/> endpoint declared
    /// through the data service island, exactly as the list declares its own. The first page is
    /// fetched on load rather than rendered on the server, so one implementation serves the first
    /// page and every page after it.
    /// </para>
    /// <para>
    /// The button hides itself once the last page has arrived. When the endpoint counts its result
    /// that is exact; when it does not, the feed stops after the first page that comes back
    /// shorter than the size it asked for.
    /// </para>
    /// </remarks>
    public class ControlDataFeed : Control, IControlDataFeed, IDataIsland
    {
        /// <summary>
        /// Gets the data service descriptors of the control, emitted as wx-service islands. The
        /// data service is the feed endpoint the pages are fetched from.
        /// </summary>
        public IList<Func<IRenderControlContext, DataServiceDescriptor>> ServiceFactories { get; } = [];

        /// <summary>
        /// Gets or sets the single data service descriptor, as a convenience for the common
        /// control with exactly one service. Reading returns the first declared service, assigning
        /// replaces all declared services.
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
        /// Gets or sets the optional template reference, emitted as the data-wx-template
        /// attribute.
        /// </summary>
        public Func<IRenderControlContext, string> TemplateFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional initial state, emitted as the wx-state island.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Gets or sets how many entries a page holds. Defaults to five: enough that the feed
        /// reads as a page of writing rather than a teaser, few enough that the reader reaches the
        /// button.
        /// </summary>
        public Func<IRenderControlContext, int> PageSize { get; set; }

        /// <summary>
        /// Gets or sets the caption of the button that fetches the next page.
        /// </summary>
        public Func<IRenderControlContext, string> MoreLabel { get; set; }

        /// <summary>
        /// Gets or sets the text shown in place of the entries when the feed is empty.
        /// </summary>
        public Func<IRenderControlContext, string> EmptyText { get; set; }

        /// <summary>
        /// Gets or sets the caption of the link each entry carries to what it stands for. Entries
        /// without an address carry none.
        /// </summary>
        public Func<IRenderControlContext, string> OpenLabel { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataFeed(string id = null)
            : base(id ?? RandomId.Create())
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <remarks>
        /// The server renders the host and the captions and nothing else: the entries, including
        /// the first page of them, are fetched by the controller. Rendering the first page here
        /// and the rest on the client would mean two implementations of an entry, which is the
        /// arrangement that drifts.
        /// </remarks>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var pageSize = PageSize?.Invoke(renderContext) ?? 5;

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-feed", GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .AddUserAttribute("data-page-size", pageSize > 0 ? pageSize.ToString() : "5")
                .AddUserAttribute("data-more-label", I18N.Translate(renderContext, MoreLabel?.Invoke(renderContext)))
                .AddUserAttribute("data-empty-text", I18N.Translate(renderContext, EmptyText?.Invoke(renderContext)))
                .AddUserAttribute("data-open-label", I18N.Translate(renderContext, OpenLabel?.Invoke(renderContext)));

            html.EmitDataIslands(this, renderContext);

            return html;
        }
    }
}
