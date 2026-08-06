using System;
using System.Collections.Generic;
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
    /// A REST API endpoint providing the dashboard configuration and handling layout updates.
    /// </summary>
    public class RestApiDashboard : IRestApi
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true
        };

        /// <summary>
        /// Gets or sets the title associated with the current object.
        /// </summary>
        public string Title { get; protected set; }

        /// <summary>
        /// Handles get requests to retrieve the current dashboard layout and configuration.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>A response containing the dashboard configuration.</returns>
        [Method(RequestMethod.GET)]
        public IResponse Retrieve(IRequest request)
        {
            try
            {
                var result = new RestApiDashboardResult()
                {
                    Title = I18N.Translate(request, Title),
                    Columns = RetrieveColumns(request),
                    AvailableWidgets = RetrieveAvailableWidgets(request)
                };

                return result.ToResponse();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing get request.");
            }
        }

        /// <summary>
        /// Handles put requests to update the dashboard layout.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>A response indicating the success of the update operation.</returns>
        [Method(RequestMethod.PUT)]
        public IResponse Update(IRequest request)
        {
            try
            {
                if (request is Request requestData)
                {
                    if (requestData.Content is null || requestData.Content.Length == 0)
                    {
                        return new ResponseBadRequest(new StatusMessage("missing request body."));
                    }

                    var bodyString = Encoding.UTF8.GetString(requestData.Content);
                    var payload = JsonSerializer.Deserialize<RestApiDashboardLayout>(bodyString, _jsonOptions);

                    // a full board carries the per-widget settings (add / delete /
                    // reconfigure), a column list carries only the column meta
                    // (add / rename / reorder / delete)
                    if (payload?.Board != null)
                    {
                        UpdateBoard(payload.Board, request);
                    }
                    else
                    {
                        UpdtaeColumns(payload, request);
                    }
                }

                var responseObj = new { success = true };
                var responseJson = JsonSerializer.Serialize(responseObj, _jsonOptions);

                return new ResponseOK
                {
                    Content = Encoding.UTF8.GetBytes(responseJson)
                }.AddHeaderContentType("application/json");
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing put request.");
            }
        }

        /// <summary>
        /// Retrieves the collection of dashboard columns.
        /// </summary>
        /// <param name="request">
        /// The request context used to determine which dashboard columns to retrieve.
        /// </param>
        /// <returns>
        /// An enumerable collection of dashboard columns relevant to the request. The 
        /// collection is empty if no columns are available.
        /// </returns>
        protected virtual IEnumerable<RestApiDashboardColumn> RetrieveColumns(IRequest request)
        {
            // return empty by default
            return [];
        }

        /// <summary>
        /// Retrieves the widget types the board may add. The server owns which
        /// widgets a board may use, so an endpoint opts widgets in by overriding
        /// this; the default offers none.
        /// </summary>
        /// <param name="request">The request context.</param>
        /// <returns>The available widget descriptors, empty by default.</returns>
        protected virtual IEnumerable<RestApiDashboardAvailableWidget> RetrieveAvailableWidgets(IRequest request)
        {
            return [];
        }

        /// <summary>
        /// Updates the columns of the specified dashboard layout based on the provided 
        /// request.
        /// </summary>
        /// <param name="layout">
        /// The dashboard layout whose columns will be updated.
        /// </param>
        /// <param name="request">
        /// The request containing the details for updating the columns.
        /// </param>
        protected virtual void UpdtaeColumns(RestApiDashboardLayout layout, IRequest request)
        {
        }

        /// <summary>
        /// Applies a full board update - the columns with their widgets including
        /// the per-widget name, color and params - to persist a widget being
        /// added, deleted or reconfigured. The default does nothing, so an
        /// endpoint opts in by overriding it.
        /// </summary>
        /// <param name="board">The full board carried in the request.</param>
        /// <param name="request">The request containing the details for the update.</param>
        protected virtual void UpdateBoard(IEnumerable<RestApiDashboardBoardColumn> board, IRequest request)
        {
        }
    }
}
