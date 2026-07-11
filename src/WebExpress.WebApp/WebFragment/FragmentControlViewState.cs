using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebFragment;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebFragment;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebFragment
{
    /// <summary>
    /// A ViewState made available as a fragment, so the framework can
    /// insert it into a WebApp page section. A page that is composed from
    /// fragments uses this to inject the ViewState its bound control fragments
    /// resolve by resource, mirroring the fragment form of the data controls
    /// (FragmentControlDataList and the rest). The fragment is generic over the
    /// ViewState state model and carries the typed State, Service and Resource
    /// authoring of <see cref="ControlViewState{TState}"/>.
    /// </summary>
    /// <typeparam name="TState">The ViewState state model.</typeparam>
    public abstract class FragmentControlViewState<TState> : ControlViewState<TState>, IFragmentControl<ControlViewState<TState>>, IFragmentControlViewState where TState : class, new()
    {
        /// <summary>
        /// Gets the context of the fragment.
        /// </summary>
        public IFragmentContext FragmentContext { get; private set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="fragmentContext">The context of the fragment.</param>
        public FragmentControlViewState(IFragmentContext fragmentContext)
            : base(fragmentContext?.FragmentId?.ToString()?.Replace(".", "-"))
        {
            FragmentContext = fragmentContext;
        }

        /// <summary>
        /// Convert the fragment to HTML.
        /// </summary>
        /// <param name="renderContext">The context in which the fragment is rendered.</param>
        /// <param name="visualTree">The visual tree used for rendering the fragment.</param>
        /// <returns>An HTML node representing the rendered fragment, or null when its conditions exclude it.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            if (!FragmentContext.Conditions.Check(renderContext?.Request))
            {
                return null;
            }

            return base.Render(renderContext, visualTree);
        }
    }
}
