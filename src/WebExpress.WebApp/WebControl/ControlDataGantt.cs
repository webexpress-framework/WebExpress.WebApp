using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a REST-backed interactive gantt chart control. The server
    /// authors the endpoint through the wx-service island and optionally seeds
    /// the project and the view configuration through the wx-state island; the
    /// client renders the timeline, persists task and link mutations REST-fully
    /// and raises the mutation events.
    /// </summary>
    public class ControlDataGantt : ControlPanel, IControlDataGantt, IDataIsland, IViewStateBound
    {
        /// <summary>
        /// Gets or sets the name of the enclosing ViewState resource the gantt
        /// renders. When set, the control is a pure view of a central resource
        /// the ViewState owns; when null, it owns its state and service
        /// islands and loads itself.
        /// </summary>
        public Func<IRenderControlContext, string> ResourceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional ViewState id the control binds to. When null, it
        /// resolves the nearest enclosing ViewState by ancestry.
        /// </summary>
        public Func<IRenderControlContext, string> ViewState { get; set; }

        /// <summary>
        /// Gets or sets the initial timeline scale: day, week or month. The
        /// default is the day scale.
        /// </summary>
        public Func<IRenderControlContext, string> Scale { get; set; }

        /// <summary>
        /// Gets or sets the scales offered in the toolbar, as a comma separated
        /// subset of day, week and month. When null, all three are offered.
        /// </summary>
        public Func<IRenderControlContext, string> Scales { get; set; }

        /// <summary>
        /// Gets or sets the grid columns offered to the user, as a comma
        /// separated subset of name, start, end, duration, progress and
        /// resources. When null, all columns are shown; the name column is
        /// always present.
        /// </summary>
        public Func<IRenderControlContext, string> Columns { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the plan is read-only, which
        /// disables every mutating interaction while the timeline stays fully
        /// navigable.
        /// </summary>
        public Func<IRenderControlContext, bool> ReadOnly { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the task grid pane starts
        /// collapsed, leaving the full width to the timeline. The user brings
        /// the grid back through the toolbar toggle or the splitter.
        /// </summary>
        public Func<IRenderControlContext, bool> GridCollapsed { get; set; }

        /// <summary>
        /// Gets or sets whether the control takes the height its host offers
        /// instead of bringing one of its own.
        /// </summary>
        /// <remarks>
        /// The grid and the timeline scroll in step, which needs a definite
        /// height, and a host rarely has one - hence the self-imposed default of
        /// the <c>--wx-gantt-height</c> custom property. That is the right shape
        /// for a plan shown among other blocks on a page. Where the chart *is*
        /// the view, it is the wrong one: a chart with a height of its own inside
        /// an application-shell pane either leaves dead space below it or reaches
        /// past the pane, which then scrolls around panes that already scroll.
        ///
        /// A host that is a flex column - which the WebApp content panel becomes
        /// on its own for a filling control - drives the height. A host that hands
        /// nothing down falls back to the self-imposed height, never to the
        /// content: the scrollports only exist while the chart is bounded.
        /// </remarks>
        public Func<IRenderControlContext, bool> Fill { get; set; } = _ => false;

        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements. The data service loads the project with
        /// GET and persists task and link mutations against the same base:
        /// POST /tasks, PUT /tasks/{id}, DELETE /tasks/{id}, POST /links and
        /// DELETE /links/{id}.
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
        public ControlDataGantt(string id = null)
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
            var scale = Scale?.Invoke(renderContext);
            var scales = Scales?.Invoke(renderContext);
            var columns = Columns?.Invoke(renderContext);
            var readOnly = ReadOnly?.Invoke(renderContext) ?? false;
            var gridCollapsed = GridCollapsed?.Invoke(renderContext) ?? false;
            var fill = Fill?.Invoke(renderContext) ?? false;

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-gantt", fill ? "wx-fill" : null, GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .AddUserAttribute("data-scale", scale)
                .AddUserAttribute("data-scales", scales)
                .AddUserAttribute("data-columns", columns)
                .AddUserAttribute("data-readonly", readOnly ? "true" : null)
                .AddUserAttribute("data-grid-collapsed", gridCollapsed ? "true" : null)
                .EmitDataIslands(this, renderContext);

            return html;
        }
    }
}
