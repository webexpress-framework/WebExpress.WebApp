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
    public class ControlWebAppToolbar : ControlToolbar, IControlWebAppToolbar
    {
        private readonly List<IControlToolbarItem> _preferences = [];
        private readonly List<IControlToolbarItem> _primary = [];
        private readonly List<IControlToolbarItem> _secondary = [];
        private readonly List<IControlDropdownItem> _morePreferences = [];
        private readonly List<IControlDropdownItem> _morePrimary = [];
        private readonly List<IControlDropdownItem> _moreSecondary = [];

        /// <summary>
        /// Gets the preferences area.
        /// </summary>
        public IEnumerable<IControlToolbarItem> Preferences => _preferences;

        /// <summary>
        /// Gets the primary area.
        /// </summary>
        public IEnumerable<IControlToolbarItem> Primary => _primary;

        /// <summary>
        /// Gets the secondary area.
        /// </summary>
        public IEnumerable<IControlToolbarItem> Secondary => _secondary;

        /// <summary>
        /// Gets the preferences area of the more menu.
        /// </summary>
        public IEnumerable<IControlDropdownItem> MorePreferences => _morePreferences;

        /// <summary>
        /// Gets the primary area of the more menu.
        /// </summary>
        public IEnumerable<IControlDropdownItem> MorePrimary => _morePrimary;

        /// <summary>
        /// Gets the secondary area of the more menu.
        /// </summary>
        public IEnumerable<IControlDropdownItem> MoreSecondary => _moreSecondary;

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
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppToolbar AddPreferences(params IControlToolbarItem[] items)
        {
            _preferences.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppToolbar RemovePreference(IControlToolbarItem item)
        {
            _preferences.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppToolbar AddPrimary(params IControlToolbarItem[] items)
        {
            _primary.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppToolbar RemovePrimary(IControlToolbarItem item)
        {
            _primary.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppToolbar AddSecondary(params IControlToolbarItem[] items)
        {
            _secondary.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppToolbar RemoveSecondary(IControlToolbarItem item)
        {
            _secondary.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the preferences area of the more menu.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppToolbar AddPreferences(params IControlDropdownItem[] items)
        {
            _morePreferences.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the preferences area of the more menu.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppToolbar RemovePreference(IControlDropdownItem item)
        {
            _morePreferences.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the primary area of the more menu.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppToolbar AddPrimary(params IControlDropdownItem[] items)
        {
            _morePrimary.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the primary area of the more menu.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppToolbar RemovePrimary(IControlDropdownItem item)
        {
            _morePrimary.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the secondary area of the more menu.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppToolbar AddSecondary(params IControlDropdownItem[] items)
        {
            _moreSecondary.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the secondary area of the more menu.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppToolbar RemoveSecondary(IControlDropdownItem item)
        {
            _moreSecondary.Remove(item);

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
            var more = GetMore(renderContext);

            Enable = items.Any() || more.Any();

            return base.Render(renderContext, visualTree, items, more);
        }

        /// <summary>
        /// Retrieves the toolbar items from the preferences, primary, and secondary areas.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns>A list of toolbar items.</returns>
        private IEnumerable<IControlToolbarItem> GetItems(IRenderControlContext renderContext)
        {
            var preferences = Preferences
                .Concat
                (
                    WebEx.ComponentHub.FragmentManager
                        .GetFragments<IFragmentControlToolbarItem, SectionToolbarPreferences>
                        (
                            renderContext?.PageContext
                        )
                        .OfType<IControlToolbarItem>()
                );

            var primary = Primary
               .Concat
               (
                   WebEx.ComponentHub.FragmentManager
                       .GetFragments<IFragmentControlToolbarItem, SectionToolbarPrimary>
                       (
                            renderContext?.PageContext
                       )
                       .OfType<IControlToolbarItem>()
               );

            var secondary = Secondary
               .Concat
               (
                   WebEx.ComponentHub.FragmentManager
                       .GetFragments<IFragmentControlToolbarItem, SectionToolbarSecondary>
                       (
                            renderContext?.PageContext
                       )
                       .OfType<IControlToolbarItem>()
               );

            var preferencesLeft = preferences
                .Where(x => x.Alignment == TypeToolbarItemAlignment.Default || x.Alignment == TypeToolbarItemAlignment.Left);
            var preferencesRight = preferences
                .Where(x => x.Alignment == TypeToolbarItemAlignment.Right);
            var primaryLeft = primary
                .Where(x => x.Alignment == TypeToolbarItemAlignment.Default || x.Alignment == TypeToolbarItemAlignment.Left);
            var primaryRight = primary
                .Where(x => x.Alignment == TypeToolbarItemAlignment.Right);
            var secondaryLeft = secondary
                .Where(x => x.Alignment == TypeToolbarItemAlignment.Default || x.Alignment == TypeToolbarItemAlignment.Left);
            var secondaryRight = secondary
                .Where(x => x.Alignment == TypeToolbarItemAlignment.Right);

            // left
            foreach (var item in preferencesLeft)
            {
                yield return item;
            }

            if (preferencesLeft.Any() && (primaryLeft.Any() || secondaryLeft.Any()))
            {
                yield return new ControlToolbarItemDivider();
            }

            foreach (var item in primaryLeft)
            {
                yield return item;
            }

            if (primaryLeft.Any() && secondaryLeft.Any())
            {
                yield return new ControlToolbarItemDivider();
            }

            foreach (var item in secondaryLeft)
            {
                yield return item;
            }

            // right
            foreach (var item in preferencesRight)
            {
                yield return item;
            }

            if (preferencesRight.Any() && (primaryRight.Any() || secondaryRight.Any()))
            {
                yield return new ControlToolbarItemDivider()
                {
                    Alignment = TypeToolbarItemAlignment.Right
                };
            }

            foreach (var item in primaryRight)
            {
                yield return item;
            }

            if (primaryRight.Any() && secondaryRight.Any())
            {
                yield return new ControlToolbarItemDivider()
                {
                    Alignment = TypeToolbarItemAlignment.Right
                };
            }

            foreach (var item in secondaryRight)
            {
                yield return item;
            }
        }

        /// <summary>
        /// Retrieves the more items to be displayed in the dropdown.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns>A collection of dropdown items.</returns>
        private IEnumerable<IControlDropdownItem> GetMore(IRenderControlContext renderContext)
        {
            var preferences = MorePreferences
                .Concat
                (
                    WebEx.ComponentHub.FragmentManager
                        .GetFragments<IFragmentControlDropdownItem, SectionToolbarMorePreferences>
                        (
                            renderContext?.PageContext
                        )
                        .OfType<IControlDropdownItem>()
                );

            var primary = MorePrimary
               .Concat
               (
                   WebEx.ComponentHub.FragmentManager
                       .GetFragments<IFragmentControlDropdownItem, SectionToolbarMorePrimary>
                       (
                            renderContext?.PageContext
                       )
                       .OfType<IControlDropdownItem>()
               );

            var secondary = MoreSecondary
               .Concat
               (
                   WebEx.ComponentHub.FragmentManager
                       .GetFragments<IFragmentControlDropdownItem, SectionToolbarMoreSecondary>
                       (
                            renderContext?.PageContext
                       )
                       .OfType<IControlDropdownItem>()
               );

            if (preferences.Any() || primary.Any() || secondary.Any())
            {
                yield return new ControlDropdownItemHeader()
                {
                    Text = "webexpress.webapp:toolbar.more.title"
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
