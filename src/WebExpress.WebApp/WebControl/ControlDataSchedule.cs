using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents the data-driven schedule: a <see cref="ControlSchedule"/> that
    /// loads its items and holidays from REST endpoints instead of being handed
    /// them, reloads the matching period whenever the view or the shown range
    /// changes, and optionally creates, updates and deletes items.
    /// </summary>
    /// <remarks>
    /// The two controls share one visual and functional concept and differ only
    /// in where the data comes from, which is why this one derives from the
    /// static schedule rather than restating its view configuration.
    ///
    /// The endpoints, the authentication headers, the retry policy and the
    /// change domains that drive the live updates are not spelled as properties
    /// here: they belong to the service descriptors that
    /// <c>DataService&lt;TEndpoint&gt;()</c> and
    /// <c>HolidayService&lt;TEndpoint&gt;()</c> emit as wx-service islands, which
    /// is the one place the framework authors an endpoint. Items added
    /// statically stay the fallback the schedule shows until - and if - the
    /// endpoint answers.
    /// </remarks>
    public class ControlDataSchedule : ControlSchedule, IControlDataSchedule, IDataIsland, IViewStateBound
    {
        /// <summary>
        /// Gets or sets the name of the enclosing ViewState resource the schedule
        /// renders. When set, the control is a pure view of a central resource
        /// the ViewState owns; when null, it owns its state and service islands
        /// and loads itself.
        /// </summary>
        public Func<IRenderControlContext, string> ResourceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional ViewState id the control binds to. When null, it
        /// resolves the nearest enclosing ViewState by ancestry.
        /// </summary>
        public Func<IRenderControlContext, string> ViewState { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the schedule loads its items
        /// on the first paint. It loads unless switched off; switching it off
        /// leaves the statically supplied items on screen until the first
        /// explicit refresh, which is the seam an offline or deferred mode uses.
        /// </summary>
        public Func<IRenderControlContext, bool> AutoLoad { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether stepping to another period or
        /// switching the view reloads the items of the new range. It reloads
        /// unless switched off, because a calendar that is queried by range
        /// otherwise shows an empty month as soon as the visitor navigates.
        /// </summary>
        public Func<IRenderControlContext, bool> ReloadOnNavigate { get; set; }

        /// <summary>
        /// Gets or sets the interval, in seconds, at which the shown period is
        /// reloaded. A schedule that is also subscribed to the change domains of
        /// its service needs no polling; the interval is for sources that cannot
        /// announce a change.
        /// </summary>
        public Func<IRenderControlContext, int?> RefreshInterval { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether a range that has already been
        /// loaded is served from the client cache instead of being requested
        /// again. It is cached unless switched off; a schedule over data that
        /// changes by the minute switches it off so that stepping back to a
        /// month shows the current state.
        /// </summary>
        public Func<IRenderControlContext, bool> Cache { get; set; }

        /// <summary>
        /// Gets or sets the region the holidays are requested for. It is sent
        /// with the year, so the holiday endpoint answers per region and year
        /// rather than having to deliver the whole calendar at once.
        /// </summary>
        public Func<IRenderControlContext, string> HolidayRegion { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether new items may be created,
        /// which offers the empty slots as creation targets.
        /// </summary>
        public Func<IRenderControlContext, bool> Creatable { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether items may be deleted.
        /// </summary>
        public Func<IRenderControlContext, bool> Deletable { get; set; }

        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements. The data service loads the items of a
        /// range with GET and persists their mutations against the same base:
        /// POST to create, PUT to update and DELETE to remove. The optional
        /// holidays service answers the holidays of a year and a region.
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
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataSchedule(string id = null)
            : base(id ?? RandomId.Create())
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var html = RenderHost(renderContext, visualTree, "wx-webapp-schedule");
            var interval = RefreshInterval?.Invoke(renderContext);

            // the client loads, reloads and caches unless it reads an explicit
            // "false", so only the opt-outs are worth an attribute
            html.AddUserAttribute("data-auto-load", AutoLoad != null && !AutoLoad(renderContext) ? "false" : null)
                .AddUserAttribute("data-reload-on-navigate", ReloadOnNavigate != null && !ReloadOnNavigate(renderContext) ? "false" : null)
                .AddUserAttribute("data-cache", Cache != null && !Cache(renderContext) ? "false" : null)
                .AddUserAttribute("data-refresh-interval", interval.HasValue && interval.Value > 0 ? interval.Value.ToString(CultureInfo.InvariantCulture) : null)
                .AddUserAttribute("data-holiday-region", Encode(HolidayRegion?.Invoke(renderContext)))
                .AddUserAttribute("data-creatable", (Creatable?.Invoke(renderContext) ?? false) ? "true" : null)
                .AddUserAttribute("data-deletable", (Deletable?.Invoke(renderContext) ?? false) ? "true" : null);

            return html.EmitDataIslands(this, renderContext);
        }

        /// <summary>
        /// Encodes a value for an attribute, because attribute values are
        /// written verbatim by the HTML writer.
        /// </summary>
        /// <param name="value">The value.</param>
        /// <returns>The encoded value, or null when there is none.</returns>
        private static string Encode(string value)
        {
            return string.IsNullOrEmpty(value) ? null : WebUtility.HtmlEncode(value);
        }
    }
}
