using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Test implementation for RestApiTab.
    /// </summary>
    [Title("my title")]
    public sealed class TestRestApiTab : RestApiTab<TestIndexItem>
    {
        private readonly IEnumerable<RestApiTabView> _views;

        /// <summary>
        /// Gets the last template id received in create requests.
        /// </summary>
        public string LastCreateTemplateId { get; private set; }

        /// <summary>
        /// Gets the tab id and label of the last accepted rename, or null.
        /// </summary>
        public (string Id, string Label)? LastRename { get; private set; }

        /// <summary>
        /// Gets the tab id and color of the last accepted color change, or null.
        /// </summary>
        public (string Id, string Color)? LastRecolor { get; private set; }

        /// <summary>
        /// Gets the tab order of the last reorder, or null.
        /// </summary>
        public IReadOnlyList<string> LastOrder { get; private set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="views">The views returned for GET requests.</param>
        public TestRestApiTab(IEnumerable<RestApiTabView> views = null)
        {
            _views = views ?? [];
        }

        /// <summary>
        /// Retrieves tab views.
        /// </summary>
        protected override IEnumerable<RestApiTabView> RetrieveViews(IQueryContext context, IRequest request)
        {
            return _views;
        }

        /// <summary>
        /// Creates a new tab view for POST requests.
        /// </summary>
        protected override IRestApiTabView CreateView(IQueryContext context, IRequest request)
        {
            return new RestApiTabView
            {
                Id = "new-tab",
                Title = "New Tab",
                Name = "Created Tab",
                Icon = "wx-icon-light wx-icon-light-star",
                TemplateId = "defaultTemplate",
                Badge = "1",
                Binding = new
                {
                    title = "Created Tab",
                    name = "Created Tab"
                }
            };
        }

        /// <summary>
        /// Creates a new tab view and remembers the requested template id.
        /// </summary>
        protected override IRestApiTabView CreateView(IQueryContext context, IRequest request, string templateId)
        {
            LastCreateTemplateId = templateId;

            return base.CreateView(context, request, templateId);
        }

        /// <summary>
        /// Remembers the reorder and accepts it.
        /// </summary>
        protected override bool ReorderViews(IReadOnlyList<string> order, IQueryContext context, IRequest request)
        {
            LastOrder = order;

            return true;
        }

        /// <summary>
        /// Remembers the color change and accepts it for known views only.
        /// </summary>
        protected override bool RecolorView(string viewId, string color, IQueryContext context, IRequest request)
        {
            if (!_views.Any(v => v.Id == viewId))
            {
                return false;
            }

            LastRecolor = (viewId, color);

            return true;
        }

        /// <summary>
        /// Remembers the rename and accepts it for known views only.
        /// </summary>
        protected override bool RenameView(string viewId, string label, IQueryContext context, IRequest request)
        {
            if (!_views.Any(v => v.Id == viewId))
            {
                return false;
            }

            LastRename = (viewId, label);

            return true;
        }
    }
}
