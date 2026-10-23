using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebParameter;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Provides an abstract base class for the endpoint behind a data-driven
    /// schedule. It answers GET with the items of a period and, where the source
    /// supports it, creates, updates and deletes single items.
    /// </summary>
    /// <remarks>
    /// The period arrives as the <c>from</c> and <c>to</c> query parameters,
    /// because a calendar is queried by the range it shows rather than by a page
    /// number, and the client re-queries whenever the visitor navigates. A
    /// source that cannot narrow by range ignores them and returns everything;
    /// the client renders only what falls into the shown period either way.
    ///
    /// The write handlers default to rejecting the request, so a read-only
    /// calendar needs no override and never silently accepts a change it does
    /// not persist.
    /// </remarks>
    public abstract class RestApiSchedule : IRestApi
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNameCaseInsensitive = true
        };

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        protected RestApiSchedule()
        {
        }

        /// <summary>
        /// Handles GET requests and returns the items of the requested period.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The response carrying the items and the holidays.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(IRequest request)
        {
            try
            {
                var from = ParseDate(request, "from");
                var to = ParseDate(request, "to");

                return new RestApiScheduleResult()
                {
                    Items = RetrieveItems(from, to, request),
                    Holidays = RetrieveHolidays(from, to, request)
                }
                    .ToResponse();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing get request.");
            }
        }

        /// <summary>
        /// Handles POST requests and creates a new item.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The response carrying the created item.</returns>
        [Method(RequestMethod.POST)]
        public virtual IResponse Create(IRequest request)
        {
            var item = ReadBody(request);
            if (item is null)
            {
                return new ResponseBadRequest(new StatusMessage("Missing or malformed request body."));
            }

            try
            {
                var created = Create(item, request);

                return created is null
                    ? new ResponseBadRequest(new StatusMessage("The item could not be created."))
                    : Success(new { success = true, item = created });
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing post request.");
            }
        }

        /// <summary>
        /// Handles PUT requests and updates an existing item. It is the handler
        /// a move reaches, so the identifier is taken from the payload rather
        /// than from the route.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The response carrying the updated item.</returns>
        [Method(RequestMethod.PUT)]
        public virtual IResponse Update(IRequest request)
        {
            var item = ReadBody(request);
            if (item is null)
            {
                return new ResponseBadRequest(new StatusMessage("Missing or malformed request body."));
            }
            if (string.IsNullOrWhiteSpace(item.Id))
            {
                return new ResponseBadRequest(new StatusMessage("Missing item id."));
            }

            try
            {
                var updated = Update(item, request);

                // a miss must not look like a successful update: the client
                // would keep the moved entry where the user dropped it and the
                // next reload would silently put it back
                return updated is null
                    ? new ResponseNotFound(new StatusMessage($"No item found for id '{item.Id}'."))
                    : Success(new { success = true, item = updated });
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing put request.");
            }
        }

        /// <summary>
        /// Handles DELETE requests and removes an item.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The response indicating the outcome.</returns>
        [Method(RequestMethod.DELETE)]
        public virtual IResponse Delete(IRequest request)
        {
            var id = request.GetParameter<ParameterId>()?.Value ?? request.GetParameter("id")?.Value;
            if (string.IsNullOrWhiteSpace(id))
            {
                return new ResponseBadRequest(new StatusMessage("Missing item id."));
            }

            try
            {
                return Delete(id, request)
                    ? Success(new { success = true, id = id })
                    : new ResponseNotFound(new StatusMessage($"No item found for id '{id}'."));
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing delete request.");
            }
        }

        /// <summary>
        /// Retrieves the items of a period.
        /// </summary>
        /// <param name="from">The first day of the period, or null when the request did not narrow it.</param>
        /// <param name="to">The day after the period, or null when the request did not narrow it.</param>
        /// <param name="request">The current request.</param>
        /// <returns>The items.</returns>
        protected virtual IEnumerable<RestApiScheduleItem> RetrieveItems(DateTime? from, DateTime? to, IRequest request)
        {
            // return empty by default
            return [];
        }

        /// <summary>
        /// Retrieves the holidays of a period. A schedule that takes its
        /// holidays from a separate endpoint leaves this empty.
        /// </summary>
        /// <param name="from">The first day of the period, or null.</param>
        /// <param name="to">The day after the period, or null.</param>
        /// <param name="request">The current request.</param>
        /// <returns>The holidays.</returns>
        protected virtual IEnumerable<RestApiScheduleHoliday> RetrieveHolidays(DateTime? from, DateTime? to, IRequest request)
        {
            // return empty by default
            return [];
        }

        /// <summary>
        /// Creates an item. The default refuses, so a read-only calendar needs
        /// no override.
        /// </summary>
        /// <param name="item">The item to create.</param>
        /// <param name="request">The current request.</param>
        /// <returns>The created item including its assigned id, or null when it was refused.</returns>
        protected virtual RestApiScheduleItem Create(RestApiScheduleItem item, IRequest request)
        {
            return null;
        }

        /// <summary>
        /// Updates an item, which is the path a move takes. The default refuses.
        /// </summary>
        /// <param name="item">The item to update.</param>
        /// <param name="request">The current request.</param>
        /// <returns>The updated item, or null when it is unknown or was refused.</returns>
        protected virtual RestApiScheduleItem Update(RestApiScheduleItem item, IRequest request)
        {
            return null;
        }

        /// <summary>
        /// Deletes an item. The default refuses.
        /// </summary>
        /// <param name="id">The identifier of the item.</param>
        /// <param name="request">The current request.</param>
        /// <returns>True when the item was deleted.</returns>
        protected virtual bool Delete(string id, IRequest request)
        {
            return false;
        }

        /// <summary>
        /// Reads a date parameter, tolerating both the bare and the full form the
        /// client may send.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <param name="name">The parameter name.</param>
        /// <returns>The parsed date, or null when it is absent or unusable.</returns>
        protected static DateTime? ParseDate(IRequest request, string name)
        {
            var raw = request?.GetParameter(name)?.Value;

            return DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var value)
                ? value
                : null;
        }

        /// <summary>
        /// Formats a moment as the zone-free local text the schedule exchanges.
        /// </summary>
        /// <param name="value">The moment.</param>
        /// <returns>The formatted timestamp.</returns>
        protected static string Format(DateTime value)
        {
            return value.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture);
        }

        /// <summary>
        /// Formats a day as the bare date the schedule keys holidays by.
        /// </summary>
        /// <param name="value">The day.</param>
        /// <returns>The formatted date.</returns>
        protected static string FormatDate(DateTime value)
        {
            return value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }

        /// <summary>
        /// Deserializes the item carried in the request body.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The item, or null when the body is missing or malformed.</returns>
        private static RestApiScheduleItem ReadBody(IRequest request)
        {
            if (request is not Request requestData || requestData.Content is null || requestData.Content.Length == 0)
            {
                return null;
            }

            try
            {
                return JsonSerializer.Deserialize<RestApiScheduleItem>(Encoding.UTF8.GetString(requestData.Content), _jsonOptions);
            }
            catch (JsonException)
            {
                return null;
            }
        }

        /// <summary>
        /// Builds the JSON response of a successful write.
        /// </summary>
        /// <param name="payload">The payload.</param>
        /// <returns>The response.</returns>
        private static IResponse Success(object payload)
        {
            return new ResponseOK
            {
                Content = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload, _jsonOptions))
            }
                .AddHeaderContentType("application/json");
        }
    }
}
