using WebExpress.WebApp.WebSection;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebFragment;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebFragment;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Supplies a scoped introduction to verify landing section discovery.
    /// </summary>
    [Section<SectionLandingHero>]
    [Scope<TestPageA>]
    public sealed class TestFragmentLandingHero : FragmentControlPanel
    {
        /// <summary>
        /// Configures recognizable content for ordering and scope assertions.
        /// </summary>
        /// <param name="fragmentContext">The scope and conditions of the test fragment.</param>
        public TestFragmentLandingHero(IFragmentContext fragmentContext)
            : base(fragmentContext)
        {
            Add(new ControlText { Text = _ => "landing-hero-fragment" });
        }
    }
}
