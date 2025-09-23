using WebExpress.WebApp.WebSection;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebFragment;
using WebExpress.WebUI.WebFragment;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// A dummy fragment for testing purposes.
    /// </summary>
    [Section<SectionAppPreferences>]
    public sealed class TestFragmentSectionAppPreferencesItem : FragmentControlDropdownItemLink
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public TestFragmentSectionAppPreferencesItem(IFragmentContext fragmentContext)
            : base(fragmentContext)
        {
            Text = "TestFragmentSectionAppPreferencesItem";
        }
    }
}
