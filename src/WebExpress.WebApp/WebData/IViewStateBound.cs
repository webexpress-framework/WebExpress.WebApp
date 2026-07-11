using System;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// Marks a data control that renders a resource of an enclosing ViewState
    /// rather than owning its state and service. When the resource is
    /// set, the control emits the data-wx-resource binding (and the optional
    /// data-wx-viewstate id) instead of its own wx-state and wx-service islands,
    /// because the ViewState owns the state, the service and the central load. The
    /// control then attaches to the ViewState on the client, subscribes to the
    /// resource slice and re-renders when the ViewState re-queries it.
    ///
    /// A control that is authored outside a ViewState leaves the resource unset and
    /// behaves exactly as before, owning its islands and loading itself. See
    /// WebExpress/docs/view-state-service.md.
    /// </summary>
    public interface IViewStateBound
    {
        /// <summary>
        /// Gets or sets the resolver of the ViewState resource the control renders.
        /// It is set type-safely through the Resource&lt;TResource&gt;() binding
        /// extension rather than with a string. When null, the control is
        /// standalone and owns its own islands. The member is named
        /// ResourceFactory rather than Resource so the typed
        /// Resource&lt;TResource&gt;() extension is not shadowed by an instance
        /// member of the same name.
        /// </summary>
        Func<IRenderControlContext, string> ResourceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional ViewState id the control binds to, emitted as the
        /// data-wx-viewstate attribute. When null, the control resolves its ViewState by
        /// the resource it binds to.
        /// </summary>
        Func<IRenderControlContext, string> ViewState { get; set; }
    }

    /// <summary>
    /// Marks a ViewState-bound control that also needs the ViewState's users service (the
    /// assignee or mention resolution), bound type-safely with
    /// UsersService&lt;TEndpoint&gt;(). The control emits the data-wx-users
    /// binding so the client resolves that service from the ViewState, since the
    /// control owns no islands of its own.
    /// </summary>
    public interface IViewStateBoundUsers : IViewStateBound
    {
        /// <summary>
        /// Gets or sets the resolver of the ViewState users service, set type-safely
        /// through UsersService&lt;TEndpoint&gt;().
        /// </summary>
        Func<IRenderControlContext, string> UsersFactory { get; set; }
    }
}
