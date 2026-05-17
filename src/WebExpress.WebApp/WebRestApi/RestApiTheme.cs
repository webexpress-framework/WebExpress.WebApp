using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebCore.WebTheme;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// REST endpoint that backs the <c>ControlRestSelectionTheme</c> selector.
    /// <para>
    /// A <c>GET</c> returns the themes registered for the request's application
    /// in the shape consumed by the JS dropdown:
    /// <c>{ items: [{ id, content, … }], selected: "&lt;themeId&gt;" }</c>.
    /// </para>
    /// <para>
    /// A <c>PUT</c> / <c>POST</c> with the <c>v</c> parameter (the chosen
    /// theme id, or empty to clear the preference) hands the value to the
    /// virtual <see cref="PersistSelection"/> hook. The base implementation
    /// is a no-op; user code overrides it to store the selection wherever
    /// it likes (session, user profile, database, …) and overrides
    /// <see cref="GetActiveThemeId"/> to return the stored value on
    /// subsequent reads. The framework neither stores the choice itself nor
    /// applies it to the visual tree - user code calls
    /// <c>visualTree.UseTheme&lt;TTheme&gt;()</c> based on the stored value
    /// from its page's <c>Process</c> override.
    /// </para>
    /// <para>
    /// Persistence hooks receive an <see cref="IQueryContext"/> so derived
    /// classes can share a transactional scope with the rest of the WebApp
    /// REST-API family; override <see cref="CreateContext"/> to supply a
    /// custom one.
    /// </para>
    /// </summary>
    public abstract class RestApiTheme : IRestApi
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        protected RestApiTheme()
        {
        }

        /// <summary>
        /// Returns the themes registered for the request's application.
        /// </summary>
        /// <param name="request">The current HTTP request.</param>
        /// <returns>JSON response with the selectable theme items.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(IRequest request)
        {
            try
            {
                var applicationContext = request?.ApplicationContext;
                var themes = WebEx.ComponentHub?.ThemeManager?.Themes
                    ?.Where(t => t.ApplicationContext == applicationContext)
                    ?? Enumerable.Empty<IThemeContext>();

                using var context = CreateContext();
                var selectedId = GetActiveThemeId(context, request);
                var items = themes.Select(t => MapToItem(t, request, selectedId)).ToList();

                return Json(new
                {
                    items,
                    selected = selectedId
                });
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error processing request. {ex}"));
            }
        }

        /// <summary>
        /// Hands the chosen theme id (parameter <c>v</c>) to
        /// <see cref="PersistSelection"/> so user code can store it. The
        /// response echoes the new state - the framework leaves persistence
        /// to the application.
        /// </summary>
        /// <param name="request">The current HTTP request.</param>
        /// <returns>JSON response carrying the new selected theme id.</returns>
        [Method(RequestMethod.PUT)]
        [Method(RequestMethod.POST)]
        public virtual IResponse Update(IRequest request)
        {
            try
            {
                var raw = request.GetParameter("v")?.Value ?? string.Empty;
                var trimmed = raw.Trim();

                using var context = CreateContext();
                PersistSelection(string.IsNullOrEmpty(trimmed) ? null : trimmed, context, request);

                return Json(new { selected = GetActiveThemeId(context, request) });
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error processing request. {ex}"));
            }
        }

        /// <summary>
        /// Creates a new instance of an object that implements the
        /// <see cref="IQueryContext"/> interface, shared by the GET and PUT
        /// handlers and passed through to <see cref="GetActiveThemeId"/> and
        /// <see cref="PersistSelection"/>. Override to bind a per-request
        /// transactional scope.
        /// </summary>
        /// <returns>An <see cref="IQueryContext"/> for the current request.</returns>
        protected virtual IQueryContext CreateContext()
        {
            return new DefaultQueryContext();
        }

        /// <summary>
        /// Returns the currently active theme id for the request, or
        /// <see langword="null"/> when no preference is stored. The base
        /// implementation always returns <see langword="null"/>; user code
        /// overrides this to expose values from its own store.
        /// </summary>
        /// <param name="context">The query context shared with the GET/PUT handler.</param>
        /// <param name="request">The current HTTP request.</param>
        /// <returns>The stored theme id or <see langword="null"/>.</returns>
        protected virtual string GetActiveThemeId(IQueryContext context, IRequest request)
        {
            return null;
        }

        /// <summary>
        /// Persists the user's theme pick. The base implementation is a
        /// no-op; user code overrides this to write to a session, identity
        /// profile, database, file, … whatever fits the application. A
        /// <see langword="null"/> value means the user cleared the preference.
        /// </summary>
        /// <param name="themeId">The chosen theme id, or <see langword="null"/> to clear.</param>
        /// <param name="context">The query context shared with the PUT handler.</param>
        /// <param name="request">The current HTTP request.</param>
        protected virtual void PersistSelection(string themeId, IQueryContext context, IRequest request)
        {
        }

        /// <summary>
        /// Maps an <see cref="IThemeContext"/> to the JSON shape the JS
        /// dropdown consumes. Override to attach additional fields (image,
        /// color, …) per theme.
        /// </summary>
        /// <param name="theme">The theme to map.</param>
        /// <param name="request">The triggering request.</param>
        /// <param name="selectedId">The currently selected theme id, or null.</param>
        /// <returns>The dictionary serialised by <see cref="Retrieve"/>.</returns>
        protected virtual IDictionary<string, object> MapToItem(IThemeContext theme, IRequest request, string selectedId)
        {
            var id = theme?.ThemeId?.ToString();
            var item = new Dictionary<string, object>
            {
                ["id"] = id,
                ["content"] = I18N.Translate(request, theme?.Name) ?? id,
                ["name"] = I18N.Translate(request, theme?.Name) ?? id
            };

            var description = I18N.Translate(request, theme?.Description);
            if (!string.IsNullOrWhiteSpace(description))
            {
                item["description"] = description;
            }

            if (theme?.Image is not null)
            {
                item["image"] = theme.Image.ToString();
            }

            if (!string.IsNullOrEmpty(selectedId) && string.Equals(selectedId, id, StringComparison.OrdinalIgnoreCase))
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
        protected static IResponse Json(object payload)
        {
            var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload, _jsonOptions));
            return new ResponseOK
            {
                Content = bytes
            }
                .AddHeaderContentType("application/json");
        }
    }
}
