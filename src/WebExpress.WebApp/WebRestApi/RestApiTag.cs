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
    /// Abstract base class for a tag (label) REST endpoint. The class
    /// dispatches the routes consumed by the client-side
    /// <c>webexpress.webapp.TagCtrl</c>:
    /// <list type="bullet">
    ///   <item><c>GET    {base}</c> → the tags currently attached to the object</item>
    ///   <item><c>GET    {base}?q={term}</c> → autocomplete suggestions from the tag vocabulary</item>
    ///   <item><c>POST   {base}</c> → add a tag</item>
    ///   <item><c>DELETE {base}/{value}</c> → remove a tag</item>
    /// </list>
    /// A single endpoint is used for both loading and suggesting: when the
    /// <c>q</c> query parameter is absent the current tags are returned,
    /// otherwise matching suggestions are returned. Derived classes provide
    /// storage by overriding the <c>RetrieveTags</c>, <c>SuggestTags</c>,
    /// <c>CreateTag</c> and <c>DeleteTag</c> methods. The base class only deals
    /// with HTTP wiring, sub-path matching and JSON marshalling.
    /// </summary>
    public abstract class RestApiTag : IRestApi
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };

        /// <summary>
        /// Handles the <c>GET</c> entry point. Without a <c>q</c> query
        /// parameter the tags currently attached to the object are returned;
        /// with a <c>q</c> parameter the matching autocomplete suggestions
        /// from the tag vocabulary are returned.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(IRequest request)
        {
            try
            {
                var term = request.GetParameter("q")?.Value;

                if (!string.IsNullOrWhiteSpace(term))
                {
                    var suggestions = SuggestTags(term, request) ?? [];
                    return Json(suggestions);
                }

                var tags = RetrieveTags(request) ?? [];
                return Json(tags);
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing get request.");
            }
        }

        /// <summary>
        /// Handles <c>POST {base}</c>: adds a tag from the JSON body.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.POST)]
        public virtual IResponse Create(IRequest request)
        {
            try
            {
                var payload = GetPayload<RestApiTagPayload>(request);
                if (payload is null || string.IsNullOrWhiteSpace(payload.Value))
                {
                    return new ResponseBadRequest(new StatusMessage("missing or invalid payload."));
                }

                var created = CreateTag(payload, request);
                return created is null
                    ? new ResponseBadRequest(new StatusMessage("tag could not be created."))
                    : Json(created);
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing post request.");
            }
        }

        /// <summary>
        /// Handles <c>DELETE {base}/{value}</c>.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.DELETE)]
        public virtual IResponse Delete(IRequest request)
        {
            try
            {
                var segments = GetRelativeSegments(request);
                if (segments.Count != 1)
                {
                    return new ResponseNotFound();
                }

                var deleted = DeleteTag(segments[0], request);
                return deleted
                    ? new ResponseNoContent()
                    : new ResponseNotFound();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing delete request.");
            }
        }

        /// <summary>
        /// Returns the tags currently attached to the object backing this
        /// endpoint.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The current tags.</returns>
        protected abstract IEnumerable<RestApiTagItem> RetrieveTags(IRequest request);

        /// <summary>
        /// Returns the autocomplete suggestions from the tag vocabulary that
        /// match the given search term.
        /// </summary>
        /// <param name="term">The search term entered by the user.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The matching suggestions.</returns>
        protected abstract IEnumerable<RestApiTagItem> SuggestTags(string term, IRequest request);

        /// <summary>
        /// Persists a newly added tag.
        /// </summary>
        /// <param name="payload">The create payload.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// The created tag, or <see langword="null"/> when creation failed.
        /// </returns>
        protected abstract RestApiTagItem CreateTag(RestApiTagPayload payload, IRequest request);

        /// <summary>
        /// Removes the tag with the given value.
        /// </summary>
        /// <param name="value">The value of the tag to delete.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// <see langword="true"/> when the tag existed and was deleted.
        /// </returns>
        protected abstract bool DeleteTag(string value, IRequest request);

        /// <summary>
        /// Returns the path segments of the request below the endpoint's base
        /// path. For an endpoint mounted at <c>/api/v1/tags</c> invoked with
        /// <c>/api/v1/tags/urgent</c>, the result is <c>[ "urgent" ]</c>.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The remaining segments.</returns>
        private static IReadOnlyList<string> GetRelativeSegments(IRequest request)
        {
            var path = request?.Uri?.PathSegments?
                .Select(x => x?.Value)
                .Where(x => !string.IsNullOrWhiteSpace(x) && x != "/")
                .ToList() ?? [];

            var basePath = request?.Uri?.BasePath?.PathSegments?
                .Select(x => x?.Value)
                .Where(x => !string.IsNullOrWhiteSpace(x) && x != "/")
                .ToList() ?? [];

            if (basePath.Count > 0 && path.Count >= basePath.Count)
            {
                var matches = true;
                for (var i = 0; i < basePath.Count; i++)
                {
                    if (!string.Equals(path[i], basePath[i], StringComparison.OrdinalIgnoreCase))
                    {
                        matches = false;
                        break;
                    }
                }

                if (matches)
                {
                    return path.Skip(basePath.Count).ToList();
                }
            }

            return path;
        }

        /// <summary>
        /// Tries to deserialize the request body into the requested payload
        /// type.
        /// </summary>
        /// <typeparam name="T">The payload type.</typeparam>
        /// <param name="request">The incoming request.</param>
        /// <returns>The payload, or <see langword="null"/> when missing or invalid.</returns>
        private static T GetPayload<T>(IRequest request)
            where T : class
        {
            if (request is not Request data || data.Content is null || data.Content.Length == 0)
            {
                return null;
            }

            try
            {
                return JsonSerializer.Deserialize<T>(data.Content, _jsonOptions);
            }
            catch (JsonException)
            {
                return null;
            }
        }

        /// <summary>
        /// Builds an <c>application/json</c> 200 response containing the
        /// serialized payload.
        /// </summary>
        /// <param name="payload">The payload to serialize.</param>
        /// <returns>The HTTP response.</returns>
        private static IResponse Json(object payload)
        {
            var json = JsonSerializer.Serialize(payload, _jsonOptions);

            return new ResponseOK
            {
                Content = Encoding.UTF8.GetBytes(json)
            }
                .AddHeaderContentType("application/json");
        }
    }
}
