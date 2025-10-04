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
        private readonly List<IControlSidebarItem> _header = [];
        private readonly List<IControlSidebarItem> _preferences = [];
        private readonly List<IControlSidebarItem> _primary = [];
        private readonly List<IControlSidebarItem> _secondary = [];

        /// <summary>
        /// Returns the header area.
        /// </summary>
        public IEnumerable<IControlSidebarItem> Header => _header;

        /// <summary>
        /// Returns the preferences area.
        /// </summary>
        public IEnumerable<IControlSidebarItem> Preferences => _preferences;

        /// <summary>
        /// Returns the primary area.
        /// </summary>
        public IEnumerable<IControlSidebarItem> Primary => _primary;

        /// <summary>
        /// Returns the secondary area.
        /// </summary>
        public IEnumerable<IControlSidebarItem> Secondary => _secondary;

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
        public IControlWebAppSidebar AddHeader(params IControlSidebarItem[] items)
        {
            _header.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the header area.
        /// </summary>
        /// <param name="item">The item to remove from the header area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppSidebar RemoveHeader(IControlSidebarItem item)
        {
            _header.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppSidebar AddPreferences(params IControlSidebarItem[] items)
        {
            _preferences.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppSidebar RemovePreference(IControlSidebarItem item)
        {
            _preferences.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppSidebar AddPrimary(params IControlSidebarItem[] items)
        {
            _primary.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppSidebar RemovePrimary(IControlSidebarItem item)
        {
            _primary.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppSidebar AddSecondary(params IControlSidebarItem[] items)
        {
            _secondary.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppSidebar RemoveSecondary(IControlSidebarItem item)
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

            var sidebarCtlr = items.Any()
                ? new ControlSidebar(Id)
                {
                    Breakpoint = 80
                }
                    .Add(items)
                    .Add(new ControlToolbarItemButtonSplitToggle("wx-split-button-toggle")
                    {
                        Alignment = TypeToolbarItemAlignment.Right,
                        Overflow = TypeToolbarItemOverflow.Never,
                        SpltterId = "wx-split"
                    })
                : null;

            return sidebarCtlr?.Render(renderContext, visualTree);
        }

        /// <summary>
        /// Retrieves the items to be displayed in the control.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns>A collection of dropdown items.</returns>
        protected virtual IEnumerable<IControlSidebarItem> GetItems(IRenderControlContext renderContext)
        {
            foreach (var item in Header
                .Concat
                (
                    WebEx.ComponentHub.FragmentManager
                        .GetFragments<IFragmentControlSidebarItem, SectionSidebarHeader>
                        (
                            renderContext?.PageContext
                        )
                        .OfType<IControlSidebarItem>()
                )
            )
            {
                yield return item;
            }

            foreach (var item in Preferences
                .Concat
                (
                    WebEx.ComponentHub.FragmentManager
                        .GetFragments<IFragmentControlSidebarItem, SectionSidebarPreferences>
                        (
                            renderContext?.PageContext
                        )
                        .OfType<IControlSidebarItem>()
                )
            )
            {
                yield return item;
            }

            foreach (var item in Primary
                .Concat
                (
                    WebEx.ComponentHub.FragmentManager
                        .GetFragments<IFragmentControlSidebarItem, SectionSidebarPrimary>
                        (
                            renderContext?.PageContext
                        )
                        .OfType<IControlSidebarItem>()
                )
            )
            {
                yield return item;
            }

            foreach (var item in Secondary
                .Concat
                (
                    WebEx.ComponentHub.FragmentManager
                        .GetFragments<IFragmentControlSidebarItem, SectionSidebarSecondary>
                        (
                            renderContext?.PageContext
                        )
                        .OfType<IControlSidebarItem>()
                )
            )
            {
                yield return item;
            }
        }
    }
}
