using System;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// Marks a data control that renders a resource of an enclosing scope
    /// ViewState rather than owning its state and service. When the resource is
    /// set, the control emits the data-wx-resource binding (and the optional
    /// data-wx-view scope id) instead of its own wx-state and wx-service islands,
    /// because the scope owns the state, the service and the central load. The
    /// control then attaches to the scope on the client, subscribes to the
    /// resource slice and re-renders when the scope re-queries it.
    ///
    /// A control that is authored outside a scope leaves the resource unset and
    /// behaves exactly as before, owning its islands and loading itself. See
    /// WebExpress/docs/view-state-service.md.
    /// </summary>
    public interface IScopeBound
    {
        /// <summary>
        /// Gets or sets the name of the scope resource the control renders. When
        /// null or empty, the control is standalone and owns its own islands.
        /// </summary>
        Func<IRenderControlContext, string> Resource { get; set; }

        /// <summary>
        /// Gets or sets the optional scope id the control binds to, emitted as the
        /// data-wx-view attribute. When null, the control resolves the nearest
        /// enclosing scope by ancestry.
        /// </summary>
        Func<IRenderControlContext, string> Scope { get; set; }
    }
}
