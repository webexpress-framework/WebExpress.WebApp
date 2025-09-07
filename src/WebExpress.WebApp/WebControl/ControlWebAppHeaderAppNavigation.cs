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
    /// Represents the header navigation control for the web application.
    /// </summary>
    public class ControlWebAppHeaderAppNavigation : ControlPanelFlexbox
    {
        private readonly List<IControlNavigationItem> _preferences = [];
        private readonly List<IControlNavigationItem> _primary = [];
        private readonly List<IControlNavigationItem> _secondary = [];

        /// <summary>
        /// Returns the preferences area.
        /// </summary>
        public IEnumerable<IControlNavigationItem> Preferences => _preferences;

        /// <summary>
        /// Returns the primary area.
        /// </summary>
        public IEnumerable<IControlNavigationItem> Primary => _primary;

        /// <summary>
        /// Returns the secondary area.
        /// </summary>
        public IEnumerable<IControlNavigationItem> Secondary => _secondary;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlWebAppHeaderAppNavigation(string id = null)
            : base(id)
        {
            Padding = new PropertySpacingPadding(PropertySpacing.Space.Null);
        }

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        public void AddPreferences(params IControlNavigationItem[] items)
        {
            _preferences.AddRange(items);
        }

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        public void RemovePreference(IControlNavigationItem item)
        {
            _preferences.Remove(item);
        }

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        public void AddPrimary(params IControlNavigationItem[] items)
        {
            _primary.AddRange(items);
        }

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        public void RemovePrimary(IControlNavigationItem item)
        {
            _primary.Remove(item);
        }

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        public void AddSecondary(params IControlNavigationItem[] items)
        {
            _secondary.AddRange(items);
        }

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        public void RemoveSecondary(IControlNavigationItem item)
        {
            _secondary.Remove(item);
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var preferences = Preferences.Union(WebEx.ComponentHub.FragmentManager.GetFragments<FragmentControlNavigationItemLink, SectionAppNavigationPreferences>
            (
                renderContext?.PageContext
            ));

            var primary = Primary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<FragmentControlNavigationItemLink, SectionAppNavigationPrimary>
            (
                renderContext?.PageContext
            ));

            var secondary = WebEx.ComponentHub.FragmentManager.GetFragments<FragmentControlNavigationItemLink, SectionAppNavigationSecondary>
            (
                renderContext?.PageContext
            );

            return new HtmlElementTextContentDiv
            (
                preferences.Any() ? new ControlNavigation("webexpress.webapp.header.appnavigation.preferences", [.. preferences])
                {
                    Layout = TypeLayoutTab.Default,
                }.Render(renderContext, visualTree) : null,
                primary.Any() ? new ControlNavigation("webexpress.webapp.header.appnavigation.primary", [.. primary])
                {
                    Layout = TypeLayoutTab.Default,
                }.Render(renderContext, visualTree) : null,
                secondary.Any() ? new ControlNavigation("webexpress.webapp.header.appnavigation.secondary", Secondary.Union(secondary).ToArray())
                {
                    Layout = TypeLayoutTab.Default,
                }.Render(renderContext, visualTree) : null
            )
            {
                Id = Id,
                Class = Css.Concatenate("", GetClasses()),
                Style = Style.Concatenate("", GetStyles()),
                Role = Role
            };
        }
    }
}
