using System;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// The outbound WebSocket message that carries one fresh reading of a
    /// system metric. The value is always a percentage, so every metric renders
    /// through the same gauge; the byte figures accompany the memory metric so
    /// a client can present the absolute usage without knowing how the server
    /// measured it.
    /// </summary>
    public class SystemMetricMessage : Message
    {
        /// <summary>
        /// Gets the metric token, one of
        /// <see cref="SystemMetricMessageTypes.Cpu"/> or
        /// <see cref="SystemMetricMessageTypes.Ram"/>.
        /// </summary>
        public string Metric { get; }

        /// <summary>
        /// Gets the reading as a percentage between 0 and 100, rounded to one
        /// decimal so the wire value is stable across platforms.
        /// </summary>
        public double Value { get; }

        /// <summary>
        /// Gets the absolute usage in bytes, when the metric has one (the
        /// memory metric). Omitted from the wire when absent.
        /// </summary>
        public long? UsedBytes { get; }

        /// <summary>
        /// Gets the total capacity in bytes, when the metric has one (the
        /// memory metric). Omitted from the wire when absent.
        /// </summary>
        public long? TotalBytes { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="metric">The metric token.</param>
        /// <param name="value">The reading as a percentage.</param>
        /// <param name="usedBytes">The optional absolute usage in bytes.</param>
        /// <param name="totalBytes">The optional total capacity in bytes.</param>
        /// <exception cref="ArgumentNullException">
        /// Thrown when <paramref name="metric"/> is <c>null</c>.
        /// </exception>
        public SystemMetricMessage(string metric, double value, long? usedBytes = null, long? totalBytes = null)
            : base(SystemMetricMessageTypes.Update)
        {
            Metric = metric ?? throw new ArgumentNullException(nameof(metric));
            Value = Math.Round(Math.Clamp(value, 0, 100), 1);
            UsedBytes = usedBytes;
            TotalBytes = totalBytes;
        }
    }
}
