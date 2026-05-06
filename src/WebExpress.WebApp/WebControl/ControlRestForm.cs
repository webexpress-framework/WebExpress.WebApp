using System;
using System.Linq;
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
    public class ControlRestForm : ControlForm
    {
        /// <summary>
        /// Gets or sets the mode that determines how the form behaves 
        /// or is rendered.
        /// </summary>
        public Func<IRenderControlFormContext, TypeRestFormMode> Mode { get; set; } = _ => TypeRestFormMode.Default;

        /// <summary>
        /// Gets or sets the function used to retrieve the item identifier for a given render 
        /// control form context.
        /// </summary>
        public Func<IRenderControlFormContext, string> ItemId { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestForm(string id = null)
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
        public override IHtmlNode Render(IRenderControlFormContext renderContext, IVisualTreeControl visualTree)
        {
            var uri = Uri?.Invoke(renderContext);
            var mode = Mode?.Invoke(renderContext);
            var itemLayout = ItemLayout?.Invoke(renderContext) ?? TypeLayoutFormItem.Vertical;
            var formLayout = FormLayout?.Invoke(renderContext) ?? TypeLayoutForm.Default;
            var id = ItemId?.Invoke(renderContext);
            var method = Method?.Invoke(renderContext) ?? RequestMethod.NONE;
            var role = Role?.Invoke(renderContext);

            var resultUri = uri?.BindParameters(renderContext.Request);

            // generate html
            var form = new HtmlElementFormForm()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-restform", GetClasses()),
                Style = GetStyles(),
                Role = role
            }
                .AddUserAttribute("data-method", method.ToString())
                .AddUserAttribute("data-mode", mode?.ToMode())
                .AddUserAttribute("data-id", id?.ToString())
                .AddUserAttribute("data-uri", resultUri?.ToString());

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

            foreach (var item in Items.Where(x => x is ControlFormItemInputHidden))
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

            foreach (var item in Items.Where(x => x is not ControlFormItemInputHidden))
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