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
    /// Represents a control that renders a disjunctive normal form in a table using
    /// a template whose terms are queried from an endpoint.
    /// </summary>
    /// <remarks>
    /// A term set that is shared across the rows of a table, or too large to embed,
    /// belongs behind an endpoint rather than in every cell. The static
    /// <see cref="ControlTableTemplateDnf"/> carries its terms with the table and is
    /// the better choice for a short, table specific list.
    /// </remarks>
    public class ControlTableTemplateRestDnf : IControlTableTemplateEditable, IDataIsland
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
        /// Gets or sets the placeholder text displayed in a conjunction that holds no term yet.
        /// </summary>
        public Func<IRenderControlContext, string> Placeholder { get; set; }

        /// <summary>
        /// Gets or sets the maximum number of conjunctions, or a value of zero or
        /// less for an unlimited number.
        /// </summary>
        public Func<IRenderControlContext, int> MaxGroups { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the read state clips the
        /// expression to a single line. Enabled unless told otherwise, because a
        /// wrapping expression makes the row heights of a table depend on the
        /// complexity of one cell.
        /// </summary>
        public Func<IRenderControlContext, bool> Compact { get; set; }

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
        public ControlTableTemplateRestDnf(string id = null)
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
            var maxGroups = MaxGroups?.Invoke(renderContext) ?? -1;
            var compact = Compact?.Invoke(renderContext) ?? true;

            // the template is inert, so the declared service travels as the
            // endpoint parameter of the template description
            var endpoint = ServiceFactory?.Invoke(renderContext)?.BaseUri;

            var html = new HtmlElement("template")
            {
                Id = Id
            }
                .AddUserAttribute("data-type", "rest_dnf")
                .AddUserAttribute("data-placeholder", I18N.Translate(renderContext, placeholder))
                .AddUserAttribute("data-editable", editable ? "true" : null)
                .AddUserAttribute("data-max-groups", maxGroups > 0 ? maxGroups.ToString() : null)
                .AddUserAttribute("data-compact", compact ? null : "false")
                .AddUserAttribute("data-uri", endpoint);

            return html;
        }
    }
}
