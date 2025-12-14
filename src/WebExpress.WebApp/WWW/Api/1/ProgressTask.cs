using System.Linq;
using System.Text.Json;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;

namespace WebExpress.WebApp.WWW.Api.V1
{
    /// <summary>
    /// Determines the status and progress of a task (WebTask).
    /// </summary>
    //[Method(CrudMethod.GET)]
    [IncludeSubPaths(true)]
    public sealed class ProgressTask : IRestApi
    {
        private readonly IComponentHub _componentHub;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="componentHub">The component hub.</param>
        public ProgressTask(IComponentHub componentHub)
        {
            _componentHub = componentHub;
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
            var id = request.Uri.PathSegments.Last().Value;

            if (_componentHub.TaskManager.ContainsTask(id))
            {
                var task = _componentHub.TaskManager.GetTask(id);
                var json = JsonSerializer.Serialize(new
                {
                    id,
                    state = task.State,
                    progress = task.Progress,
                    message = task.Message
                });

                return new ResponseOK()
                {
                    Content = json
                }.AddHeaderContentType("application/json");
            }

            return new ResponseNotFound();
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
            return new ResponseBadRequest(new StatusMessage("Not implemented."));
        }
    }
}
