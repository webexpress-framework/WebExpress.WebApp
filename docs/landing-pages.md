# Landing pages

The public website layout uses `IPage<VisualTreeWebAppLanding>`. It has an independent header, hero, continuous main content, and footer. It omits the application avatar, application menu, breadcrumb, headline, sidebar, toolbar, and property splitters. Its layout and document scrolling are scoped to landing pages and do not change normal application pages. The landing palette derives from the framework variables, so the page follows the theme, the light or dark scheme and the icon set the visitor chose; a page applies the theme in `Process` (`visualTree.UseTheme(...)`) as any other page does.

The header accepts controls through `LandingHeader.Add(...)` and fragments registered with `[Section<SectionLandingHeader>]`. The hero accepts controls through `Hero.Add(...)` and `[Section<SectionLandingHero>]`. Both appear before the reused content slots. The hero belongs to the main landmark.

The content retains `Content.MainPanel.AddPreferences(...)`, `AddPrimary(...)`, and `AddSecondary(...)`, together with `SectionContentPreferences`, `SectionContentPrimary`, and `SectionContentSecondary`. The layout renders the actual content directly, without the normal application headline or nested scrolling containers.

The footer accepts `LandingFooter.Add(...)` and `[Section<SectionLandingFooter>]`. It also renders the existing footer controls and `SectionFooterPreferences`, `SectionFooterPrimary`, and `SectionFooterSecondary`, so shared legal links can be reused. Fragment scope, conditions, and ordering continue to be managed by the framework.

The cookie banner slot uses `[Section<SectionCookieBanner>]` on a `FragmentControlCookieBanner` subclass. Both the normal and landing visual trees render this slot. Scope the fragment to the relevant pages and register it in one rendered section to avoid duplicate instances. Body fragments, notifications, and existing body-section banners remain supported.

The example at `/webui/landing` reconstructs the public WebExpress website using native panels, headings, links, Markdown text, images, and a code control. Its source English copy is deliberately preserved in both tutorial language resources for comparison with the original. Privacy statements are adjusted for the live tutorial's cookies and browser storage. Header, hero, content, and footer are independently registered fragments. Assets are embedded locally. See [the reference attribution](landing-reference-license.md) for provenance and licensing.
