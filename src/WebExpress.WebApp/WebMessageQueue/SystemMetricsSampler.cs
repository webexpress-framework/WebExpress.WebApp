using System;
using System.Diagnostics;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Samples the live system metrics the <see cref="SystemMetricsDispatcher"/>
    /// pushes to the clients. The cpu reading is the processor time of the
    /// server process, taken as the delta between two samples and normalized
    /// over all cores, because a cross platform system-wide cpu counter does
    /// not exist in the base library. The memory reading is the physical
    /// memory load of the host as the garbage collector reports it, which also
    /// respects container limits.
    /// </summary>
    public sealed class SystemMetricsSampler
    {
        private TimeSpan _lastProcessorTime;
        private DateTime _lastSampleUtc;

        /// <summary>
        /// Takes a fresh sample. The first call carries a cpu reading of zero,
        /// because the cpu load is a delta between two consecutive samples.
        /// </summary>
        /// <returns>The sample.</returns>
        public SystemMetricsSample Sample()
        {
            var now = DateTime.UtcNow;
            var processorTime = Process.GetCurrentProcess().TotalProcessorTime;

            var cpuPercent = 0d;
            if (_lastSampleUtc != default)
            {
                var elapsed = (now - _lastSampleUtc).TotalMilliseconds;
                if (elapsed > 0)
                {
                    var used = (processorTime - _lastProcessorTime).TotalMilliseconds;
                    cpuPercent = used / (elapsed * Environment.ProcessorCount) * 100;
                }
            }

            _lastProcessorTime = processorTime;
            _lastSampleUtc = now;

            var memory = GC.GetGCMemoryInfo();
            var totalBytes = memory.TotalAvailableMemoryBytes;
            var usedBytes = memory.MemoryLoadBytes;
            var memoryPercent = totalBytes > 0 ? (double)usedBytes / totalBytes * 100 : 0;

            return new SystemMetricsSample
            (
                Math.Clamp(cpuPercent, 0, 100),
                usedBytes,
                totalBytes,
                Math.Clamp(memoryPercent, 0, 100)
            );
        }
    }

    /// <summary>
    /// One reading of the system metrics: the cpu load of the server process
    /// and the physical memory usage of the host.
    /// </summary>
    /// <param name="CpuPercent">The cpu load as a percentage between 0 and 100.</param>
    /// <param name="UsedMemoryBytes">The physical memory in use, in bytes.</param>
    /// <param name="TotalMemoryBytes">The available physical memory, in bytes.</param>
    /// <param name="MemoryPercent">The memory usage as a percentage between 0 and 100.</param>
    public sealed record SystemMetricsSample(double CpuPercent, long UsedMemoryBytes, long TotalMemoryBytes, double MemoryPercent);
}
