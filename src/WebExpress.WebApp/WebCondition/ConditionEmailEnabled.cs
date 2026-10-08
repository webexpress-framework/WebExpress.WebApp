using WebExpress.WebCore;
using WebExpress.WebCore.WebCondition;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebCondition
{
    /// <summary>
    /// Keeps email administration unavailable when the running delivery service is disabled.
    /// </summary>
    public sealed class ConditionEmailEnabled : ICondition
    {
        /// <summary>
        /// Uses the manager's active configuration for both route resolution and navigation visibility.
        /// </summary>
        /// <param name="request">The request evaluated by the common condition contract.</param>
        /// <returns>True only when email delivery is enabled in the running manager.</returns>
        public bool Fulfillment(IRequest request)
        {
            return WebEx.ComponentHub?.EmailManager?.GetStatus().Enabled == true;
        }
    }
}
