namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// The well known identifiers of the system metric family. A system metric
    /// message pushes a live host reading (the cpu load or the memory usage of
    /// the server) to the clients that subscribed the metric's channel, so a
    /// <c>ControlSystemMetric</c> renders live values without any HTTP polling.
    /// The channels ride the same runtime channel subscription the data change
    /// notifications use, so a connection receives only the metrics a control
    /// on its page subscribed.
    /// </summary>
    public static class SystemMetricMessageTypes
    {
        /// <summary>
        /// Outbound: a fresh reading of one system metric.
        /// </summary>
        public const string Update = "webexpress.webapp.systemmetric.update";

        /// <summary>
        /// The wire token of the cpu metric, the processor load of the server
        /// process across all cores.
        /// </summary>
        public const string Cpu = "cpu";

        /// <summary>
        /// The wire token of the ram metric, the physical memory usage of the
        /// host.
        /// </summary>
        public const string Ram = "ram";

        /// <summary>
        /// Returns the subscription channel of a metric. A client subscribes
        /// this channel at runtime (like a data change domain), so the
        /// dispatcher addresses only the sessions that render the metric.
        /// </summary>
        /// <param name="metric">The metric token, for example "cpu".</param>
        /// <returns>The channel name.</returns>
        public static string Channel(string metric)
        {
            return $"webexpress.webapp.systemmetric.{metric}";
        }
    }
}
