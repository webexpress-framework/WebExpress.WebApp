using System;
using System.Threading;
using System.Threading.Tasks;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Periodically samples the system metrics and pushes each reading to the
    /// sessions that subscribed the metric's channel, so a
    /// <c>ControlSystemMetric</c> shows live cpu and memory values without any
    /// HTTP polling. Addressing rides the runtime channel subscription (see
    /// <see cref="DataSubscription"/>): a client that renders a metric
    /// subscribes its channel over the socket, and a connection without a
    /// subscription receives nothing, so an idle page costs only the sampling
    /// itself.
    /// </summary>
    public sealed class SystemMetricsDispatcher : IDisposable
    {
        /// <summary>
        /// The sampling interval. Two seconds keeps the gauge lively while a
        /// burst of connected clients still costs next to nothing, because one
        /// sample serves every subscriber.
        /// </summary>
        public const int IntervalMilliseconds = 2000;

        private readonly IMessageQueueManager _messageQueueManager;
        private readonly SystemMetricsSampler _sampler = new();
        private readonly Timer _timer;

        /// <summary>
        /// Initializes a new instance and starts the sampling timer.
        /// </summary>
        /// <param name="messageQueueManager">
        /// The message queue manager used to forward the readings.
        /// </param>
        /// <exception cref="ArgumentNullException">
        /// Thrown when <paramref name="messageQueueManager"/> is <c>null</c>.
        /// </exception>
        public SystemMetricsDispatcher(IMessageQueueManager messageQueueManager)
        {
            _messageQueueManager = messageQueueManager
                ?? throw new ArgumentNullException(nameof(messageQueueManager));

            _timer = new Timer(OnTick, null, IntervalMilliseconds, IntervalMilliseconds);
        }

        /// <summary>
        /// Builds the messages of one sample, one per metric. Separated from
        /// the timer so the wire shape is testable without waiting on a tick.
        /// </summary>
        /// <param name="sample">The sample to convert.</param>
        /// <returns>The cpu and the ram message.</returns>
        public static (SystemMetricMessage Cpu, SystemMetricMessage Ram) CreateMessages(SystemMetricsSample sample)
        {
            ArgumentNullException.ThrowIfNull(sample);

            var cpu = new SystemMetricMessage(SystemMetricMessageTypes.Cpu, sample.CpuPercent);
            var ram = new SystemMetricMessage(SystemMetricMessageTypes.Ram, sample.MemoryPercent, sample.UsedMemoryBytes, sample.TotalMemoryBytes);

            return (cpu, ram);
        }

        /// <summary>
        /// Samples and dispatches one reading per metric to its channel.
        /// Failures are swallowed, because a transport error must never tear
        /// down the sampling timer.
        /// </summary>
        private async void OnTick(object state)
        {
            try
            {
                var (cpu, ram) = CreateMessages(_sampler.Sample());

                await SendAsync(SystemMetricMessageTypes.Cpu, cpu);
                await SendAsync(SystemMetricMessageTypes.Ram, ram);
            }
            catch
            {
                // a failed tick must not stop the metrics stream
            }
        }

        /// <summary>
        /// Sends one reading to the subscribers of the metric's channel.
        /// </summary>
        /// <param name="metric">The metric token.</param>
        /// <param name="message">The reading.</param>
        private Task SendAsync(string metric, SystemMetricMessage message)
        {
            var address = new AddressDomain(SystemMetricMessageTypes.Channel(metric));

            return _messageQueueManager.SendAsync(address, message);
        }

        /// <summary>
        /// Stops the sampling timer.
        /// </summary>
        public void Dispose()
        {
            _timer.Dispose();
        }
    }
}
