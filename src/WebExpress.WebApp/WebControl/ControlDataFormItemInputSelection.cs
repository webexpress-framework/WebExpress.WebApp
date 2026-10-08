using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebApiControl
{
    /// <summary>
    /// Represents a form item input selection that retrieves options from a specified URI.
    /// </summary>
    public class ControlDataFormItemInputSelection : ControlFormItemInputSelection, IControlData, IDataIsland
    {
        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements. The data service queries the options.
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
        /// Gets or sets the binding.
        /// </summary>
        public new Func<IRenderControlContext, IBinding> Bind { get; set; }

        /// <summary>
        /// Gets or sets the maximum number of entries to display (default 25).
        /// </summary>
        public Func<IRenderControlContext, int> MaxItems { get; set; } = _ => -1;

        /// <summary>
        /// Initializes a new instance of the class with an automatically assigned ID.
        /// </summary>
        public ControlDataFormItemInputSelection()
            : this(DeterministicId.Create())
        {
        }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        /// <param name="items">The entries.</param>
        public ControlDataFormItemInputSelection(string id, params ControlFormItemInputSelectionItem[] items)
            : base(id, items)
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlFormContext renderContext, IVisualTreeControl visualTree)
        {
            var maxItems = MaxItems?.Invoke(renderContext) ?? -1;
            var bind = Bind?.Invoke(renderContext);

            var html = base.Render(renderContext, visualTree)
                .AddClass("wx-webapp-input-selection")
                .RemoveClass("wx-webui-input-selection")
                .EmitDataIslands(this, renderContext)
                .AddUserAttribute("data-maxItems", maxItems > 0 ? maxItems.ToString() : null);

            bind?.ApplyUserAttributes(html);

            return html;
        }
    }
}
