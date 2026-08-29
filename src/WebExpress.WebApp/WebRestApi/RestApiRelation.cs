using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using WebExpress.WebApp.WebRelation;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract base class of the link endpoint that backs the link surface of
    /// one object. It implements the whole generic half of the hybrid link
    /// system - the filtering, the grouping by relation, the perspective that
    /// decides which of the two type labels applies, and the validation against
    /// the registry - and leaves an implementation only the questions that
    /// depend on where the links and the objects are stored.
    ///
    /// The endpoint is deliberately unaware of what a relation means. It reads
    /// the registered systems and types at request time, so a relation a plugin
    /// contributed is served without a change here.
    ///
    /// The contract is:
    /// <code>
    /// GET    {base}?kind=&amp;type=&amp;system=&amp;status=&amp;target=&amp;q=  -> RestApiRelationResult
    /// POST   {base}            body RestApiRelationPayload      -> RestApiRelationItem
    /// PUT    {base}/{id}       body RestApiRelationPayload      -> RestApiRelationItem
    /// DELETE {base}/{id}                                    -> 204
    /// </code>
    /// </summary>
    public abstract class RestApiRelation : IRestApi
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };

        /// <summary>
        /// Handles <c>GET {base}</c>: answers the links of the addressed object,
        /// grouped by relation and narrowed by the filter.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(IRequest request)
        {
            try
            {
                var subject = RetrieveSubject(request);
                if (subject == null)
                {
                    return new ResponseNotFound();
                }

                var filter = RestApiRelationFilter.From(request);
                filter.Source ??= subject.Key;

                // the category is applied here rather than in the query, because
                // the tab that is not shown still reports its number
                var links = (RetrieveLinks(filter.WithoutKind(), request) ?? [])
                    .Where(x => x != null)
                    .ToList();

                var byKind = links.ToLookup(x => KindOf(x));
                var shown = links
                    .Where(x => !filter.Kind.HasValue || KindOf(x) == filter.Kind.Value)
                    .ToList();

                return Json(new RestApiRelationResult
                {
                    Groups = BuildGroups(shown, subject.Key, request),
                    Total = shown.Count,
                    ObjectCount = byKind[RelationKind.Object].Count(),
                    ExternalCount = byKind[RelationKind.External].Count()
                });
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing get request.");
            }
        }

        /// <summary>
        /// Handles <c>POST {base}</c>: establishes a link from the addressed
        /// object.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.POST)]
        public virtual IResponse Create(IRequest request)
        {
            try
            {
                if (GetRelativeSegments(request).Count != 0)
                {
                    return new ResponseNotFound();
                }

                var payload = GetPayload<RestApiRelationPayload>(request);
                if (payload == null)
                {
                    return new ResponseBadRequest(new StatusMessage("missing or invalid payload."));
                }

                var subject = RetrieveSubject(request);
                if (subject == null)
                {
                    return new ResponseNotFound();
                }

                var link = payload.ToLink(subject);
                var validation = Validate(link, request);
                if (!validation.IsValid)
                {
                    return Rejected(validation, request);
                }

                var created = CreateLink(link, request);

                return created == null
                    ? new ResponseBadRequest(new StatusMessage("the link could not be stored."))
                    : Json(RestApiRelationItem.From(created, subject.Key));
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing post request.");
            }
        }

        /// <summary>
        /// Handles <c>PUT {base}/{id}</c>: changes the relation, the status or
        /// the note of an existing link. The two ends are not moved, because a
        /// link between other objects is a different link.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.PUT)]
        public virtual IResponse Update(IRequest request)
        {
            try
            {
                var segments = GetRelativeSegments(request);
                if (segments.Count != 1)
                {
                    return new ResponseNotFound();
                }

                var payload = GetPayload<RestApiRelationPayload>(request);
                if (payload == null)
                {
                    return new ResponseBadRequest(new StatusMessage("missing or invalid payload."));
                }

                var stored = RetrieveLink(segments[0], request);
                if (stored == null)
                {
                    return new ResponseNotFound();
                }

                Apply(payload, stored);

                var validation = Validate(stored, request);
                if (!validation.IsValid)
                {
                    return Rejected(validation, request);
                }

                var updated = UpdateLink(stored, request);
                var subject = RetrieveSubject(request);

                return updated == null
                    ? new ResponseBadRequest(new StatusMessage("the link could not be stored."))
                    : Json(RestApiRelationItem.From(updated, subject?.Key));
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing put request.");
            }
        }

        /// <summary>
        /// Handles <c>DELETE {base}/{id}</c>: removes a link.
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

                return DeleteLink(segments[0], request)
                    ? new ResponseNoContent()
                    : new ResponseNotFound();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing delete request.");
            }
        }

        /// <summary>
        /// Returns the object the surface belongs to, resolved from the route or
        /// from a request parameter. It is the source of every link created here
        /// and the perspective every link is read from.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// The object, or <see langword="null"/> when the route addresses none,
        /// which is answered as not found.
        /// </returns>
        protected abstract RelationReference RetrieveSubject(IRequest request);

        /// <summary>
        /// Returns the links matching the filter. An implementation that cannot
        /// push every criterion into its query returns the links of
        /// <see cref="RestApiRelationFilter.Source"/> and lets
        /// <see cref="RestApiRelationFilter.Matches"/> narrow them.
        /// </summary>
        /// <param name="filter">The criteria, with the category already removed.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The links.</returns>
        protected abstract IEnumerable<Relation> RetrieveLinks(RestApiRelationFilter filter, IRequest request);

        /// <summary>
        /// Returns a single stored link.
        /// </summary>
        /// <param name="id">The identity of the link.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The link, or <see langword="null"/> when it is unknown.</returns>
        protected abstract Relation RetrieveLink(string id, IRequest request);

        /// <summary>
        /// Persists a validated link and returns it with its assigned identity.
        /// </summary>
        /// <param name="link">The validated link.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The stored link, or <see langword="null"/> when it was rejected.</returns>
        protected abstract Relation CreateLink(Relation link, IRequest request);

        /// <summary>
        /// Persists the changes of a validated link.
        /// </summary>
        /// <param name="link">The validated link.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The stored link, or <see langword="null"/> when it was rejected.</returns>
        protected abstract Relation UpdateLink(Relation link, IRequest request);

        /// <summary>
        /// Removes a link.
        /// </summary>
        /// <param name="id">The identity of the link.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns><see langword="true"/> when the link existed and was removed.</returns>
        protected abstract bool DeleteLink(string id, IRequest request);

        /// <summary>
        /// Determines whether a referenced object exists. Both ends of a new link
        /// are checked through it, so a link can never be stored against a key
        /// that was mistyped or an object that was meanwhile deleted.
        /// </summary>
        /// <param name="reference">The reference to resolve.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns><see langword="true"/> when the object exists.</returns>
        protected abstract bool Exists(RelationReference reference, IRequest request);

        /// <summary>
        /// Returns the links that already touch either end of a candidate, which
        /// the duplicate and the cardinality check are evaluated against. The
        /// default answers the links of both ends through
        /// <see cref="RetrieveLinks"/>; an implementation with an indexed store
        /// narrows it further.
        /// </summary>
        /// <param name="link">The candidate.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The neighbouring links.</returns>
        protected virtual IEnumerable<Relation> RetrieveNeighbourhood(Relation link, IRequest request)
        {
            var fromSource = RetrieveLinks(new RestApiRelationFilter { Source = link?.Source?.Key, Type = link?.Type }, request) ?? [];

            if (link?.Target == null || !link.Target.IsObject())
            {
                return fromSource;
            }

            var fromTarget = RetrieveLinks(new RestApiRelationFilter { Source = link.Target.Key, Type = link.Type }, request) ?? [];

            return fromSource.Concat(fromTarget);
        }

        /// <summary>
        /// Returns the category a link belongs to. It follows the registered
        /// system; a link of a system that was meanwhile removed is classified by
        /// its target, so it keeps rendering in the tab it was created in.
        /// </summary>
        /// <param name="link">The link.</param>
        /// <returns>The category.</returns>
        protected virtual RelationKind KindOf(Relation link)
        {
            var system = RelationRegistry.GetSystem(link?.System);

            if (system != null)
            {
                return system.Kind;
            }

            return link?.Target?.IsObject() == true ? RelationKind.Object : RelationKind.External;
        }

        /// <summary>
        /// Validates a link against the registry, the existence of its two ends
        /// and the links that already surround them.
        /// </summary>
        /// <param name="link">The link to validate.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The outcome.</returns>
        protected virtual RelationValidationResult Validate(Relation link, IRequest request)
        {
            return RelationRegistry.Validate(link, reference => Exists(reference, request), RetrieveNeighbourhood(link, request));
        }

        /// <summary>
        /// Applies the changeable fields of a payload onto a stored link. The two
        /// ends and the system stay untouched, so an update cannot silently turn
        /// a link into a different one.
        /// </summary>
        /// <param name="payload">The request body.</param>
        /// <param name="link">The stored link.</param>
        private static void Apply(RestApiRelationPayload payload, Relation link)
        {
            if (!string.IsNullOrWhiteSpace(payload.Type))
            {
                link.Type = payload.Type;
            }

            if (!string.IsNullOrWhiteSpace(payload.Status))
            {
                link.Status = RestApiRelationWire.Status(payload.Status);
            }

            if (!string.IsNullOrWhiteSpace(payload.Direction))
            {
                link.Direction = RestApiRelationWire.Direction(payload.Direction);
            }

            if (payload.Comment != null)
            {
                link.Comment = payload.Comment;
            }

            if (!string.IsNullOrWhiteSpace(payload.Title) && link.Target != null)
            {
                link.Target.Title = payload.Title;
            }

            foreach (var entry in payload.Metadata ?? new Dictionary<string, string>())
            {
                link.Metadata[entry.Key] = entry.Value;
            }
        }

        /// <summary>
        /// Groups the links by the relation they carry and by the end the
        /// rendering object sits on, which is what makes "blocks" and "is blocked
        /// by" two headings of one type. The groups follow the administered order
        /// of the types.
        /// </summary>
        /// <param name="links">The links to render.</param>
        /// <param name="key">The key of the rendering object.</param>
        /// <param name="request">The incoming request, carrying the culture.</param>
        /// <returns>The groups.</returns>
        private IEnumerable<RestApiRelationGroup> BuildGroups(IEnumerable<Relation> links, string key, IRequest request)
        {
            var order = RelationRegistry.Types
                .Select((type, index) => new { type.Id, index })
                .ToDictionary(x => x.Id, x => x.index, StringComparer.OrdinalIgnoreCase);

            return links
                .GroupBy(x => new { x.Type, Inverse = x.IsInverseFor(key) })
                .OrderBy(x => order.TryGetValue(x.Key.Type ?? string.Empty, out var index) ? index : int.MaxValue)
                .ThenBy(x => x.Key.Inverse)
                .Select(group =>
                {
                    var type = RelationRegistry.GetType(group.Key.Type);
                    var items = group
                        .OrderBy(x => x.Created)
                        .Select(x => RestApiRelationItem.From(x, key))
                        .ToList();

                    return new RestApiRelationGroup
                    {
                        Type = group.Key.Type,
                        Inverse = group.Key.Inverse,
                        Label = Label(type, group.Key.Inverse, request) ?? group.Key.Type,
                        Counterpart = type?.Symmetric == true ? null : Label(type, !group.Key.Inverse, request),
                        Icon = type?.Icon ?? "link",
                        Effect = RestApiRelationWire.Token(type?.Effect ?? RelationEffect.None),
                        Symmetric = type?.Symmetric ?? false,
                        Count = items.Count,
                        Items = items
                    };
                })
                .ToList();
        }

        /// <summary>
        /// Returns the translated label of a relation as read from one of its two
        /// ends.
        /// </summary>
        /// <param name="type">The relation type, may be unknown.</param>
        /// <param name="inverse">Whether the relation is read from its target.</param>
        /// <param name="request">The incoming request, carrying the culture.</param>
        /// <returns>The label, or <see langword="null"/> when the type is unknown.</returns>
        private static string Label(IRelationType type, bool inverse, IRequest request)
        {
            if (type == null)
            {
                return null;
            }

            var key = inverse && !type.Symmetric ? type.InverseLabel : type.Label;

            return string.IsNullOrEmpty(key) ? null : I18N.Translate(request, key);
        }

        /// <summary>
        /// Answers a rejected link with its machine readable reason, so the
        /// client renders a translated message instead of matching on prose.
        /// </summary>
        /// <param name="validation">The failed validation.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        private static IResponse Rejected(RelationValidationResult validation, IRequest request)
        {
            // the translation falls back to the key when the bundle does not know
            // it, which is how a code a plugin introduced still reaches the client
            var key = $"webexpress.webapp:{validation.Code}";
            var translated = I18N.Translate(request, key);

            var json = JsonSerializer.Serialize(new
            {
                code = validation.Code,
                message = translated == key ? validation.Message : translated
            }, _jsonOptions);

            return new ResponseBadRequest
            {
                Content = Encoding.UTF8.GetBytes(json)
            }
                .AddHeaderContentType("application/json");
        }

        /// <summary>
        /// Returns the path segments of the request below the endpoint base path.
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
        /// Tries to deserialize the request body into the requested payload type.
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
