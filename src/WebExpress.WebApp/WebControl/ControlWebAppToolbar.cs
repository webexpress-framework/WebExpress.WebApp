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
    /// Represents a toolbar control for a web application.
    /// </summary>
    public class ControlWebAppToolbar : ControlToolbar
    {
        private readonly List<IControlToolbarItem> _preferences = [];
        private readonly List<IControlToolbarItem> _primary = [];
        private readonly List<IControlToolbarItem> _secondary = [];

        /// <summary>
        /// Returns the preferences area.
        /// </summary>
        public IEnumerable<IControlToolbarItem> Preferences => _preferences;

        /// <summary>
        /// Returns the primary area.
        /// </summary>
        public IEnumerable<IControlToolbarItem> Primary => _primary;

        /// <summary>
        /// Returns the secondary area.
        /// </summary>
        public IEnumerable<IControlToolbarItem> Secondary => _secondary;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlWebAppToolbar(string id = null)
            : base(id)
        {
            Padding = new PropertySpacingPadding(PropertySpacing.Space.Null);
        }

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        public void AddPreferences(params IControlToolbarItem[] items)
        {
            _preferences.AddRange(items);
        }

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        public void RemovePreference(IControlToolbarItem item)
        {
            _preferences.Remove(item);
        }

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        public void AddPrimary(params IControlToolbarItem[] items)
        {
            _primary.AddRange(items);
        }

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        public void RemovePrimary(IControlToolbarItem item)
        {
            _primary.Remove(item);
        }

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        public void AddSecondary(params IControlToolbarItem[] items)
        {
            _secondary.AddRange(items);
        }

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        public void RemoveSecondary(IControlToolbarItem item)
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
            var items = GetItems(renderContext);

            Enable = items.Any();

            return base.Render(renderContext, visualTree, items);
        }

        /// <summary>
        /// Retrieves the toolbar items from the preferences, primary, and secondary areas.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns>A list of toolbar items.</returns>
        private IEnumerable<IControlToolbarItem> GetItems(IRenderControlContext renderContext)
        {
            var preferences = Preferences.Union(WebEx.ComponentHub.FragmentManager.GetFragments<FragmentControlToolbarItemButton, SectionToolbarPreferences>
            (
                renderContext?.PageContext
            ).Cast<ControlToolbarItemButton>());

            var primary = Primary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<FragmentControlToolbarItemButton, SectionToolbarPrimary>
            (
                renderContext?.PageContext
            ).Union(Items).Cast<ControlToolbarItemButton>());

            var secondary = Secondary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<FragmentControlToolbarItemButton, SectionToolbarSecondary>
            (
                renderContext?.PageContext
            ).Cast<ControlToolbarItemButton>());

            foreach (var item in preferences)
            {
                yield return item;
            }

            if (preferences.Any() && (primary.Any() || secondary.Any()))
            {
                yield return new ControlToolbarItemDivider();
            }

            foreach (var item in primary)
            {
                yield return item;
            }

            if (primary.Any() && secondary.Any())
            {
                yield return new ControlToolbarItemDivider();
            }

            foreach (var item in secondary)
            {
                yield return item;
            }
        }
    }
}
