using System.Collections.Generic;
using System.Linq;
using System.Text;
using WebExpress.WebApp.WebSection;
using WebExpress.WebCore;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebFragment;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control for managing web application toast notification, 
    /// including preferences, primary, and secondary areas.
    /// </summary>
    public class ControlWebAppToastnotification : Control, IControlWebAppProperty
    {
        private readonly List<IControl> _preferences = [];
        private readonly List<IControl> _primary = [];
        private readonly List<IControl> _secondary = [];

        /// <summary>
        /// Gets the preferences area.
        /// </summary>
        public IEnumerable<IControl> Preferences => _preferences;

        /// <summary>
        /// Gets the primary area.
        /// </summary>
        public IEnumerable<IControl> Primary => _primary;

        /// <summary>
        /// Gets the secondary area.
        /// </summary>
        public IEnumerable<IControl> Secondary => _secondary;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlWebAppToastnotification(string id = null)
            : base(id)
        {
        }

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppProperty AddPreferences(params IControl[] items)
        {
            _preferences.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppProperty RemovePreference(IControl item)
        {
            _preferences.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppProperty AddPrimary(params IControl[] items)
        {
            _primary.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppProperty RemovePrimary(IControl item)
        {
            _primary.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppProperty AddSecondary(params IControl[] items)
        {
            _secondary.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppProperty RemoveSecondary(IControl item)
        {
            _secondary.Remove(item);

            return this;
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var preferences = Preferences.Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionToastNotificationPreferences>
            (
                renderContext?.PageContext
            ));

            var primary = Primary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionToastNotificationPrimary>
            (
                renderContext?.PageContext
            ));

            var secondary = Secondary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionToastNotificationSecondary>
            (
                renderContext?.PageContext
            ));

            // the bar is decided by what the children render, not by their presence: a fragment
            // whose condition refuses or that renders no markup (null, an empty text) would
            // otherwise leave an empty strip with nothing but its close button
            var nodes = preferences
                .Concat(primary)
                .Concat(secondary)
                .Select(x => x?.Render(renderContext, visualTree))
                .Where(HasMarkup)
                .Select(x => new ControlRenderedNode(x))
                .ToList();

            if (nodes.Count == 0)
            {
                return null;
            }

            return new ControlToast(Id)
            {
                Classes = ["wx-toast"]
            }
                .Add(nodes)
                .Render(renderContext, visualTree);
        }

        /// <summary>
        /// Tells whether a rendered child puts anything on the page.
        /// </summary>
        /// <param name="node">The rendered child, or null.</param>
        /// <returns>True when the child serializes to more than whitespace.</returns>
        private static bool HasMarkup(IHtmlNode node)
        {
            if (node is null)
            {
                return false;
            }

            var builder = new StringBuilder();
            node.ToString(builder, 0);

            return !string.IsNullOrWhiteSpace(builder.ToString());
        }

        /// <summary>
        /// Carries a child that is already rendered into the toast, so no child renders twice.
        /// </summary>
        private sealed class ControlRenderedNode : Control
        {
            private readonly IHtmlNode _node;

            /// <summary>
            /// Initializes a new instance of the class.
            /// </summary>
            /// <param name="node">The rendered child.</param>
            public ControlRenderedNode(IHtmlNode node)
            {
                _node = node;
            }

            /// <summary>
            /// Returns the rendered child.
            /// </summary>
            /// <param name="renderContext">The context in which the control is rendered.</param>
            /// <param name="visualTree">The visual tree representing the control's structure.</param>
            /// <returns>The rendered child.</returns>
            public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
            {
                return _node;
            }
        }
    }
}
