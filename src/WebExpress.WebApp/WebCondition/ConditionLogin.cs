using WebExpress.WebCore;
using WebExpress.WebCore.WebCondition;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebCondition
{
    /// <summary>
    /// Represents a condition that checks whether the current request
    /// is associated with an authenticated session.
    /// </summary>
    public class ConditionLogin : ICondition
    {
        /// <summary>
        /// Checks whether the condition is fulfilled.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>True if the user is logged in; otherwise false.</returns>
        public bool Fulfillment(IRequest request)
        {
            var identity = WebEx.ComponentHub.IdentityManager.GetCurrentIdentity(request);

            return identity is not null;
        }
    }
}