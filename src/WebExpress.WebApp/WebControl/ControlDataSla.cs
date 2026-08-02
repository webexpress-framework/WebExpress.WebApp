using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents the data-driven service level agreement: a
    /// <see cref="ControlSla"/> that loads its state from a REST endpoint
    /// instead of being handed it, and persists a pause, a resume or a manual
    /// settlement back to the same endpoint.
    /// </summary>
    /// <remarks>
    /// The two controls share one visual and functional concept and differ only
    /// in where the state comes from, which is why this one derives from the
    /// static agreement rather than restating its twenty attributes and its
    /// markup.
    ///
    /// Whatever is configured statically stays the fallback the widget shows
    /// until - and if - the endpoint answers. Seeding it with the last known
    /// state is what keeps the tile from flashing an empty or violated frame on
    /// every page load.
    ///
    /// The endpoint, the authentication headers and the retry policy are not
    /// properties here: they belong to the service descriptor that
    /// <c>DataService&lt;TEndpoint&gt;()</c> emits as a wx-service island, which
    /// is the one place the framework authors an endpoint.
    /// </remarks>
    public class ControlDataSla : ControlSla, IControlData, IDataIsland
    {
        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements. The data service backs the load of the
        /// state and the persistence of a transition.
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
        /// Gets or sets the interval in seconds at which the widget re-reads the
        /// state from the endpoint. Without it the widget loads once and then
        /// counts on its own, which is correct as long as it is the only thing
        /// changing the agreement; a poll is what keeps several visitors of the
        /// same agreement in step.
        /// </summary>
        public Func<IRenderControlContext, int?> RefreshInterval { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The id of the control.</param>
        public ControlDataSla(string id = null)
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
            var refreshInterval = RefreshInterval?.Invoke(renderContext);
            var html = RenderHost(renderContext, visualTree, "wx-webapp-sla");

            html.AddUserAttribute
            (
                "data-refresh-interval",
                refreshInterval?.ToString(System.Globalization.CultureInfo.InvariantCulture)
            );

            return html.EmitDataIslands(this, renderContext);
        }
    }
}
