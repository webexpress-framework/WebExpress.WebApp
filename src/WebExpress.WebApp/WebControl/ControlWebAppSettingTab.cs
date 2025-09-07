using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebSection;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebFragment;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a settings tab control in the web application.
    /// </summary>
    public class ControlWebAppSettingTab : Control
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
        public ControlWebAppSettingTab(string id = null)
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
            var items = GetItems(renderContext);

            Enable = items.Count() > 1;

            if (!Enable)
            {
                return null;
            }

            return new ControlNavigation(Id, [.. items])
            {
                Layout = TypeLayoutTab.Tab
            }.Render(renderContext, visualTree);
        }

        /// <summary>
        /// Retrieves the items from the preferences, primary, and secondary areas.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns>A list of tab items.</returns>
        private IEnumerable<IControlNavigationItem> GetItems(IRenderControlContext renderContext)
        {
            var settinPageManager = WebEx.ComponentHub.SettingPageManager;
            var appicationContext = renderContext.PageContext?.ApplicationContext;
            var settingPageContext = renderContext.PageContext as ISettingPageContext;
            var categories = settinPageManager?.GetSettingCategories(appicationContext)
                .Select
                (
                    x => new ControlNavigationItemLink()
                    {
                        Text = I18N.Translate(renderContext, x?.Name),
                        Uri = settinPageManager.GetFirstSettingPage(appicationContext, x).Route.ToUri(),
                        Active = settingPageContext.SettingCategory == x ? TypeActive.Active : TypeActive.None
                    }
                );

            foreach (var item in Preferences.Union(WebEx.ComponentHub.FragmentManager.GetFragments<FragmentControlNavigationItemLink, SectionSettingTabPreferences>
            (
                renderContext?.PageContext
            )))
            {
                yield return item;
            }

            foreach (var category in categories)
            {
                yield return category;
            }

            foreach (var item in Primary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<FragmentControlNavigationItemLink, SectionSettingTabPrimary>
            (
                renderContext?.PageContext
            )))
            {
                yield return item;
            }

            foreach (var item in Secondary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<FragmentControlNavigationItemLink, SectionSettingTabSecondary>
            (
                renderContext?.PageContext
            )))
            {
                yield return item;
            }
        }
    }
}
