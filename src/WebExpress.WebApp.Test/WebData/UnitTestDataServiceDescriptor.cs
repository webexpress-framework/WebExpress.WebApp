using WebExpress.WebApp.WebData;

namespace WebExpress.WebApp.Test.WebData
{
    /// <summary>
    /// Tests the C# service descriptor that serializes into the data-wx-service
    /// island. This is the first C# artifact of the View, State and Service
    /// architecture, so the test pins the island shape that the JavaScript
    /// ServiceRegistry consumes, in particular that it matches the JavaScript
    /// legacyDescriptor fallback of the list control.
    /// </summary>
    public class UnitTestDataServiceDescriptor
    {
        /// <summary>
        /// Tests that the list data descriptor serializes into exactly the island
        /// that mirrors webexpress.webapp.listModel.legacyDescriptor.
        /// </summary>
        [Fact]
        public void ListDataIslandMatchesTheLegacyDescriptor()
        {
            var json = DataServiceDescriptor.ListData("/api/orders").ToIsland();

            Assert.Equal(
                "{\"name\":\"data\",\"kind\":\"rest\",\"baseUri\":\"/api/orders\",\"method\":\"GET\"," +
                "\"query\":{\"search\":\"q\",\"wql\":\"wql\",\"filter\":\"f\",\"page\":\"p\",\"pageSize\":\"l\",\"orderBy\":\"o\",\"orderDir\":\"d\"}," +
                "\"response\":{\"items\":\"items\",\"total\":\"total\"}}",
                json);
        }

        /// <summary>
        /// Tests that the table data descriptor serializes into exactly the
        /// island that mirrors webexpress.webapp.tableModel.legacyDescriptor,
        /// including the put update method and the rows response key.
        /// </summary>
        [Fact]
        public void TableDataIslandMatchesTheLegacyDescriptor()
        {
            var json = DataServiceDescriptor.TableData("/api/orders").ToIsland();

            Assert.Equal(
                "{\"name\":\"data\",\"kind\":\"rest\",\"baseUri\":\"/api/orders\",\"method\":\"GET\",\"updateMethod\":\"PUT\"," +
                "\"query\":{\"search\":\"q\",\"wql\":\"wql\",\"filter\":\"f\",\"page\":\"p\",\"pageSize\":\"l\",\"orderBy\":\"o\",\"orderDir\":\"d\"}," +
                "\"response\":{\"rows\":\"rows\",\"total\":\"total\"}}",
                json);
        }

        /// <summary>
        /// Tests that the common data descriptor (load with GET, persist with
        /// PUT, no query or response mapping) serializes into the shape the
        /// kanban, tile, dashboard, comment, scrum backlog and workflow controls
        /// share.
        /// </summary>
        [Fact]
        public void DataIslandIsTheCommonGetPutShape()
        {
            var json = DataServiceDescriptor.Data("/api/x").ToIsland();

            Assert.Equal("{\"name\":\"data\",\"kind\":\"rest\",\"baseUri\":\"/api/x\",\"method\":\"GET\",\"updateMethod\":\"PUT\"}", json);
        }

        /// <summary>
        /// Tests that the tab data descriptor serializes into exactly the island
        /// that mirrors webexpress.webapp.tabModel.legacyDescriptor, with the id
        /// query mapping and the items response mapping.
        /// </summary>
        [Fact]
        public void TabDataIslandMatchesTheLegacyDescriptor()
        {
            var json = DataServiceDescriptor.TabData("/api/tabs").ToIsland();

            Assert.Equal(
                "{\"name\":\"data\",\"kind\":\"rest\",\"baseUri\":\"/api/tabs\",\"method\":\"GET\",\"updateMethod\":\"PUT\"," +
                "\"query\":{\"id\":\"id\"},\"response\":{\"items\":\"items\"}}",
                json);
        }

        /// <summary>
        /// Tests that a minimal rest descriptor omits the empty query, response
        /// and update method parts so the island stays compact.
        /// </summary>
        [Fact]
        public void RestOmitsEmptyParts()
        {
            var json = DataServiceDescriptor.Rest("data")
                .WithBaseUri("/api/x")
                .WithMethod("GET")
                .ToIsland();

            Assert.Equal("{\"name\":\"data\",\"kind\":\"rest\",\"baseUri\":\"/api/x\",\"method\":\"GET\"}", json);
        }

        /// <summary>
        /// Tests that the update method is emitted when it is set, which the tab,
        /// kanban and table services use for their put updates.
        /// </summary>
        [Fact]
        public void UpdateMethodIsEmittedWhenSet()
        {
            var json = DataServiceDescriptor.Rest("data")
                .WithBaseUri("/api/x")
                .WithMethod("GET")
                .WithUpdateMethod("PUT")
                .ToIsland();

            Assert.Equal("{\"name\":\"data\",\"kind\":\"rest\",\"baseUri\":\"/api/x\",\"method\":\"GET\",\"updateMethod\":\"PUT\"}", json);
        }

        /// <summary>
        /// Tests that a missing base uri serializes as an empty string rather than
        /// a null, so the JavaScript RestService always has a usable base.
        /// </summary>
        [Fact]
        public void MissingBaseUriBecomesEmptyString()
        {
            var json = DataServiceDescriptor.Rest("data").WithMethod("GET").ToIsland();

            Assert.Equal("{\"name\":\"data\",\"kind\":\"rest\",\"baseUri\":\"\",\"method\":\"GET\"}", json);
        }
    }
}
