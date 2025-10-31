using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control panel for API table interactions.
    /// </summary>
    public class ControlRestTable : ControlPanel, IControlRestTable
    {
        private readonly List<IControlForm> _forms = [];
        private readonly List<ControlRestTableOptionItem> _optionItems = [];

        /// <summary>
        /// Returns or sets the uri that determines the data.
        /// </summary>
        public IUri RestUri { get; set; }

        /// <summary>
        /// Returns the collection of forms associated with the control.
        /// </summary>
        public IEnumerable<IControlForm> Forms => _forms;

        /// <summary>
        /// Returns the editing options (e.g. Edit, Delete, ...).
        /// </summary>
        public IEnumerable<ControlRestTableOptionItem> OptionItems => _optionItems;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestTable(string id = null)
            : base(id ?? Guid.NewGuid().ToString())
        {
        }

        /// <summary>
        /// Adds a collection of forms to the current control rest table.
        /// </summary>
        /// <param name="forms">The collection of forms to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlRestTable Add(params IControlForm[] forms)
        {
            _forms.AddRange(forms);

            return this;
        }

        /// <summary>
        /// Adds a collection of forms to the current control rest table.
        /// </summary>
        /// <param name="forms">The collection of forms to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlRestTable Add(IEnumerable<IControlForm> forms)
        {
            _forms.AddRange(forms);

            return this;
        }

        /// <summary>
        /// Removes the specified form from the collection of forms.
        /// </summary>
        /// <param name="form">The form to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlRestTable Remove(IControlForm form)
        {
            if (form == null)
            {
                return this;
            }

            _forms.Remove(form);

            return this;
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-table", GetClasses()),
                Style = GetStyles()
            }
            .AddUserAttribute("data-uri", RestUri?.ToString());

            return new HtmlList(html, Forms.Select(x => x.Render(renderContext, visualTree)));
        }
    }
}
