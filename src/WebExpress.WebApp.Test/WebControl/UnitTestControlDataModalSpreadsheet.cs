using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebEndpoint;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the workbook dialog.
    /// </summary>
    /// <remarks>
    /// Drafting, publishing, sharing and the bar are those of the document dialog and are carried
    /// by the editor's tests; what is tested here is what a workbook changes in the render
    /// contract: the controller the dialog is picked up by, the spreadsheet as the filling body
    /// under the field name both endpoints read, and the declarations that bind the two endpoints.
    /// </remarks>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataModalSpreadsheet
    {
        /// <summary>
        /// Builds a workbook dialog with both services declared.
        /// </summary>
        /// <param name="id">The control id.</param>
        /// <returns>The control.</returns>
        private static ControlDataModalSpreadsheet CreateControl(string id = "sheet")
        {
            var control = new ControlDataModalSpreadsheet(id)
            {
                ServiceFactory = _ => DataServiceDescriptor.FormData("http://localhost:8080/api/workbooks"),
                DraftServiceFactory = _ => DataServiceDescriptor.DraftData("http://localhost:8080/api/drafts")
            };

            control.Title.Name = _ => "Title";
            control.Body.Name = _ => "Body";

            return control;
        }

        /// <summary>
        /// Renders a control against the mocked render context.
        /// </summary>
        /// <param name="control">The control to render.</param>
        /// <returns>The rendered markup.</returns>
        private static string Render(ControlDataModalSpreadsheet control)
        {
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);

            return control.Render(context, visualTree).ToString();
        }

        /// <summary>
        /// Returns the substring between two markers.
        /// </summary>
        /// <param name="html">The rendered markup.</param>
        /// <param name="from">The opening marker.</param>
        /// <param name="to">The marker the section ends before.</param>
        /// <returns>The section.</returns>
        private static string Section(string html, string from, string to)
        {
            var start = html.IndexOf(from, StringComparison.Ordinal);
            Assert.True(start >= 0, $"the markup carries \"{from}\"");

            var end = html.IndexOf(to, start, StringComparison.Ordinal);

            return html[start..(end < 0 ? html.Length : end)];
        }

        /// <summary>
        /// Tests that the dialog is picked up by the workbook controller and carries the kind
        /// class beside the shared one, while the form keeps the islands as direct children.
        /// </summary>
        [Fact]
        public void TheDialogIsTheWorkbookKindOfTheDocumentDialog()
        {
            // arrange
            var control = CreateControl();

            // act
            var html = Render(control);

            // validation
            Assert.Contains(@"<form id=""sheet_form"" class=""wx-webapp-restform""", html);
            Assert.Contains(@"<wx-service hidden name=""data"" kind=""rest"" base-uri=""http://localhost:8080/api/workbooks""", html);
            Assert.Contains(@"<wx-service hidden name=""draft"" kind=""rest"" base-uri=""http://localhost:8080/api/drafts""", html);
            Assert.Contains(@"<dialog id=""sheet"" class=""wx-webapp-modal-spreadsheet wx-editor-form wx-spreadsheet-form""", html);
            Assert.Contains(@"data-size=""modal-fullscreen""", html);
            Assert.Contains(@"data-wx-preview=""true""", html);
        }

        /// <summary>
        /// Tests that the body is a filling spreadsheet under the field name both endpoints read,
        /// with no caption, and that its own settings reach the spreadsheet.
        /// </summary>
        [Fact]
        public void TheBodyIsAFillingSpreadsheetWithItsOwnSettings()
        {
            // arrange
            var control = CreateControl();
            control.Body.FormulaBar = _ => false;
            control.Body.Locale = _ => "de";

            // act
            var html = Render(control);
            var content = Section(html, "wx-modal-content", "wx-modal-footer");

            // validation
            Assert.Contains("wx-webui-spreadsheet", content);
            Assert.Contains(@"name=""Body""", content);
            Assert.Contains(@"data-fill=""true""", content);
            Assert.Contains(@"data-formula-bar=""false""", content);
            Assert.Contains(@"data-locale=""de""", content);
            Assert.DoesNotContain("<label", html);
        }

        /// <summary>
        /// Tests that the title is the editable name on the dialog's title bar, as for every
        /// document.
        /// </summary>
        [Fact]
        public void TheNameIsOnTheTitleBar()
        {
            // arrange
            var control = CreateControl();

            // act
            var html = Render(control);
            var header = Section(html, "wx-modal-header", "wx-modal-content");

            // validation
            Assert.Contains(@"name=""Title""", header);
            Assert.Contains("wx-editor-form-title-input", header);
        }

        /// <summary>
        /// Tests that a drafting workbook publishes and one without a draft saves, as a text does.
        /// </summary>
        [Fact]
        public void TheSubmitPublishesOnlyWhileDrafting()
        {
            // arrange
            var drafting = CreateControl("a");
            var plain = CreateControl("b");
            plain.Draft = _ => false;

            // act
            var published = Render(drafting);
            var saved = Render(plain);

            // validation
            Assert.Contains(">Publish", published);
            Assert.Contains(@"id=""a_discard""", published);
            Assert.Contains(">Save", saved);
            Assert.DoesNotContain(@"name=""draft""", saved);
        }

        /// <summary>
        /// Tests that a shared workbook sits in the collaborative container, whose presence is
        /// docked onto the bar, and that the draft announcements go to the same channel.
        /// </summary>
        [Fact]
        public void ASharedWorkbookSitsInTheCollaborativeContainer()
        {
            // arrange
            var control = CreateControl();
            control.Collaborative = _ => true;
            control.CollaborationId = _ => "budget";

            // act
            var html = Render(control);
            var content = Section(html, "wx-modal-content", "wx-modal-footer");

            // validation
            Assert.Contains(@"<div id=""budget"" class=""wx-webapp-collaborative", content);
            Assert.Contains("wx-webui-spreadsheet", content);
            Assert.Contains(@"data-wx-channel=""budget""", html);
            Assert.Contains(@"id=""sheet_presence"" class=""wx-editor-form-presence""", html);
        }

        /// <summary>
        /// Tests that the declarations chain: the record service answers the workbook dialog, so
        /// the draft can be declared on it, and each lands where the control reads it.
        /// </summary>
        [Fact]
        public void TheTwoEndpointsAreDeclaredByChaining()
        {
            // arrange: the endpoint resolution touches the sitemap at build time
            UnitTestControlFixture.CreateAndRegisterComponentHubMock();

            // act
            var control = new ControlDataModalSpreadsheet("sheet")
                .DataService<FakeWorkbookEndpoint>()
                .DraftService<FakeWorkbookEndpoint>();

            // validation
            Assert.Single(control.ServiceFactories);
            Assert.NotNull(control.DraftServiceFactory);
        }

        /// <summary>
        /// A marker endpoint for the preset test.
        /// </summary>
        private sealed class FakeWorkbookEndpoint : IEndpoint
        {
        }
    }
}
