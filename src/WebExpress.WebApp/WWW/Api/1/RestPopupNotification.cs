using System;
using System.Linq;
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
        public void CreateData(Request request)
        {
        }

        /// <summary>
        /// Retrieves data based on the provided request.
        /// </summary>
        /// <param name="request">The request containing the criteria for data retrieval.</param>
        /// <returns>A collection of notifications.</returns>
        public object GetData(Request request)
        {
            return _componentHub.GetComponentManager<NotificationManager>()?.GetNotifications
            (
                _applicationContext, request
            );
        }

        /// <summary>
        /// Updates data based on the provided request.
        /// </summary>
        /// <param name="request">The request containing the data to update.</param>
        public void UpdateData(Request request)
        {
        }

        /// <summary>
        /// Deletes data based on the provided request.
        /// </summary>
        /// <param name="request">The request containing the data to delete.</param>
        public void DeleteData(Request request)
        {
            if (Guid.TryParse(request.Uri.PathSegments.Last()?.ToString(), out Guid id))
            {
                _componentHub.GetComponentManager<NotificationManager>()?.RemoveNotifications(id);
            }
        }
    }
}
