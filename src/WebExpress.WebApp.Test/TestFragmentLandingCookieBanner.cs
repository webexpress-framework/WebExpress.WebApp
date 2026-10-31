using WebExpress.WebApp.WebSection;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebFragment;
using WebExpress.WebUI.WebFragment;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Supplies a scoped cookie notice to verify shared layout integration.
    /// </summary>
    [Section<SectionCookieBanner>]
    [Scope<TestPageA>]
    public sealed class TestFragmentLandingCookieBanner : FragmentControlCookieBanner
    {
        /// <summary>
        /// Configures a recognizable storage key without changing banner behavior.
        /// </summary>
        /// <param name="fragmentContext">The scope and conditions of the test fragment.</param>
        public TestFragmentLandingCookieBanner(IFragmentContext fragmentContext)
            : base(fragmentContext)
        {
            StorageKey = _ => "landing-cookie-test";
        }
    }
}
