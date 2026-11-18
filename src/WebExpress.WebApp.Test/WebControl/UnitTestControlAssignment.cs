using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the assignment control. The control renders the row on the server already, so
    /// the page shows the assignee before and without the client-side
    /// <c>webexpress.webapp.AssignmentCtrl</c>.
    /// </summary>
    public class UnitTestControlAssignment
    {
        private static readonly RestApiAssignmentItem Grace = new() { Id = "u1", Name = "Grace Hopper" };
        private static readonly RestApiAssignmentItem Ada = new() { Id = "u2", Name = "Ada Lovelace", Image = "/img/ada.png" };

        /// <summary>
        /// Renders a control in a fresh test context.
        /// </summary>
        /// <param name="control">The control.</param>
        /// <returns>The rendered html without the line breaks of the pretty printer.</returns>
        private static string Render(ControlDataAssignment control)
        {
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);

            return AssertExtensions.RemoveLineBreaks(control.Render(context, visualTree)?.ToString());
        }

        /// <summary>
        /// Tests that an unassigned object renders the empty circle and the placeholder, so
        /// the row is never blank.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-assignment wx-assignment-empty""><span class=""wx-assignment-avatar"" aria-hidden=""true""></span><span class=""wx-assignment-text"" aria-live=""polite""><span class=""wx-assignment-caption"">Assignee</span><span class=""wx-assignment-name"">Unassigned</span></span></div>")]
        [InlineData("a1", @"<div id=""a1"" class=""wx-webapp-assignment wx-assignment-empty""><span class=""wx-assignment-avatar"" aria-hidden=""true""></span><span class=""wx-assignment-text"" aria-live=""polite""><span class=""wx-assignment-caption"">Assignee</span><span class=""wx-assignment-name"">Unassigned</span></span></div>")]
        public void Unassigned_RendersPlaceholder(string id, string expected)
        {
            // act
            var html = Render(new ControlDataAssignment(id));

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that an assignee without a portrait renders the initials derived from the
        /// name and the name as text, and that no state island is emitted without a seed of
        /// the right to change.
        /// </summary>
        [Fact]
        public void Assigned_RendersInitialsAndName()
        {
            // act
            var html = Render(new ControlDataAssignment()
            {
                Assignee = _ => Grace
            });

            // validation
            Assert.Contains(@"<span class=""wx-assignment-avatar"" aria-hidden=""true"">GH</span>", html);
            Assert.Contains(@"<span class=""wx-assignment-name"">Grace Hopper</span>", html);
            Assert.DoesNotContain("wx-assignment-empty", html);
            Assert.DoesNotContain("wx-assignment-action", html);
        }

        /// <summary>
        /// Tests that a portrait replaces the initials and stays decorative.
        /// </summary>
        [Fact]
        public void Assigned_RendersPortrait()
        {
            // act
            var html = Render(new ControlDataAssignment()
            {
                Assignee = _ => Ada
            });

            // validation
            Assert.Contains(@"<span class=""wx-assignment-avatar"" aria-hidden=""true""><img src=""/img/ada.png"" alt></span>", html);
            Assert.Contains(@"<span class=""wx-assignment-name"">Ada Lovelace</span>", html);
        }

        /// <summary>
        /// Tests that a name is rendered as text, not as markup.
        /// </summary>
        [Fact]
        public void Assigned_EncodesTheName()
        {
            // act
            var html = Render(new ControlDataAssignment()
            {
                Assignee = _ => new RestApiAssignmentItem() { Id = "x", Name = "<b>Eve</b>" }
            });

            // validation
            Assert.Contains("&lt;b&gt;Eve&lt;/b&gt;", html);
            Assert.DoesNotContain("<b>", html);
        }

        /// <summary>
        /// Tests that a viewer who may change the assignment and is not the assignee gets
        /// "assign to me", and the assignee gets "unassign".
        /// </summary>
        /// <param name="selfIsAssignee">Whether the viewer is the assignee.</param>
        /// <param name="action">The expected action.</param>
        /// <param name="text">The expected text.</param>
        [Theory]
        [InlineData(false, "assign", "Assign to me")]
        [InlineData(true, "unassign", "Unassign")]
        public void MayChange_RendersThePrimaryAction(bool selfIsAssignee, string action, string text)
        {
            // act
            var html = Render(new ControlDataAssignment()
            {
                Assignee = _ => Grace,
                Self = _ => selfIsAssignee ? Grace : Ada,
                MayChange = _ => true
            });

            // validation
            Assert.Contains(@"<span class=""wx-assignment-actions""><button type=""button"" class=""wx-assignment-action"" data-wx-assignment-action=""" + action + @""">", html);
            Assert.Contains("<span>" + text + "</span></button>", html);
            Assert.Single(html.Split("<button").Skip(1));
        }

        /// <summary>
        /// Tests that the icon of an action is hidden from assistive technology, so the text
        /// alone names the button.
        /// </summary>
        [Fact]
        public void Action_HidesTheIcon()
        {
            // act
            var html = Render(new ControlDataAssignment()
            {
                Self = _ => Ada,
                MayChange = _ => true
            });

            // validation
            Assert.Matches(@"<button[^>]*><i [^>]*aria-hidden=""true""[^>]*></i><span>Assign to me</span></button>", html);
        }

        /// <summary>
        /// Tests that the row offers no action without the right, read-only or without a
        /// known viewer and search.
        /// </summary>
        /// <param name="mayChange">The right to change.</param>
        /// <param name="readOnly">The read-only flag.</param>
        /// <param name="withSelf">Whether the viewer is known.</param>
        [Theory]
        [InlineData(false, false, true)]
        [InlineData(true, true, true)]
        [InlineData(true, false, false)]
        public void NoRightOrReadonly_RendersNoAction(bool mayChange, bool readOnly, bool withSelf)
        {
            // act
            var html = Render(new ControlDataAssignment()
            {
                Assignee = _ => Grace,
                Self = withSelf ? _ => Ada : null,
                MayChange = _ => mayChange,
                Readonly = _ => readOnly
            });

            // validation
            Assert.DoesNotContain("wx-assignment-actions", html);
            Assert.Equal(readOnly, html.Contains(@"data-readonly=""true"""));
        }

        /// <summary>
        /// Tests that the overridden texts replace the defaults and travel to the client.
        /// </summary>
        [Fact]
        public void Texts_OverrideTheDefaults()
        {
            // act
            var html = Render(new ControlDataAssignment()
            {
                Self = _ => Ada,
                MayChange = _ => true,
                Caption = _ => "Owner",
                Placeholder = _ => "Nobody yet",
                AssignToMeText = _ => "Take it",
                UnassignText = _ => "Drop it",
                AssignToText = _ => "Hand over"
            }
                .UsersService<FakeEndpoint>());

            // validation
            Assert.Contains(@"<span class=""wx-assignment-caption"">Owner</span>", html);
            Assert.Contains(@"<span class=""wx-assignment-name"">Nobody yet</span>", html);
            Assert.Contains("<span>Take it</span>", html);
            Assert.Contains("<span>Hand over</span>", html);
            Assert.Contains(@"data-caption=""Owner""", html);
            Assert.Contains(@"data-placeholder=""Nobody yet""", html);
            Assert.Contains(@"data-assign-to-me=""Take it""", html);
            Assert.Contains(@"data-unassign=""Drop it""", html);
            Assert.Contains(@"data-assign-to=""Hand over""", html);
        }

        /// <summary>
        /// Tests that the data service is emitted as the data island.
        /// </summary>
        [Fact]
        public void DataService_EmitsTheIsland()
        {
            // act
            var html = Render(new ControlDataAssignment()
            {
                ServiceFactory = _ => DataServiceDescriptor.Data("https://example.com/api/assignment/INC-1")
            });

            // validation
            Assert.StartsWith(@"<div class=""wx-webapp-assignment wx-assignment-empty""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/assignment/INC-1"" method=""GET"" update-method=""PUT""></wx-service><span class=""wx-assignment-avatar""", html);
            Assert.DoesNotContain(@"data-wx-assignment-action=""pick""", html);
        }

        /// <summary>
        /// Tests that a bound users service adds the "assign to" action beside the primary
        /// one, and stands alone for a viewer who is not known.
        /// </summary>
        /// <param name="withSelf">Whether the viewer is known.</param>
        /// <param name="buttons">The expected number of actions.</param>
        [Theory]
        [InlineData(true, 2)]
        [InlineData(false, 1)]
        public void UsersService_AddsThePickAction(bool withSelf, int buttons)
        {
            // act
            var html = Render(new ControlDataAssignment()
            {
                Self = withSelf ? _ => Ada : null,
                MayChange = _ => true,
                ServiceFactories =
                {
                    _ => DataServiceDescriptor.Data("https://example.com/api/assignment/INC-1"),
                    _ => DataServiceDescriptor.Rest("users").WithBaseUri("https://example.com/api/users").WithMethod("GET")
                }
            });

            // validation
            Assert.Contains(@"<wx-service hidden name=""users"" kind=""rest"" base-uri=""https://example.com/api/users"" method=""GET""></wx-service>", html);
            Assert.Contains(@"data-wx-assignment-action=""pick""", html);
            Assert.Contains("<span>Assign to …</span>", html);
            Assert.Equal(buttons, html.Split("<button").Length - 1);
        }

        /// <summary>
        /// Tests that a seeded row carries its state as the wx-state island, so the client
        /// renders without a first request.
        /// </summary>
        [Fact]
        public void Seed_EmitsTheStateIsland()
        {
            // act
            var html = Render(new ControlDataAssignment()
            {
                Assignee = _ => Grace,
                Self = _ => Ada,
                MayChange = _ => true
            });

            // validation
            Assert.Contains("<wx-state hidden>", html);
            Assert.Contains(@"<wx-prop name=""assignee"" type=""json"">{&quot;id&quot;:&quot;u1&quot;,&quot;name&quot;:&quot;Grace Hopper&quot;,&quot;image&quot;:null,&quot;initials&quot;:null}</wx-prop>", html);
            Assert.Contains(@"<wx-prop name=""self"" type=""json"">", html);
            Assert.Contains(@"<wx-prop name=""mayChange"" type=""boolean"">true</wx-prop>", html);
        }

        /// <summary>
        /// Tests that a row without a seed emits no state island, so the client loads the
        /// state itself.
        /// </summary>
        [Fact]
        public void NoSeed_EmitsNoStateIsland()
        {
            // act
            var html = Render(new ControlDataAssignment());

            // validation
            Assert.DoesNotContain("wx-state", html);
        }

        /// <summary>
        /// Tests that a row bound to a ViewState resource emits the resource and the users
        /// binding instead of its service islands, because the ViewState owns the services
        /// and the central load, while the row and the seed are still rendered.
        /// </summary>
        [Fact]
        public void ViewStateBound_EmitsResourceAndUsersBinding_NotServices()
        {
            // act
            var html = Render(new ControlDataAssignment()
            {
                Assignee = _ => Grace,
                Self = _ => Ada,
                MayChange = _ => true,
                // even with services declared, the resource binding wins
                ServiceFactories =
                {
                    _ => DataServiceDescriptor.Data("https://example.com/api/assignment/INC-1"),
                    _ => DataServiceDescriptor.Rest("users").WithBaseUri("https://example.com/api/users").WithMethod("GET")
                },
                ResourceFactory = _ => "assignee",
                UsersFactory = _ => "users"
            });

            // validation
            Assert.StartsWith(@"<div class=""wx-webapp-assignment"" data-wx-resource=""assignee"" data-wx-users=""users""><wx-state hidden>", html);
            Assert.DoesNotContain("wx-service", html);
            Assert.Contains(@"<span class=""wx-assignment-name"">Grace Hopper</span>", html);
            Assert.Contains(@"data-wx-assignment-action=""assign""", html);
            Assert.Contains(@"data-wx-assignment-action=""pick""", html);
        }

        /// <summary>
        /// Tests that a bound row offers the search through the ViewState users binding alone,
        /// without an island of its own.
        /// </summary>
        [Fact]
        public void ViewStateBound_UsersBindingAloneAddsThePickAction()
        {
            // act
            var html = Render(new ControlDataAssignment()
            {
                MayChange = _ => true,
                ResourceFactory = _ => "assignee",
                UsersFactory = _ => "users"
            });

            // validation
            Assert.Contains(@"data-wx-assignment-action=""pick""", html);
        }

        /// <summary>
        /// Tests that the fluent <c>Resource&lt;TResource&gt;()</c> binding sets the resource
        /// factory to the resource type name and preserves the concrete control type.
        /// </summary>
        [Fact]
        public void Resource_BindsByType_PreservingConcreteType()
        {
            // arrange & act: the assignment compiles only because the typed overload returns the
            // concrete control type rather than IViewStateBound
            ControlDataAssignment control = new ControlDataAssignment("assignee").Resource<AssigneeTestResource>();

            // validation
            Assert.Equal(DataTypeName.Of<AssigneeTestResource>(), control.ResourceFactory(null));
        }

        /// <summary>
        /// Tests that a disabled control renders nothing.
        /// </summary>
        [Fact]
        public void Enable_False_RendersNothing()
        {
            // act
            var html = Render(new ControlDataAssignment()
            {
                Enable = _ => false
            });

            // validation
            Assert.Null(html);
        }

        /// <summary>
        /// Tests the initials of a name.
        /// </summary>
        /// <param name="name">The name.</param>
        /// <param name="expected">The expected initials.</param>
        [Theory]
        [InlineData("Grace Hopper", "GH")]
        [InlineData("grace", "G")]
        [InlineData("Murray the Demonic Skull", "MT")]
        [InlineData("", "")]
        [InlineData(null, "")]
        public void InitialsOf(string name, string expected)
        {
            Assert.Equal(expected, ControlDataAssignment.InitialsOf(name));
        }

        /// <summary>
        /// A marker endpoint for the preset test.
        /// </summary>
        private sealed class FakeEndpoint : WebExpress.WebCore.WebEndpoint.IEndpoint
        {
        }

        /// <summary>
        /// A resource identity used only by the binding test.
        /// </summary>
        private sealed class AssigneeTestResource : IDataResource
        {
        }
    }
}
