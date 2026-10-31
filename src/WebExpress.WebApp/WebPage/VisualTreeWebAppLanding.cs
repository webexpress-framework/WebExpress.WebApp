using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebSection;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebEndpoint;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebSection;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebFragment;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebPage
{
    /// <summary>
    /// Provides an independent public website layout with scoped branding, hero, content, and footer fragments.
    /// </summary>
    public class VisualTreeWebAppLanding : VisualTreeWebApp
    {
        private readonly IComponentHub _componentHub;

        /// <summary>
        /// Gets the page-specific branding and navigation controls.
        /// </summary>
        public ControlPanel LandingHeader { get; } = new ControlPanel();

        /// <summary>
        /// Gets the introductory controls displayed before scoped hero fragments.
        /// </summary>
        public ControlPanel Hero { get; } = new ControlPanel();

        /// <summary>
        /// Gets the footer controls displayed before scoped landing footer fragments.
        /// </summary>
        public ControlPanel LandingFooter { get; } = new ControlPanel();

        /// <summary>
        /// Initializes the dedicated landing stylesheet while retaining shared framework infrastructure.
        /// </summary>
        /// <param name="componentHub">The component hub resolving scoped fragments.</param>
        /// <param name="pageContext">The registration and application context of the page.</param>
        public VisualTreeWebAppLanding(IComponentHub componentHub, IPageContext pageContext)
            : base(componentHub, pageContext)
        {
            _componentHub = componentHub;
            AddCssLink(RouteEndpoint.Combine(pageContext.ApplicationContext?.Route,
                "webexpress.webapp/assets/css/webexpress.webapp.landing.css"));
        }

        /// <summary>
        /// Marks the document for the landing layout and continuous document scrolling.
        /// </summary>
        /// <remarks>
        /// The theme, its light or dark scheme and the icon set are applied by the base tree as
        /// on every other page; the landing palette derives from them, so the public page looks
        /// like the application the visitor chose.
        /// </remarks>
        /// <param name="context">The context used to render the complete page.</param>
        /// <returns>The landing document without application navigation or splitters.</returns>
        public override IHtmlNode Render(IVisualTreeContext context)
        {
            var html = (HtmlElementRootHtml)base.Render(context);
            html.Body.AddUserAttribute("class", "wx-landing");
            return html;
        }

        /// <summary>
        /// Renders branding independently of the application's title, avatar, and navigation fragments.
        /// </summary>
        /// <param name="renderContext">The current request and page context.</param>
        /// <returns>The semantic landing header.</returns>
        protected override IHtmlNode RenderHeader(IRenderControlContext renderContext)
        {
            return new ControlHeader("wx-landing-header",
                [.. LandingHeader.Content, .. Fragments<SectionLandingHeader>(renderContext)])
            {
                Classes = ["wx-landing-site-header"]
            }.Render(renderContext, this);
        }

        /// <summary>
        /// Keeps the hero inside the main landmark instead of rendering application breadcrumbs.
        /// </summary>
        /// <param name="renderContext">The current request and page context.</param>
        /// <returns>An empty sequence because the introduction belongs to the main landmark.</returns>
        protected override IEnumerable<IHtmlNode> RenderIntroduction(IRenderControlContext renderContext)
        {
            return [];
        }

        /// <summary>
        /// Reuses the three content slots without adding the application headline, toolbar, or property panel.
        /// </summary>
        /// <param name="renderContext">The current request and page context.</param>
        /// <returns>The hero and continuous page sections in one main landmark.</returns>
        protected override IHtmlNode RenderMainContent(IRenderControlContext renderContext)
        {
            var main = new ControlMain("wx-landing-main",
                new ControlPanel("wx-landing-hero", [.. Hero.Content, .. Fragments<SectionLandingHero>(renderContext)])
                {
                    Classes = ["wx-landing-hero"]
                },
                new ControlPanel("wx-landing-content",
                    [.. Content.MainPanel.Preferences, .. Fragments<SectionContentPreferences>(renderContext),
                     .. Content.MainPanel.Primary, .. Fragments<SectionContentPrimary>(renderContext),
                     .. Content.MainPanel.Secondary, .. Fragments<SectionContentSecondary>(renderContext)]));
            return main.Render(renderContext, this);
        }

        /// <summary>
        /// Combines dedicated landing footer fragments with the existing reusable footer slots.
        /// </summary>
        /// <param name="renderContext">The current request and page context.</param>
        /// <returns>The semantic landing footer.</returns>
        protected override IHtmlNode RenderFooter(IRenderControlContext renderContext)
        {
            return new ControlFooter("wx-landing-footer",
                [.. LandingFooter.Content, .. Fragments<SectionLandingFooter>(renderContext),
                 .. Footer.Preferences, .. Fragments<SectionFooterPreferences>(renderContext),
                 .. Footer.Primary, .. Fragments<SectionFooterPrimary>(renderContext),
                 .. Footer.Secondary, .. Fragments<SectionFooterSecondary>(renderContext)])
            {
                Classes = ["wx-landing-site-footer"]
            }.Render(renderContext, this);
        }

        /// <summary>
        /// Resolves each slot per render without mutating controls or accumulating duplicate fragments.
        /// </summary>
        /// <typeparam name="TSection">The typed fragment slot to resolve.</typeparam>
        /// <param name="renderContext">The current request and page context.</param>
        /// <returns>The scoped controls in fragment-manager order.</returns>
        private IEnumerable<IControl> Fragments<TSection>(IRenderControlContext renderContext)
            where TSection : ISection
        {
            return _componentHub.FragmentManager.GetFragments<IFragmentControl, TSection>(renderContext.PageContext);
        }
    }
}
