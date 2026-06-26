using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebInclude;

namespace WebExpress.WebApp.Test.WebInclude
{
    /// <summary>
    /// Verifies that the scrum team workload model module is shipped and
    /// registered correctly. The pure helpers in
    /// webexpress.webapp.scrum.team.model.js must be embedded as a resource and
    /// registered through an Asset attribute on IncludeJavaScript before the team
    /// control that consumes them. This guards the build pipeline part of the
    /// control without executing any JavaScript.
    /// </summary>
    public class UnitTestScrumTeamModelAsset
    {
        private const string Model = "/assets/js/webexpress.webapp.scrum.team.model.js";
        private const string Team = "/assets/js/webexpress.webapp.scrum.team.js";

        /// <summary>
        /// Reads the ordered list of Asset paths declared on IncludeJavaScript.
        /// </summary>
        /// <returns>The ordered list of asset paths.</returns>
        private static List<string> GetAssetOrder()
        {
            return typeof(IncludeJavaScript)
                .GetCustomAttributesData()
                .Where(x => x.AttributeType.Name == "AssetAttribute")
                .Select(x => x.ConstructorArguments.FirstOrDefault().Value as string)
                .Where(x => x is not null)
                .ToList();
        }

        /// <summary>
        /// Tests that the scrum team model module is registered through an Asset
        /// attribute on IncludeJavaScript.
        /// </summary>
        [Fact]
        public void Registered()
        {
            Assert.Contains(Model, GetAssetOrder());
        }

        /// <summary>
        /// Tests that the scrum team model module loads before the team control,
        /// so that the control can use it at instantiation time.
        /// </summary>
        [Fact]
        public void LoadsBeforeTheTeamControl()
        {
            var order = GetAssetOrder();

            int model = order.IndexOf(Model);
            int team = order.IndexOf(Team);

            Assert.True(model >= 0, "the scrum team model must be registered");
            Assert.True(team >= 0, "the scrum team control must be registered");
            Assert.True(model < team, "the scrum team model must load before the team control");
        }

        /// <summary>
        /// Tests that the scrum team model module is embedded as a resource in the
        /// WebExpress.WebApp assembly, so that it actually ships.
        /// </summary>
        [Fact]
        public void Embedded()
        {
            var suffix = Model.Substring("/assets/".Length).Replace('/', '.');
            var resources = typeof(IncludeJavaScript).Assembly.GetManifestResourceNames();

            Assert.Contains(resources, x => x.Replace('\\', '.').Replace('/', '.').EndsWith(suffix, StringComparison.Ordinal));
        }
    }
}
