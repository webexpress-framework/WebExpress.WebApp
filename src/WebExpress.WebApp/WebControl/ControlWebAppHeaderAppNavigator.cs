using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebSection;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebFragment;
using WebExpress.WebUI.WebIcon;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// App navigator for a WebApp.
    /// </summary>
    public class ControlWebAppHeaderAppNavigator : Control, IControlWebAppHeaderAppNavigator
    {
        private readonly List<IControlDropdownItem> _preferences = [];
        private readonly List<IControlDropdownItem> _primary = [];
        private readonly List<IControlDropdownItem> _secondary = [];

        /// <summary>
        /// Returns the preferences area.
        /// </summary>
        public IEnumerable<IControlDropdownItem> Preferences => _preferences;

        /// <summary>
        /// Returns the primary area.
        /// </summary>
        public IEnumerable<IControlDropdownItem> Primary => _primary;

        /// <summary>
        /// Returns the secondary area.
        /// </summary>
        public IEnumerable<IControlDropdownItem> Secondary => _secondary;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlWebAppHeaderAppNavigator(string id = null)
            : base(id)
        {
            Padding = new PropertySpacingPadding(PropertySpacing.Space.Null);
        }

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeaderAppNavigator AddPreferences(params IControlDropdownItem[] items)
        {
            _preferences.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeaderAppNavigator RemovePreference(IControlDropdownItem item)
        {
            _preferences.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeaderAppNavigator AddPrimary(params IControlDropdownItem[] items)
        {
            _primary.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeaderAppNavigator RemovePrimary(IControlDropdownItem item)
        {
            _primary.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeaderAppNavigator AddSecondary(params IControlDropdownItem[] items)
        {
            _secondary.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeaderAppNavigator RemoveSecondary(IControlDropdownItem item)
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
            var application = renderContext?.PageContext?.ApplicationContext;
            var items = GetItems(renderContext);

            var navigatorCtrl = items.Any()
                ? (IControl)new ControlDropdown(Id)
                {
                    Classes = ["wx-appnavigator"],
                    Icon = new ImageIcon(application?.Icon.ToUri(), new PropertySizeIcon(1, TypeSizeUnit.Em)),
                }
                    .Add(items)
                : new ControlImage(Id)
                {
                    Classes = ["wx-appnavigator"],
                    Uri = application?.Icon.ToUri()
                };

            return navigatorCtrl?.Render(renderContext, visualTree);
        }

        /// <summary>
        /// Retrieves the items to be displayed in the dropdown.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns>A collection of dropdown items.</returns>
        private IEnumerable<IControlDropdownItem> GetItems(IRenderControlContext renderContext)
        {
            var application = renderContext?.PageContext?.ApplicationContext;

            var preferences = Preferences.Union(WebEx.ComponentHub.FragmentManager.GetFragments<FragmentControlDropdownItemLink, SectionAppPreferences>
            (
                renderContext?.PageContext
            ));

            var primary = Primary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<FragmentControlDropdownItemLink, SectionAppPrimary>
            (
                renderContext?.PageContext
            ));

            var secondary = Secondary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<FragmentControlDropdownItemLink, SectionAppSecondary>
            (
                renderContext?.PageContext
            ));

            if (preferences.Any() || primary.Any() || secondary.Any())
            {
                yield return new ControlDropdownItemHeader()
                {
                    Text = I18N.Translate(renderContext, application?.ApplicationName)
                };
            }

            foreach (var item in preferences)
            {
                yield return item;
            }

            if (preferences.Any() && (primary.Any() || secondary.Any()))
            {
                yield return new ControlDropdownItemDivider();
            }

            foreach (var item in primary)
            {
                yield return item;
            }

            if (primary.Any() && secondary.Any())
            {
                yield return new ControlDropdownItemDivider();
            }

            foreach (var item in secondary)
            {
                yield return item;
            }
        }
    }
}
