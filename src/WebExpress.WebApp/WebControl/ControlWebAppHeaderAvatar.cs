using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebApp.WebSection;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebFragment;
using WebExpress.WebUI.WebIcon;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Avatar controls for a web app header. Uses the avatar image as the interactive menu
    /// button via <see cref="ControlAvatarDropdown"/> and supports dynamic item loading
    /// through a REST API endpoint.
    /// </summary>
    public class ControlWebAppHeaderAvatar : Control, IControlWebAppHeaderAvatar
    {
        private readonly List<IControlDropdownItem> _preferences = [];
        private readonly List<IControlDropdownItem> _primary = [];
        private readonly List<IControlDropdownItem> _secondary = [];

        /// <summary>
        /// Returns or sets the REST API endpoint used to dynamically populate the avatar dropdown.
        /// </summary>
        public IUri RestUri { get; set; }

        /// <summary>
        /// Returns or sets the avatar image uri.
        /// </summary>
        public string Image { get; set; }

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
        public ControlWebAppHeaderAvatar(string id = null)
            : base(id)
        {
            Padding = new PropertySpacingPadding(PropertySpacing.Space.Null);
        }

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeaderAvatar AddPreferences(params IControlDropdownItem[] items)
        {
            _preferences.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeaderAvatar RemovePreference(IControlDropdownItem item)
        {
            _preferences.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeaderAvatar AddPrimary(params IControlDropdownItem[] items)
        {
            _primary.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeaderAvatar RemovePrimary(IControlDropdownItem item)
        {
            _primary.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeaderAvatar AddSecondary(params IControlDropdownItem[] items)
        {
            _secondary.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeaderAvatar RemoveSecondary(IControlDropdownItem item)
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

            var avatarCtrl = items.Any()
                ? new ControlAvatarDropdown(Id)
                {
                    Classes = ["wx-app-dropdown"],
                    Icon = new IconCog(),
                    AlignmentMenu = TypeAlignmentDropdownMenu.Right,
                    RestUri = RestUri,
                    Image = Image,
                    Margin = new PropertySpacingMargin
                    (
                        PropertySpacing.Space.Two,
                        PropertySpacing.Space.None,
                        PropertySpacing.Space.None,
                        PropertySpacing.Space.None
                    )
                }
                    .Add(items)
                : null;

            return avatarCtrl?.Render(renderContext, visualTree);
        }

        /// <summary>
        /// Retrieves the items to be displayed in the dropdown.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns>A collection of dropdown items.</returns>
        private IEnumerable<IControlDropdownItem> GetItems(IRenderControlContext renderContext)
        {
            var settinPageManager = WebEx.ComponentHub.SettingPageManager;
            var appicationContext = renderContext.PageContext?.ApplicationContext;
            var preferenceCategories = settinPageManager?.GetSettingCategories(appicationContext)
                .Where(x => x.Section == SettingSection.Preferences)
                .Where(x => settinPageManager.GetSettingPages(appicationContext, x).Any())
                .Select
                (
                    x => new ControlDropdownItemLink()
                    {
                        Text = I18N.Translate(renderContext, x?.Name),
                        Uri = settinPageManager.GetFirstSettingPage(appicationContext, x)?.Route.ToUri(),
                        Icon = x.Icon
                    }
                );
            var primaryCategories = settinPageManager?.GetSettingCategories(appicationContext)
                .Where(x => x.Section == SettingSection.Primary)
                .Where(x => settinPageManager.GetSettingPages(appicationContext, x).Any())
                .Select
                (
                    x => new ControlDropdownItemLink()
                    {
                        Text = I18N.Translate(renderContext, x?.Name),
                        Uri = settinPageManager.GetFirstSettingPage(appicationContext, x)?.Route.ToUri(),
                        Icon = x.Icon
                    }
                );
            var secondaryCategories = settinPageManager?.GetSettingCategories(appicationContext)
                .Where(x => x.Section == SettingSection.Secondary)
                .Where(x => settinPageManager.GetSettingPages(appicationContext, x).Any())
                .Select
                (
                    x => new ControlDropdownItemLink()
                    {
                        Text = I18N.Translate(renderContext, x?.Name),
                        Uri = settinPageManager.GetFirstSettingPage(appicationContext, x)?.Route.ToUri(),
                        Icon = x.Icon
                    }
                );

            var preferences = Preferences.Union(WebEx.ComponentHub.FragmentManager.GetFragments<FragmentControlDropdownItemLink, SectionAppAvatarPreferences>
            (
                renderContext?.PageContext
            ));

            var primary = Primary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<FragmentControlDropdownItemLink, SectionAppAvatarPrimary>
            (
                renderContext?.PageContext
            ));

            var secondary = Secondary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<FragmentControlDropdownItemLink, SectionAppAvatarSecondary>
            (
                renderContext?.PageContext
            ));

            if (preferences.Any() || primary.Any() || secondary.Any() || preferenceCategories.Any())
            {
                yield return new ControlDropdownItemHeader()
                {
                    Text = I18N.Translate(renderContext.Request, "webexpress.webapp:header.avatar.label")
                };
            }

            foreach (var item in preferenceCategories)
            {
                yield return item;
            }

            foreach (var item in preferences)
            {
                yield return item;
            }

            if ((preferenceCategories.Any() || preferences.Any()) && (primary.Any() || secondary.Any()))
            {
                yield return new ControlDropdownItemDivider();
            }

            foreach (var item in primaryCategories)
            {
                yield return item;
            }

            foreach (var item in primary)
            {
                yield return item;
            }

            if ((primaryCategories.Any() || primary.Any()) && secondary.Any())
            {
                yield return new ControlDropdownItemDivider();
            }

            foreach (var item in secondaryCategories)
            {
                yield return item;
            }

            foreach (var item in secondary)
            {
                yield return item;
            }
        }
    }
}
