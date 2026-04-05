using System.Collections.Generic;
using System.Linq;
using WebExpress.WebCore;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebFragment;
using WebExpress.WebUI.WebPage;
using WebExpress.WebUI.WebSection;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a form that retrieves and displays data wizard page from 
    /// a RESTful resource specified by a URI.
    /// </summary>
    public class ControlRestWizardPage : IControlRestWizardPage
    {
        private readonly List<IControlFormItem> _items = [];

        /// <summary>
        /// Returns or sets the template id.
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// Returns or sets the form layout.
        /// </summary>
        public TypeLayoutForm FormLayout { get; set; } = TypeLayoutForm.Default;

        /// <summary>
        /// Returns or sets the item layout.
        /// </summary>
        public TypeLayoutFormItem ItemLayout { get; set; } = TypeLayoutFormItem.Vertical;


        /// <summary>
        /// Returns the collection of form items contained in this control.
        /// </summary>
        public IEnumerable<IControlFormItem> Items => _items;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestWizardPage(string id = null)
        {
            Id = id;
        }

        /// <summary>
        /// Adds one or more items to the wizard page control.
        /// </summary>
        /// <param name="items">The items to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlRestWizardPage Add(params IControlFormItem[] items)
        {
            _items.AddRange(items);

            return this;
        }

        /// <summary>
        /// Adds one or more items to the wizard page control.
        /// </summary>
        /// <param name="items">The items to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlRestWizardPage Add(IEnumerable<IControlFormItem> items)
        {
            _items.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes the specified control from wizard page tab.
        /// </summary>
        /// <param name="item">The control to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlRestWizardPage Remove(IControlFormItem item)
        {
            _items.Remove(item);

            return this;
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public virtual IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var renderFormContext = new RenderControlFormContext(renderContext, null);

            // generate html
            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = "wx-wizard-page"
            }
                .Add(_items.Select(x => x.Render(renderFormContext, visualTree)));

            var header = new HtmlElementSectionHeader();

            var headerPreferences = WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionFormHeaderPreferences>
            (
                renderContext?.PageContext?.ApplicationContext,
                [GetType()]
            );
            var headerPrimary = WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionFormHeaderPrimary>
            (
                renderContext?.PageContext?.ApplicationContext,
                [GetType()]
            );
            var headerSecondary = WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionFormHeaderSecondary>
            (
                renderContext?.PageContext?.ApplicationContext,
                [GetType()]
            );
            header.Add(headerPreferences.Select(x => x.Render(renderContext, visualTree)));
            header.Add(headerPrimary.Select(x => x.Render(renderContext, visualTree)));
            header.Add(headerSecondary.Select(x => x.Render(renderContext, visualTree)));

            foreach (var item in _items.Where(x => x is ControlFormItemInputHidden))
            {
                html.Add(item.Render(renderContext, visualTree));
            }

            var main = new HtmlElementSectionMain();
            var group = default(ControlFormItemGroup);

            group = ItemLayout switch
            {
                TypeLayoutFormItem.Horizontal => new ControlFormItemGroupHorizontal(),
                TypeLayoutFormItem.Mix => new ControlFormItemGroupMix(),
                _ => new ControlFormItemGroupVertical(),
            };

            foreach (var item in Items.Where(x => x is not ControlFormItemInputHidden))
            {
                group.Items.Add(item);
            }

            main.Add(group.Render(renderContext, visualTree));

            var footer = new HtmlElementSectionFooter();
            var footerPreferences = WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionFormFooterPreferences>
            (
                renderContext?.PageContext?.ApplicationContext,
                [GetType()]
            );
            var footerPrimary = WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionFormFooterPrimary>
            (
                renderContext?.PageContext?.ApplicationContext,
                [GetType()]
            );
            var footerSecondary = WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionFormFooterSecondary>
            (
                renderContext?.PageContext?.ApplicationContext,
                [GetType()]
            );
            footer.Add(footerPreferences.Select(x => x.Render(renderContext, visualTree)));
            footer.Add(footerPrimary.Select(x => x.Render(renderContext, visualTree)));
            footer.Add(footerSecondary.Select(x => x.Render(renderContext, visualTree)));

            if (header.Elements.Any())
            {
                html.Add(header);
            }

            html.Add(main);

            if (footerPreferences.Any() || footerPrimary.Any() || footerSecondary.Any())
            {
                html.Add(footer);
            }

            return html;
        }
    }
}