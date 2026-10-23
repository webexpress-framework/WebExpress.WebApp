using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a form that retrieves and displays data wizard from 
    /// a RESTful resource specified by a URI.
    /// </summary>
    public class ControlDataWizard : ControlPanel, IControlDataWizard, IDataIsland
    {
        private readonly List<IControlDataWizardPage> _pages = [];

        /// <summary>
        /// Gets the collection of wizard pages associated with the control.
        /// </summary>
        public IEnumerable<IControlDataWizardPage> Pages => _pages;

        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements. The data service backs the step and
        /// submit requests of the wizard.
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
        public Func<IRenderControlContext, TypeRestFormMode> Mode { get; set; } = _ => TypeRestFormMode.Default;

        /// <summary>
        /// Gets or sets the http method the final submit of the wizard uses, emitted as
        /// the data-method attribute. It must be emitted even though it is derivable,
        /// because a form element carries no method attribute here and therefore reports
        /// the html default of GET to the client, which would turn the submit into a query.
        /// </summary>
        public Func<IRenderControlContext, RequestMethod> Method { get; set; }

        /// <summary>
        /// Gets a delegate that returns the unique identifier for an item within
        /// the specified render control context.
        /// </summary>
        public Func<IRenderControlContext, string> ItemId { get; set; }

        /// <summary>
        /// Gets or sets the label of the button that leaves the wizard on its last step.
        /// Defaults to the generic "finish" of the framework.
        /// </summary>
        public Func<IRenderControlContext, string> FinishLabel { get; set; }

        /// <summary>
        /// Gets or sets the icon of the button that leaves the wizard on its last step.
        /// </summary>
        public Func<IRenderControlContext, IIcon> FinishIcon { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataWizard(string id = null)
            : base(id ?? RandomId.Create())
        {
        }

        /// <summary>
        /// Adds one or more pages to the wizard control.
        /// </summary>
        /// <param name="pages">The pages to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlDataWizard Add(params IControlDataWizardPage[] pages)
        {
            _pages.AddRange(pages);

            return this;
        }

        /// <summary>
        /// Adds one or more pages to the wizard control.
        /// </summary>
        /// <param name="pages">The pages to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlDataWizard Add(IEnumerable<IControlDataWizardPage> pages)
        {
            _pages.AddRange(pages);

            return this;
        }

        /// <summary>
        /// Removes the specified page from the wizard control.
        /// </summary>
        /// <param name="page">The page to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlDataWizard Remove(IControlDataWizardPage page)
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
        public virtual IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree, IEnumerable<IControlDataWizardPage> pages)
        {
            var mode = Mode?.Invoke(renderContext) ?? TypeRestFormMode.Default;
            var itemId = ItemId?.Invoke(renderContext);
            var method = Method?.Invoke(renderContext) ?? GetDefaultMethod(mode, itemId);
            var methodName = method != RequestMethod.NONE ? method.ToString() : null;
            var role = Role?.Invoke(renderContext);

            // generate html. The method is carried twice on purpose: the controller reads
            // data-method but strips it from the dom once it has initialized, so only the
            // method attribute survives to tell a later initialization of the same element
            // what the submit is.
            var html = new HtmlElementFormForm()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-restwizard", GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = role,
                Method = methodName
            }
                .AddUserAttribute("data-method", methodName)
                .AddUserAttribute("data-mode", mode.ToMode())
                .AddUserAttribute("data-id", itemId?.ToString())
                .AddUserAttribute("data-finish-label", I18N.Translate(renderContext, FinishLabel?.Invoke(renderContext)))
                .AddUserAttribute("data-finish-icon", (FinishIcon?.Invoke(renderContext) as Icon)?.Class)
                .Add(pages.Select(x => x.Render(renderContext, visualTree)))
                .EmitDataIslands(this, renderContext);

            return html;
        }

        /// <summary>
        /// Determines the http method the submit falls back to when none is declared.
        /// The derivation mirrors the client, which treats a wizard as an edit as soon
        /// as an item id is present, so that the emitted method and the mode the client
        /// infers never disagree.
        /// </summary>
        /// <param name="mode">The mode the wizard is rendered in.</param>
        /// <param name="itemId">The identifier of the record the wizard works on, if any.</param>
        /// <returns>The http method of the final submit.</returns>
        private static RequestMethod GetDefaultMethod(TypeRestFormMode mode, string itemId)
        {
            return mode switch
            {
                TypeRestFormMode.Add or TypeRestFormMode.Clone => RequestMethod.POST,
                TypeRestFormMode.Edit => RequestMethod.PUT,
                TypeRestFormMode.Delete => RequestMethod.DELETE,
                _ => string.IsNullOrWhiteSpace(itemId) ? RequestMethod.POST : RequestMethod.PUT
            };
        }
    }
}