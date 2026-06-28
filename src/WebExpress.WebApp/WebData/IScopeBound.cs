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
        /// Gets or sets the resolver of the scope resource the control renders.
        /// It is set type-safely through the Resource&lt;TResource&gt;() binding
        /// extension rather than with a string. When null, the control is
        /// standalone and owns its own islands. The member is named
        /// ResourceFactory rather than Resource so the typed
        /// Resource&lt;TResource&gt;() extension is not shadowed by an instance
        /// member of the same name.
        /// </summary>
        Func<IRenderControlContext, string> ResourceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional scope id the control binds to, emitted as the
        /// data-wx-view attribute. When null, the control resolves its scope by
        /// the resource it binds to.
        /// </summary>
        Func<IRenderControlContext, string> Scope { get; set; }
    }

    /// <summary>
    /// Marks a scope-bound control that also needs the scope's users service (the
    /// assignee or mention resolution), bound type-safely with
    /// UsersService&lt;TEndpoint&gt;(). The control emits the data-wx-users
    /// binding so the client resolves that service from the scope, since the
    /// control owns no islands of its own.
    /// </summary>
    public interface IScopeBoundUsers : IScopeBound
    {
        /// <summary>
        /// Gets or sets the resolver of the scope users service, set type-safely
        /// through UsersService&lt;TEndpoint&gt;().
        /// </summary>
        Func<IRenderControlContext, string> UsersFactory { get; set; }
    }
}
