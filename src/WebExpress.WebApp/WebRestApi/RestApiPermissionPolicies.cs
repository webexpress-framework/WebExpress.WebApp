using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract base class for the policy directory endpoint of the permission
    /// control. It serves the identity policies (see <c>IIdentityPolicy</c>)
    /// that populate the assign select; the concrete endpoint typically
    /// sources them from the identity manager of the application.
    /// </summary>
    public abstract class RestApiPermissionPolicies : IRestApi
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };

        /// <summary>
        /// Handles <c>GET {base}?q=…</c>: returns the policies matching the
        /// optional free-text filter (case-insensitive, against the name and
        /// the description).
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(IRequest request)
        {
            var search = request?.GetParameter("q")?.Value ?? string.Empty;

            try
            {
                var policies = (RetrievePolicies(request) ?? [])
                    .Where(x => string.IsNullOrWhiteSpace(search)
                        || (x.Name ?? string.Empty).Contains(search, StringComparison.OrdinalIgnoreCase)
                        || (x.Description ?? string.Empty).Contains(search, StringComparison.OrdinalIgnoreCase))
                    .ToList();

                var json = JsonSerializer.Serialize(policies, _jsonOptions);

                return new ResponseOK
                {
                    Content = Encoding.UTF8.GetBytes(json)
                }
                    .AddHeaderContentType("application/json");
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing get request.");
            }
        }

        /// <summary>
        /// Returns the assignable identity policies.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The policies.</returns>
        protected abstract IEnumerable<RestApiPermissionPolicy> RetrievePolicies(IRequest request);
    }
}
