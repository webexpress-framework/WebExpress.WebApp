using WebExpress.WebCore.WebEndpoint;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// The type-safe binding surface that ties a control to a scope resource.
    /// Instead of assigning a string resource name, a control is bound with
    /// Resource&lt;TResource&gt;(), so the resource is referenced by its type and
    /// no name is spelled at the call site. The extension is declared on the
    /// non-generic <see cref="IScopeBound"/> with a single type parameter, so the
    /// call reads control.Resource&lt;TResource&gt;() and the receiver keeps its
    /// concrete type when the control is created in its own statement first, which
    /// is the authoring pattern the scope model uses.
    /// </summary>
    public static class ScopeBindingExtensions
    {
        /// <summary>
        /// Binds the control to the scope resource identified by the resource
        /// type. The control emits the resource binding and resolves, on the
        /// client, the scope that declares the resource.
        /// </summary>
        /// <typeparam name="TResource">The resource type.</typeparam>
        /// <param name="control">The scope-bound control.</param>
        /// <returns>The control for chaining.</returns>
        public static IScopeBound Resource<TResource>(this IScopeBound control) where TResource : IDataResource
        {
            if (control != null)
            {
                control.ResourceFactory = _ => DataTypeName.Of<TResource>();
            }

            return control;
        }

        /// <summary>
        /// Binds the scope users service the control uses, identified by its
        /// endpoint type. The control emits the binding so the client resolves
        /// the service from the scope.
        /// </summary>
        /// <typeparam name="TEndpoint">The users endpoint type.</typeparam>
        /// <param name="control">The scope-bound control that needs a users service.</param>
        /// <returns>The control for chaining.</returns>
        public static IScopeBoundUsers UsersService<TEndpoint>(this IScopeBoundUsers control) where TEndpoint : IEndpoint
        {
            if (control != null)
            {
                control.UsersFactory = _ => DataTypeName.Of<TEndpoint>();
            }

            return control;
        }
    }
}
