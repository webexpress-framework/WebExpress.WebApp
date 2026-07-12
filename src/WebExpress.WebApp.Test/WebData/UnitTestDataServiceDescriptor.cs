using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebParameter;

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

        /// <summary>
        /// Tests that the declared domains are emitted as one semicolon joined
        /// attribute and that duplicates merge, which is the shape the client
        /// ViewState subscribes for live data updates.
        /// </summary>
        [Fact]
        public void DomainsAreEmittedWhenSet()
        {
            var island = DataServiceDescriptor.Rest("data")
                .WithBaseUri("/api/x")
                .WithDomain("my.app.order")
                .WithDomain("my.app.customer")
                .WithDomain("my.app.order")
                .ToIslandElement()
                .ToString();

            Assert.Contains("domains=\"my.app.order;my.app.customer\"", island);
        }

        /// <summary>
        /// Tests that a service without domains omits the attribute, so a
        /// ViewState with such a service stays detached from the message queue.
        /// </summary>
        [Fact]
        public void DomainsAreOmittedByDefault()
        {
            var island = DataServiceDescriptor.Rest("data").WithBaseUri("/api/x").ToIslandElement().ToString();

            Assert.DoesNotContain("domains", island);
        }

        /// <summary>
        /// Tests that a base address keyed by a route parameter expands its
        /// ${name} placeholder to the value of the matching request parameter, so
        /// a table on a class detail page targets the concrete resource of that
        /// class rather than the literal placeholder the sitemap leaves behind.
        /// </summary>
        [Fact]
        public void BindPathVariablesExpandsAMatchingRouteParameter()
        {
            var request = CreateRequestWith(new Parameter("classid", "41bf8ef5-03b8-4ccd-8666-83d91450abc5", ParameterScope.Url));

            var island = DataServiceDescriptor.TableData("/api/1/fields/${classid}/table")
                .BindPathVariables(request)
                .ToIslandElement()
                .ToString();

            Assert.Contains("base-uri=\"/api/1/fields/41bf8ef5-03b8-4ccd-8666-83d91450abc5/table\"", island);
        }

        /// <summary>
        /// Tests that a placeholder whose name the request does not carry is left
        /// untouched, so a genuine misconfiguration stays visible instead of
        /// silently producing a wrong url and a value the client fills per call is
        /// preserved.
        /// </summary>
        [Fact]
        public void BindPathVariablesLeavesAnUnmatchedPlaceholder()
        {
            var request = CreateRequestWith(new Parameter("workspacekey", "acme", ParameterScope.Url));

            var descriptor = DataServiceDescriptor.TableData("/api/1/fields/${classid}/table")
                .BindPathVariables(request);

            Assert.Equal("/api/1/fields/${classid}/table", descriptor.BaseUri);
        }

        /// <summary>
        /// Tests that the placeholder lookup is case insensitive, because the
        /// placeholder carries the segment's variable name in its declared casing
        /// while the request stores the route parameter key in lower case.
        /// </summary>
        [Fact]
        public void BindPathVariablesMatchesCaseInsensitively()
        {
            var request = CreateRequestWith(new Parameter("classid", "41bf8ef5-03b8-4ccd-8666-83d91450abc5", ParameterScope.Url));

            var descriptor = DataServiceDescriptor.TableData("/api/1/fields/${ClassId}/table")
                .BindPathVariables(request);

            Assert.Equal("/api/1/fields/41bf8ef5-03b8-4ccd-8666-83d91450abc5/table", descriptor.BaseUri);
        }

        /// <summary>
        /// Tests that a static base address carries no placeholder and is returned
        /// unchanged, which is the workspace table shape that already worked, so
        /// the fix stays free of regressions on the common case.
        /// </summary>
        [Fact]
        public void BindPathVariablesIsANoOpForAStaticUri()
        {
            var request = CreateRequestWith(new Parameter("classid", "41bf8ef5-03b8-4ccd-8666-83d91450abc5", ParameterScope.Url));

            var descriptor = DataServiceDescriptor.TableData("/api/1/workspaces/table")
                .BindPathVariables(request);

            Assert.Equal("/api/1/workspaces/table", descriptor.BaseUri);
        }

        /// <summary>
        /// Tests that a null request leaves the placeholder in place, so an
        /// emission without a request context, for example in a test, stays safe.
        /// </summary>
        [Fact]
        public void BindPathVariablesToleratesAMissingRequest()
        {
            var descriptor = DataServiceDescriptor.TableData("/api/1/fields/${classid}/table")
                .BindPathVariables((IRequest)null);

            Assert.Equal("/api/1/fields/${classid}/table", descriptor.BaseUri);
        }

        /// <summary>
        /// Tests that a placeholder can be bound manually to an explicit value the
        /// current request does not carry, which is the case an author who knows
        /// the value at render time needs.
        /// </summary>
        [Fact]
        public void BindPathVariableBindsAnExplicitValue()
        {
            var descriptor = DataServiceDescriptor.TableData("/api/1/fields/${classid}/table")
                .BindPathVariable("classid", "41bf8ef5-03b8-4ccd-8666-83d91450abc5");

            Assert.Equal("/api/1/fields/41bf8ef5-03b8-4ccd-8666-83d91450abc5/table", descriptor.BaseUri);
        }

        /// <summary>
        /// Tests that several placeholders can be bound manually in one pass from a
        /// name to value map.
        /// </summary>
        [Fact]
        public void BindPathVariablesBindsExplicitValuesFromAMap()
        {
            var descriptor = DataServiceDescriptor.TableData("/api/1/${workspace}/fields/${classid}/table")
                .BindPathVariables(new Dictionary<string, string>
                {
                    ["workspace"] = "acme",
                    ["classid"] = "41bf8ef5-03b8-4ccd-8666-83d91450abc5"
                });

            Assert.Equal("/api/1/acme/fields/41bf8ef5-03b8-4ccd-8666-83d91450abc5/table", descriptor.BaseUri);
        }

        /// <summary>
        /// Tests that a manual binding composes with the request binding: the
        /// author binds the placeholder the request does not carry and the
        /// emission binds the rest from the request, so both placeholders resolve.
        /// </summary>
        [Fact]
        public void BindPathVariableComposesWithTheRequestBinding()
        {
            var request = CreateRequestWith(new Parameter("classid", "41bf8ef5-03b8-4ccd-8666-83d91450abc5", ParameterScope.Url));

            var descriptor = DataServiceDescriptor.TableData("/api/1/${workspace}/fields/${classid}/table")
                .BindPathVariable("workspace", "acme")
                .BindPathVariables(request);

            Assert.Equal("/api/1/acme/fields/41bf8ef5-03b8-4ccd-8666-83d91450abc5/table", descriptor.BaseUri);
        }

        /// <summary>
        /// Tests that a manual binding takes precedence over a request parameter of
        /// the same name, because it runs first and removes the placeholder it
        /// fills, so the later request binding finds nothing to overwrite.
        /// </summary>
        [Fact]
        public void ManualBindingTakesPrecedenceOverTheRequest()
        {
            var request = CreateRequestWith(new Parameter("classid", "from-request", ParameterScope.Url));

            var descriptor = DataServiceDescriptor.TableData("/api/1/fields/${classid}/table")
                .BindPathVariable("classid", "from-author")
                .BindPathVariables(request);

            Assert.Equal("/api/1/fields/from-author/table", descriptor.BaseUri);
        }

        /// <summary>
        /// Builds a request that carries the given parameters, used to bind the
        /// route placeholders of a base address.
        /// </summary>
        /// <param name="parameters">The parameters the request carries.</param>
        /// <returns>The request.</returns>
        private static IRequest CreateRequestWith(params Parameter[] parameters)
        {
            var request = UnitTestControlFixture.CreateRequestMock();
            request.AddParameter(parameters);

            return request;
        }
    }
}
