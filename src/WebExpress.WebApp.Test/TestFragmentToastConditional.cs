using WebExpress.WebApp.WebSection;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebCondition;
using WebExpress.WebCore.WebFragment;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebUI.WebFragment;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// A toast fragment that renders nothing unless the request carries the test parameter, so a
    /// test can tell whether the toast bar is decided by the rendered output or by the fragment's presence.
    /// </summary>
    [Section<SectionToastNotificationPrimary>]
    [Condition<TestConditionToast>]
    public sealed class TestFragmentToastConditional : FragmentControlHtml
    {
        /// <summary>
        /// The text the fragment renders when its condition holds.
        /// </summary>
        public const string Text = "TestFragmentToastConditional";

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="fragmentContext">The context of the fragment.</param>
        public TestFragmentToastConditional(IFragmentContext fragmentContext)
            : base(fragmentContext)
        {
            Html = _ => $"<span>{Text}</span>";
        }
    }

    /// <summary>
    /// Holds when the request carries the toast test parameter.
    /// </summary>
    public sealed class TestConditionToast : ICondition
    {
        /// <summary>
        /// The name of the parameter that fulfills the condition.
        /// </summary>
        public const string ParameterName = "test-toast";

        /// <summary>
        /// Checks the condition.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>True when the request carries the parameter.</returns>
        public bool Fulfillment(IRequest request)
        {
            return request?.HasParameter(ParameterName) ?? false;
        }
    }
}
