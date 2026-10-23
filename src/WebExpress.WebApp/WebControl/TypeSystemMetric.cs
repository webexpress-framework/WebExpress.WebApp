namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// The system metric a <see cref="ControlSystemMetric"/> renders. Each
    /// control instance shows exactly one metric, so a surface composes its
    /// gauges from one control per reading instead of configuring a combined
    /// widget.
    /// </summary>
    public enum TypeSystemMetric
    {
        /// <summary>
        /// The processor load of the server process, normalized over all cores.
        /// </summary>
        Cpu,

        /// <summary>
        /// The physical memory usage of the host.
        /// </summary>
        Ram
    }

    /// <summary>
    /// The visual form a <see cref="ControlSystemMetric"/> renders its metric
    /// in. Both forms show the same live reading; they differ in whether the
    /// history is visible.
    /// </summary>
    public enum TypeSystemMetricLayout
    {
        /// <summary>
        /// A single horizontal bar that fills to the current percentage. The
        /// compact form for a dense surface (a header, a footer, a table cell).
        /// </summary>
        Bar,

        /// <summary>
        /// A live sparkline that plots the recent history of the reading, so a
        /// trend (a climbing load, a memory leak) is visible at a glance.
        /// </summary>
        Chart
    }

    /// <summary>
    /// Provides extension methods for the <see cref="TypeSystemMetric"/> enum.
    /// </summary>
    public static class TypeSystemMetricExtensions
    {
        /// <summary>
        /// Converts the metric to the lowercase token the client runtime expects
        /// in the <c>data-metric</c> attribute and the server uses on the wire,
        /// so both sides match the same stable, culture independent identifier.
        /// </summary>
        /// <param name="metric">The metric.</param>
        /// <returns>The wire token corresponding to the metric.</returns>
        public static string ToValue(this TypeSystemMetric metric)
        {
            return metric switch
            {
                TypeSystemMetric.Ram => "ram",
                _ => "cpu",
            };
        }

        /// <summary>
        /// Converts the layout to the lowercase token the client runtime expects
        /// in the <c>data-layout</c> attribute.
        /// </summary>
        /// <param name="layout">The layout.</param>
        /// <returns>The wire token corresponding to the layout.</returns>
        public static string ToValue(this TypeSystemMetricLayout layout)
        {
            return layout switch
            {
                TypeSystemMetricLayout.Chart => "chart",
                _ => "bar",
            };
        }
    }
}
