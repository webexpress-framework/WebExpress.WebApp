using System;
using System.Collections.Concurrent;

namespace WebExpress.WebApp.WebMessageQueue.Model
{
    /// <summary>
    /// Represents a thread-safe collection that maps keys to message queue socket instances.
    /// </summary>
    internal class SocketDictionary : ConcurrentDictionary<Guid, IMessageQueueSocket>
    {
    }
}
