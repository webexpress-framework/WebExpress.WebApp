using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control for composing and editing WQL expressions with REST-based suggestions, 
    /// syntax validation, and history navigation.
    /// </summary>
    public class ControlDataWqlPrompt : Control, IControlDataWqlPrompt, IDataIsland, IViewStateModelBound
    {
        /// <summary>
        /// Gets or sets the resolver of the ViewState resource the prompt drives.
        /// When set through Resource&lt;TResource&gt;(), a submitted WQL query is
        /// written into the shared state and re-queries this resource; when null,
        /// the prompt is standalone and coordinates through the change filter event
        /// and the BindSearch bind.
        /// </summary>
        public Func<IRenderControlContext, string> ResourceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional ViewState id the prompt binds to. When null, the
        /// prompt resolves its ViewState by the resource it drives.
        /// </summary>
        public Func<IRenderControlContext, string> ViewState { get; set; }

        /// <summary>
        /// Gets or sets the resolver of the state path the prompt writes the
        /// submitted query into, set through Model(...) and defaulting to "wql" on
        /// the client.
        /// </summary>
        public Func<IRenderControlContext, string> ModelFactory { get; set; }
        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements. The data service backs the suggestions,
        /// the analysis and the history of the prompt.
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
        /// <param name="id">The control id.</param>
        public ControlDataWqlPrompt(string id = null)
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
            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-wql-prompt", GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .EmitDataIslands(this, renderContext);

            return html;
        }
    }
}