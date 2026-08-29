using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the data file view control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataFileView
    {
        /// <summary>
        /// Tests the id property of the file view control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-file-view"" data-layout=""togglegroup"" data-views=""list,tile""><div class=""wx-webui-file-list""></div></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-file-view"" data-layout=""togglegroup"" data-views=""list,tile""><div class=""wx-webui-file-list""></div></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFileView(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Verifies that the declared files are rendered through a real file list, which is what
        /// makes an entry look the same here as it does in a standalone list.
        /// </summary>
        [Fact]
        public void FilesAreRenderedThroughAFileList()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFileView("id")
                .Add(new ControlFileListItem("file-1")
                {
                    Name = _ => "ProjectProposal.pdf",
                    Description = _ => "Initial draft"
                });

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains(@"<div class=""wx-webui-file-list"">", html);
            Assert.Contains(@"data-file-id=""file-1""", html);
            Assert.Contains("ProjectProposal.pdf", html);
            Assert.Contains(@"data-description=""Initial draft""", html);
        }

        /// <summary>
        /// Verifies that the presentations the switcher offers travel to the client in the
        /// declared order, because the first one is the one shown until the user picks another.
        /// </summary>
        [Fact]
        public void PresentationsKeepTheirDeclaredOrder()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFileView("id")
            {
                Presentations = _ => [TypeFileView.Tile, TypeFileView.List]
            };

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains(@"data-views=""tile,list""", html);
        }

        /// <summary>
        /// Verifies that the inline edit of a description is announced to the client, since the
        /// control offers the editor only when the page asked for it.
        /// </summary>
        [Theory]
        [InlineData(false, false)]
        [InlineData(true, true)]
        public void EditableDescriptionIsAnnounced(bool editable, bool expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFileView("id")
            {
                EditableDescription = _ => editable
            };

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Equal(expected, html.Contains(@"data-editable-description=""true"""));
        }

        /// <summary>
        /// Verifies that an author-provided view is rendered next to the built-in ones, so the
        /// control offers the same open set of views the view control does.
        /// </summary>
        [Fact]
        public void AdditionalViewsAreRendered()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFileView("id")
                .Add(new ControlViewItem("gallery")
                {
                    Title = _ => "Gallery"
                });

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains(@"<div id=""gallery"" class=""wx-view"" data-label=""Gallery""", html);
        }

        /// <summary>
        /// Verifies that the upload binding reaches the host element, which is what ties a
        /// finished upload to this control on the client.
        /// </summary>
        [Fact]
        public void UploadBindingIsApplied()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFileView("id")
            {
                Bind = _ => new Binding().Add(new BindUpload { Source = "myUpload" })
            };

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains(@"data-wx-bind=""upload""", html);
            Assert.Contains(@"data-wx-source-upload=""#myUpload""", html);
        }
    }
}
