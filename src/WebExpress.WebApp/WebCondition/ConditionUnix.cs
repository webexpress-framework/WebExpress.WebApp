using System;
using WebExpress.WebCore.WebCondition;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebCondition
{
    /// <summary>
    /// Represents a condition that checks if the operating system is Unix.
    /// </summary>
    public class ConditionUnix : ICondition
    {
        /// <summary>
        /// Check whether the condition is fulfilled.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>True if the condition is fulfilled, false otherwise.</returns>
        public bool Fulfillment(IRequest request)
        {
            return Environment.OSVersion.ToString().Contains("unix", StringComparison.OrdinalIgnoreCase);
        }
    }
}
