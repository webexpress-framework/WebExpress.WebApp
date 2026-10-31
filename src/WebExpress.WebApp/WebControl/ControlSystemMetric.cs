using System;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// A live gauge for one system metric of the server: the cpu load or the
    /// memory usage. The readings arrive over the MessageQueue WebSocket (see
    /// <c>WebExpress.WebApp.WebMessageQueue.SystemMetricsDispatcher</c>): the
    /// client subscribes the metric's channel on mount and the server pushes a
    /// fresh sample every two seconds, so the gauge is live without any HTTP
    /// polling and survives navigation, reconnects and multiple windows.
    /// </summary>
    /// <remarks>
    /// A control instance renders exactly one metric. A surface that shows cpu
    /// and memory side by side places two instances, which keeps each gauge a
    /// small, composable unit instead of a configured dashboard widget.
    /// </remarks>
    public class ControlSystemMetric : Control
    {
        /// <summary>
        /// Gets or sets the metric the control renders. Defaults to
        /// <see cref="TypeSystemMetric.Cpu"/>.
        /// </summary>
        public Func<IRenderControlContext, TypeSystemMetric> Metric { get; set; }

        /// <summary>
        /// Gets or sets the visual form of the gauge, a filling bar or a live
        /// sparkline of the recent history. Defaults to
        /// <see cref="TypeSystemMetricLayout.Bar"/>.
        /// </summary>
        public Func<IRenderControlContext, TypeSystemMetricLayout> Layout { get; set; }

        /// <summary>
        /// Gets or sets the optional caption rendered above the gauge. Without
        /// a label the client falls back to the translated metric name.
        /// </summary>
        public Func<IRenderControlContext, string> Label { get; set; }

        /// <summary>
        /// Initializes a new instance.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlSystemMetric(string id = null)
            : base(id ?? RandomId.Create())
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation. The host carries the
        /// metric as a data attribute; the client control subscribes the
        /// metric's channel and renders the gauge from the live readings.
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

            var metric = Metric?.Invoke(renderContext) ?? TypeSystemMetric.Cpu;
            var layout = Layout?.Invoke(renderContext) ?? TypeSystemMetricLayout.Bar;
            var label = Label?.Invoke(renderContext);

            return new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-system-metric", GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .AddUserAttribute("data-metric", metric.ToValue())
                // the bar default is implied; only the chart layout is seeded
                .AddUserAttribute("data-layout", layout != TypeSystemMetricLayout.Bar ? layout.ToValue() : null)
                .AddUserAttribute("data-label", label);
        }
    }
}
