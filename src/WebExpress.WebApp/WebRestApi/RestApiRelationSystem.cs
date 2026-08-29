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

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// The endpoint the add dialog reads its sidebar from: every registered link
    /// system with the relation types it offers. It is what makes the dialog
    /// extensible without a change to the client - a plugin registers its system
    /// in <see cref="RelationRegistry"/> and the entry appears, grouped under the
    /// contributed systems and carrying its version and its enabled state.
    ///
    /// The class is concrete because the answer is entirely derived from the
    /// registry; an endpoint that has to hide systems from certain users
    /// overrides <see cref="RetrieveSystems"/>.
    ///
    /// The contract is:
    /// <code>
    /// GET {base}?kind=&amp;enabled= -> RestApiRelationSystemItem[]
    /// </code>
    /// </summary>
    public class RestApiRelationSystem : IRestApi
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };

        /// <summary>
        /// Handles <c>GET {base}</c>: answers the registered systems.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(IRequest request)
        {
            try
            {
                var kind = request.GetParameter("kind")?.Value;
                var enabled = request.GetParameter("enabled")?.Value;

                var systems = (RetrieveSystems(request) ?? [])
                    .Where(x => x != null)
                    .Where(x => string.IsNullOrWhiteSpace(kind) || x.Kind == RestApiRelationWire.Kind(kind))
                    .Where(x => string.IsNullOrWhiteSpace(enabled) || x.Enabled == string.Equals(enabled, "true", StringComparison.OrdinalIgnoreCase))
                    .Select(x => ToItem(x, request))
                    .ToList();

                return Json(systems);
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing get request.");
            }
        }

        /// <summary>
        /// Returns the systems the caller may link through. The default answers
        /// every registered system.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The systems.</returns>
        protected virtual IEnumerable<IRelationSystem> RetrieveSystems(IRequest request)
        {
            return RelationRegistry.Systems;
        }

        /// <summary>
        /// Returns the id of the client panel that renders the fields of a
        /// system. The default derives it from the system id, which is the
        /// convention the two native panels follow; a plugin whose panel is
        /// registered under another name overrides it.
        /// </summary>
        /// <param name="system">The system.</param>
        /// <returns>The panel id.</returns>
        protected virtual string PanelOf(IRelationSystem system)
        {
            return system?.Id;
        }

        /// <summary>
        /// Projects a system onto the wire, translating its texts and the types
        /// it offers into the culture of the request. Only active types are
        /// offered, because the dialog creates links and a deactivated type may
        /// no longer be used.
        /// </summary>
        /// <param name="system">The system.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The wire item.</returns>
        private RestApiRelationSystemItem ToItem(IRelationSystem system, IRequest request)
        {
            var types = RelationRegistry.TypesOf(system.Id, activeOnly: true)
                .Select(type => RestApiRelationTypeItem.From(
                    type,
                    Translate(type.Label, request),
                    type.Symmetric ? Translate(type.Label, request) : Translate(type.InverseLabel, request),
                    Translate(type.Description, request)))
                .ToList();

            var item = RestApiRelationSystemItem.From(
                system,
                Translate(system.Label, request),
                Translate(system.Description, request),
                types);

            item.Panel = PanelOf(system);

            return item;
        }

        /// <summary>
        /// Translates a text, tolerating prose rather than an i18n key.
        /// </summary>
        /// <param name="value">The text or key.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The translated text.</returns>
        private static string Translate(string value, IRequest request)
        {
            return string.IsNullOrEmpty(value) ? value : I18N.Translate(request, value);
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
