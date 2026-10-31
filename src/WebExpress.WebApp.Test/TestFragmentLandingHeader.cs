using WebExpress.WebApp.WebSection;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebFragment;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebFragment;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Verifies the dedicated landing header slot independently of normal application sections.
    /// </summary>
    [Section<SectionLandingHeader>]
    [Scope<TestPageA>]
    public sealed class TestFragmentLandingHeader : FragmentControlPanel
    {
        /// <summary>
        /// Supplies a recognizable marker for section and scope assertions.
        /// </summary>
        /// <param name="fragmentContext">The scope and registration of the test fragment.</param>
        public TestFragmentLandingHeader(IFragmentContext fragmentContext)
            : base(fragmentContext)
        {
            Add(new ControlText { Text = _ => "landing-header-fragment" });
        }
    }
}
