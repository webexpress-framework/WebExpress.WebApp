using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebFragment;
using WebExpress.WebUI.WebPage;
using WebExpress.WebUI.WebSection;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a form that retrieves and displays data from 
    /// a RESTful resource specified by a URI.
    /// </summary>
    public class ControlDataForm : ControlForm, IDataIsland
    {
        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements. The data service backs the load and the
        /// submit of the form.
        /// </summary>
        public IList<Func<IRenderControlContext, DataServiceDescriptor>> ServiceFactories { get; } = [];

        /// <summary>
        /// Gets or sets the single data service descriptor, as a convenience for
        /// the common control with exactly one service. Reading returns the
        /// first declared service, assigning replaces all declared services.
        /// </summary>
        public Func<IRenderControlContext, DataServiceDescriptor> ServiceFactory
        {
            get => ServiceFactories.Count > 0 ? ServiceFactories[0] : null;
            set
            {
                ServiceFactories.Clear();

                if (value != null)
                {
                    ServiceFactories.Add(value);
                }
            }
        }

        /// <summary>
        /// Gets or sets the optional template reference, emitted as the
        /// data-wx-template attribute.
        /// </summary>
        public Func<IRenderControlContext, string> TemplateFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional initial state, emitted as the wx-state island.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Gets or sets the mode that determines how the form behaves
        /// or is rendered.
        /// </summary>
        public virtual Func<IRenderControlFormContext, string> Mode { get; set; }

        /// <summary>
        /// Gets or sets the function used to retrieve the item identifier for a given render 
        /// control form context.
        /// </summary>
        public Func<IRenderControlFormContext, string> ItemId { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataForm(string id = null)
            : base(id ?? RandomId.Create())
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var renderFormContext = new RenderControlFormContext(renderContext, this);

            return Render(renderFormContext, visualTree);
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlFormContext renderContext, IVisualTreeControl visualTree, IEnumerable<IControlFormItem> items)
        {
            var mode = Mode?.Invoke(renderContext);
            var itemLayout = ItemLayout?.Invoke(renderContext) ?? TypeLayoutFormItem.Vertical;
            var formLayout = FormLayout?.Invoke(renderContext) ?? TypeLayoutForm.Default;
            var id = ItemId?.Invoke(renderContext);
            var method = Method?.Invoke(renderContext) ?? RequestMethod.NONE;
            var role = Role?.Invoke(renderContext);

            // generate html
            var form = new HtmlElementFormForm()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-restform", GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = role
            }
                .AddUserAttribute("data-method", method.ToString())
                .AddUserAttribute("data-mode", mode)
                .AddUserAttribute("data-id", id?.ToString());

            form.EmitDataIslands(this, renderContext);

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
                form.Add(item.Render(renderContext, visualTree));
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

            main.Add(group.Render(renderContext, visualTree));

            var buttonPannel = new HtmlElementTextContentDiv()
            {
                Class = formLayout == TypeLayoutForm.Inline ? "ms-2" : ""
            };
            buttonPannel.Add(Buttons.Select(x => x?.Render(renderContext, visualTree)));

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
                form.Add(header);
            }

            form.Add(main);
            form.Add(buttonPannel);

            if (footerPreferences.Any() || footerPrimary.Any() || footerSecondary.Any())
            {
                form.Add(footer);
            }

            return form;
        }
    }
}