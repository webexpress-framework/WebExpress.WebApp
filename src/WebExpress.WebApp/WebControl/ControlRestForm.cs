using System.Collections.Generic;
using System.Linq;
using WebExpress.WebCore;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
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
        /// Returns or sets the mode that determines how the form behaves 
        /// or is rendered.
        /// </summary>
        public TypeRestFormMode Mode { get; set; } = TypeRestFormMode.Default;

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

            return Render(renderFormContext, visualTree, Items, null);
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <param name="items">The form items.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree, IEnumerable<IControlFormItem> items)
        {
            var renderFormContext = new RenderControlFormContext(renderContext, this);

            return Render(renderFormContext, visualTree, items, null);
        }

        /// <summary>
        /// Convert to html.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <param name="items">The form items.</param>
        /// <returns>The control as html.</returns>
        public override IHtmlNode Render(IRenderControlFormContext renderContext, IVisualTreeControl visualTree, IEnumerable<IControlFormItem> items)
        {
            return Render(renderContext, visualTree, items, null);
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <param name="items">The form items.</param>
        /// <param name="id">The unique identifier for the item.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public virtual IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree, IEnumerable<IControlFormItem> items, string id)
        {
            var renderFormContext = new RenderControlFormContext(renderContext, this);

            return Render(renderFormContext, visualTree, items, id, Uri);
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <param name="items">The form items.</param>
        /// <param name="id">The unique identifier for the item.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public virtual IHtmlNode Render(IRenderControlFormContext renderContext, IVisualTreeControl visualTree, IEnumerable<IControlFormItem> items, string id, IUri uri)
        {
            var resultUri = uri?.BindParameters(renderContext.Request);

            // generate html
            var form = new HtmlElementFormForm()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-restform", GetClasses()),
                Style = GetStyles(),
                Role = Role
            }
                .AddUserAttribute("data-method", Method.ToString())
                .AddUserAttribute("data-mode", Mode.ToMode())
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

            foreach (var item in items.Where(x => x is ControlFormItemInputHidden))
            {
                form.Add(item.Render(renderContext, visualTree));
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

            var buttonPannel = new HtmlElementTextContentDiv()
            {
                Class = FormLayout == TypeLayoutForm.Inline ? "ms-2" : ""
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