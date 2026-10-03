using System;
using WebExpress.WebCore.WebEndpoint;
using WebExpress.WebUI.WebPage;

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
        /// Binds a writing surface to the ViewState resource it drives, identified
        /// by the resource type. The surface writes into the shared state and
        /// re-queries this resource, so it resolves the ViewState that declares it
        /// on the client, exactly like a control that renders the resource. The
        /// overload keeps the receiver typed as <see cref="IViewStateModelBound"/>
        /// so the Model(...) call chains after it.
        /// </summary>
        /// <typeparam name="TResource">The resource type the surface drives.</typeparam>
        /// <param name="control">The writing surface.</param>
        /// <returns>The surface for chaining.</returns>
        public static IViewStateModelBound Resource<TResource>(this IViewStateModelBound control) where TResource : IDataResource
        {
            if (control != null)
            {
                control.ResourceFactory = _ => DataTypeName.Of<TResource>();
            }

            return control;
        }

        /// <summary>
        /// Declares the ViewState state path a writing surface writes when the user
        /// interacts, so a quickfilter, a search box or a form field feeds the
        /// shared state and, combined with the bound resource, triggers a central
        /// re-query. The path is emitted as data-wx-model and the bound resource
        /// as data-wx-model-query, which the model bind and the surface's client
        /// behavior consume. This is the write counterpart to Resource, so it is
        /// declared on <see cref="IViewStateModelBound"/> and paired with it.
        /// </summary>
        /// <param name="control">The writing surface.</param>
        /// <param name="path">The ViewState state path to write, for example "filter" or "search".</param>
        /// <returns>The surface for chaining.</returns>
        public static IViewStateModelBound Model(this IViewStateModelBound control, string path)
        {
            if (control != null)
            {
                control.ModelFactory = _ => path;
            }

            return control;
        }

        /// <summary>
        /// Declares the ViewState state path a writing surface writes, resolved from
        /// the render context, for a path that depends on the request.
        /// </summary>
        /// <param name="control">The writing surface.</param>
        /// <param name="path">The resolver of the state path.</param>
        /// <returns>The surface for chaining.</returns>
        public static IViewStateModelBound Model(this IViewStateModelBound control, Func<IRenderControlContext, string> path)
        {
            if (control != null)
            {
                control.ModelFactory = path;
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
