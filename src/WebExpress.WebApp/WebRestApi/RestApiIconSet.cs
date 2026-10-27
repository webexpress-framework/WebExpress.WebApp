using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using WebExpress.WebApp.WebTheme;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// REST endpoint that backs the <c>ControlDataSelectionIconSet</c> selector.
    /// <para>
    /// It speaks the envelope of <see cref="RestApiTheme"/> - <c>GET</c> returns
    /// <c>{ items, selected }</c>, <c>PUT</c>/<c>POST</c> with <c>v</c> stores a choice - so
    /// the same client dropdown serves both preferences. The offered sets come from
    /// <see cref="ThemePreferences.RegisterIconSets"/>; an id outside them is refused here,
    /// before it reaches the store.
    /// </para>
    /// <para>
    /// Storage is the application's: it overrides <see cref="GetActiveIconSetId"/> and
    /// <see cref="PersistSelection"/>, and <see cref="CreateContext"/> when the store needs a
    /// transactional scope such as a database unit of work.
    /// </para>
    /// </summary>
    public abstract class RestApiIconSet : IRestApi
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /// <summary>
        /// Returns the icon sets offered by the request's application.
        /// </summary>
        /// <param name="request">The current HTTP request.</param>
        /// <returns>JSON response with the selectable icon sets.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(IRequest request)
        {
            try
            {
                using var context = CreateContext();
                var selectedId = GetActiveIconSetId(context, request);
                var items = ThemePreferences.GetIconSets(request?.ApplicationContext)
                    .Select(x => MapToItem(x, request, selectedId))
                    .ToList();

                return Json(new { items, selected = selectedId });
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "Error processing request.");
            }
        }

        /// <summary>
        /// Hands an offered icon set id (parameter <c>v</c>, empty to clear) to
        /// <see cref="PersistSelection"/>.
        /// </summary>
        /// <param name="request">The current HTTP request.</param>
        /// <returns>JSON response carrying the stored icon set id.</returns>
        [Method(RequestMethod.PUT)]
        [Method(RequestMethod.POST)]
        public virtual IResponse Update(IRequest request)
        {
            try
            {
                var value = request.GetParameter("v")?.Value?.Trim();
                var iconSet = string.IsNullOrEmpty(value)
                    ? null
                    : ThemePreferences.GetIconSets(request.ApplicationContext)
                        .FirstOrDefault(x => string.Equals(x.Id, value, StringComparison.OrdinalIgnoreCase))
                        ?? throw new ArgumentException("The selected icon set is not offered by this application.", nameof(request));

                using var context = CreateContext();
                PersistSelection(iconSet?.Id, context, request);

                return Json(new { selected = GetActiveIconSetId(context, request) });
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "Error processing request.");
            }
        }

        /// <summary>
        /// Creates the query context shared by the read and the write of one request.
        /// Override to bind a transactional scope of the store.
        /// </summary>
        /// <returns>An <see cref="IQueryContext"/> for the current request.</returns>
        protected virtual IQueryContext CreateContext()
        {
            return new DefaultQueryContext();
        }

        /// <summary>
        /// Returns the stored icon set id of the request, or <see langword="null"/> when the
        /// framework drawings apply.
        /// </summary>
        /// <param name="context">The query context shared with the GET/PUT handler.</param>
        /// <param name="request">The current HTTP request.</param>
        /// <returns>The stored icon set id or <see langword="null"/>.</returns>
        protected abstract string GetActiveIconSetId(IQueryContext context, IRequest request);

        /// <summary>
        /// Stores an icon set id that the application offers, or removes the preference.
        /// </summary>
        /// <param name="iconSetId">The validated icon set id, or <see langword="null"/> to clear.</param>
        /// <param name="context">The query context shared with the PUT handler.</param>
        /// <param name="request">The current HTTP request.</param>
        protected abstract void PersistSelection(string iconSetId, IQueryContext context, IRequest request);

        /// <summary>
        /// Maps an icon set to the item shape the dropdown consumes.
        /// </summary>
        /// <param name="iconSet">The icon set to map.</param>
        /// <param name="request">The triggering request.</param>
        /// <param name="selectedId">The stored icon set id, or null.</param>
        /// <returns>The dictionary serialised by <see cref="Retrieve"/>.</returns>
        protected virtual IDictionary<string, object> MapToItem(IconSet iconSet, IRequest request, string selectedId)
        {
            var name = I18N.Translate(request, iconSet.Name) ?? iconSet.Id;
            var item = new Dictionary<string, object>
            {
                ["id"] = iconSet.Id,
                ["content"] = name,
                ["name"] = name
            };

            var description = I18N.Translate(request, iconSet.Description);
            if (!string.IsNullOrWhiteSpace(description))
            {
                item["description"] = description;
            }

            // the address the server links the set under, so the picker can swap it in place
            if (!string.IsNullOrWhiteSpace(iconSet.Stylesheet) && request?.ApplicationContext?.Route is { } route)
            {
                item["stylesheet"] = route.Concat(iconSet.Stylesheet).ToString();
            }

            if (string.Equals(selectedId, iconSet.Id, StringComparison.OrdinalIgnoreCase))
            {
                item["selected"] = true;
            }

            return item;
        }

        /// <summary>
        /// Wraps the payload as <c>application/json</c>.
        /// </summary>
        /// <param name="payload">The payload to serialize.</param>
        /// <returns>The JSON response.</returns>
        private static IResponse Json(object payload)
        {
            return new ResponseOK
            {
                Content = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload, _jsonOptions))
            }
                .AddHeaderContentType("application/json");
        }
    }
}
