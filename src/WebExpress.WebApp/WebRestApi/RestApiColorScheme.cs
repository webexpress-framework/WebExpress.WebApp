using System;
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
    /// REST endpoint that stores the visitor's light or dark mode.
    /// <para>
    /// It speaks the envelope of <see cref="RestApiTheme"/>, so the theme dropdown serves as its
    /// picker, and it is also the target of the client's dark mode switch once the page
    /// announces it (<c>data-wx-theme-service</c>). The values are fixed
    /// (<see cref="ColorScheme.All"/>); anything else is refused here, and an empty value
    /// clears the choice. Without a stored choice <c>selected</c> is null and the picker shows
    /// the mode the page is rendered in, which only the page knows.
    /// </para>
    /// <para>
    /// Storage is the application's: it overrides <see cref="GetActiveColorScheme"/> and
    /// <see cref="PersistSelection"/>, and <see cref="CreateContext"/> for a transactional scope.
    /// </para>
    /// </summary>
    public abstract class RestApiColorScheme : IRestApi
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /// <summary>
        /// Returns the selectable schemes and the stored one.
        /// </summary>
        /// <param name="request">The current HTTP request.</param>
        /// <returns>JSON response with the selectable schemes.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(IRequest request)
        {
            try
            {
                using var context = CreateContext();
                var selected = ColorScheme.Normalize(GetActiveColorScheme(context, request));
                var items = ColorScheme.All.Select(x =>
                {
                    var name = I18N.Translate(request, "webexpress.webapp:setting.theme.mode." + x);
                    return new { id = x, content = name, name, selected = x == selected };
                }).ToList();

                return Json(new { items, selected });
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "Error processing request.");
            }
        }

        /// <summary>
        /// Hands a valid scheme (parameter <c>v</c>) to <see cref="PersistSelection"/>.
        /// </summary>
        /// <param name="request">The current HTTP request.</param>
        /// <returns>JSON response carrying the stored scheme.</returns>
        [Method(RequestMethod.PUT)]
        [Method(RequestMethod.POST)]
        public virtual IResponse Update(IRequest request)
        {
            try
            {
                var value = request.GetParameter("v")?.Value?.Trim();
                if (!string.IsNullOrEmpty(value) && !ColorScheme.All.Contains(value, StringComparer.OrdinalIgnoreCase))
                {
                    throw new ArgumentException("The mode is neither light nor dark.", nameof(request));
                }

                using var context = CreateContext();
                PersistSelection(ColorScheme.Normalize(value), context, request);

                return Json(new { selected = ColorScheme.Normalize(GetActiveColorScheme(context, request)) });
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
        /// Returns the stored scheme of the request, or <see langword="null"/> when the theme decides.
        /// </summary>
        /// <param name="context">The query context shared with the GET/PUT handler.</param>
        /// <param name="request">The current HTTP request.</param>
        /// <returns>The stored scheme or <see langword="null"/>.</returns>
        protected abstract string GetActiveColorScheme(IQueryContext context, IRequest request);

        /// <summary>
        /// Stores <see cref="ColorScheme.Light"/> or <see cref="ColorScheme.Dark"/>, or removes
        /// the preference when the value is <see langword="null"/>.
        /// </summary>
        /// <param name="colorScheme">The validated scheme, or null to let the theme decide.</param>
        /// <param name="context">The query context shared with the PUT handler.</param>
        /// <param name="request">The current HTTP request.</param>
        protected abstract void PersistSelection(string colorScheme, IQueryContext context, IRequest request);

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
