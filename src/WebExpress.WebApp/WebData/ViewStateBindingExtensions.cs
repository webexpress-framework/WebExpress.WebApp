using WebExpress.WebCore.WebEndpoint;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// The type-safe binding surface that ties a control to a ViewState resource.
    /// Instead of assigning a string resource name, a control is bound with
    /// Resource&lt;TResource&gt;(), so the resource is referenced by its type and
    /// no name is spelled at the call site. The extension is declared on the
    /// non-generic <see cref="IViewStateBound"/> with a single type parameter, so the
    /// call reads control.Resource&lt;TResource&gt;() and the receiver keeps its
    /// concrete type when the control is created in its own statement first, which
    /// is the authoring pattern the ViewState model uses.
    /// </summary>
    public static class ViewStateBindingExtensions
    {
        /// <summary>
        /// Binds the control to the ViewState resource identified by the resource
        /// type. The control emits the resource binding and resolves, on the
        /// client, the ViewState that declares the resource.
        /// </summary>
        /// <typeparam name="TResource">The resource type.</typeparam>
        /// <param name="control">The ViewState-bound control.</param>
        /// <returns>The control for chaining.</returns>
        public static IViewStateBound Resource<TResource>(this IViewStateBound control) where TResource : IDataResource
        {
            if (control != null)
            {
                control.ResourceFactory = _ => DataTypeName.Of<TResource>();
            }

            return control;
        }

        /// <summary>
        /// Binds the ViewState users service the control uses, identified by its
        /// endpoint type. The control emits the binding so the client resolves
        /// the service from the ViewState.
        /// </summary>
        /// <typeparam name="TEndpoint">The users endpoint type.</typeparam>
        /// <param name="control">The ViewState-bound control that needs a users service.</param>
        /// <returns>The control for chaining.</returns>
        public static IViewStateBoundUsers UsersService<TEndpoint>(this IViewStateBoundUsers control) where TEndpoint : IEndpoint
        {
            if (control != null)
            {
                control.UsersFactory = _ => DataTypeName.Of<TEndpoint>();
            }

            return control;
        }
    }
}
