using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control that renders a single-select combo in a table using a
    /// template. It is the single-choice sibling of
    /// <see cref="ControlTableTemplateRestSelection"/>: the options are loaded from
    /// a REST endpoint, the read-only cell shows the chosen value and the editable
    /// cell offers a service-backed picker.
    /// </summary>
    public class ControlTableTemplateRestCombo : IControlTableTemplateEditable, IDataIsland
    {
        /// <summary>
        /// Gets or sets the unique identifier for the object.
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the current template is editable or read-only.
        /// </summary>
        public Func<IRenderControlContext, bool> Editable { get; set; }

        /// <summary>
        /// Gets or sets the placeholder text displayed when no value is chosen.
        /// </summary>
        public Func<IRenderControlContext, string> Placeholder { get; set; }

        /// <summary>
        /// Gets the data service descriptors of the control. A template is a
        /// description rather than a live host, so the declared data service
        /// resolves into the template's endpoint parameter; the table builds a
        /// client side wx-service island when it materializes the cells.
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
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The id of the control.</param>
        public ControlTableTemplateRestCombo(string id = null)
        {
            Id = id;
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public virtual IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var placeholder = Placeholder?.Invoke(renderContext);
            var editable = Editable?.Invoke(renderContext) ?? false;

            // the template is inert, so the declared service travels as the
            // endpoint parameter of the template description
            var endpoint = ServiceFactory?.Invoke(renderContext)?.BaseUri;

            return new HtmlElement("template")
            {
                Id = Id
            }
                .AddUserAttribute("data-type", "rest_combo")
                .AddUserAttribute("data-placeholder", I18N.Translate(renderContext, placeholder))
                .AddUserAttribute("data-editable", editable ? "true" : null)
                .AddUserAttribute("data-uri", endpoint);
        }
    }
}
