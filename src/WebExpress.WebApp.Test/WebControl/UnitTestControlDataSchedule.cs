using System;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the api schedule control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataSchedule
    {
        /// <summary>
        /// Tests the id property of the api schedule control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-schedule"" role=""region""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-schedule"" role=""region""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataSchedule(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the view configuration inherited from the static schedule
        /// is emitted by the data-driven one as well, because the client reads
        /// the same contract in both.
        /// </summary>
        [Fact]
        public void ViewConfiguration_IsInherited()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataSchedule("s")
            {
                View = _ => TypeViewSchedule.Week,
                Culture = _ => "de-DE",
                WeekStart = _ => DayOfWeek.Monday,
                IsoWeek = _ => true,
                ShowWeekNumbers = _ => true,
                HourStart = _ => 8,
                HourEnd = _ => 20,
                Editable = _ => true
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                @"<div id=""s"" class=""wx-webapp-schedule"" role=""region"" data-view=""week"" data-culture=""de-DE"" data-week-start=""1"" data-iso-week=""true"" data-week-numbers=""true"" data-hour-start=""8"" data-hour-end=""20"" data-editable=""true""></div>", html);
        }

        /// <summary>
        /// Tests that only the opt-outs of the loading behaviour are emitted,
        /// because the client loads, reloads and caches unless it reads an
        /// explicit "false".
        /// </summary>
        [Theory]
        [InlineData(null, null, null, @"<div id=""*"" class=""wx-webapp-schedule"" role=""region""></div>")]
        [InlineData(true, true, true, @"<div id=""*"" class=""wx-webapp-schedule"" role=""region""></div>")]
        [InlineData(false, null, null, @"<div id=""*"" class=""wx-webapp-schedule"" role=""region"" data-auto-load=""false""></div>")]
        [InlineData(null, false, null, @"<div id=""*"" class=""wx-webapp-schedule"" role=""region"" data-reload-on-navigate=""false""></div>")]
        [InlineData(null, null, false, @"<div id=""*"" class=""wx-webapp-schedule"" role=""region"" data-cache=""false""></div>")]
        [InlineData(false, false, false, @"<div id=""*"" class=""wx-webapp-schedule"" role=""region"" data-auto-load=""false"" data-reload-on-navigate=""false"" data-cache=""false""></div>")]
        public void LoadingBehaviour(bool? autoLoad, bool? reloadOnNavigate, bool? cache, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataSchedule()
            {
                AutoLoad = autoLoad is null ? null : _ => autoLoad.Value,
                ReloadOnNavigate = reloadOnNavigate is null ? null : _ => reloadOnNavigate.Value,
                Cache = cache is null ? null : _ => cache.Value
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that only a positive refresh interval is emitted, since a zero
        /// or negative one carries no schedule the client could poll on.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-schedule"" role=""region""></div>")]
        [InlineData(0, @"<div id=""*"" class=""wx-webapp-schedule"" role=""region""></div>")]
        [InlineData(-5, @"<div id=""*"" class=""wx-webapp-schedule"" role=""region""></div>")]
        [InlineData(60, @"<div id=""*"" class=""wx-webapp-schedule"" role=""region"" data-refresh-interval=""60""></div>")]
        public void RefreshInterval(int? interval, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataSchedule()
            {
                RefreshInterval = _ => interval
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the holiday region and the CRUD affordances.
        /// </summary>
        [Theory]
        [InlineData(null, false, false, @"<div id=""*"" class=""wx-webapp-schedule"" role=""region""></div>")]
        [InlineData("BY", false, false, @"<div id=""*"" class=""wx-webapp-schedule"" role=""region"" data-holiday-region=""BY""></div>")]
        [InlineData("BY", true, true, @"<div id=""*"" class=""wx-webapp-schedule"" role=""region"" data-holiday-region=""BY"" data-creatable=""true"" data-deletable=""true""></div>")]
        public void Crud(string region, bool creatable, bool deletable, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataSchedule()
            {
                HolidayRegion = region is null ? null : _ => region,
                Creatable = _ => creatable,
                Deletable = _ => deletable
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that statically added items are rendered as descriptors, which
        /// is what makes them the fallback the schedule shows until the endpoint
        /// answers.
        /// </summary>
        [Fact]
        public void StaticItems_RenderAsFallbackDescriptors()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataSchedule("s");

            control.Add(new ControlScheduleItem("a")
            {
                Title = _ => "Quest",
                Start = _ => new DateTime(2026, 8, 12, 10, 0, 0)
            });

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                @"<div id=""s"" class=""wx-webapp-schedule"" role=""region"">"
                + @"<div id=""a"" class=""wx-schedule-item"" data-title=""Quest"" data-start=""2026-08-12T10:00:00""></div>"
                + @"</div>", html);
        }
    }
}
