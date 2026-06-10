using System;
using System.Collections.Generic;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// Marks a WebApp control as data bound. A data bound control declares an
    /// optional initial state, one or more data service descriptors and an
    /// optional template reference, which it emits as the data-wx-state,
    /// data-wx-service and data-wx-template islands that the JavaScript engine
    /// consumes (webexpress.webapp.Data seeds its store from the state island,
    /// webexpress.webapp.ServiceRegistry resolves the service island,
    /// webexpress.webapp.Templates resolves the template reference).
    /// The emission itself is shared through the EmitDataIslands extension, so a
    /// control only declares the members and calls the extension from Render.
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
        /// Gets the data service descriptors of the control, emitted together as
        /// the data-wx-service island: a single object for one service and a
        /// json array for several, which the JavaScript ServiceRegistry resolves
        /// into a map of named services. When empty, no island is emitted and
        /// the client uses its legacy descriptor fallback.
        /// </summary>
        IList<Func<IRenderControlContext, DataServiceDescriptor>> ServiceFactories { get; }

        /// <summary>
        /// Gets or sets the single data service descriptor, as a convenience for
        /// the common control with exactly one service. Reading returns the
        /// first declared service, assigning replaces all declared services.
        /// </summary>
        Func<IRenderControlContext, DataServiceDescriptor> ServiceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional template reference, emitted as the
        /// data-wx-template attribute. The client Templates registry resolves it
        /// into a registered render function or a server rendered template
        /// element, so a view can be authored in C# and reused on the client.
        /// </summary>
        Func<IRenderControlContext, string> TemplateFactory { get; set; }
    }
}
