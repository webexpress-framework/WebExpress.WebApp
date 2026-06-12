using WebExpress.WebApp.WebData;

namespace WebExpress.WebApp.Test.WebData
{
    /// <summary>
    /// Tests the C# service descriptor that renders into the wx-service island
    /// element. The test pins the island shape that the JavaScript
    /// ServiceRegistry consumes: the scalar parts as attributes and the query,
    /// response, header and error mappings as child elements.
    /// </summary>
    public class UnitTestDataServiceDescriptor
    {
        /// <summary>
        /// Tests that the list data descriptor renders the historical list
        /// query and response names as mapping elements.
        /// </summary>
        [Fact]
        public void ListDataIslandCarriesTheListMappings()
        {
            var island = DataServiceDescriptor.ListData("/api/orders").ToIslandElement().ToString();

            Assert.Contains("<wx-service hidden name=\"data\" kind=\"rest\" base-uri=\"/api/orders\" method=\"GET\">", island);
            Assert.Contains("<wx-query name=\"search\" wire=\"q\"></wx-query>", island);
            Assert.Contains("<wx-query name=\"pageSize\" wire=\"l\"></wx-query>", island);
            Assert.Contains("<wx-response name=\"items\" wire=\"items\"></wx-response>", island);
            Assert.Contains("<wx-response name=\"total\" wire=\"total\"></wx-response>", island);
        }

        /// <summary>
        /// Tests that the table data descriptor carries the put update method
        /// and the rows response key.
        /// </summary>
        [Fact]
        public void TableDataIslandCarriesTheTableMappings()
        {
            var island = DataServiceDescriptor.TableData("/api/orders").ToIslandElement().ToString();

            Assert.Contains("update-method=\"PUT\"", island);
            Assert.Contains("<wx-response name=\"rows\" wire=\"rows\"></wx-response>", island);
        }

        /// <summary>
        /// Tests that the common data descriptor (load with GET, persist with
        /// PUT, no query or response mapping) renders the shape the kanban,
        /// tile, dashboard, comment, scrum backlog and workflow controls share.
        /// </summary>
        [Fact]
        public void DataIslandIsTheCommonGetPutShape()
        {
            var island = DataServiceDescriptor.Data("/api/x").ToIslandElement().ToString();

            Assert.Contains("<wx-service hidden name=\"data\" kind=\"rest\" base-uri=\"/api/x\" method=\"GET\" update-method=\"PUT\">", island);
            Assert.DoesNotContain("<wx-query", island);
            Assert.DoesNotContain("<wx-response", island);
        }

        /// <summary>
        /// Tests that the tab data descriptor carries the id query mapping and
        /// the items response mapping.
        /// </summary>
        [Fact]
        public void TabDataIslandCarriesTheTabMappings()
        {
            var island = DataServiceDescriptor.TabData("/api/tabs").ToIslandElement().ToString();

            Assert.Contains("<wx-query name=\"id\" wire=\"id\"></wx-query>", island);
            Assert.Contains("<wx-response name=\"items\" wire=\"items\"></wx-response>", island);
        }

        /// <summary>
        /// Tests that a minimal rest descriptor omits the empty query, response
        /// and update method parts so the island stays compact.
        /// </summary>
        [Fact]
        public void RestOmitsEmptyParts()
        {
            var island = DataServiceDescriptor.Rest("data")
                .WithBaseUri("/api/x")
                .WithMethod("GET")
                .ToIslandElement()
                .ToString();

            Assert.Contains("<wx-service hidden name=\"data\" kind=\"rest\" base-uri=\"/api/x\" method=\"GET\">", island);
            Assert.DoesNotContain("update-method", island);
            Assert.DoesNotContain("<wx-query", island);
            Assert.DoesNotContain("<wx-response", island);
        }

        /// <summary>
        /// Tests that the update method is emitted when it is set, which the tab,
        /// kanban and table services use for their put updates.
        /// </summary>
        [Fact]
        public void UpdateMethodIsEmittedWhenSet()
        {
            var island = DataServiceDescriptor.Rest("data")
                .WithBaseUri("/api/x")
                .WithMethod("GET")
                .WithUpdateMethod("PUT")
                .ToIslandElement()
                .ToString();

            Assert.Contains("update-method=\"PUT\"", island);
        }

        /// <summary>
        /// Tests that a missing base uri omits the attribute, which the
        /// JavaScript island parser restores as an empty base.
        /// </summary>
        [Fact]
        public void MissingBaseUriOmitsTheAttribute()
        {
            var island = DataServiceDescriptor.Rest("data").WithMethod("GET").ToIslandElement().ToString();

            Assert.DoesNotContain("base-uri", island);
        }

        /// <summary>
        /// Tests that the declared policies, which are the request headers, the
        /// status to message mapping and the retry policy, are emitted in the
        /// island shape that the JavaScript RestService consumes.
        /// </summary>
        [Fact]
        public void PoliciesAreEmittedWhenSet()
        {
            var island = DataServiceDescriptor.Rest("data")
                .WithBaseUri("/api/x")
                .WithMethod("GET")
                .WithHeader("X-Api-Version", "1")
                .MapError(404, "webexpress.webapp:error.notfound")
                .WithRetry(2, 300)
                .ToIslandElement()
                .ToString();

            Assert.Contains("retry-count=\"2\"", island);
            Assert.Contains("retry-delay=\"300\"", island);
            Assert.Contains("<wx-header name=\"X-Api-Version\" value=\"1\"></wx-header>", island);
            Assert.Contains("<wx-error status=\"404\" message=\"webexpress.webapp:error.notfound\"></wx-error>", island);
        }

        /// <summary>
        /// Tests that the policies stay omitted when they are not declared, so
        /// the island keeps its compact shape.
        /// </summary>
        [Fact]
        public void PoliciesAreOmittedByDefault()
        {
            var island = DataServiceDescriptor.Rest("data").WithBaseUri("/api/x").ToIslandElement().ToString();

            Assert.DoesNotContain("wx-header", island);
            Assert.DoesNotContain("wx-error", island);
            Assert.DoesNotContain("retry-count", island);
        }
    }
}
