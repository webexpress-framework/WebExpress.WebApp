using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
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
    public class ControlDataWizardPage : IControlDataWizardPage
    {
        private readonly List<IControlFormItem> _items = [];

        /// <summary>
        /// Gets or sets the id.
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the title of the step, shown in the progress indicator.
        /// </summary>
        public Func<IRenderControlContext, string> Title { get; set; }

        /// <summary>
        /// Gets or sets the secondary text of the step, shown below its title. It states
        /// what the step asks for while the step is still open.
        /// </summary>
        public Func<IRenderControlContext, string> Subtitle { get; set; }

        /// <summary>
        /// Gets or sets the name of the input whose selected label replaces the subtitle
        /// once the step has been answered, so the progress indicator reads back what was
        /// chosen rather than what was asked.
        /// </summary>
        public Func<IRenderControlContext, string> SummarySource { get; set; }

        /// <summary>
        /// Gets or sets the uri the step is loaded from. A step with a uri is fetched
        /// with the current form payload when it is reached; a step answering
        /// <c>204 No Content</c> is skipped. Leave it unset for a step rendered upfront.
        /// </summary>
        public Func<IRenderControlContext, IUri> Uri { get; set; }


        /// <summary>
        /// Gets or sets the form layout.
        /// </summary>
        public Func<IRenderControlContext, TypeLayoutForm> FormLayout { get; set; } = _ => TypeLayoutForm.Default;

        /// <summary>
        /// Gets or sets the item layout.
        /// </summary>
        public Func<IRenderControlContext, TypeLayoutFormItem> ItemLayout { get; set; } = _ => TypeLayoutFormItem.Vertical;


        /// <summary>
        /// Gets the collection of form items contained in this control.
        /// </summary>
        public IEnumerable<IControlFormItem> Items => _items;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataWizardPage(string id = null)
        {
            Id = id;
        }

        /// <summary>
        /// Adds one or more items to the wizard page control.
        /// </summary>
        /// <param name="items">The items to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlDataWizardPage Add(params IControlFormItem[] items)
        {
            _items.AddRange(items);

            return this;
        }

        /// <summary>
        /// Adds one or more items to the wizard page control.
        /// </summary>
        /// <param name="items">The items to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlDataWizardPage Add(IEnumerable<IControlFormItem> items)
        {
            _items.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes the specified control from wizard page tab.
        /// </summary>
        /// <param name="item">The control to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlDataWizardPage Remove(IControlFormItem item)
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
            return Render(renderContext, visualTree, _items);
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">
        /// The context in which the control is rendered.
        /// </param>
        /// <param name="visualTree">The visual tree.</param>
        /// <param name="items">The collection of form items to render.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public virtual IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree, IEnumerable<IControlFormItem> items)
        {
            var itemLayout = ItemLayout?.Invoke(renderContext) ?? TypeLayoutFormItem.Vertical;
            var renderFormContext = new RenderControlFormContext(renderContext, null);

            // generate html. The items are not rendered here: the hidden ones are
            // emitted below as direct children so they submit regardless of layout,
            // and the visible ones through the layout group of the main section. Adding
            // them here as well would put every input into the form twice.
            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = "wx-wizard-page"
            }
                .AddUserAttribute("data-title", I18N.Translate(renderContext, Title?.Invoke(renderContext)))
                .AddUserAttribute("data-subtitle", I18N.Translate(renderContext, Subtitle?.Invoke(renderContext)))
                .AddUserAttribute("data-summary-source", SummarySource?.Invoke(renderContext))
                .AddUserAttribute("data-uri", Uri?.Invoke(renderContext)?.ToString());

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

            foreach (var item in items.Where(x => x is ControlFormItemInputHidden))
            {
                html.Add(item.Render(renderFormContext, visualTree));
            }

            var main = new HtmlElementSectionMain();
            var group = default(ControlFormItemGroup);

            group = itemLayout switch
            {
                TypeLayoutFormItem.Horizontal => new ControlFormItemGroupHorizontal(),
                TypeLayoutFormItem.Mix => new ControlFormItemGroupMix(),
                _ => new ControlFormItemGroupVertical(),
            };

            foreach (var item in items.Where(x => x is not ControlFormItemInputHidden))
            {
                group.Items.Add(item);
            }

            // a form item renders to nothing unless it is handed a form context, so the
            // group of the main section is rendered with the same context as the hidden
            // items above rather than with the plain control context. A page without
            // visible items — a step whose content is loaded from its uri — contributes no
            // group at all rather than an empty wrapper.
            if (group.Items.Count > 0)
            {
                main.Add(group.Render(renderFormContext, visualTree));
            }

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