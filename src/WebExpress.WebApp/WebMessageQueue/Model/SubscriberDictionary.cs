using System;
using System.Collections.Concurrent;
using System.Collections.Generic;

namespace WebExpress.WebApp.WebMessageQueue.Model
{
    /// <summary>
    /// Represents a thread-safe collection that maps subscription keys to lists of 
    /// message handler actions.
    /// </summary>
    internal class SubscriberDictionary : ConcurrentDictionary<string, List<Action<IMessage>>>
    {
    }
}
