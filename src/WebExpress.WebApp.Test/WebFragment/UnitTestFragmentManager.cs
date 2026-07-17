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

            // validation
            if (id is null)
            {
                Assert.Empty(fragment);
                return;
            }

            Assert.Contains(id, fragment.Select(x => x.FragmentId?.ToString()));
        }

        /// <summary>
        /// Test helper for GetFragments assertions.
        /// </summary>
        private void AssertGetFragments(Type applicationType, Type fragmentType, Type sectionType, Type scopeType, int count, string expected)
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
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_Panel_ContentPrimary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlPanel), typeof(SectionContentPrimary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentpagea""><div>Hello World</div></div>");

        [Fact]
        public void GetFragments_Panel_ContentPrimary_IScopeGeneral() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlPanel), typeof(SectionContentPrimary), typeof(IScopeGeneral), 0, null);

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_Panel_ContentPrimary_IScope() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlPanel), typeof(SectionContentPrimary), typeof(IScope), 0, null);

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_IFragmentControl_ContentPrimary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(IFragmentControl), typeof(SectionContentPrimary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentpagea""><div>Hello World</div></div>");

        [Fact]
        public void GetFragments_IFragmentControl_ContentPrimary_IScopeGeneral() => AssertGetFragments(typeof(TestApplication), typeof(IFragmentControl), typeof(SectionContentPrimary), typeof(IScopeGeneral), 0, null);

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_IFragmentControl_ContentPrimary_IScope() => AssertGetFragments(typeof(TestApplication), typeof(IFragmentControl), typeof(SectionContentPrimary), typeof(IScope), 0, null);

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_IFragmentBase_ContentPrimary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(IFragmentBase), typeof(SectionContentPrimary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentpagea""><div>Hello World</div></div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_IFragmentBase_ContentPrimary_IScopeGeneral() => AssertGetFragments(typeof(TestApplication), typeof(IFragmentBase), typeof(SectionContentPrimary), typeof(IScopeGeneral), 0, null);

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_IFragmentBase_ContentPrimary_IScope() => AssertGetFragments(typeof(TestApplication), typeof(IFragmentBase), typeof(SectionContentPrimary), typeof(IScope), 0, null);

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_IFragmentControl_AppNavigationPrimary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(IFragmentControl), typeof(SectionAppNavigationPrimary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentpagea""><div>Hello World</div></div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_IFragmentControl_AppNavigationPrimary_IScope() => AssertGetFragments(typeof(TestApplication), typeof(IFragmentControl), typeof(SectionAppNavigationPrimary), typeof(IScope), 0, null);

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_Panel_ContentSecondary_TestPageB() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlPanel), typeof(SectionContentSecondary), typeof(TestPageB), 1, @"<div id=""webexpress-webapp-test-testfragmentpageb""><div>Hello World</div></div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_Panel_ContentSecondary_IScopeGeneral() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlPanel), typeof(SectionContentSecondary), typeof(IScopeGeneral), 0, null);

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_Panel_ContentSecondary_IScope() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlPanel), typeof(SectionContentSecondary), typeof(IScope), 0, null);

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_Panel_ContentPrimary_TestPageB() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlPanel), typeof(SectionContentPrimary), typeof(TestPageB), 0, null);

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_RestTable_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlDataTable), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontroldatatable"" class=""wx-webapp-table""></div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_RestDropdown_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlDataDropdown), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontroldatadropdown"" class=""wx-webapp-dropdown"" role=""button""></div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_RestFormNew_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(TestFragmentControlDataFormNew), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<form id=""webexpress-webapp-test-testfragmentcontroldataformnew"" class=""wx-webapp-restform"" data-method=""POST"" data-mode=""new""><main><div></div></main><div><button type=""submit"" class=""btn me-2 btn-success""><i class=""wx-icon-light wx-icon-light-plus me-2""></i>New  </button></div></form>");

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_RestFormEdit_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(TestFragmentControlDataFormEdit), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<form id=""webexpress-webapp-test-testfragmentcontroldataformedit"" class=""wx-webapp-restform"" data-method=""PUT"" data-mode=""edit""><main><div></div></main><div><button type=""submit"" class=""btn me-2 btn-success""><i class=""wx-icon-light wx-icon-light-floppy-disk me-2""></i>Save  </button></div></form>");

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_RestFormDelete_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(TestFragmentControlDataFormDelete), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<form id=""webexpress-webapp-test-testfragmentcontroldataformdelete"" class=""wx-webapp-restform"" data-method=""DELETE"" data-mode=""delete""><main><div><p>Are you sure you want to delete this item?</p></div></main><div><button type=""submit"" class=""btn me-2 btn-danger""><i class=""wx-icon-light wx-icon-light-trash me-2""></i>Delete  </button></div></form>");

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_ModalRemoteForm_BodySecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(TestFragmentControlModalRemoteForm), typeof(SectionBodySecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontrolmodalremoteform"" class=""wx-webui-modal-form"" data-close-label=""Close""><div class=""wx-modal-header""></div><div class=""wx-modal-content""></div><div class=""wx-modal-footer""></div></div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_IFragmentControl_BodySecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(IFragmentControl), typeof(SectionBodySecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontrolmodalremoteform"" class=""wx-webui-modal-form"" data-close-label=""Close""><div class=""wx-modal-header""></div><div class=""wx-modal-content""></div><div class=""wx-modal-footer""></div></div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_RestQuickfilter_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlDataQuickfilter), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontroldataquickfilter"" class=""wx-webapp-quickfilter""></div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_RestDashboard_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlDataDashboard), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontroldatadashboard"" class=""wx-webapp-dashboard""></div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_RestWizard_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlDataWizard), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<form id=""webexpress-webapp-test-testfragmentcontroldatawizard"" class=""wx-webapp-restwizard""></form>");

        /// <summary>
        /// Test the get fragments function of the fragment manager.
        /// Test helper for GetFragments assertions.
        /// </summary>
        [Fact]
        public void GetFragments_RestWorkflow_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlDataWorkflow), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontroldataworkflow"" class=""wx-webapp-workflow-editor""></div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager for the comment control.
        /// </summary>
        [Fact]
        public void GetFragments_DataComment_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlDataComment), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontroldatacomment"" class=""wx-webapp-comment""*</div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager for the gantt control.
        /// </summary>
        [Fact]
        public void GetFragments_DataGantt_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlDataGantt), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontroldatagantt"" class=""wx-webapp-gantt""*</div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager for the permission control.
        /// </summary>
        [Fact]
        public void GetFragments_DataPermission_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlDataPermission), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontroldatapermission"" class=""wx-webapp-permission""*</div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager for the scrum backlog control.
        /// </summary>
        [Fact]
        public void GetFragments_DataScrumBacklog_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlDataScrumBacklog), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontroldatascrumbacklog"" class=""wx-webapp-scrum-backlog""*</div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager for the scrum sprint control.
        /// </summary>
        [Fact]
        public void GetFragments_DataScrumSprint_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlDataScrumSprint), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontroldatascrumsprint"" class=""wx-webapp-scrum-sprint""*</div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager for the scrum team control.
        /// </summary>
        [Fact]
        public void GetFragments_DataScrumTeam_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlDataScrumTeam), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontroldatascrumteam"" class=""wx-webapp-scrum-team""*</div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager for the scrum velocity control.
        /// </summary>
        [Fact]
        public void GetFragments_DataScrumVelocity_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlDataScrumVelocity), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontroldatascrumvelocity"" class=""wx-webapp-scrum-velocity""*</div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager for the sidebar control.
        /// </summary>
        [Fact]
        public void GetFragments_DataSidebar_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlDataSidebar), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontroldatasidebar"" class=""wx-webapp-sidebar""*</div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager for the system metric control.
        /// </summary>
        [Fact]
        public void GetFragments_SystemMetric_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlSystemMetric), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontrolsystemmetric"" class=""wx-webapp-system-metric""*</div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager for the message queue status control.
        /// </summary>
        [Fact]
        public void GetFragments_MessageQueueStatus_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlMessageQueueStatus), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontrolmessagequeuestatus"" class=""wx-webapp-message-queue-status""*</div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager for the progress task control.
        /// </summary>
        [Fact]
        public void GetFragments_ProgressTask_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlProgressTask), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontrolprogresstask"" class=""wx-webapp-progress-task""*</div>");

        /// <summary>
        /// Test the get fragments function of the fragment manager for the chat control.
        /// </summary>
        [Fact]
        public void GetFragments_Chat_ContentSecondary_TestPageA() => AssertGetFragments(typeof(TestApplication), typeof(FragmentControlChat), typeof(SectionContentSecondary), typeof(TestPageA), 1, @"<div id=""webexpress-webapp-test-testfragmentcontrolchat"" class=""wx-webapp-chat""*</div>");

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

            // validation
            Assert.NotNull(html);
            AssertExtensions.EqualWithPlaceholders(expected, html.FirstOrDefault()?.ToString());
        }

        /// <summary>
        /// Verifies FragmentControlDataTabTemplate retrieval in isolation.
        /// </summary>
        [Fact]
        public void GetFragments_RestTabTemplate()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var renderContext = UnitTestControlFixture.CreateRenderContextMock(application, [typeof(TestPageA)]);
            var visualTree = new VisualTreeControl(componentHub, renderContext.PageContext);

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

            var parameters = new object[]
            {
                renderContext?.PageContext?.ApplicationContext,
                renderContext?.PageContext?.Scopes
            };

            // act
            var fragments = (IEnumerable<object>)getFragmentsMethod.MakeGenericMethod(typeof(FragmentControlDataTabTemplate), typeof(SectionContentSecondary))
                .Invoke(componentHub.FragmentManager, parameters);
            var controls = Enumerable.Cast<IFragmentControlDataTabTemplate>(fragments).ToList();
            var html = controls.Select(x => x.Render(renderContext, visualTree)).ToList();

            // validation
            Assert.Single(html);
            AssertExtensions.EqualWithPlaceholders(@"<template id=""webexpress-webapp-test-testfragmentcontroldatatabtemplate""></template>", html.FirstOrDefault()?.ToString()?.Trim());
        }

        /// <summary>
        /// Verifies IFragmentControlDataTabTemplate retrieval in isolation.
        /// </summary>
        [Fact]
        public void GetFragments_IRestTabTemplate()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var renderContext = UnitTestControlFixture.CreateRenderContextMock(application, [typeof(TestPageA)]);
            var visualTree = new VisualTreeControl(componentHub, renderContext.PageContext);

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

            var parameters = new object[]
            {
                renderContext?.PageContext?.ApplicationContext,
                renderContext?.PageContext?.Scopes
            };

            // act
            var fragments = (IEnumerable<object>)getFragmentsMethod.MakeGenericMethod(typeof(IFragmentControlDataTabTemplate), typeof(SectionContentSecondary))
                .Invoke(componentHub.FragmentManager, parameters);
            var controls = Enumerable.Cast<IFragmentControlDataTabTemplate>(fragments).ToList();
            var html = controls.Select(x => x.Render(renderContext, visualTree)).ToList();

            // validation
            Assert.Single(html);
            AssertExtensions.EqualWithPlaceholders(@"<template id=""webexpress-webapp-test-testfragmentcontroldatatabtemplate""></template>", html.FirstOrDefault()?.ToString()?.Trim());
        }

        /// <summary>
        /// Verifies RestTabTemplate fragment is filtered out for unrelated scope.
        /// </summary>
        [Fact]
        public void GetFragments_RestTabTemplate_WrongScope()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var renderContext = UnitTestControlFixture.CreateRenderContextMock(application, [typeof(TestPageB)]);

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

            var parameters = new object[]
            {
                renderContext?.PageContext?.ApplicationContext,
                renderContext?.PageContext?.Scopes
            };

            // act
            var fragments = (IEnumerable<object>)getFragmentsMethod.MakeGenericMethod(typeof(FragmentControlDataTabTemplate), typeof(SectionContentSecondary))
                .Invoke(componentHub.FragmentManager, parameters);
            var controls = Enumerable.Cast<IFragmentControlDataTabTemplate>(fragments).ToList();

            // validation
            Assert.Empty(controls);
        }
    }
}
