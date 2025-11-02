using System.Reflection;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebFragment;
using WebExpress.WebApp.WebScope;
using WebExpress.WebApp.WebSection;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebFragment;
using WebExpress.WebCore.WebScope;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebFragment;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebFragment
{
    /// <summary>
    /// Test the fragment manager.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestFragmentManager
    {
        /// <summary>
        /// Test the id property of the fragment manager.
        /// </summary>
        [Theory]
        [InlineData(typeof(TestApplication), typeof(TestFragmentPageA), "webexpress.webapp.test.testfragmentpagea")]
        public void Id(Type applicationType, Type fragmentType, string id)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(applicationType).FirstOrDefault();

            // test execution
            var fragment = componentHub.FragmentManager.GetFragments(application, fragmentType);

            if (id == null)
            {
                Assert.Empty(fragment);
                return;
            }

            Assert.Contains(id, fragment.Select(x => x.FragmentId?.ToString()));
        }

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// </summary>
        [Theory]
        [InlineData(typeof(TestApplication), typeof(FragmentControlPanel), typeof(SectionContentPrimary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentpagea""><div>Hello World</div></div>")]
        [InlineData(typeof(TestApplication), typeof(FragmentControlPanel), typeof(SectionContentPrimary), typeof(IScopeGeneral), 0, null)]
        [InlineData(typeof(TestApplication), typeof(FragmentControlPanel), typeof(SectionContentPrimary), typeof(IScope), 0, null)]
        [InlineData(typeof(TestApplication), typeof(IFragmentControl), typeof(SectionContentPrimary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentpagea""><div>Hello World</div></div>")]
        [InlineData(typeof(TestApplication), typeof(IFragmentControl), typeof(SectionContentPrimary), typeof(IScopeGeneral), 0, null)]
        [InlineData(typeof(TestApplication), typeof(IFragmentControl), typeof(SectionContentPrimary), typeof(IScope), 0, null)]
        [InlineData(typeof(TestApplication), typeof(IFragmentBase), typeof(SectionContentPrimary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentpagea""><div>Hello World</div></div>")]
        [InlineData(typeof(TestApplication), typeof(IFragmentBase), typeof(SectionContentPrimary), typeof(IScopeGeneral), 0, null)]
        [InlineData(typeof(TestApplication), typeof(IFragmentBase), typeof(SectionContentPrimary), typeof(IScope), 0, null)]
        [InlineData(typeof(TestApplication), typeof(IFragmentControl), typeof(SectionAppNavigationPrimary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentpagea""><div>Hello World</div></div>")]
        //[InlineData(typeof(TestApplication), typeof(IFragmentControl), typeof(SectionAppNavigationPrimary), typeof(IScopeGeneral), 1, @"<a id=""webexpress-webapp-test-testfragmentgeneral"" class=""link""><div>Hello World</div></a>")]
        [InlineData(typeof(TestApplication), typeof(IFragmentControl), typeof(SectionAppNavigationPrimary), typeof(IScope), 0, null)]
        [InlineData(typeof(TestApplication), typeof(FragmentControlPanel), typeof(SectionContentSecondary), typeof(TestPageB), 1, @"<div id=""webexpress-webapp-test-testfragmentpageb""><div>Hello World</div></div>")]
        [InlineData(typeof(TestApplication), typeof(FragmentControlPanel), typeof(SectionContentSecondary), typeof(IScopeGeneral), 0, null)]
        [InlineData(typeof(TestApplication), typeof(FragmentControlPanel), typeof(SectionContentSecondary), typeof(IScope), 0, null)]
        [InlineData(typeof(TestApplication), typeof(FragmentControlPanel), typeof(SectionContentPrimary), typeof(TestPageB), 0, null)]
        [InlineData(typeof(TestApplication), typeof(FragmentControlRestTable), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontrolresttable"" class=""wx-webapp-table""></div>")]
        [InlineData(typeof(TestApplication), typeof(FragmentControlRestDropdown), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontrolrestdropdown"" class=""wx-webapp-dropdown"" role=""button""></div>")]
        public void GetFragments(Type applicationType, Type fragmentType, Type sectionType, Type scopeType, int count, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(applicationType).FirstOrDefault();
            var renderContext = UnitTestControlFixture.CreateRenderContextMock(application, [scopeType]);
            var visualTree = new VisualTreeControl(componentHub, renderContext.PageContext);

            // reflection to get GetFragments method
            var fragmentManagerType = componentHub.FragmentManager.GetType();
            var getFragmentsMethod = fragmentManagerType.GetMethod
            (
                "GetFragments",
                BindingFlags.Instance | BindingFlags.Public,
                [
                    typeof(ApplicationContext),
                    typeof(IEnumerable<Type>)
                ]
            );

            // prepare parameters for the method
            var parameters = new object[]
            {
                renderContext?.PageContext?.ApplicationContext,
                renderContext?.PageContext?.Scopes
            };

            // test execution
            // invoke the method using reflection
            var preferences = (IEnumerable<object>)getFragmentsMethod.MakeGenericMethod(fragmentType, sectionType)
                .Invoke(componentHub.FragmentManager, parameters);
            var castPreferences = Enumerable.Cast<IControl>(preferences);

            var html = castPreferences.Select(x => x.Render(renderContext, visualTree));

            Assert.Equal(count, html.Count());
            AssertExtensions.EqualWithPlaceholders(expected, string.Join("", html).Trim());
        }

        /// <summary>
        /// Test the render function of the fragment manager.
        /// </summary>
        [Theory]
        [InlineData(typeof(TestApplication), typeof(SectionContentPrimary), typeof(TestPageA), @"<div id=""webexpress-webapp-test-testfragmentpagea""><div>Hello World</div></div>")]
        [InlineData(typeof(TestApplication), typeof(SectionContentPrimary), typeof(IScopeGeneral), null)]
        [InlineData(typeof(TestApplication), typeof(SectionContentPrimary), typeof(IScope), null)]
        public void Render(Type applicationType, Type sectionType, Type scopeType, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(applicationType).FirstOrDefault();
            var renderContext = UnitTestControlFixture.CreateRenderContextMock(application, [scopeType]);
            var visualTree = new VisualTreeControl(componentHub, renderContext.PageContext);

            // test execution
            var html = componentHub.FragmentManager.Render(renderContext, visualTree, sectionType);

            Assert.NotNull(html);
            AssertExtensions.EqualWithPlaceholders(expected, html.FirstOrDefault()?.ToString());
        }
    }
}
