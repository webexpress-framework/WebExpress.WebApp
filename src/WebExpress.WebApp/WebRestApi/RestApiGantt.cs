using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// A REST API endpoint backing the interactive gantt control. A single GET
    /// returns the whole project as tasks and links; the discrete mutations of
    /// the client persist REST-fully against sub-paths of the same base:
    /// POST /tasks, PUT /tasks/{id}, DELETE /tasks/{id}, POST /links and
    /// DELETE /links/{id}. A derived endpoint therefore only overrides the data
    /// hooks, and the routing, the payload parsing and the response shaping stay
    /// in one place. The endpoint must be registered with a segment and
    /// sub-paths enabled so the collection sub-paths reach it:
    ///
    /// <code>
    /// [Segment("plan")]
    /// [IncludeSubPaths(true)]
    /// [Title("Project plan")]
    /// public sealed class ProjectPlanApi : RestApiGantt { }
    /// </code>
    /// </summary>
    public class RestApiGantt : IRestApi
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /// <summary>
        /// Gets or sets the title associated with the plan, read from the
        /// endpoint's Title attribute.
        /// </summary>
        public string Title { get; protected set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestApiGantt()
        {
            // read the title attribute of the concrete endpoint, mirroring the
            // other data REST endpoints so the client can show a plan heading
            Title = GetType().CustomAttributes
                .Where(x => x?.AttributeType == typeof(TitleAttribute))
                .Select(x => x.ConstructorArguments.FirstOrDefault().Value?.ToString())
                .FirstOrDefault();
        }

        /// <summary>
        /// Handles the GET request that loads the whole project.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>A response carrying the tasks and links.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(IRequest request)
        {
            try
            {
                var result = new RestApiGanttResult
                {
                    Title = I18N.Translate(request, Title),
                    Tasks = RetrieveTasks(request),
                    Links = RetrieveLinks(request)
                };

                return result.ToResponse();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing get request.");
            }
        }

        /// <summary>
        /// Handles the POST request that creates a task (/tasks) or a link
        /// (/links). The created resource is echoed back, so the client can
        /// adopt a server assigned id.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The created resource, or an error response.</returns>
        [Method(RequestMethod.POST)]
        public virtual IResponse Create(IRequest request)
        {
            var segments = GetRelativeSegments(request);

            try
            {
                if (Matches(segments, "tasks"))
                {
                    var payload = GetPayload<RestApiGanttTask>(request);
                    if (payload is null)
                    {
                        return new ResponseBadRequest(new StatusMessage("invalid task payload."));
                    }

                    var created = CreateTask(payload, request);
                    return created is null
                        ? new ResponseBadRequest(new StatusMessage("creation failed."))
                        : ToJsonResponse(created);
                }

                if (Matches(segments, "links"))
                {
                    var payload = GetPayload<RestApiGanttLink>(request);
                    if (payload is null)
                    {
                        return new ResponseBadRequest(new StatusMessage("invalid link payload."));
                    }

                    var created = CreateLink(payload, request);
                    return created is null
                        ? new ResponseBadRequest(new StatusMessage("creation failed."))
                        : ToJsonResponse(created);
                }

                return new ResponseNotFound();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing post request.");
            }
        }

        /// <summary>
        /// Handles the PUT/PATCH request that persists a task change
        /// (/tasks/{id}).
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The updated task, or an error response.</returns>
        [Method(RequestMethod.PUT)]
        [Method(RequestMethod.PATCH)]
        public virtual IResponse Update(IRequest request)
        {
            var segments = GetRelativeSegments(request);

            try
            {
                if (segments.Count == 2 && EqualsSegment(segments[0], "tasks"))
                {
                    var payload = GetPayload<RestApiGanttTask>(request);
                    if (payload is null)
                    {
                        return new ResponseBadRequest(new StatusMessage("invalid task payload."));
                    }

                    var updated = UpdateTask(segments[1], payload, request);
                    return updated is null
                        ? new ResponseNotFound(new StatusMessage($"task '{segments[1]}' not found."))
                        : ToJsonResponse(updated);
                }

                return new ResponseNotFound();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing put request.");
            }
        }

        /// <summary>
        /// Handles the DELETE request that removes a task (/tasks/{id}) or a
        /// link (/links/{id}).
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>A no-content response on success, or an error response.</returns>
        [Method(RequestMethod.DELETE)]
        public virtual IResponse Delete(IRequest request)
        {
            var segments = GetRelativeSegments(request);

            try
            {
                if (segments.Count == 2 && EqualsSegment(segments[0], "tasks"))
                {
                    return DeleteTask(segments[1], request)
                        ? new ResponseNoContent()
                        : new ResponseNotFound(new StatusMessage($"task '{segments[1]}' not found."));
                }

                if (segments.Count == 2 && EqualsSegment(segments[0], "links"))
                {
                    return DeleteLink(segments[1], request)
                        ? new ResponseNoContent()
                        : new ResponseNotFound(new StatusMessage($"link '{segments[1]}' not found."));
                }

                return new ResponseNotFound();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing delete request.");
            }
        }

        /// <summary>
        /// Retrieves the tasks of the project. The default is empty; a derived
        /// endpoint returns the project's tasks.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The tasks.</returns>
        protected virtual IEnumerable<RestApiGanttTask> RetrieveTasks(IRequest request)
        {
            return [];
        }

        /// <summary>
        /// Retrieves the dependency links of the project. The default is empty;
        /// a derived endpoint returns the project's links.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The links.</returns>
        protected virtual IEnumerable<RestApiGanttLink> RetrieveLinks(IRequest request)
        {
            return [];
        }

        /// <summary>
        /// Persists a newly created task. A derived endpoint stores the task and
        /// returns it, assigning the canonical id it wants the client to adopt.
        /// Returning null signals a failed creation.
        /// </summary>
        /// <param name="task">The task to create.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The created task, or null on failure.</returns>
        protected virtual RestApiGanttTask CreateTask(RestApiGanttTask task, IRequest request)
        {
            return task;
        }

        /// <summary>
        /// Persists a task change. A derived endpoint applies the payload to the
        /// stored task and returns it. Returning null signals that the task does
        /// not exist.
        /// </summary>
        /// <param name="id">The task id from the sub-path.</param>
        /// <param name="task">The task payload.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The updated task, or null when unknown.</returns>
        protected virtual RestApiGanttTask UpdateTask(string id, RestApiGanttTask task, IRequest request)
        {
            return task;
        }

        /// <summary>
        /// Removes a task and its dependent data. A derived endpoint deletes the
        /// task's subtree and the links that touch it, matching the client which
        /// cascades the deletion.
        /// </summary>
        /// <param name="id">The task id from the sub-path.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>True when the task existed and was removed.</returns>
        protected virtual bool DeleteTask(string id, IRequest request)
        {
            return true;
        }

        /// <summary>
        /// Persists a newly created dependency link. A derived endpoint stores
        /// the link and returns it, assigning the canonical id. Returning null
        /// signals a failed creation.
        /// </summary>
        /// <param name="link">The link to create.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The created link, or null on failure.</returns>
        protected virtual RestApiGanttLink CreateLink(RestApiGanttLink link, IRequest request)
        {
            return link;
        }

        /// <summary>
        /// Removes a dependency link.
        /// </summary>
        /// <param name="id">The link id from the sub-path.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>True when the link existed and was removed.</returns>
        protected virtual bool DeleteLink(string id, IRequest request)
        {
            return true;
        }

        /// <summary>
        /// Writes an object as a JSON response, the shape the client reads to
        /// adopt a server assigned id.
        /// </summary>
        /// <param name="value">The value to serialise.</param>
        /// <returns>A response carrying the serialised value.</returns>
        protected static IResponse ToJsonResponse(object value)
        {
            var json = JsonSerializer.Serialize(value, _jsonOptions);

            return new ResponseOK
            {
                Content = Encoding.UTF8.GetBytes(json)
            }
                .AddHeaderContentType("application/json");
        }

        /// <summary>
        /// Deserialises the JSON request body into the given payload type, or
        /// returns null when the body is missing or malformed.
        /// </summary>
        /// <typeparam name="T">The payload type.</typeparam>
        /// <param name="request">The request whose content is parsed.</param>
        /// <returns>The payload, or null.</returns>
        protected static T GetPayload<T>(IRequest request)
            where T : class
        {
            if (request is not Request requestData || requestData.Content is null || requestData.Content.Length == 0)
            {
                return null;
            }

            try
            {
                return JsonSerializer.Deserialize<T>(requestData.Content, _jsonOptions);
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// Determines the request path segments relative to the endpoint base,
        /// so a sub-path request such as /tasks/{id} routes on the trailing
        /// segments. When the base path cannot be matched, the segments after
        /// the last tasks or links collection marker are used as a fallback.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The relative segments, empty for the base path itself.</returns>
        protected static List<string> GetRelativeSegments(IRequest request)
        {
            var path = request?.Uri?.PathSegments?
                .Select(x => x?.Value)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToList() ?? [];

            var basePath = request?.Uri?.BasePath?.PathSegments?
                .Select(x => x?.Value)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToList() ?? [];

            if (basePath.Count > 0 && path.Count >= basePath.Count)
            {
                var matches = true;
                for (var i = 0; i < basePath.Count; i++)
                {
                    if (!EqualsSegment(path[i], basePath[i]))
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

            var markerIndex = path.FindLastIndex(x => EqualsSegment(x, "tasks") || EqualsSegment(x, "links"));
            return markerIndex >= 0 ? path.Skip(markerIndex).ToList() : [];
        }

        /// <summary>
        /// Determines whether the segments match the expected sequence exactly.
        /// </summary>
        /// <param name="segments">The segments to compare.</param>
        /// <param name="expected">The expected sequence.</param>
        /// <returns>True on an exact match.</returns>
        protected static bool Matches(IReadOnlyList<string> segments, params string[] expected)
        {
            if (segments.Count != expected.Length)
            {
                return false;
            }

            for (var i = 0; i < expected.Length; i++)
            {
                if (!EqualsSegment(segments[i], expected[i]))
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>
        /// Compares two path segments for equality, ignoring case.
        /// </summary>
        /// <param name="a">The first segment.</param>
        /// <param name="b">The second segment.</param>
        /// <returns>True when equal ignoring case.</returns>
        protected static bool EqualsSegment(string a, string b)
        {
            return string.Equals(a, b, StringComparison.OrdinalIgnoreCase);
        }
    }
}
