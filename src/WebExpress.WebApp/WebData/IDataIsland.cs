using System;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// Marks a WebApp control as data bound. A data bound control declares an
    /// optional initial state and an optional data service descriptor, which it
    /// emits as the data-wx-state and data-wx-service islands that the JavaScript
    /// engine consumes (webexpress.webapp.Data seeds its store from the state
    /// island, webexpress.webapp.ServiceRegistry resolves the service island).
    /// The emission itself is shared through the EmitDataIslands extension, so a
    /// control only declares the two members and calls the extension from Render.
    ///
    /// This is the C# data layer of the View, State and Service architecture. The
    /// name "Data" is used in place of "Component", which is a distinct concept in
    /// WebExpress. The whole concept lives in WebExpress.WebApp; WebExpress.WebUI
    /// carries only static controls. See WebExpress/docs/view-state-service.md.
    /// </summary>
    public interface IDataIsland
    {
        /// <summary>
        /// Gets or sets the optional initial state, emitted as the data-wx-state
        /// island. When null or empty, no island is emitted and the client loads
        /// on mount.
        /// </summary>
        Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional data service descriptor, emitted as the
        /// data-wx-service island. When null, the client uses its legacy
        /// descriptor fallback.
        /// </summary>
        Func<IRenderControlContext, DataServiceDescriptor> ServiceFactory { get; set; }
    }
}
