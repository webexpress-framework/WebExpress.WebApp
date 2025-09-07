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
    /// Footer for a web app.
    /// </summary>
    public class ControlWebAppFooter : Control
    {
        private readonly List<IControl> _preferences = [];
        private readonly List<IControl> _primary = [];
        private readonly List<IControl> _secondary = [];

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
        public ControlWebAppFooter(string id = null)
            : base(id)
        {
        }

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        public void AddPreferences(params IControl[] items)
        {
            _preferences.AddRange(items);
        }

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        public void RemovePreference(IControl item)
        {
            _preferences.Remove(item);
        }

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        public void AddPrimary(params IControl[] items)
        {
            _primary.AddRange(items);
        }

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        public void RemovePrimary(IControl item)
        {
            _primary.Remove(item);
        }

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        public void AddSecondary(params IControl[] items)
        {
            _secondary.AddRange(items);
        }

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        public void RemoveSecondary(IControl item)
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
            var preferences = Preferences.Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionFooterPreferences>
            (
                renderContext?.PageContext
            ));

            var primary = Primary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionFooterPrimary>
            (
                renderContext?.PageContext
            ));

            var secondary = Secondary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionFooterSecondary>
            (
                renderContext?.PageContext
            ));

            var footerCtrl = (preferences.Any() || primary.Any() || secondary.Any()) ? new ControlPanelFooter
            (
                Id,
                new ControlPanel(null, [.. preferences]),
                new ControlPanel(null, [.. primary]),
                new ControlPanel(null, [.. secondary])
            )
            {
                Classes = ["wx-footer"],
            } : null;

            return footerCtrl?.Render(renderContext, visualTree);
        }
    }
}
