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
    /// Represents a control for managing web application epilogue section, 
    /// including preferences, primary, and secondary areas.
    /// </summary>
    public class ControlWebAppEpilogue : Control, IControlWebAppEpilogue
    {
        private readonly List<IControl> _preferences = [];
        private readonly List<IControl> _primary = [];
        private readonly List<IControl> _secondary = [];

        /// <summary>
        /// Gets the preferences area.
        /// </summary>
        public IEnumerable<IControl> Preferences => _preferences;

        /// <summary>
        /// Gets the primary area.
        /// </summary>
        public IEnumerable<IControl> Primary => _primary;

        /// <summary>
        /// Gets the secondary area.
        /// </summary>
        public IEnumerable<IControl> Secondary => _secondary;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlWebAppEpilogue(string id = null)
            : base(id)
        {
        }

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppEpilogue AddPreferences(params IControl[] items)
        {
            _preferences.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppEpilogue RemovePreference(IControl item)
        {
            _preferences.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppEpilogue AddPrimary(params IControl[] items)
        {
            _primary.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppEpilogue RemovePrimary(IControl item)
        {
            _primary.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppEpilogue AddSecondary(params IControl[] items)
        {
            _secondary.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppEpilogue RemoveSecondary(IControl item)
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
            var preferences = Preferences
                .Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionEpiloguePreferences>
                (
                    renderContext?.PageContext
                ));

            var primary = Primary
                .Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionEpiloguePrimary>
                (
                    renderContext?.PageContext
                ));

            var secondary = Secondary
                .Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionEpilogueSecondary>
                (
                    renderContext?.PageContext
                ));

            if (!preferences.Any() && !primary.Any() && !secondary.Any())
            {
                return null;
            }

            var ctlr = (preferences.Any() || primary.Any() || secondary.Any())
                ? new ControlPanel(Id)
                {
                    Classes = ["wx-epilogue"]
                }
                    .Add(preferences)
                    .Add(primary)
                    .Add(secondary)
                : null;

            return ctlr?.Render(renderContext, visualTree);
        }
    }
}
