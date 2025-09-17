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
    /// Headline for an web app.
    /// </summary>
    public class ControlWebAppHeadline : Control, IControlWebAppHeadline
    {
        private readonly List<IControl> _prologue = [];
        private readonly List<IControl> _preferences = [];
        private readonly List<IControl> _primary = [];
        private readonly List<IControl> _secondary = [];
        private readonly List<IControl> _metadata = [];

        /// <summary>
        /// Returns the prologue area.
        /// </summary>
        public IEnumerable<IControl> Prologue => _prologue;

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
        /// Returns the secondary area for the metadata.
        /// </summary>
        public IEnumerable<IControl> Metadata => _metadata;

        /// <summary>
        /// Returns the more control.
        /// </summary>
        public IControlWebAppHeadlineMore More { get; } = new ControlWebAppHeadlineMore("wx-content-main-headline-more")
        {
        };

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlWebAppHeadline(string id = null)
            : base(id)
        {
        }

        /// <summary>
        /// Adds items to the prologue area.
        /// </summary>
        /// <param name="items">The items to add to the prologue area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeadline AddPrologue(params IControl[] items)
        {
            _prologue.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the prologue area.
        /// </summary>
        /// <param name="item">The item to remove from the prologue area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeadline RemovePrologue(IControl item)
        {
            _prologue.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeadline AddPreferences(params IControl[] items)
        {
            _preferences.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeadline RemovePreference(IControl item)
        {
            _preferences.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeadline AddPrimary(params IControl[] items)
        {
            _primary.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeadline RemovePrimary(IControl item)
        {
            _primary.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeadline AddSecondary(params IControl[] items)
        {
            _secondary.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeadline RemoveSecondary(IControl item)
        {
            _secondary.Remove(item);

            return this;
        }

        /// <summary>
        /// Adds items to the metadata area.
        /// </summary>
        /// <param name="items">The items to add to the metadata area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeadline AddMetadata(params IControl[] items)
        {
            _metadata.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes an item from the metadata area.
        /// </summary>
        /// <param name="item">The item to remove from the metadata area.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeadline RemoveMetadata(IControl item)
        {
            _metadata.Remove(item);

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
            var prologue = Prologue.Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionHeadlinePrologue>
            (
                renderContext?.PageContext
            ));

            var preferences = Preferences.Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionHeadlinePreferences>
            (
                renderContext?.PageContext
            ));

            var primary = Primary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionHeadlinePrimary>
            (
                renderContext?.PageContext
            ));

            var secondary = Secondary.Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionHeadlineSecondary>
            (
                renderContext?.PageContext
            ));

            var metadata = Metadata.Union(WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionHeadlineMetadata>
            (
                renderContext?.PageContext
            ));

            return new HtmlElementSectionHeader
            (
                new ControlPanelFlex
                (
                    null,
                    prologue.Any() ? new ControlPanelFlex(null, [.. prologue])
                    {
                        Layout = TypeLayoutFlex.Default,
                        Align = TypeAlignFlex.Center,
                        Justify = TypeJustifiedFlex.Start
                    } : null,
                    new ControlText()
                    {
                        Text = I18N.Translate
                        (
                            renderContext,
                            renderContext.PageContext?.PageTitle
                        ),
                        Format = TypeFormatText.H2,
                        Margin = new PropertySpacingMargin(PropertySpacing.Space.None, PropertySpacing.Space.Two, PropertySpacing.Space.None, PropertySpacing.Space.Null)
                    },
                    preferences.Any() ? new ControlPanelFlex(null, [.. preferences])
                    {
                        Layout = TypeLayoutFlex.Default,
                        Align = TypeAlignFlex.Center,
                        Justify = TypeJustifiedFlex.Start
                    } : null,
                    primary.Any() ? new ControlPanelFlex(null, [.. primary])
                    {
                        Layout = TypeLayoutFlex.Default,
                        Align = TypeAlignFlex.Center,
                        Justify = TypeJustifiedFlex.Start
                    } : null,
                    secondary.Any() ? new ControlPanelFlex(null, [.. secondary])
                    {
                        Layout = TypeLayoutFlex.Default,
                        Align = TypeAlignFlex.Center,
                        Justify = TypeJustifiedFlex.End
                    } : null,
                    More
                )
                {
                    Layout = TypeLayoutFlex.Default,
                    Align = TypeAlignFlex.Center,
                    Justify = TypeJustifiedFlex.Between
                }.Render(renderContext, visualTree),
                metadata.Any() ? new HtmlElementTextContentDiv
                (
                    [.. metadata.Select(x => x.Render(renderContext, visualTree))]
                )
                {
                    Class = Css.Concatenate("ms-2 me-2 mb-3 text-secondary"),
                    Style = Style.Concatenate("font-size:0.75rem;")
                } : null
            )
            {
                Id = Id,
                Class = Css.Concatenate("", GetClasses()),
                Style = Style.Concatenate("display: block;", GetStyles()),
                Role = Role
            };
        }
    }
}
