using System;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Provides an abstract base class for REST API endpoints that read and
    /// persist the checked state of a boolean resource. GET requests return
    /// the current state, while POST requests apply a new state supplied via
    /// the <c>v</c> parameter ("true"/"false").
    /// </summary>
    public abstract class RestApiCheck : IRestApi
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        protected RestApiCheck()
        {
        }

        /// <summary>
        /// Processing of the resource that was called via the get request.
        /// Returns the current checked state of the resource.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the current checked state.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(Request request)
        {
            try
            {
                return new RestApiCheckResult()
                {
                    Checked = GetChecked(request)
                }
                    .ToResponse();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error processing request.{ex}"));
            }
        }

        /// <summary>
        /// Processing of the resource that was called via the post request.
        /// Persists the new checked state supplied via the <c>v</c> parameter.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the resulting checked state.</returns>
        [Method(RequestMethod.POST)]
        public virtual IResponse Update(Request request)
        {
            try
            {
                var raw = request.GetParameter("v")?.Value;
                var @checked = string.Equals(raw, "true", StringComparison.OrdinalIgnoreCase) ||
                               string.Equals(raw, "on", StringComparison.OrdinalIgnoreCase) ||
                               string.Equals(raw, "1", StringComparison.OrdinalIgnoreCase);

                SetChecked(@checked, request);

                return new RestApiCheckResult()
                {
                    Checked = @checked
                }
                    .ToResponse();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error processing request.{ex}"));
            }
        }

        /// <summary>
        /// Reads the current checked state for the given request context.
        /// </summary>
        /// <param name="request">The request context.</param>
        /// <returns>The current checked state.</returns>
        protected abstract bool GetChecked(Request request);

        /// <summary>
        /// Persists the new checked state for the given request context.
        /// </summary>
        /// <param name="checked">The new checked state.</param>
        /// <param name="request">The request context.</param>
        protected abstract void SetChecked(bool @checked, Request request);
    }
}
