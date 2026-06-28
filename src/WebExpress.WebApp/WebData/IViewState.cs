using System;
using System.Collections.Generic;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// Marks a control as a scope ViewState host. A scope host owns the single
    /// source of truth for a region of the page: beyond the state and services
    /// of an <see cref="IDataIsland"/>, it declares the named resources that bind
    /// that state to those services. It emits them as hidden wx-resource island
    /// elements that the JavaScript ViewState consumes, so the scope loads each
    /// resource centrally and every control in the scope re-renders when the
    /// shared state changes.
    ///
    /// This is the C# contract behind the ControlViewState container. The page is
    /// simply the outermost scope; scopes nest, and a control resolves the nearest
    /// enclosing scope. See WebExpress/docs/view-state-service.md.
    /// </summary>
    public interface IViewState : IDataIsland
    {
        /// <summary>
        /// Gets the resource descriptors of the scope, emitted as one wx-resource
        /// island element per resource, which the JavaScript ViewState resolves
        /// into the central queries of the scope. When empty, the scope holds
        /// state and services but loads nothing on its own.
        /// </summary>
        IList<Func<IRenderControlContext, DataResourceDescriptor>> ResourceFactories { get; }
    }
}
