using System;
using System.Linq;
using System.Text.Json;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebUI.WebNotification;

namespace WebExpress.WebApp.WWW.Api._1
{
    /// <summary>
    /// Returns the status and progress of a task (WebTask).
    /// </summary>
    [Cache]
    [IncludeSubPaths(true)]
    public sealed class PopupNotification : IRestApi
    {
        private readonly IComponentHub _componentHub;
        private readonly IApplicationContext _applicationContext;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="componentHub">The component hub.</param>
        /// <param name="applicationContext">The application context.</param>
        public PopupNotification(IComponentHub componentHub, IApplicationContext applicationContext)
        {
            _componentHub = componentHub;
            _applicationContext = applicationContext;
        }

        /// <summary>
        /// Retrieves data based on the provided request.
        /// </summary>
        /// <param name="request">The request containing the criteria for data retrieval.</param>
        /// <returns>The response containing the result of the operation.</returns>
        [Method(RequestMethod.GET)]
        public Response Retrieve(Request request)
        {
            var notifications = _componentHub
                .GetComponentManager<NotificationManager>()?
                .GetNotifications(_applicationContext, request);
            var json = JsonSerializer.Serialize(notifications);

            return new ResponseOK()
            {
                Content = json
            }.AddHeaderContentType("application/json");
        }

        /// <summary>
        /// Deletes data based on the provided request.
        /// </summary>
        /// <param name="request">The request containing the data to delete.</param>
        /// <returns>The response containing the result of the operation.</returns>
        [Method(RequestMethod.DELETE)]
        public Response Delete(Request request)
        {
            if (Guid.TryParse(request.Uri.PathSegments.Last()?.ToString(), out Guid id))
            {
                _componentHub.GetComponentManager<NotificationManager>()?.RemoveNotifications(id);
            }

            return new ResponseOK();
        }
    }
}
