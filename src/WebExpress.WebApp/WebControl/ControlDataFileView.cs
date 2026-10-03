using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Presents one set of files in several interchangeable views: the tabular
    /// file list and the tile board are built in, further views are added by the
    /// author. The files come from a REST endpoint, so a set that changes on the
    /// server - a new upload, a renamed document - reaches the page without a
    /// reload.
    /// </summary>
    /// <remarks>
    /// The control is the data bound counterpart of <see cref="ControlView"/>:
    /// the switcher and the pane handling are the same idea, but the panes here
    /// render one shared, service-owned set of files rather than unrelated
    /// content. The list pane is a real <see cref="ControlFileList"/>, so a file
    /// looks and behaves the same whether it is shown by this control or by the
    /// list on its own.
    /// </remarks>
    public class ControlDataFileView : Control, IControlDataFileView, IDataIsland, IViewStateBound
    {
        private readonly List<IControlFileListItem> _files = [];
        private readonly List<IControlViewItem> _views = [];

        /// <summary>
        /// Returns the files the control shows before the first response arrives,
        /// and the whole content of the control when no service is declared.
        /// </summary>
        public IEnumerable<IControlFileListItem> Files => _files;

        /// <summary>
        /// Returns the additional, author-provided views the switcher offers next
        /// to the built-in ones.
        /// </summary>
        public IEnumerable<IControlViewItem> Views => _views;

        /// <summary>
        /// Gets or sets the built-in views the switcher offers, in the order they
        /// are switched through. The first one is shown until the user picks
        /// another.
        /// </summary>
        public Func<IRenderControlContext, IEnumerable<TypeFileView>> Presentations { get; set; }
            = _ => [TypeFileView.List, TypeFileView.Tile];

        /// <summary>
        /// Gets or sets the layout of the view switcher.
        /// </summary>
        public Func<IRenderControlContext, TypeLayoutView> Layout { get; set; }
            = _ => TypeLayoutView.ToggleGroup;

        /// <summary>
        /// Gets or sets a value indicating whether the description of a file can
        /// be changed in place, without leaving the view.
        /// </summary>
        /// <remarks>
        /// The edit is offered by the smart edit control and persisted through the
        /// update operation of the data service, so the control needs a service
        /// that accepts an update before the flag has an effect on the server.
        /// </remarks>
        public Func<IRenderControlContext, bool> EditableDescription { get; set; } = _ => false;

        /// <summary>
        /// Gets or sets the number of files requested per page.
        /// </summary>
        public Func<IRenderControlContext, uint> PageSize { get; set; }

        /// <summary>
        /// Gets or sets the binding, which is where an upload control is tied to
        /// the view so a finished upload shows up without a reload.
        /// </summary>
        public Func<IRenderControlContext, IBinding> Bind { get; set; }

        /// <summary>
        /// Gets or sets the name of the enclosing ViewState resource the control
        /// renders. When set, the control is a pure view of a central resource the
        /// ViewState owns; when null, it owns its state and service islands and
        /// loads itself.
        /// </summary>
        public Func<IRenderControlContext, string> ResourceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional ViewState id the control binds to. When null,
        /// it resolves the nearest enclosing ViewState by ancestry.
        /// </summary>
        public Func<IRenderControlContext, string> ViewState { get; set; }

        /// <summary>
        /// Gets the data service descriptors of the control, emitted together as
        /// the data-wx-service island that the JavaScript engine consumes, which
        /// keeps the endpoint and parameter knowledge authored in C#.
        /// </summary>
        public IList<Func<IRenderControlContext, DataServiceDescriptor>> ServiceFactories { get; } = [];

        /// <summary>
        /// Gets or sets the single data service descriptor, as a convenience for
        /// the common control with exactly one service. Reading returns the first
        /// declared service, assigning replaces all declared services.
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
        /// data-wx-template attribute that the client Templates registry resolves
        /// into a registered view.
        /// </summary>
        public Func<IRenderControlContext, string> TemplateFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional initial state, emitted as the data-wx-state
        /// island.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        /// <param name="items">The files to initialize the control with.</param>
        public ControlDataFileView(string id = null, params IControlFileListItem[] items)
            : base(id ?? RandomId.Create())
        {
            _files.AddRange(items);
        }

        /// <summary>
        /// Adds one or more files to the control.
        /// </summary>
        /// <param name="items">The files to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlDataFileView Add(params IControlFileListItem[] items)
        {
            _files.AddRange(items);

            return this;
        }

        /// <summary>
        /// Adds one or more files to the control.
        /// </summary>
        /// <param name="items">The files to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlDataFileView Add(IEnumerable<IControlFileListItem> items)
        {
            _files.AddRange(items);

            return this;
        }

        /// <summary>
        /// Adds one or more additional views to the control.
        /// </summary>
        /// <param name="views">The views to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlDataFileView Add(params IControlViewItem[] views)
        {
            _views.AddRange(views);

            return this;
        }

        /// <summary>
        /// Adds one or more additional views to the control.
        /// </summary>
        /// <param name="views">The views to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlDataFileView Add(IEnumerable<IControlViewItem> views)
        {
            _views.AddRange(views);

            return this;
        }

        /// <summary>
        /// Removes the specified file from the control.
        /// </summary>
        /// <param name="item">The file to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlDataFileView Remove(IControlFileListItem item)
        {
            _files.Remove(item);

            return this;
        }

        /// <summary>
        /// Removes the specified view from the control.
        /// </summary>
        /// <param name="view">The view to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlDataFileView Remove(IControlViewItem view)
        {
            _views.Remove(view);

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
            var presentations = (Presentations?.Invoke(renderContext) ?? [TypeFileView.List])
                .Distinct()
                .ToArray();
            var layout = Layout?.Invoke(renderContext) ?? TypeLayoutView.ToggleGroup;
            var pageSize = PageSize?.Invoke(renderContext) ?? 0;
            var editable = EditableDescription?.Invoke(renderContext) ?? false;
            var bind = Bind?.Invoke(renderContext);

            // the list pane is the file list control itself rather than a
            // reimplementation of it, so an entry keeps the markup, the icons and
            // the styling it has everywhere else in the framework
            var list = new ControlFileList().Add(_files);

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-file-view", GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .AddUserAttribute("data-layout", layout.ToValue())
                .AddUserAttribute("data-views", string.Join(",", presentations.Select(x => x.ToValue())))
                .AddUserAttribute("data-page-size", pageSize > 0 ? pageSize.ToString() : null)
                .AddUserAttribute("data-editable-description", editable ? "true" : null)
                .Add(list.Render(renderContext, visualTree))
                .Add(_views.Select(x => x.Render(renderContext, visualTree)));

            html.EmitDataIslands(this, renderContext);

            bind?.ApplyUserAttributes(html);

            return html;
        }
    }
}
