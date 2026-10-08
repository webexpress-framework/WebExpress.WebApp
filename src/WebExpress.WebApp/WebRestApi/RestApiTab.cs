using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract class providing tab responses for REST API.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiTab<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        /// <summary>
        /// Gets or sets the title associated with the current object.
        /// </summary>
        public string Title { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        protected RestApiTab()
        {
            // read attributes once
            Title = GetType().CustomAttributes
                .Where(x => x is not null && x.AttributeType == typeof(TitleAttribute))
                .Select(x => x.ConstructorArguments.FirstOrDefault().Value?.ToString())
                .FirstOrDefault();
        }

        /// <summary>
        /// Processing of the resource that was called via the get request.
        /// Returns a list-shaped payload with items, title and pagination.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        [Method(RequestMethod.GET)]
        public IResponse Retrieve(IRequest request)
        {
            try
            {
                using var context = CreateContext();
                var items = RetrieveViews(context, request);

                var result = new RestApiTabResult()
                {
                    //Title = I18N.Translate(request, Title),
                    Views = items
                };

                return result.ToResponse();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "Error processing request.");
            }
        }

        /// <summary>
        /// Handles POST requests to create a new tab.
        /// </summary>
        /// <param name="request">The incoming REST request containing JSON with at least 'label' or 'name'</param>
        /// <returns>
        /// The created RestApiTabView, or an error response.
        /// </returns>
        [Method(RequestMethod.POST)]
        public IResponse Create(IRequest request)
        {
            using var context = CreateContext();

            try
            {
                var templateId = ExtractTemplateId(request);

                // persist or sync content
                var newView = CreateView(context, request, templateId);

                var data = new
                {
                    newTab = newView,
                };

                // response corresponds to the JS mock (single new tab)
                var jsonData = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
                var content = System.Text.Encoding.UTF8.GetBytes(jsonData);

                return new ResponseCreated
                {
                    Content = content
                }
                    .AddHeaderContentType("application/json");
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "Error processing POST request.");
            }
        }

        /// <summary>
        /// Extracts the optional template id from request parameter or JSON request body.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The template id if provided; otherwise null.</returns>
        protected virtual string ExtractTemplateId(IRequest request)
        {
            var templateId = request?.GetParameter("templateId")?.Value;
            if (!string.IsNullOrWhiteSpace(templateId))
            {
                return templateId;
            }

            return ReadJsonBody(request) is { ValueKind: JsonValueKind.Object } body
                ? ReadString(body, "templateId")
                : null;
        }

        /// <summary>
        /// Handles DELETE requests to remove a tab by id in the ?id=... query.
        /// </summary>
        /// <param name="request">The request specifying the tab id as query (?id=...)</param>
        /// <returns>HTTP 204 (Deleted) or 404 (Not found)</returns>
        [Method(RequestMethod.DELETE)]
        public IResponse Delete(IRequest request)
        {
            // parse view id from query (?id=...)
            var viewId = request.GetParameter("id")?.Value;

            if (string.IsNullOrWhiteSpace(viewId))
            {
                return new ResponseBadRequest(new StatusMessage("Missing id parameter for tab deletion."));
            }

            var removed = RemoveView(viewId);

            if (removed)
            {
                return new ResponseNoContent(); // HTTP 204
            }
            else
            {
                return new ResponseNotFound(new StatusMessage($"Tab with id='{viewId}' not found."));
            }
        }

        /// <summary>
        /// Handles PUT requests that change existing tabs. A body with
        /// <c>"action": "rename"</c> carries the <c>id</c> and the new <c>label</c>
        /// of a tab renamed in place, a body with <c>"action": "color"</c> the
        /// <c>id</c> and the new <c>color</c> (null to remove it); any other body
        /// is expected to carry an
        /// <c>order</c> array of tab ids in their new sequence (sent by the
        /// client-side controller when tabs are reordered via drag and drop).
        /// </summary>
        /// <param name="request">The incoming REST request.</param>
        /// <returns>HTTP 204 (No Content) on success, otherwise an error response.</returns>
        [Method(RequestMethod.PUT)]
        public IResponse Update(IRequest request)
        {
            using var context = CreateContext();

            try
            {
                var body = ReadJsonBody(request);
                var rename = ExtractRename(body);
                if (rename is not null)
                {
                    var (viewId, label) = rename.Value;
                    label = label?.Trim();
                    if (string.IsNullOrWhiteSpace(viewId) || string.IsNullOrEmpty(label))
                    {
                        return new ResponseBadRequest(new StatusMessage("Missing id or label for tab renaming."));
                    }

                    if (!IsValidLabel(label))
                    {
                        return new ResponseBadRequest(new StatusMessage($"The tab label must not exceed {MaxLabelLength} characters or contain control characters."));
                    }

                    return RenameView(viewId, label, context, request)
                        ? new ResponseNoContent()
                        : new ResponseBadRequest(new StatusMessage("Tab renaming failed."));
                }

                var recolor = ExtractColor(body);
                if (recolor is not null)
                {
                    var (viewId, color) = recolor.Value;
                    if (string.IsNullOrWhiteSpace(viewId))
                    {
                        return new ResponseBadRequest(new StatusMessage("Missing id for tab coloring."));
                    }

                    if (color is not null && !IsValidColor(color))
                    {
                        return new ResponseBadRequest(new StatusMessage("The tab color must be a #rrggbb value."));
                    }

                    return RecolorView(viewId, color, context, request)
                        ? new ResponseNoContent()
                        : new ResponseBadRequest(new StatusMessage("Tab coloring failed."));
                }

                var order = ExtractOrder(body);
                if (order is null || order.Count == 0)
                {
                    return new ResponseBadRequest(new StatusMessage("Missing order payload for tab reordering."));
                }

                var reordered = ReorderViews(order, context, request);

                return reordered
                    ? new ResponseNoContent()
                    : new ResponseBadRequest(new StatusMessage("Tab reordering failed."));
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "Error processing PUT request.");
            }
        }

        /// <summary>
        /// Extracts the ordered list of tab ids from the JSON request body's
        /// <c>order</c> array.
        /// </summary>
        /// <param name="body">The parsed request body, or null when it is missing or no valid JSON.</param>
        /// <returns>The ordered tab ids, or null when none are present.</returns>
        protected virtual IReadOnlyList<string> ExtractOrder(JsonElement? body)
        {
            if (body is not { ValueKind: JsonValueKind.Object } root
                || !root.TryGetProperty("order", out var orderProperty)
                || orderProperty.ValueKind != JsonValueKind.Array)
            {
                return null;
            }

            return orderProperty.EnumerateArray()
                .Where(x => x.ValueKind == JsonValueKind.String)
                .Select(x => x.GetString())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToList();
        }

        /// <summary>
        /// Persists a new tab order. Override this method in a derived class to
        /// implement custom reordering logic. The default implementation is a
        /// no-op that reports failure.
        /// </summary>
        /// <param name="order">The ordered list of tab ids in their new sequence.</param>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional
        /// information or constraints for the operation. Cannot be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// <see langword="true"/> when the order was applied; otherwise
        /// <see langword="false"/>.
        /// </returns>
        protected virtual bool ReorderViews(IReadOnlyList<string> order, IQueryContext context, IRequest request)
        {
            return false;
        }

        /// <summary>
        /// Extracts the tab id and the new label of a rename request. The
        /// reorder request shares the PUT method, so only a body whose
        /// <c>action</c> is <c>rename</c> counts as a rename.
        /// </summary>
        /// <param name="body">The parsed request body, or null when it is missing or no valid JSON.</param>
        /// <returns>
        /// The tab id and label (either may be null when the body omits it), or
        /// null when the request is no rename.
        /// </returns>
        protected virtual (string Id, string Label)? ExtractRename(JsonElement? body)
        {
            if (body is not { ValueKind: JsonValueKind.Object } root || ReadString(root, "action") != "rename")
            {
                return null;
            }

            return (ReadString(root, "id"), ReadString(root, "label"));
        }

        /// <summary>
        /// Extracts the tab id and the new color of a color request. The other
        /// requests share the PUT method, so only a body whose <c>action</c> is
        /// <c>color</c> counts as one.
        /// </summary>
        /// <param name="body">The parsed request body, or null when it is missing or no valid JSON.</param>
        /// <returns>
        /// The tab id and color (the color is null to clear it), or null when the
        /// request is no color change.
        /// </returns>
        protected virtual (string Id, string Color)? ExtractColor(JsonElement? body)
        {
            if (body is not { ValueKind: JsonValueKind.Object } root || ReadString(root, "action") != "color")
            {
                return null;
            }

            return (ReadString(root, "id"), ReadString(root, "color"));
        }

        /// <summary>
        /// Determines whether a tab color may be stored. Only a plain <c>#rrggbb</c>
        /// value is accepted, so the stored color can never carry more css than a
        /// color into the pages of other users.
        /// </summary>
        /// <param name="color">The color.</param>
        /// <returns><see langword="true"/> when the color is acceptable.</returns>
        protected virtual bool IsValidColor(string color)
        {
            return color.Length == 7
                && color[0] == '#'
                && color.Skip(1).All(Uri.IsHexDigit);
        }

        /// <summary>
        /// Persists the color of a tab chosen from its menu. Override this method
        /// in a derived class to store the color in <see cref="RestApiTabView.TabColor"/>;
        /// the default implementation is a no-op that reports failure, which the
        /// client announces as an error.
        /// </summary>
        /// <param name="viewId">The id of the tab.</param>
        /// <param name="color">
        /// The new color as a <c>#rrggbb</c> value, or null to remove the color.
        /// </param>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional
        /// information or constraints for the operation. Cannot be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// <see langword="true"/> when the color was applied; otherwise
        /// <see langword="false"/>.
        /// </returns>
        protected virtual bool RecolorView(string viewId, string color, IQueryContext context, IRequest request)
        {
            return false;
        }

        /// <summary>
        /// Gets the maximum length of a tab label. A label is shown in every tab
        /// header and served to every client of the endpoint, so its size is
        /// bounded where it enters. The client field defaults to the same limit.
        /// </summary>
        protected virtual int MaxLabelLength => 200;

        /// <summary>
        /// Determines whether a label may be stored. Control characters break
        /// the header layout, and the bidirectional overrides and isolates would
        /// let a label reverse how the text next to it reads.
        /// </summary>
        /// <param name="label">The trimmed label.</param>
        /// <returns><see langword="true"/> when the label is acceptable.</returns>
        protected virtual bool IsValidLabel(string label)
        {
            return label.Length <= MaxLabelLength
                && !label.Any(c => char.IsControl(c) || (c >= 0x202A && c <= 0x202E) || (c >= 0x2066 && c <= 0x2069));
        }

        /// <summary>
        /// Reads the JSON request body once for all operations that inspect it.
        /// A missing or malformed body is no error here, because each operation
        /// decides itself what it requires.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The root element of the body, or null.</returns>
        private static JsonElement? ReadJsonBody(IRequest request)
        {
            if (request is not Request typedRequest || typedRequest.Content is null || typedRequest.Content.Length == 0)
            {
                return null;
            }

            var json = Encoding.UTF8.GetString(typedRequest.Content);
            if (string.IsNullOrWhiteSpace(json))
            {
                return null;
            }

            try
            {
                using var doc = JsonDocument.Parse(json);

                // the document is disposed on return, the clone outlives it
                return doc.RootElement.Clone();
            }
            catch (JsonException)
            {
                return null;
            }
        }

        /// <summary>
        /// Reads a string property of a JSON object, tolerating a missing or
        /// non-string value, which the caller rejects as an incomplete request.
        /// </summary>
        /// <param name="element">The JSON object.</param>
        /// <param name="name">The property name.</param>
        /// <returns>The string value, or null.</returns>
        private static string ReadString(JsonElement element, string name)
        {
            return element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
                ? value.GetString()
                : null;
        }

        /// <summary>
        /// Persists a new label for a tab renamed in place. Override this method
        /// in a derived class to store the label; the default implementation is a
        /// no-op that reports failure, which the client shows as an error in the
        /// rename field.
        /// </summary>
        /// <param name="viewId">The id of the renamed tab.</param>
        /// <param name="label">
        /// The new label, trimmed, never empty and accepted by <see cref="IsValidLabel"/>.
        /// </param>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional
        /// information or constraints for the operation. Cannot be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// <see langword="true"/> when the label was applied; otherwise
        /// <see langword="false"/>.
        /// </returns>
        protected virtual bool RenameView(string viewId, string label, IQueryContext context, IRequest request)
        {
            return false;
        }

        /// <summary>
        /// Creates a new instance of an object that implements the IQueryContext interface.
        /// </summary>
        /// <returns>
        /// An IQueryContext instance that can be used to execute queries.
        /// </returns>
        protected virtual IQueryContext CreateContext()
        {
            return new DefaultQueryContext();
        }

        /// <summary>
        /// Retrieves the collection of tab views associated with the specified request.
        /// </summary>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional information or constraints 
        /// for the retrieval operation. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request for which to retrieve tab views. Must not be null.
        /// </param>
        /// <returns>
        /// An enumerable collection of tab views for the specified request. Returns 
        /// an empty collection if no states are available.
        /// </returns>
        protected abstract IEnumerable<RestApiTabView> RetrieveViews(IQueryContext context, IRequest request);

        /// <summary>
        /// Creates a new instance of a REST API tab view based on the specified
        /// query context and request.
        /// </summary>
        /// <param name="context">
        /// The query context that provides information about the current state 
        /// and parameters of the query.
        /// </param>
        /// <param name="request">
        /// The request object containing details of the REST API call to be 
        /// represented in the view.
        /// </param>
        /// <returns>
        /// An object that implements the IRestApiTabView interface, representing 
        /// the created view for the specified request and context.
        /// </returns>
        protected virtual IRestApiTabView CreateView(IQueryContext context, IRequest request)
        {
            return null;
        }

        /// <summary>
        /// Creates a new instance of a REST API tab view and optionally applies a template id.
        /// </summary>
        /// <param name="context">The query context.</param>
        /// <param name="request">The request.</param>
        /// <param name="templateId">The optional template id from client request.</param>
        /// <returns>A tab view instance.</returns>
        protected virtual IRestApiTabView CreateView(IQueryContext context, IRequest request, string templateId)
        {
            var view = CreateView(context, request);

            if (!string.IsNullOrWhiteSpace(templateId) && view is RestApiTabView tabView)
            {
                tabView.TemplateId = templateId;
            }

            return view;
        }

        /// <summary>
        /// Removes the view with the specified ID from the collection of managed views.
        /// </summary>
        /// <remarks>
        /// Override this method in a derived class to implement custom view removal logic.
        /// </remarks>
        /// <param name="viewId">
        /// The unique identifier of the view to be removed. Must not be null or empty.
        /// </param>
        /// <returns>
        /// true if the view was successfully removed; otherwise, false.
        /// </returns>
        protected virtual bool RemoveView(string viewId)
        {
            return false;
        }
    }
}