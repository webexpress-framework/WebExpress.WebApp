using System.Reflection;
using System.Text.Json;
using System.Threading;
using WebExpress.WebApp.WebMessageQueue;

namespace WebExpress.WebApp.Test.WebMessageQueue
{
    /// <summary>
    /// Tests the live system metric pipeline: the sampler that reads the cpu
    /// and memory figures, the wire shape of the update message the dispatcher
    /// pushes over the MessageQueue WebSocket, and the channel names the
    /// clients subscribe. Together these pin the contract the JavaScript
    /// SystemMetricCtrl consumes.
    /// </summary>
    public class UnitTestSystemMetrics
    {
        /// <summary>
        /// Tests that a sample carries plausible figures: percentages inside
        /// the gauge range and a positive memory capacity.
        /// </summary>
        [Fact]
        public void SamplerProducesFiguresInsideTheGaugeRange()
        {
            var sampler = new SystemMetricsSampler();

            // the cpu figure is a delta, so the second sample is the real one
            sampler.Sample();
            Thread.Sleep(50);
            var sample = sampler.Sample();

            Assert.InRange(sample.CpuPercent, 0, 100);
            Assert.InRange(sample.MemoryPercent, 0, 100);
            Assert.True(sample.TotalMemoryBytes > 0, "the sampler reports the memory capacity");
            Assert.InRange(sample.UsedMemoryBytes, 0, sample.TotalMemoryBytes);
        }

        /// <summary>
        /// Tests that the first sample reports a cpu figure of zero, because
        /// the cpu load is a delta between two consecutive samples.
        /// </summary>
        [Fact]
        public void TheFirstSampleCarriesNoCpuFigure()
        {
            var sample = new SystemMetricsSampler().Sample();

            Assert.Equal(0, sample.CpuPercent);
        }

        /// <summary>
        /// Tests that the cpu message serializes into the wire shape the
        /// JavaScript SystemMetricCtrl reads: the type, the metric token and
        /// the percentage at the JSON root, without the byte figures.
        /// </summary>
        [Fact]
        public void CpuMessageSerializesTheWireShape()
        {
            var (cpu, _) = SystemMetricsDispatcher.CreateMessages(new SystemMetricsSample(12.34, 100, 200, 50));

            using var document = JsonDocument.Parse(cpu.ToJson());
            var root = document.RootElement;

            Assert.Equal("webexpress.webapp.systemmetric.update", root.GetProperty("type").GetString());
            Assert.Equal("cpu", root.GetProperty("metric").GetString());
            Assert.Equal(12.3, root.GetProperty("value").GetDouble());
            Assert.False(root.TryGetProperty("usedBytes", out _), "the cpu metric carries no byte figures");
            Assert.False(root.TryGetProperty("totalBytes", out _));
        }

        /// <summary>
        /// Tests that the ram message carries the byte figures alongside the
        /// percentage, so a client can present the absolute usage.
        /// </summary>
        [Fact]
        public void RamMessageCarriesTheByteFigures()
        {
            var (_, ram) = SystemMetricsDispatcher.CreateMessages(new SystemMetricsSample(1, 1536, 4096, 37.5));

            using var document = JsonDocument.Parse(ram.ToJson());
            var root = document.RootElement;

            Assert.Equal("ram", root.GetProperty("metric").GetString());
            Assert.Equal(37.5, root.GetProperty("value").GetDouble());
            Assert.Equal(1536, root.GetProperty("usedBytes").GetInt64());
            Assert.Equal(4096, root.GetProperty("totalBytes").GetInt64());
        }

        /// <summary>
        /// Tests that a reading outside the gauge range is clamped, so a
        /// misbehaving figure can never render a bar beyond its track.
        /// </summary>
        [Theory]
        [InlineData(-5, 0)]
        [InlineData(140, 100)]
        [InlineData(33.33, 33.3)]
        public void MessageValuesAreClampedAndRounded(double value, double expected)
        {
            var message = new SystemMetricMessage(SystemMetricMessageTypes.Cpu, value);

            Assert.Equal(expected, message.Value);
        }

        /// <summary>
        /// Tests the channel names the clients subscribe, which route a metric
        /// only to the sessions that render it.
        /// </summary>
        [Theory]
        [InlineData("cpu", "webexpress.webapp.systemmetric.cpu")]
        [InlineData("ram", "webexpress.webapp.systemmetric.ram")]
        public void ChannelNamesAreStable(string metric, string expected)
        {
            Assert.Equal(expected, SystemMetricMessageTypes.Channel(metric));
        }

        /// <summary>
        /// Tests that a tick arriving while the previous one is still sending is skipped, so
        /// two ticks never sample and write to the same connections at once; once the
        /// previous tick has finished, the next one sends again.
        /// </summary>
        [Fact]
        public async Task OverlappingTickIsSkipped()
        {
            // arrange
            var manager = new BlockingMessageQueueManager();
            using var dispatcher = new SystemMetricsDispatcher(manager);
            var onTick = typeof(SystemMetricsDispatcher).GetMethod("OnTick", BindingFlags.NonPublic | BindingFlags.Instance);

            // act
            onTick.Invoke(dispatcher, [null]);
            onTick.Invoke(dispatcher, [null]);
            var sendsWhileBlocked = manager.SendCount;

            manager.Release();
            await manager.WaitForSendsAsync(2);
            onTick.Invoke(dispatcher, [null]);
            await manager.WaitForSendsAsync(4);

            // validation
            Assert.Equal(1, sendsWhileBlocked);
            Assert.Equal(4, manager.SendCount);
        }

        /// <summary>
        /// Message queue fake whose sends stay pending until the test releases them, which
        /// keeps a tick busy for as long as the test needs.
        /// </summary>
        private sealed class BlockingMessageQueueManager : IMessageQueueManager
        {
            private readonly TaskCompletionSource _gate = new(TaskCreationOptions.RunContinuationsAsynchronously);
            private int _sendCount;

            public int SendCount => Volatile.Read(ref _sendCount);

            public void Release() => _gate.TrySetResult();

            public async Task WaitForSendsAsync(int count)
            {
                var deadline = DateTime.UtcNow.AddSeconds(5);

                while (SendCount < count && DateTime.UtcNow < deadline)
                {
                    await Task.Delay(10);
                }
            }

            public IMessageQueueManager Register(Guid connectionId, IMessageQueueSocket socket) => this;
            public IMessageQueueManager Register(string messageType, Action<IMessage> handler) => this;
            public IMessageQueueManager Unregister(Guid connectionId) => this;
            public IMessageQueueManager Unregister(string messageType, Action<IMessage> handler) => this;

            public async Task<IMessageQueueManager> SendAsync(IAddress address, IMessage message, CancellationToken cancellationToken = default)
            {
                Interlocked.Increment(ref _sendCount);
                await _gate.Task;

                return this;
            }

            public Task ReplayPopupNotificationsAsync(IMessageQueueSocket socket, CancellationToken cancellationToken = default)
                => Task.CompletedTask;

            public Task ReplayProgressTasksAsync(IMessageQueueSocket socket, CancellationToken cancellationToken = default)
                => Task.CompletedTask;

            public IPopupNotificationHandler PopupNotificationHandler => null;

            public IChatMessageHandler ChatMessageHandler => null;

            public void Dispose()
            {
            }
        }
    }
}
