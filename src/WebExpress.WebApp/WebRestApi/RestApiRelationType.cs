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
    /// Abstract base class of the endpoint that administers the relation types of
    /// a class. It serves the type table and its editor: which relations exist,
    /// how they are named from either end, which classes they accept, how often
    /// they may meet, what they do to the workflow and how heavily they are
    /// already used.
    ///
    /// Creating and editing a type goes through the same door a plugin uses,
    /// <see cref="RelationRegistry.RegisterType"/>, so a relation an administrator
    /// invents and one a plugin ships are indistinguishable to every surface that
    /// reads them.
    ///
    /// The contract is:
    /// <code>
    /// GET    {base}?q=&amp;class=&amp;system=                    -> RestApiRelationTypeResult
    /// POST   {base}        body RestApiRelationTypePayload      -> RestApiRelationTypeItem
    /// POST   {base}/order  body RestApiRelationTypeOrderPayload -> 204
    /// PUT    {base}/{id}   body RestApiRelationTypePayload      -> RestApiRelationTypeItem
    /// DELETE {base}/{id}                                    -> 204
    /// </code>
    /// </summary>
    public abstract class RestApiRelationType : IRestApi
    {
        /// <summary>
        /// The trailing segment that addresses the order of the types rather than
        /// a single type, which is why it is not a legal type id.
        /// </summary>
        private const string OrderSegment = "order";

        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };

        /// <summary>
        /// Handles <c>GET {base}</c>: answers the administered types together with
        /// the counts of the caption and the classes the editor offers.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(IRequest request)
        {
            try
            {
                var search = request.GetParameter("q")?.Value;
                var targetClass = request.GetParameter("class")?.Value;
                var system = request.GetParameter("system")?.Value;

                var all = (RetrieveTypes(request) ?? []).Where(x => x != null).ToList();
                var shown = all
                    .Where(x => string.IsNullOrWhiteSpace(system) || string.Equals(x.System, system, StringComparison.OrdinalIgnoreCase))
                    .Where(x => Accepts(x, targetClass))
                    .Where(x => Matches(x, search, request))
                    .ToList();

                return Json(new RestApiRelationTypeResult
                {
                    Items = shown.Select(x => ToItem(x, request)).ToList(),
                    Total = all.Count,
                    Active = all.Count(x => x.Active),
                    Classes = RetrieveClasses(request) ?? []
                });
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing get request.");
            }
        }

        /// <summary>
        /// Handles <c>POST {base}</c>, which defines a new type, and
        /// <c>POST {base}/order</c>, which rearranges the existing ones.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.POST)]
        public virtual IResponse Create(IRequest request)
        {
            try
            {
                var segments = GetRelativeSegments(request);

                if (segments.Count == 1 && string.Equals(segments[0], OrderSegment, StringComparison.OrdinalIgnoreCase))
                {
                    var order = GetPayload<RestApiRelationTypeOrderPayload>(request);

                    return order?.Ids == null
                        ? new ResponseBadRequest(new StatusMessage("missing or invalid payload."))
                        : ApplyOrder(order.Ids.Where(x => !string.IsNullOrWhiteSpace(x)).ToList(), request)
                            ? new ResponseNoContent()
                            : new ResponseNotFound();
                }

                if (segments.Count != 0)
                {
                    return new ResponseNotFound();
                }

                var payload = GetPayload<RestApiRelationTypePayload>(request);
                if (payload == null)
                {
                    return new ResponseBadRequest(new StatusMessage("missing or invalid payload."));
                }

                var id = string.IsNullOrWhiteSpace(payload.Id) ? DeriveId(payload.Label) : payload.Id.Trim();
                var rejection = Reject(payload, id, isCreate: true, request);
                if (rejection != null)
                {
                    return rejection;
                }

                var stored = StoreType(payload.ToRelationType(id), request);

                return stored == null
                    ? new ResponseBadRequest(new StatusMessage("the link type could not be stored."))
                    : Json(ToItem(stored, request));
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing post request.");
            }
        }

        /// <summary>
        /// Handles <c>PUT {base}/{id}</c>: changes an existing type. The id is
        /// never changed, because the stored links reference it.
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

                var payload = GetPayload<RestApiRelationTypePayload>(request);
                if (payload == null)
                {
                    return new ResponseBadRequest(new StatusMessage("missing or invalid payload."));
                }

                var id = segments[0];
                if (!(RetrieveTypes(request) ?? []).Any(x => string.Equals(x?.Id, id, StringComparison.OrdinalIgnoreCase)))
                {
                    return new ResponseNotFound();
                }

                var rejection = Reject(payload, id, isCreate: false, request);
                if (rejection != null)
                {
                    return rejection;
                }

                var stored = StoreType(payload.ToRelationType(id), request);

                return stored == null
                    ? new ResponseBadRequest(new StatusMessage("the link type could not be stored."))
                    : Json(ToItem(stored, request));
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing put request.");
            }
        }

        /// <summary>
        /// Handles <c>DELETE {base}/{id}</c>: drops a type that is not in use. A
        /// type with links is deactivated instead, so the meaning of the stored
        /// links is never lost.
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

                if (RetrieveUsage(segments[0], request) > 0)
                {
                    return Rejected("relation.type.in.use", "the link type is still in use and can only be deactivated.", request);
                }

                return RemoveType(segments[0], request)
                    ? new ResponseNoContent()
                    : new ResponseNotFound();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing delete request.");
            }
        }

        /// <summary>
        /// Returns the administered types. The usual implementation answers
        /// <see cref="RelationRegistry.Types"/>, optionally narrowed to the systems
        /// the surface administers.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The types.</returns>
        protected abstract IEnumerable<IRelationType> RetrieveTypes(IRequest request);

        /// <summary>
        /// Persists a created or edited type and publishes it. An implementation
        /// stores the definition and hands it to
        /// <see cref="RelationRegistry.RegisterType"/>, so the change is immediately
        /// visible to every surface.
        /// </summary>
        /// <param name="type">The type to store.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The stored type, or <see langword="null"/> when it was rejected.</returns>
        protected abstract IRelationType StoreType(RelationType type, IRequest request);

        /// <summary>
        /// Removes a type that carries no links.
        /// </summary>
        /// <param name="id">The id of the type.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns><see langword="true"/> when the type existed and was removed.</returns>
        protected abstract bool RemoveType(string id, IRequest request);

        /// <summary>
        /// Returns how many stored links carry the type, which the table shows
        /// and the delete guards against.
        /// </summary>
        /// <param name="id">The id of the type.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The number of links.</returns>
        protected abstract int RetrieveUsage(string id, IRequest request);

        /// <summary>
        /// Returns the classes a type may accept as a target. The default answers
        /// none, which renders the editor with the "all classes" option alone.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The classes.</returns>
        protected virtual IEnumerable<RestApiRelationClassItem> RetrieveClasses(IRequest request)
        {
            return [];
        }

        /// <summary>
        /// Rearranges the types. The default rewrites the order of the known
        /// types through <see cref="StoreType"/>, which is correct for any store
        /// that persists the whole definition; an implementation with its own
        /// order column overrides it.
        /// </summary>
        /// <param name="ids">The ids in their new order.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns><see langword="true"/> when the order was applied.</returns>
        protected virtual bool ApplyOrder(IReadOnlyList<string> ids, IRequest request)
        {
            var known = (RetrieveTypes(request) ?? [])
                .Where(x => x != null)
                .ToDictionary(x => x.Id, x => x, StringComparer.OrdinalIgnoreCase);

            var applied = false;

            for (var i = 0; i < ids.Count; i++)
            {
                if (!known.TryGetValue(ids[i], out var type))
                {
                    continue;
                }

                StoreType(Copy(type, i + 1), request);
                applied = true;
            }

            return applied;
        }

        /// <summary>
        /// Determines whether a type is shipped by code rather than defined
        /// through this surface. The default treats every type as editable; an
        /// application that ships fixed relations answers true for them, which
        /// hides the delete on the row.
        /// </summary>
        /// <param name="type">The type.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns><see langword="true"/> when the type is shipped.</returns>
        protected virtual bool IsBuiltin(IRelationType type, IRequest request)
        {
            return false;
        }

        /// <summary>
        /// Projects a type onto the wire, translating its texts into the culture
        /// of the request and resolving its usage.
        /// </summary>
        /// <param name="type">The registered type.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The wire item.</returns>
        private RestApiRelationTypeItem ToItem(IRelationType type, IRequest request)
        {
            var item = RestApiRelationTypeItem.From(
                type,
                Translate(type.Label, request),
                type.Symmetric ? Translate(type.Label, request) : Translate(type.InverseLabel, request),
                Translate(type.Description, request));

            item.Usage = RetrieveUsage(type.Id, request);
            item.Builtin = IsBuiltin(type, request);

            return item;
        }

        /// <summary>
        /// Returns the reason a payload cannot be stored, or
        /// <see langword="null"/> when it can. The rules are the ones the editor
        /// enforces as well; they are repeated here because a request does not
        /// have to come from that editor.
        /// </summary>
        /// <param name="payload">The request body.</param>
        /// <param name="id">The resolved id.</param>
        /// <param name="isCreate">Whether the type is being defined rather than edited.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The rejection, or <see langword="null"/>.</returns>
        private IResponse Reject(RestApiRelationTypePayload payload, string id, bool isCreate, IRequest request)
        {
            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(payload.Label))
            {
                return Rejected("relation.type.label.required", "the link type needs a label.", request);
            }

            if (!payload.Symmetric && string.IsNullOrWhiteSpace(payload.Inverse))
            {
                return Rejected("relation.type.inverse.required", "a link type that is not symmetric needs a counterpart label.", request);
            }

            var system = string.IsNullOrWhiteSpace(payload.System) ? RelationSystem.Object : payload.System;
            if (RelationRegistry.GetSystem(system) == null)
            {
                return Rejected(RelationValidationResult.UnknownSystem, $"the link system '{system}' is not registered.", request);
            }

            var taken = (RetrieveTypes(request) ?? []).Any(x => string.Equals(x?.Id, id, StringComparison.OrdinalIgnoreCase));

            return isCreate && taken
                ? Rejected("relation.type.duplicate", $"a link type with the id '{id}' already exists.", request)
                : null;
        }

        /// <summary>
        /// Determines whether a type accepts the class the table is filtered by.
        /// A type without target classes accepts every class and therefore passes
        /// every filter.
        /// </summary>
        /// <param name="type">The type.</param>
        /// <param name="targetClass">The class, may be absent.</param>
        /// <returns><see langword="true"/> when the type passes.</returns>
        private static bool Accepts(IRelationType type, string targetClass)
        {
            if (string.IsNullOrWhiteSpace(targetClass))
            {
                return true;
            }

            var classes = type.TargetClasses?.ToList() ?? [];

            return classes.Count == 0 || classes.Contains(targetClass, StringComparer.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Determines whether a type matches the free text of the table, which is
        /// searched against the translated labels the user actually reads.
        /// </summary>
        /// <param name="type">The type.</param>
        /// <param name="search">The free text, may be absent.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns><see langword="true"/> when the type matches.</returns>
        private static bool Matches(IRelationType type, string search, IRequest request)
        {
            if (string.IsNullOrWhiteSpace(search))
            {
                return true;
            }

            return Contains(type.Id, search)
                || Contains(Translate(type.Label, request), search)
                || Contains(Translate(type.InverseLabel, request), search);
        }

        /// <summary>
        /// Determines whether a field carries the searched text.
        /// </summary>
        /// <param name="value">The field.</param>
        /// <param name="search">The searched text.</param>
        /// <returns><see langword="true"/> when the text was found.</returns>
        private static bool Contains(string value, string search)
        {
            return value != null && value.Contains(search, StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Translates a label, tolerating a label that is plain prose rather than
        /// an i18n key - which is what a type defined through this surface
        /// carries.
        /// </summary>
        /// <param name="value">The label or key.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The translated label.</returns>
        private static string Translate(string value, IRequest request)
        {
            return string.IsNullOrEmpty(value) ? value : I18N.Translate(request, value);
        }

        /// <summary>
        /// Returns a copy of a type at a new position, so the reorder does not
        /// depend on the registered instance being mutable.
        /// </summary>
        /// <param name="type">The type to copy.</param>
        /// <param name="order">The new position.</param>
        /// <returns>The copy.</returns>
        private static RelationType Copy(IRelationType type, int order)
        {
            var copy = new RelationType
            {
                Id = type.Id,
                Label = type.Label,
                InverseLabel = type.InverseLabel,
                Symmetric = type.Symmetric,
                System = type.System,
                Cardinality = type.Cardinality,
                Effect = type.Effect,
                Active = type.Active,
                Description = type.Description,
                Icon = type.Icon,
                Order = order
            };

            foreach (var targetClass in type.TargetClasses ?? [])
            {
                copy.TargetClasses.Add(targetClass);
            }

            return copy;
        }

        /// <summary>
        /// Derives a stable id from a label, for a type the editor created
        /// without naming one.
        /// </summary>
        /// <param name="label">The label.</param>
        /// <returns>The derived id, or <see langword="null"/> when the label was empty.</returns>
        private static string DeriveId(string label)
        {
            if (string.IsNullOrWhiteSpace(label))
            {
                return null;
            }

            var builder = new StringBuilder();

            foreach (var character in label.Trim().ToLowerInvariant())
            {
                if (char.IsLetterOrDigit(character))
                {
                    builder.Append(character);
                }
                else if (builder.Length > 0 && builder[^1] != '-')
                {
                    builder.Append('-');
                }
            }

            var id = builder.ToString().Trim('-');

            return id.Length > 0 ? id : null;
        }

        /// <summary>
        /// Answers a rejected request with its machine readable reason.
        /// </summary>
        /// <param name="code">The reason code.</param>
        /// <param name="message">The fallback message.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        private static IResponse Rejected(string code, string message, IRequest request)
        {
            var key = $"webexpress.webapp:{code}";
            var translated = I18N.Translate(request, key);

            var json = JsonSerializer.Serialize(new
            {
                code,
                message = translated == key ? message : translated
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
