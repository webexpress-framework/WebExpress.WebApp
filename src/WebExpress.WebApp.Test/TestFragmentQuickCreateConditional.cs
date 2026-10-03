using WebExpress.WebApp.WebSection;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebCondition;
using WebExpress.WebCore.WebFragment;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebUI.WebFragment;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// A quick-create entry that appears only when its condition holds, so the header can be
    /// tested for honoring fragment conditions. Requests without the switch parameter never
    /// see it, which keeps every other header test unaffected.
    /// </summary>
    [Section<SectionAppQuickcreatePrimary>]
    [Condition<TestConditionQuickCreate>]
    public sealed class TestFragmentQuickCreateConditional : FragmentControlSplitButtonItemLink
    {
        /// <summary>
        /// The uri the entry leads to, so a test can recognize the button it produces.
        /// </summary>
        public const string TargetUri = "/test/quickcreate/conditional";

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="fragmentContext">The context in which the fragment is used.</param>
        public TestFragmentQuickCreateConditional(IFragmentContext fragmentContext)
            : base(fragmentContext)
        {
            Text = _ => "TestFragmentQuickCreateConditional";
            Uri = _ => new WebCore.WebUri.UriEndpoint(TargetUri);
        }
    }

    /// <summary>
    /// Holds only for requests carrying the switch parameter, so a test decides per request
    /// whether the conditional quick-create entry may appear.
    /// </summary>
    public sealed class TestConditionQuickCreate : ICondition
    {
        /// <summary>
        /// The name of the request parameter that fulfills the condition.
        /// </summary>
        public const string ParameterName = "test-quickcreate";

        /// <summary>
        /// Verifies that the request carries the switch parameter.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>True if the parameter is present, false otherwise.</returns>
        public bool Fulfillment(IRequest request)
        {
            return request?.HasParameter(ParameterName) ?? false;
        }
    }
}
