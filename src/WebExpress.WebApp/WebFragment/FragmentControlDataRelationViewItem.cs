using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebFragment;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebFragment
{
    /// <summary>
    /// The base a plugin derives from to contribute a further presentation to the
    /// relation surface. The derived class names the section it belongs to and
    /// the scope it applies in through attributes, fills the presentation with
    /// controls in its constructor and is inserted by the framework - the page
    /// hosting the surface is not touched.
    ///
    /// <code>
    /// [Section&lt;SectionRelationViewPrimary&gt;]
    /// [Scope&lt;IncidentPage&gt;]
    /// public sealed class TimelineView : FragmentControlDataRelationViewItem
    /// {
    ///     public TimelineView(IFragmentContext fragmentContext)
    ///         : base(fragmentContext, "timeline")
    ///     {
    ///         Label = _ => "Timeline";
    ///         Add(new ControlDataSchedule().DataService&lt;IncidentTimeline&gt;());
    ///     }
    /// }
    /// </code>
    /// </summary>
    public abstract class FragmentControlDataRelationViewItem : ControlDataRelationViewItem, IFragmentControlDataRelationViewItem
    {
        /// <summary>
        /// Gets the context of the fragment.
        /// </summary>
        public IFragmentContext FragmentContext { get; private set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="fragmentContext">The context of the fragment.</param>
        /// <param name="view">
        /// The token the presentation is selected by. It must not collide with
        /// the built-in <c>list</c> and <c>graph</c> or with another contributed
        /// presentation.
        /// </param>
        public FragmentControlDataRelationViewItem(IFragmentContext fragmentContext, string view)
            : base(view, fragmentContext?.FragmentId?.ToString()?.Replace(".", "-"))
        {
            FragmentContext = fragmentContext;
        }

        /// <summary>
        /// Converts the fragment to its HTML representation. A fragment whose
        /// conditions do not hold renders nothing, so its entry never appears in
        /// the presentation switch either.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>The rendered HTML node, or <see langword="null"/>.</returns>
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
