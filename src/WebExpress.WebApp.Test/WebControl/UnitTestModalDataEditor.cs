using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the document editor dialog.
    /// </summary>
    /// <remarks>
    /// What the tests carry is the render contract, because that is the whole of the agreement
    /// between the control and the two controllers that pick it up: the modal controller lifts the
    /// three sections onto the dialog it builds, and the editor controller finds the form by
    /// walking up from the indicator, reads its configuration off it and hydrates from the islands
    /// beside it. Every one of those is a placement or an attribute, and every one of them costs a
    /// debugging cycle when it moves.
    /// </remarks>
    [Collection("NonParallelTests")]
    public class UnitTestModalDataEditor
    {
        /// <summary>
        /// Builds an editor with both services declared, which is the shape the control is
        /// authored in when it is meant to autosave.
        /// </summary>
        /// <param name="id">The control id.</param>
        /// <returns>The control.</returns>
        private static ModalDataEditor CreateControl(string id = "editor")
        {
            var control = new ModalDataEditor(id)
            {
                ServiceFactory = _ => DataServiceDescriptor.FormData("http://localhost:8080/api/documents"),
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
        private static string Render(ModalDataEditor control)
        {
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);

            return control.Render(context, visualTree).ToString();
        }

        /// <summary>
        /// Returns the substring between two markers, so an assertion can be made about one
        /// section of the dialog rather than about the whole of it.
        /// </summary>
        /// <param name="html">The rendered markup.</param>
        /// <param name="from">The opening marker.</param>
        /// <param name="to">The marker the section ends before, or null for the rest.</param>
        /// <returns>The section.</returns>
        private static string Section(string html, string from, string to = null)
        {
            var start = html.IndexOf(from, StringComparison.Ordinal);
            Assert.True(start >= 0, $"the markup carries \"{from}\"");

            var end = to is null ? html.Length : html.IndexOf(to, start, StringComparison.Ordinal);

            return html[start..(end < 0 ? html.Length : end)];
        }

        /// <summary>
        /// Tests that the form carries nothing but its hidden islands and the dialog. The islands
        /// have to stay direct children, because the client resolves the services from the form's
        /// own children rather than from its descendants; everything else is presentation and
        /// belongs to the dialog.
        /// </summary>
        [Fact]
        public void TheFormCarriesTheIslandsAndTheDialog()
        {
            // arrange
            var control = CreateControl();

            // act
            var html = Render(control);

            // validation
            Assert.Contains(@"<form id=""editor_form"" class=""wx-webapp-restform""", html);
            Assert.Contains(@"<wx-service hidden name=""data"" kind=""rest"" base-uri=""http://localhost:8080/api/documents""", html);
            Assert.Contains(@"<wx-service hidden name=""draft"" kind=""rest"" base-uri=""http://localhost:8080/api/drafts"" method=""GET"" update-method=""PUT""", html);
            Assert.Contains(@"<div id=""editor"" class=""wx-webui-modal wx-editor-form"" role=""dialog""", html);
        }

        /// <summary>
        /// Tests that the dialog opens fullscreen, does not scroll and stays closed until it is
        /// asked to open. A writing surface takes the whole dialog and scrolls inside itself, so a
        /// scrolling body would put a second scrollbar around the first one.
        /// </summary>
        [Fact]
        public void TheDialogIsAFullscreenSurfaceThatWaitsToBeOpened()
        {
            // arrange
            var control = CreateControl();

            // act
            var html = Render(control);

            // validation
            Assert.Contains(@"data-size=""modal-fullscreen""", html);
            Assert.Contains(@"data-scrollable=""false""", html);
            Assert.DoesNotContain("data-auto-show", html);
        }

        /// <summary>
        /// Tests that a page which is itself the editor can have the dialog open with it, because
        /// there is then no reading view to be triggered from.
        /// </summary>
        [Fact]
        public void ShowOpensTheDialogWithThePage()
        {
            // arrange
            var control = CreateControl();
            control.Show = _ => true;
            control.Size = _ => TypeModalSize.Large;

            // act
            var html = Render(control);

            // validation
            Assert.Contains(@"data-auto-show=""true""", html);
            Assert.Contains(@"data-size=""modal-lg""", html);
        }

        /// <summary>
        /// Tests that the three sections the modal controller reads are present, in the order it
        /// lifts them in: a header onto the title bar, the content into the body, a footer onto
        /// the footer bar.
        /// </summary>
        [Fact]
        public void TheDialogCarriesTheThreeSectionsInReadingOrder()
        {
            // arrange
            var control = CreateControl();

            // act
            var html = Render(control);

            // validation
            var header = html.IndexOf("wx-modal-header", StringComparison.Ordinal);
            var content = html.IndexOf("wx-modal-content", StringComparison.Ordinal);
            var footer = html.IndexOf("wx-modal-footer", StringComparison.Ordinal);

            Assert.True(header >= 0 && header < content, "the title bar comes first");
            Assert.True(content < footer, "the writing surface comes before the bar that comments on it");
        }

        /// <summary>
        /// Tests that the writing surface asks for the whole content area and carries no caption:
        /// the title is already on the dialog's title bar, so there is nothing left for a label to
        /// distinguish the body from.
        /// </summary>
        [Fact]
        public void TheBodyFillsAndCarriesNoLabel()
        {
            // arrange
            var control = CreateControl();

            // act
            var html = Render(control);
            var content = Section(html, "wx-modal-content", "wx-modal-footer");

            // validation
            Assert.Contains(@"data-fill=""true""", content);
            Assert.Contains(@"name=""Body""", content);
            Assert.DoesNotContain("<label", html);
        }

        /// <summary>
        /// Tests that the title is the dialog's header, so the framework puts it on the title bar
        /// while it stays a field of the form.
        /// </summary>
        [Fact]
        public void TheTitleIsTheDialogHeader()
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
        /// Tests that the indicator carries every attribute the client controller reads. The
        /// controller is mounted on this element and configures itself from it alone, so a missing
        /// attribute is a silently disabled autosave.
        /// </summary>
        [Fact]
        public void TheStateElementCarriesTheControllerConfiguration()
        {
            // arrange
            var control = CreateControl();
            control.Debounce = _ => 250;
            control.MaxDelay = _ => 2500;

            // act
            var html = Render(control);
            var footer = Section(html, "wx-modal-footer");

            // validation
            Assert.Contains("wx-webapp-editor-form", footer);
            Assert.Contains(@"data-wx-state=""idle""", footer);
            Assert.Contains(@"data-wx-debounce=""250""", footer);
            Assert.Contains(@"data-wx-max-delay=""2500""", footer);
            Assert.Contains(@"data-wx-menu=""editor_menu""", footer);
            Assert.Contains(@"data-wx-discard=""editor_discard""", footer);
        }

        /// <summary>
        /// Tests that the indicator stays in place when the state is turned off. It is the host of
        /// the controller, so dropping it would drop the autosave with it - what "no state" means
        /// is a quiet bar, not a form that loses what was written.
        /// </summary>
        [Fact]
        public void TheStateElementIsHiddenRatherThanDroppedWhenTheStateIsOff()
        {
            // arrange
            var control = CreateControl();
            control.ShowState = _ => false;

            // act
            var html = Render(control);

            // validation
            Assert.Contains(@"class=""wx-webapp-editor-form wx-editor-form-state"" data-wx-state=""idle""", html);
            Assert.Contains(@"data-wx-discard=""editor_discard"" hidden>", html);
        }

        /// <summary>
        /// Tests that the overflow menu carries the discard the control owns, plus the entries the
        /// host added, and that it starts out hidden - the server cannot know whether there is a
        /// draft to act on, so the controller reveals it once the endpoint has answered.
        /// </summary>
        [Fact]
        public void TheMenuCarriesDiscardAndTheHostEntries()
        {
            // arrange
            var control = CreateControl();
            control.MoreItems.Add(new ControlDropdownItemLink("editor_changes") { Text = _ => "Show changes" });

            // act
            var html = Render(control);

            // validation
            Assert.Contains(@"id=""editor_menu""", html);
            Assert.Contains("wx-editor-form-menu-empty", html);
            Assert.Contains(@"id=""editor_changes""", html);
            Assert.Contains(@"id=""editor_discard""", html);
        }

        /// <summary>
        /// Tests that a form without a declared draft service is an ordinary edit dialog: nothing
        /// autosaves, so there is no indicator to host a controller, no draft to discard, and the
        /// submit means save beside the dialog's cancel.
        /// </summary>
        [Fact]
        public void WithoutADraftServiceTheDialogIsAnOrdinaryEditForm()
        {
            // arrange
            var control = new ModalDataEditor("editor")
            {
                ServiceFactory = _ => DataServiceDescriptor.FormData("http://localhost:8080/api/documents")
            };
            control.Title.Name = _ => "Title";
            control.Body.Name = _ => "Body";

            // act
            var html = Render(control);

            // validation
            Assert.DoesNotContain("wx-webapp-editor-form", html);
            Assert.DoesNotContain("wx-editor-form-state", html);
            Assert.DoesNotContain("wx-editor-form-menu", html);
            Assert.DoesNotContain(@"name=""draft""", html);
            Assert.Contains("wx-icon-light-floppy-disk", html);
            Assert.Contains(">Save", html);
        }

        /// <summary>
        /// Tests that turning the draft off is the same surface as never declaring the endpoint. A
        /// host declares its two endpoints once and decides per request which of the two meanings
        /// of save it offers, so the switch has to reach everything the draft brings with it - a
        /// half-drafting surface would autosave into an endpoint nothing can discard from.
        /// </summary>
        [Fact]
        public void DraftOffIsAnOrdinaryEditFormEvenWithTheEndpointDeclared()
        {
            // arrange
            var control = CreateControl();
            control.Draft = _ => false;

            // act
            var html = Render(control);

            // validation
            Assert.DoesNotContain("wx-webapp-editor-form", html);
            Assert.DoesNotContain("wx-editor-form-state", html);
            Assert.DoesNotContain("wx-editor-form-menu", html);
            Assert.DoesNotContain(@"name=""draft""", html);
            Assert.Contains("wx-icon-light-floppy-disk", html);
            Assert.Contains(">Save", html);
        }

        /// <summary>
        /// Tests that the publish label replaces the save label as soon as the surface drafts: the
        /// text was already saved while it was typed, so the button is about the readers rather
        /// than about storage.
        /// </summary>
        [Fact]
        public void WithADraftServiceTheSubmitPublishes()
        {
            // arrange
            var control = CreateControl();

            // act
            var html = Render(control);

            // validation
            Assert.Contains("wx-icon-light-paper-plane", html);
            Assert.Contains(">Publish", html);
            Assert.DoesNotContain(">Save", html);
        }

        /// <summary>
        /// Tests that a shared document wraps only the writing surface. The title bar and the
        /// footer bar stay outside the container, because they are the dialog's rather than the
        /// document's - and the islands stay outside it because the form hydrates from them.
        /// </summary>
        [Fact]
        public void CollaborativeWrapsTheContentAndNothingElse()
        {
            // arrange
            var control = CreateControl();
            control.Collaborative = _ => true;
            control.CollaborationId = _ => "channel";

            // act
            var html = Render(control);
            var host = Section(html, @"<div id=""channel""", "wx-modal-footer");

            // validation
            Assert.Contains("wx-webapp-collaborative", host);
            Assert.Contains("<main", host);
            Assert.Contains(@"data-fill=""true""", host);
            Assert.DoesNotContain("wx-modal-header", host);
            Assert.DoesNotContain("<wx-service", host);
        }

        /// <summary>
        /// Tests that a shared document names the footer slot the collaborative controller docks
        /// its presence bar into. Who is here is a fact about the whole surface, so it belongs on
        /// the bar rather than floating over the first line of what is being written.
        /// </summary>
        [Fact]
        public void CollaborativeDocksThePresenceBarOntoTheFooter()
        {
            // arrange
            var control = CreateControl();
            control.Collaborative = _ => true;

            // act
            var html = Render(control);
            var footer = Section(html, "wx-modal-footer");

            // validation
            Assert.Contains(@"data-collaborative-presence-host=""editor_presence""", html);
            Assert.Contains(@"id=""editor_presence"" class=""wx-editor-form-presence""", footer);
        }

        /// <summary>
        /// Tests that the footer bar reads from the left: who is here, then whether what has been
        /// written is safe, then what else can be done with it. The presence comes first because
        /// it is about the document rather than about the draft.
        /// </summary>
        [Fact]
        public void TheBarReadsPresenceThenStateThenMenu()
        {
            // arrange
            var control = CreateControl();
            control.Collaborative = _ => true;

            // act
            var html = Render(control);
            var footer = Section(html, "wx-modal-footer");

            var presence = footer.IndexOf("wx-editor-form-presence", StringComparison.Ordinal);
            var state = footer.IndexOf("wx-editor-form-state", StringComparison.Ordinal);
            var menu = footer.IndexOf("wx-editor-form-menu", StringComparison.Ordinal);

            // validation
            Assert.True(presence >= 0 && presence < state, "who is here comes first");
            Assert.True(state < menu, "and the save state before the overflow menu");
        }

        /// <summary>
        /// Tests that a shared document that does not draft still shows who is here. The presence
        /// is about the document rather than about the draft, so the two switches are independent.
        /// </summary>
        [Fact]
        public void PresenceSurvivesTurningTheDraftOff()
        {
            // arrange
            var control = CreateControl();
            control.Collaborative = _ => true;
            control.Draft = _ => false;

            // act
            var html = Render(control);

            // validation
            Assert.Contains(@"id=""editor_presence""", html);
            Assert.DoesNotContain("wx-editor-form-state", html);
        }
    }
}
