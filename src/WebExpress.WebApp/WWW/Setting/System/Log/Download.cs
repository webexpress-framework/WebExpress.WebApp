using System.IO;
using WebExpress.WebApp.WebScope;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebLog;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebResource;

namespace WebExpress.WebApp.WWW.Setting.System.Log
{
    /// <summary>
    /// Download the log file.
    /// </summary>
    [Scope<IScopeAdmin>]
    public sealed class Download : ResourceBinary
    {
        private readonly ILogManager _logManager;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="resourceContext">The context of the resource.</param>
        /// <param name="logManager">The log manager.</param>
        public Download(IResourceContext resourceContext, ILogManager logManager)
            : base(resourceContext)
        {
            _logManager = logManager;
        }

        /// <summary>
        /// Processing of the resource.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response.</returns>
        public override IResponse Process(IRequest request)
        {
            if (!File.Exists(_logManager.DefaultLog.Filename))
            {
                return new ResponseNotFound();
            }

            Data = File.ReadAllBytes(_logManager.DefaultLog.Filename);

            var response = base.Process(request);
            response.Header.CacheControl = "no-cache";
            response.Header.ContentType = "text/plain";

            return response;
        }
    }
}

