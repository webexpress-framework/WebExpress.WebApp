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
    /// Represents a sidebar control for the web application.
    /// </summary>
    public class ControlWebAppSidebar : Control, IControlWebAppSidebar
    {
        private readonly List<IControl> _header = [];
        private readonly List<IControl> _preferences = [];
        private readonly List<IControl> _primary = [];
        private readonly List<IControl> _secondary = [];

        /// <summary>
        /// Returns the header area.
        /// </summary>
        public IEnumerable<IControl> Header => _header;

        /// <summary>
        /// Returns the preferences area.
        /// </summary>
        public IEnumerable<IControl> Preferences => _preferences;

        /// <summary>
        /// Returns the primary area.
        /// </summary>
        public IEnumerable<IControl> Primary => _primary;

        /// <summary>
        /// Returns the secondary area.
        /// </summary>
        public IEnumerable<IControl> Secondary => _secondary;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlWebAppSidebar(string id = null)
            : base(id)
        {
        }

        /// <summary>
        /// Adds items to the header area.
        /// </summary>
        /// <param name="items">The items to add to the header area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppSidebar AddHeader(params IControl[] items)
        {
            _header.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the header area.
        /// </summary>
        /// <param name="item">The item to remove from the header area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppSidebar RemoveHeader(IControl item)
        {
            _header.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppSidebar AddPreferences(params IControl[] items)
        {
            _preferences.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppSidebar RemovePreference(IControl item)
        {
            _preferences.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppSidebar AddPrimary(params IControl[] items)
        {
            _primary.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppSidebar RemovePrimary(IControl item)
        {
            _primary.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppSidebar AddSecondary(params IControl[] items)
        {
            _secondary.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppSidebar RemoveSecondary(IControl item)
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
            var items = GetItems(renderContext);

            var sidebarCtlr = items.Any() ?
            new ControlPanelFlexbox(Id, [.. items])
            {
                Classes = ["wx-sidebar"],
                //BackgroundColor = new PropertyColorButton(TypeColorButton.Dark),
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.None, PropertySpacing.Space.None, PropertySpacing.Space.None)
            } :
            null;

            return sidebarCtlr?.Render(renderContext, visualTree);
        }

        /// <summary>
        /// Retrieves the items to be displayed in the control.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns>A collection of dropdown items.</returns>
        protected virtual IEnumerable<IControl> GetItems(IRenderControlContext renderContext)
        {
            foreach (var item in Header.Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionSidebarHeader>
            (
                renderContext?.PageContext
            )))
            {
                yield return item;
            }

            foreach (var item in Preferences.Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionSidebarPreferences>
            (
                renderContext?.PageContext
            )))
            {
                yield return item;
            }

            foreach (var item in Primary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionSidebarPrimary>
            (
                renderContext?.PageContext
            )))
            {
                yield return item;
            }

            foreach (var item in Secondary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionSidebarSecondary>
            (
                renderContext?.PageContext
            )))
            {
                yield return item;
            }
        }
    }
}
