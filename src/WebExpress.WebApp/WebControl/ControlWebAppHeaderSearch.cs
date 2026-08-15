using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebSection;
using WebExpress.WebCore;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebFragment;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Renders the search control in the WebApp header. The search box is contributed through
    /// fragments of the search section, so the header stays empty until an application supplies one.
    /// </summary>
    public class ControlWebAppHeaderSearch : Control, IControlWebAppHeaderSearch
    {
        private readonly List<ControlSearch> _searches = [];

        /// <summary>
        /// Gets the search boxes contributed directly to the control.
        /// </summary>
        public IEnumerable<ControlSearch> Searches => _searches;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlWebAppHeaderSearch(string id = null)
            : base(id)
        {
            Padding = _ => new PropertySpacingPadding(PropertySpacing.Space.Null);

            // keeps the search box from sitting flush against the quick-create button to its left
            Margin = _ => new PropertySpacingMargin
            (
                PropertySpacing.Space.Three,
                PropertySpacing.Space.None,
                PropertySpacing.Space.None,
                PropertySpacing.Space.None
            );
        }

        /// <summary>
        /// Adds search boxes to the control.
        /// </summary>
        /// <param name="items">The search boxes to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeaderSearch Add(params ControlSearch[] items)
        {
            _searches.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes a search box from the control.
        /// </summary>
        /// <param name="item">The search box to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeaderSearch Remove(ControlSearch item)
        {
            _searches.Remove(item);

            return this;
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control, or null when no search box is present.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            // the boxes are collected through the fragment contract rather than through the plain
            // search fragment, so a box built on a richer control - a data bound one, for example -
            // lands in the same slot
            var searches = Searches.Cast<IControl>().Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControlSearch, SectionAppSearch>
            (
                renderContext?.PageContext
            ));

            // the header slot stays collapsed until an application contributes a search box, so an empty
            // wrapper is never emitted into the navbar
            if (!searches.Any())
            {
                return null;
            }

            // the wrapper carries its own class: wx-search is what the search box itself is marked
            // with on the client, and sharing it would apply the box styling to the wrapper
            return new ControlPanel(Id)
            {
                Classes = [Css.Concatenate("wx-header-search", GetClasses(renderContext))],
                Styles = [GetStyles(renderContext)]
            }
                .Add(searches)
                .Render(renderContext, visualTree);
        }
    }
}
