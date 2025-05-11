using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebSection;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebFragment;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Quick create control element for a WebApp.
    /// </summary>
    public class ControlWebAppHeaderQuickCreate : Control
    {
        private readonly List<IControlSplitButtonItem> _preferences = [];
        private readonly List<IControlSplitButtonItem> _primary = [];
        private readonly List<IControlSplitButtonItem> _secondary = [];

        /// <summary>
        /// Returns the preferences area.
        /// </summary>
        public IEnumerable<IControlSplitButtonItem> Preferences => _preferences;

        /// <summary>
        /// Returns the primary area.
        /// </summary>
        public IEnumerable<IControlSplitButtonItem> Primary => _primary;

        /// <summary>
        /// Returns the secondary area.
        /// </summary>
        public IEnumerable<IControlSplitButtonItem> Secondary => _secondary;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlWebAppHeaderQuickCreate(string id = null)
            : base(id)
        {
            Padding = new PropertySpacingPadding(PropertySpacing.Space.Null);
        }

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        public void AddPreferences(params IControlSplitButtonItem[] items)
        {
            _preferences.AddRange(items);
        }

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        public void RemovePreference(IControlSplitButtonItem item)
        {
            _preferences.Remove(item);
        }

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        public void AddPrimary(params IControlSplitButtonItem[] items)
        {
            _primary.AddRange(items);
        }

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        public void RemovePrimary(IControlSplitButtonItem item)
        {
            _primary.Remove(item);
        }

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        public void AddSecondary(params IControlSplitButtonItem[] items)
        {
            _secondary.AddRange(items);
        }

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        public void RemoveSecondary(IControlSplitButtonItem item)
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
            var preferences = Preferences.Union(WebEx.ComponentHub.FragmentManager.GetFragments<FragmentControlSplitButtonItemLink, SectionAppQuickcreatePreferences>
            (
                renderContext?.PageContext?.ApplicationContext,
                renderContext?.PageContext?.Scopes
            ));

            var primary = Primary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<FragmentControlSplitButtonItemLink, SectionAppQuickcreatePrimary>
            (
                renderContext?.PageContext?.ApplicationContext,
                renderContext?.PageContext?.Scopes
            ));

            var secondary = Secondary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<FragmentControlSplitButtonItemLink, SectionAppQuickcreateSecondary>
            (
                renderContext?.PageContext?.ApplicationContext,
                renderContext?.PageContext?.Scopes
            ));

            var quickcreateList = preferences
                .Union(primary)
                .Union(secondary);

            var firstQuickcreate = quickcreateList.FirstOrDefault() as ControlSplitButtonItemLink;
            var nextQuickcreate = quickcreateList.Skip(1);

            var quickcreate = nextQuickcreate.Any() ?
            (IControl)new ControlSplitButtonLink(Id, [.. nextQuickcreate.Skip(1)])
            {
                Text = I18N.Translate(renderContext.Request?.Culture, "webexpress.webapp:header.quickcreate.label"),
                Uri = firstQuickcreate?.Uri,
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Auto, PropertySpacing.Space.None),
                OnClick = firstQuickcreate?.OnClick,
                Modal = firstQuickcreate?.Modal
            } :
            Preferences.Any() ?
            new ControlButtonLink(Id)
            {
                Text = I18N.Translate(renderContext.Request?.Culture, "webexpress.webapp:header.quickcreate.label"),
                Uri = firstQuickcreate?.Uri,
                OnClick = firstQuickcreate?.OnClick,
                Modal = firstQuickcreate?.Modal
            } :
            null;

            return quickcreate?.Render(renderContext, visualTree);
        }
    }
}
