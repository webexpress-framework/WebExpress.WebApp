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
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(applicationType).FirstOrDefault();

            // act
            var fragment = componentHub.FragmentManager.GetFragments(application, fragmentType);

            if (id is null)
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
        [InlineData(typeof(TestApplication), typeof(IFragmentControl), typeof(SectionAppNavigationPrimary), typeof(IScope), 0, null)]
        [InlineData(typeof(TestApplication), typeof(FragmentControlPanel), typeof(SectionContentSecondary), typeof(TestPageB), 1, @"<div id=""webexpress-webapp-test-testfragmentpageb""><div>Hello World</div></div>")]
        [InlineData(typeof(TestApplication), typeof(FragmentControlPanel), typeof(SectionContentSecondary), typeof(IScopeGeneral), 0, null)]
        [InlineData(typeof(TestApplication), typeof(FragmentControlPanel), typeof(SectionContentSecondary), typeof(IScope), 0, null)]
        [InlineData(typeof(TestApplication), typeof(FragmentControlPanel), typeof(SectionContentPrimary), typeof(TestPageB), 0, null)]
        [InlineData(typeof(TestApplication), typeof(FragmentControlRestTable), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontrolresttable"" class=""wx-webapp-table""></div>")]
        [InlineData(typeof(TestApplication), typeof(FragmentControlRestDropdown), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontrolrestdropdown"" class=""wx-webapp-dropdown"" role=""button""></div>")]
        [InlineData(typeof(TestApplication), typeof(TestFragmentControlRestFormNew), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<form id=""webexpress-webapp-test-testfragmentcontrolrestformnew"" class=""wx-webapp-restform"" data-method=""POST"" data-mode=""new""><main><div></div></main><div><button type=""submit"" class=""btn me-2 btn-success""><i class=""fas fa-plus me-2""></i>New  </button></div></form>")]
        [InlineData(typeof(TestApplication), typeof(TestFragmentControlRestFormEdit), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<form id=""webexpress-webapp-test-testfragmentcontrolrestformedit"" class=""wx-webapp-restform"" data-method=""PUT"" data-mode=""edit""><main><div></div></main><div><button type=""submit"" class=""btn me-2 btn-success""><i class=""fas fa-save me-2""></i>Save  </button></div></form>")]
        [InlineData(typeof(TestApplication), typeof(TestFragmentControlRestFormDelete), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<form id=""webexpress-webapp-test-testfragmentcontrolrestformdelete"" class=""wx-webapp-restform"" data-method=""DELETE"" data-mode=""delete""><main><div><p>Are you sure you want to delete this item?</p></div></main><div><button type=""submit"" class=""btn me-2 btn-danger""><i class=""fas fa-trash me-2""></i>Delete  </button></div></form>")]
        [InlineData(typeof(TestApplication), typeof(TestFragmentControlModalRemoteForm), typeof(SectionBodySecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontrolmodalremoteform"" class=""wx-webui-modal-form"" data-close-label=""Close""><div class=""wx-modal-header""></div><div class=""wx-modal-content""></div><div class=""wx-modal-footer""></div></div>")]
        [InlineData(typeof(TestApplication), typeof(IFragmentControl), typeof(SectionBodySecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontrolmodalremoteform"" class=""wx-webui-modal-form"" data-close-label=""Close""><div class=""wx-modal-header""></div><div class=""wx-modal-content""></div><div class=""wx-modal-footer""></div></div>")]
        [InlineData(typeof(TestApplication), typeof(FragmentControlRestQuickfilter), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontrolrestquickfilter"" class=""wx-webapp-quickfilter""></div>")]
        [InlineData(typeof(TestApplication), typeof(FragmentControlRestDashboard), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontrolrestdashboard"" class=""wx-webapp-dashboard""></div>")]
        [InlineData(typeof(TestApplication), typeof(FragmentControlRestWizard), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<form id=""webexpress-webapp-test-testfragmentcontrolrestwizard"" class=""wx-webapp-restwizard""></form>")]
        [InlineData(typeof(TestApplication), typeof(FragmentControlRestWorkflow), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontrolrestworkflow"" class=""wx-webapp-workflow-editor""></div>")]
        public void GetFragments(Type applicationType, Type fragmentType, Type sectionType, Type scopeType, int count, string expected)
        {
            // arrange
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

            // act
            // invoke the method using reflection
            var preferences = (IEnumerable<object>)getFragmentsMethod.MakeGenericMethod(fragmentType, sectionType)
                .Invoke(componentHub.FragmentManager, parameters);
            var castPreferences = Enumerable.Cast<IControl>(preferences);

            var html = castPreferences.Select(x => x.Render(renderContext, visualTree));

            // validation
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
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(applicationType).FirstOrDefault();
            var renderContext = UnitTestControlFixture.CreateRenderContextMock(application, [scopeType]);
            var visualTree = new VisualTreeControl(componentHub, renderContext.PageContext);

            // act
            var html = componentHub.FragmentManager.Render(renderContext, visualTree, sectionType);

            Assert.NotNull(html);
            AssertExtensions.EqualWithPlaceholders(expected, html.FirstOrDefault()?.ToString());
        }
    }
}
