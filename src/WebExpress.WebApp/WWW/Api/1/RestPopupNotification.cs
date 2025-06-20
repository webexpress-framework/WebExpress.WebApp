using System;
using System.Linq;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebUI.WebNotification;

namespace WebExpress.WebApp.WWW.Api._1
{
    /// <summary>
    /// Returns the status and progress of a task (WebTask).
    /// </summary>
    [Method(CrudMethod.GET)]
    [Method(CrudMethod.DELETE)]
    [IncludeSubPaths(true)]
    public sealed class RestPopupNotification : IRestApi
    {
        private readonly IComponentHub _componentHub;
        private readonly IApplicationContext _applicationContext;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestPopupNotification(IComponentHub componentHub, IApplicationContext applicationContext)
        {
            _componentHub = componentHub;
            _applicationContext = applicationContext;
        }

        /// <summary>
        /// Creates data based on the provided request.
        /// </summary>
        /// <param name="request">The request containing the data to create.</param>
        /// <returns>The response containing the result of the operation.</returns>
        public Response CreateData(Request request)
        {
            return new ResponseBadRequest(new StatusMessage("Not implemented."));
        }

        /// <summary>
        /// Retrieves data based on the provided request.
        /// </summary>
        /// <param name="request">The request containing the criteria for data retrieval.</param>
        /// <returns>The response containing the result of the operation.</returns>
        public Response GetData(Request request)
        {
            return new ResponseOK()
            {
                Content = _componentHub.GetComponentManager<NotificationManager>()?.GetNotifications
                (
                    _applicationContext, request
                )
            }.AddHeaderContentType("application/json");
        }

        /// <summary>
        /// Updates data based on the provided request.
        /// </summary>
        /// <param name="request">The request containing the data to update.</param>
        /// <returns>The response containing the result of the operation.</returns>
        public Response UpdateData(Request request)
        {
            return new ResponseBadRequest(new StatusMessage("Not implemented."));
        }

        /// <summary>
        /// Deletes data based on the provided request.
        /// </summary>
        /// <param name="request">The request containing the data to delete.</param>
        /// <returns>The response containing the result of the operation.</returns>
        public Response DeleteData(Request request)
        {
            if (Guid.TryParse(request.Uri.PathSegments.Last()?.ToString(), out Guid id))
            {
                _componentHub.GetComponentManager<NotificationManager>()?.RemoveNotifications(id);
            }

            return new ResponseOK();
        }
    }
}
