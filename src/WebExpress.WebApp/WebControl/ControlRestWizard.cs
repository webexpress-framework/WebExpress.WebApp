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
    /// Represents a form that retrieves and displays data wizard from 
    /// a RESTful resource specified by a URI.
    /// </summary>
    public class ControlRestWizard : ControlPanel, IControlRestWizard
    {
        private readonly List<IControlRestWizardPage> _pages = [];

        /// <summary>
        /// Gets the collection of wizard pages associated with the control.
        /// </summary>
        public IEnumerable<IControlRestWizardPage> Pages => _pages;

        /// <summary>
        /// Gets or sets the uri that determines the data.
        /// </summary>
        public Func<IRenderControlContext, IUri> RestUri { get; set; }

        /// <summary>
        /// Gets or sets the mode that determines how the form behaves 
        /// or is rendered.
        /// </summary>
        public Func<IRenderControlContext, TypeRestFormMode> Mode { get; set; } = _ => TypeRestFormMode.Default;

        /// <summary>
        /// Gets a delegate that returns the unique identifier for an item within 
        /// the specified render control context.
        /// </summary>
        public Func<IRenderControlContext, string> ItemId { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestWizard(string id = null)
            : base(id ?? RandomId.Create())
        {
        }

        /// <summary>
        /// Adds one or more pages to the wizard control.
        /// </summary>
        /// <param name="pages">The pages to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlRestWizard Add(params IControlRestWizardPage[] pages)
        {
            _pages.AddRange(pages);

            return this;
        }

        /// <summary>
        /// Adds one or more pages to the wizard control.
        /// </summary>
        /// <param name="pages">The pages to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlRestWizard Add(IEnumerable<IControlRestWizardPage> pages)
        {
            _pages.AddRange(pages);

            return this;
        }

        /// <summary>
        /// Removes the specified page from the wizard control.
        /// </summary>
        /// <param name="page">The page to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlRestWizard Remove(IControlRestWizardPage page)
        {
            _pages.Remove(page);

            return this;
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            return Render(renderContext, visualTree, _pages);
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <param name="pages">The pages to render.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public virtual IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree, IEnumerable<IControlRestWizardPage> pages)
        {
            var uri = RestUri?.Invoke(renderContext);
            var resultUri = uri?.BindParameters(renderContext.Request);
            var mode = Mode?.Invoke(renderContext) ?? TypeRestFormMode.Default;
            var itemId = ItemId?.Invoke(renderContext);
            var role = Role?.Invoke(renderContext);

            // generate html
            var html = new HtmlElementFormForm()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-restwizard", GetClasses()),
                Style = GetStyles(),
                Role = role
            }
                .AddUserAttribute("data-mode", mode.ToMode())
                .AddUserAttribute("data-id", itemId?.ToString())
                .AddUserAttribute("data-uri", resultUri?.ToString())
                .Add(_pages.Select(x => x.Render(renderContext, visualTree)));

            return html;
        }
    }
}